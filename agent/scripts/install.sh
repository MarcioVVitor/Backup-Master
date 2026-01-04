#!/bin/bash
set -e

# NBM Agent Installation Script for Debian 13
# Usage: sudo ./install.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/nbm-agent"
CONFIG_DIR="/etc/nbm-agent"
LOG_DIR="/var/log/nbm-agent"
SERVICE_USER="nbm-agent"

print_banner() {
    echo -e "${BLUE}"
    echo "======================================"
    echo "  NBM Agent - Network Backup Manager"
    echo "  Installation Script for Debian 13"
    echo "======================================"
    echo -e "${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: This script must be run as root${NC}"
        echo "Please run: sudo $0"
        exit 1
    fi
}

check_debian() {
    if [[ ! -f /etc/debian_version ]]; then
        echo -e "${YELLOW}Warning: This script is designed for Debian systems${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

install_dependencies() {
    echo -e "${GREEN}Installing dependencies...${NC}"
    
    apt-get update -qq
    
    apt-get install -y -qq \
        curl \
        ca-certificates \
        gnupg \
        lsb-release

    if ! command -v node &> /dev/null; then
        echo -e "${GREEN}Installing Node.js 20.x...${NC}"
        
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        
        apt-get update -qq
        apt-get install -y -qq nodejs
    fi
    
    echo -e "${GREEN}Node.js version: $(node --version)${NC}"
    echo -e "${GREEN}npm version: $(npm --version)${NC}"
}

create_user() {
    echo -e "${GREEN}Creating service user...${NC}"
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
        echo -e "${GREEN}Created user: $SERVICE_USER${NC}"
    else
        echo -e "${YELLOW}User $SERVICE_USER already exists${NC}"
    fi
}

create_directories() {
    echo -e "${GREEN}Creating directories...${NC}"
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
}

install_agent() {
    echo -e "${GREEN}Installing NBM Agent...${NC}"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    AGENT_DIR="$(dirname "$SCRIPT_DIR")"
    
    cp -r "$AGENT_DIR/src" "$INSTALL_DIR/"
    cp "$AGENT_DIR/package.json" "$INSTALL_DIR/"
    cp "$AGENT_DIR/tsconfig.json" "$INSTALL_DIR/"
    
    cd "$INSTALL_DIR"
    npm install --production=false --silent
    npm run build
    
    rm -rf "$INSTALL_DIR/src"
    rm -rf "$INSTALL_DIR/node_modules/.cache"
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
}

create_config() {
    echo -e "${GREEN}Creating configuration...${NC}"
    
    if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
        cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "serverUrl": "https://your-nbm-server.example.com",
  "agentToken": "YOUR_AGENT_TOKEN_HERE",
  "agentId": "YOUR_AGENT_ID_HERE",
  "heartbeatInterval": 30000,
  "reconnectInterval": 5000,
  "maxReconnectAttempts": 0,
  "logLevel": "info"
}
EOF
        chmod 600 "$CONFIG_DIR/config.json"
        chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/config.json"
        echo -e "${YELLOW}Configuration file created at $CONFIG_DIR/config.json${NC}"
        echo -e "${YELLOW}Please edit this file with your server details before starting the service${NC}"
    else
        echo -e "${YELLOW}Configuration file already exists, skipping...${NC}"
    fi
}

install_service() {
    echo -e "${GREEN}Installing systemd service...${NC}"
    
    cat > /etc/systemd/system/nbm-agent.service << EOF
[Unit]
Description=NBM Agent - Network Backup Manager Remote Agent
Documentation=https://github.com/your-org/nbm-agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/agent.log
StandardError=append:$LOG_DIR/agent-error.log

Environment=NODE_ENV=production
Environment=NBM_CONFIG_PATH=$CONFIG_DIR/config.json

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=$LOG_DIR

# Resource limits
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    echo -e "${GREEN}Systemd service installed${NC}"
}

setup_logrotate() {
    echo -e "${GREEN}Setting up log rotation...${NC}"
    
    cat > /etc/logrotate.d/nbm-agent << EOF
$LOG_DIR/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $SERVICE_USER $SERVICE_USER
    sharedscripts
    postrotate
        systemctl reload nbm-agent > /dev/null 2>&1 || true
    endscript
}
EOF
}

print_instructions() {
    echo ""
    echo -e "${GREEN}======================================"
    echo "  Installation Complete!"
    echo "======================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo ""
    echo "1. Edit the configuration file:"
    echo -e "   ${BLUE}sudo nano $CONFIG_DIR/config.json${NC}"
    echo ""
    echo "2. Set your NBM server details:"
    echo "   - serverUrl: Your NBM cloud server URL"
    echo "   - agentToken: Token generated from the NBM web interface"
    echo "   - agentId: Agent ID from the NBM web interface"
    echo ""
    echo "3. Start the service:"
    echo -e "   ${BLUE}sudo systemctl start nbm-agent${NC}"
    echo ""
    echo "4. Enable auto-start on boot:"
    echo -e "   ${BLUE}sudo systemctl enable nbm-agent${NC}"
    echo ""
    echo "5. Check service status:"
    echo -e "   ${BLUE}sudo systemctl status nbm-agent${NC}"
    echo ""
    echo "6. View logs:"
    echo -e "   ${BLUE}sudo tail -f $LOG_DIR/agent.log${NC}"
    echo ""
    echo -e "${GREEN}Directories:${NC}"
    echo "  Installation: $INSTALL_DIR"
    echo "  Configuration: $CONFIG_DIR"
    echo "  Logs: $LOG_DIR"
    echo ""
}

main() {
    print_banner
    check_root
    check_debian
    install_dependencies
    create_user
    create_directories
    install_agent
    create_config
    install_service
    setup_logrotate
    print_instructions
}

main "$@"
