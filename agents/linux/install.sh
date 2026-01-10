#!/bin/bash
# NBM CLOUD Agent Installer
# Instala e configura o agente proxy para backup de equipamentos

set -e

AGENT_DIR="/opt/nbm-agent"
SERVICE_NAME="nbm-agent"
GITHUB_RAW_BASE="https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/agents/linux"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
==========================================
  NBM CLOUD Agent - Network Backup Management
  Installation Script for Debian 13
==========================================
EOF
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

echo "Installing dependencies..."

# Detect package manager and install dependencies
if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get install -y curl gnupg jq sshpass openssh-client
elif command -v yum &> /dev/null; then
    yum install -y curl jq sshpass openssh-clients
elif command -v dnf &> /dev/null; then
    dnf install -y curl jq sshpass openssh-clients
else
    echo -e "${RED}Unsupported package manager. Please install manually: curl jq sshpass ssh${NC}"
    exit 1
fi

# Install Node.js 20.x if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y nodejs
fi

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Create service user
echo "Creating service user..."
if ! id -u nbm-agent &>/dev/null; then
    useradd -r -s /bin/bash -d "$AGENT_DIR" -m nbm-agent 2>/dev/null || true
    echo "Created user: nbm-agent"
else
    echo "User nbm-agent already exists"
fi

# Create directory structure
echo "Creating directories..."
mkdir -p "$AGENT_DIR"/{logs,config}

# Download agent files directly from GitHub
echo "Installing NBM Agent..."
echo "Downloading agent from GitHub..."

# Download main agent script
curl -fsSL "${GITHUB_RAW_BASE}/nbm-agent.sh" -o "$AGENT_DIR/nbm-agent.sh"
if [[ ! -f "$AGENT_DIR/nbm-agent.sh" ]]; then
    echo -e "${RED}Failed to download nbm-agent.sh${NC}"
    exit 1
fi
chmod +x "$AGENT_DIR/nbm-agent.sh"

# Download uninstall script
curl -fsSL "${GITHUB_RAW_BASE}/uninstall.sh" -o "$AGENT_DIR/uninstall.sh" 2>/dev/null || true
chmod +x "$AGENT_DIR/uninstall.sh" 2>/dev/null || true

echo -e "${GREEN}Agent files downloaded successfully${NC}"

# Set ownership
chown -R nbm-agent:nbm-agent "$AGENT_DIR"

# Prompt for configuration
echo ""
echo -e "${YELLOW}=== Agent Configuration ===${NC}"
echo ""

read -p "Enter NBM CLOUD Server URL (e.g., https://nbm.example.com): " SERVER_URL
while [[ -z "$SERVER_URL" ]]; do
    echo -e "${RED}Server URL is required${NC}"
    read -p "Enter NBM CLOUD Server URL: " SERVER_URL
done

read -p "Enter Agent Name (descriptive name for this agent): " AGENT_NAME
while [[ -z "$AGENT_NAME" ]]; do
    echo -e "${RED}Agent name is required${NC}"
    read -p "Enter Agent Name: " AGENT_NAME
done

read -p "Enter Agent ID (from NBM CLOUD dashboard): " AGENT_ID
while [[ -z "$AGENT_ID" ]] || ! [[ "$AGENT_ID" =~ ^[0-9]+$ ]]; do
    echo -e "${RED}Valid numeric Agent ID is required${NC}"
    read -p "Enter Agent ID: " AGENT_ID
done

read -sp "Enter Agent Token (from NBM CLOUD dashboard): " AGENT_TOKEN
echo ""
while [[ -z "$AGENT_TOKEN" ]]; do
    echo -e "${RED}Agent token is required${NC}"
    read -sp "Enter Agent Token: " AGENT_TOKEN
    echo ""
done

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
chown nbm-agent:nbm-agent "$AGENT_DIR/config.json"

echo ""
echo "Creating systemd service..."

# Create systemd service
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=NBM CLOUD Agent - Network Backup Proxy
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_DIR
ExecStart=$AGENT_DIR/nbm-agent.sh start
ExecStop=$AGENT_DIR/nbm-agent.sh stop
Restart=always
RestartSec=10
StandardOutput=append:$AGENT_DIR/logs/agent.log
StandardError=append:$AGENT_DIR/logs/agent.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME

echo "Starting agent..."
systemctl start $SERVICE_NAME

# Wait and check status
sleep 3

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NBM CLOUD Agent Installed!${NC}"
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
echo -e "  ${YELLOW}tail -f $AGENT_DIR/logs/agent.log${NC} - View agent log file"
echo ""

if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}Agent is running and connecting to NBM CLOUD!${NC}"
else
    echo -e "${YELLOW}Agent service created but may need manual start.${NC}"
    echo -e "Check logs: ${BLUE}journalctl -u nbm-agent -f${NC}"
fi
