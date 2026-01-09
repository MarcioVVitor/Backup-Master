#!/bin/bash
# NBM CLOUD Agent Installer
# Instala e configura o agente proxy para backup de equipamentos

set -e

AGENT_DIR="/opt/nbm-agent"
SERVICE_NAME="nbm-agent"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/YOUR_USERNAME/nbm-agent.git}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
  _   _ ____  __  __    ____ _     ___  _   _ ____  
 | \ | | __ )|  \/  |  / ___| |   / _ \| | | |  _ \ 
 |  \| |  _ \| |\/| | | |   | |  | | | | | | | | | |
 | |\  | |_) | |  | | | |___| |__| |_| | |_| | |_| |
 |_| \_|____/|_|  |_|  \____|_____\___/ \___/|____/ 
                                                     
 Agent Installer v1.0
EOF
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

echo -e "${GREEN}[1/6] Installing dependencies...${NC}"

# Detect package manager
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y jq curl sshpass openssh-client git
    
    # Install websocat
    if ! command -v websocat &> /dev/null; then
        echo "Installing websocat..."
        WEBSOCAT_VERSION="1.11.0"
        wget -q "https://github.com/vi/websocat/releases/download/v${WEBSOCAT_VERSION}/websocat.x86_64-unknown-linux-musl" \
            -O /usr/local/bin/websocat
        chmod +x /usr/local/bin/websocat
    fi
    
elif command -v yum &> /dev/null; then
    yum install -y jq curl sshpass openssh-clients git
    
    if ! command -v websocat &> /dev/null; then
        WEBSOCAT_VERSION="1.11.0"
        wget -q "https://github.com/vi/websocat/releases/download/v${WEBSOCAT_VERSION}/websocat.x86_64-unknown-linux-musl" \
            -O /usr/local/bin/websocat
        chmod +x /usr/local/bin/websocat
    fi
    
elif command -v dnf &> /dev/null; then
    dnf install -y jq curl sshpass openssh-clients git
    
    if ! command -v websocat &> /dev/null; then
        WEBSOCAT_VERSION="1.11.0"
        wget -q "https://github.com/vi/websocat/releases/download/v${WEBSOCAT_VERSION}/websocat.x86_64-unknown-linux-musl" \
            -O /usr/local/bin/websocat
        chmod +x /usr/local/bin/websocat
    fi
else
    echo -e "${RED}Unsupported package manager. Please install manually: jq curl sshpass ssh git websocat${NC}"
    exit 1
fi

echo -e "${GREEN}[2/6] Creating directory structure...${NC}"

mkdir -p "$AGENT_DIR"/{logs,releases,repo}
mkdir -p /etc/nbm-agent

echo -e "${GREEN}[3/6] Cloning agent from GitHub...${NC}"

if [[ -d "$AGENT_DIR/repo/.git" ]]; then
    echo "Updating existing repository..."
    cd "$AGENT_DIR/repo"
    git pull origin main
else
    echo "Cloning repository..."
    git clone "$GITHUB_REPO" "$AGENT_DIR/repo"
fi

# Copy agent files
cp -r "$AGENT_DIR/repo/agents/linux/"* "$AGENT_DIR/"
chmod +x "$AGENT_DIR/"*.sh

# Create current symlink
ln -sf "$AGENT_DIR" "$AGENT_DIR/current"

echo -e "${GREEN}[4/6] Configuring agent...${NC}"

# Prompt for configuration
echo ""
read -p "Enter NBM CLOUD Server URL (e.g., https://your-app.replit.app): " SERVER_URL
read -p "Enter Agent Name: " AGENT_NAME
read -p "Enter Agent ID (from NBM CLOUD): " AGENT_ID
read -sp "Enter Agent Token (from NBM CLOUD): " AGENT_TOKEN
echo ""

# Create config file
cat > "$AGENT_DIR/config.json" << EOF
{
    "serverUrl": "$SERVER_URL",
    "name": "$AGENT_NAME",
    "agentId": $AGENT_ID,
    "token": "$AGENT_TOKEN"
}
EOF

chmod 600 "$AGENT_DIR/config.json"

echo -e "${GREEN}[5/6] Creating systemd service...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=NBM CLOUD Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_DIR
ExecStart=$AGENT_DIR/current/nbm-agent.sh start
ExecStop=$AGENT_DIR/current/nbm-agent.sh stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME

echo -e "${GREEN}[6/6] Starting agent...${NC}"

systemctl start $SERVICE_NAME

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NBM CLOUD Agent installed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Agent Directory: ${BLUE}$AGENT_DIR${NC}"
echo -e "Config File:     ${BLUE}$AGENT_DIR/config.json${NC}"
echo -e "Log File:        ${BLUE}$AGENT_DIR/logs/agent.log${NC}"
echo ""
echo -e "Commands:"
echo -e "  ${YELLOW}systemctl status nbm-agent${NC}   - Check agent status"
echo -e "  ${YELLOW}systemctl restart nbm-agent${NC}  - Restart agent"
echo -e "  ${YELLOW}journalctl -u nbm-agent -f${NC}   - View agent logs"
echo -e "  ${YELLOW}$AGENT_DIR/nbm-agent.sh update${NC} - Update agent from GitHub"
echo ""
echo -e "${GREEN}The agent is now running and connected to NBM CLOUD!${NC}"
