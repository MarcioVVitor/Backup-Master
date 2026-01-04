#!/bin/bash
set -e

# NBM Agent Uninstallation Script
# Usage: sudo ./uninstall.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="/opt/nbm-agent"
CONFIG_DIR="/etc/nbm-agent"
LOG_DIR="/var/log/nbm-agent"
SERVICE_USER="nbm-agent"

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: This script must be run as root${NC}"
        exit 1
    fi
}

confirm_uninstall() {
    echo -e "${YELLOW}This will remove NBM Agent from your system.${NC}"
    read -p "Are you sure you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstallation cancelled."
        exit 0
    fi
}

stop_service() {
    echo -e "${GREEN}Stopping NBM Agent service...${NC}"
    systemctl stop nbm-agent 2>/dev/null || true
    systemctl disable nbm-agent 2>/dev/null || true
}

remove_service() {
    echo -e "${GREEN}Removing systemd service...${NC}"
    rm -f /etc/systemd/system/nbm-agent.service
    systemctl daemon-reload
}

remove_files() {
    echo -e "${GREEN}Removing installation files...${NC}"
    rm -rf "$INSTALL_DIR"
    rm -f /etc/logrotate.d/nbm-agent
    
    echo -e "${YELLOW}Keep configuration and logs? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$CONFIG_DIR"
        rm -rf "$LOG_DIR"
        echo -e "${GREEN}Configuration and logs removed${NC}"
    else
        echo -e "${YELLOW}Configuration preserved at: $CONFIG_DIR${NC}"
        echo -e "${YELLOW}Logs preserved at: $LOG_DIR${NC}"
    fi
}

remove_user() {
    echo -e "${GREEN}Removing service user...${NC}"
    userdel "$SERVICE_USER" 2>/dev/null || true
}

main() {
    check_root
    confirm_uninstall
    stop_service
    remove_service
    remove_files
    remove_user
    echo -e "${GREEN}NBM Agent has been uninstalled.${NC}"
}

main "$@"
