#!/bin/bash
# NBM CLOUD Agent Uninstaller

set -e

AGENT_DIR="/opt/nbm-agent"
SERVICE_NAME="nbm-agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}NBM CLOUD Agent Uninstaller${NC}"
echo ""

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

read -p "Are you sure you want to uninstall NBM CLOUD Agent? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo -e "${YELLOW}[1/3] Stopping service...${NC}"
systemctl stop $SERVICE_NAME 2>/dev/null || true
systemctl disable $SERVICE_NAME 2>/dev/null || true

echo -e "${YELLOW}[2/3] Removing systemd service...${NC}"
rm -f /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

echo -e "${YELLOW}[3/3] Removing agent files...${NC}"

read -p "Remove agent directory $AGENT_DIR? (y/N) " remove_dir
if [[ "$remove_dir" == "y" || "$remove_dir" == "Y" ]]; then
    rm -rf "$AGENT_DIR"
    rm -rf /etc/nbm-agent
    echo -e "${GREEN}Agent directory removed.${NC}"
else
    echo -e "${YELLOW}Agent directory preserved at $AGENT_DIR${NC}"
fi

echo ""
echo -e "${GREEN}NBM CLOUD Agent uninstalled successfully!${NC}"
