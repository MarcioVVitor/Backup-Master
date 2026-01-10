#!/bin/bash
# NBM Agent Deploy Script
# This script updates the NBM Agent from the Git repository

set -e

REPO_URL="https://github.com/MarcioVVitor/Backup-Master.git"
TEMP_DIR="/tmp/nbm-cloud-update"
AGENT_DIR="/opt/nbm-agent"
BRANCH="main"

echo "========================================"
echo "NBM Agent Deploy Script"
echo "========================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   exit 1
fi

# Clean up any previous temp directory
rm -rf "$TEMP_DIR"

# Clone/pull the repository
echo "[1/5] Cloning repository..."
if command -v git &> /dev/null; then
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR"
else
    echo "Git not installed. Installing..."
    apt-get update && apt-get install -y git
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR"
fi

# Check if agent script exists in repo
if [[ ! -f "$TEMP_DIR/agents/linux/nbm-agent.sh" ]]; then
    echo "ERROR: Agent script not found in repository"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Backup current agent script
echo "[2/5] Backing up current agent..."
if [[ -f "$AGENT_DIR/nbm-agent.sh" ]]; then
    cp "$AGENT_DIR/nbm-agent.sh" "$AGENT_DIR/nbm-agent.sh.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copy new agent script
echo "[3/5] Installing new agent script..."
cp "$TEMP_DIR/agents/linux/nbm-agent.sh" "$AGENT_DIR/nbm-agent.sh"
chmod +x "$AGENT_DIR/nbm-agent.sh"

# Copy install/uninstall scripts if they exist
if [[ -f "$TEMP_DIR/agents/linux/install.sh" ]]; then
    cp "$TEMP_DIR/agents/linux/install.sh" "$AGENT_DIR/install.sh"
    chmod +x "$AGENT_DIR/install.sh"
fi
if [[ -f "$TEMP_DIR/agents/linux/uninstall.sh" ]]; then
    cp "$TEMP_DIR/agents/linux/uninstall.sh" "$AGENT_DIR/uninstall.sh"
    chmod +x "$AGENT_DIR/uninstall.sh"
fi

# Cleanup temp directory
echo "[4/5] Cleaning up..."
rm -rf "$TEMP_DIR"

# Restart the agent service
echo "[5/5] Restarting nbm-agent service..."
systemctl restart nbm-agent

# Wait for service to start
sleep 3

# Check service status
if systemctl is-active --quiet nbm-agent; then
    echo ""
    echo "========================================"
    echo "SUCCESS: NBM Agent updated and running!"
    echo "========================================"
    echo ""
    echo "Recent logs:"
    tail -15 "$AGENT_DIR/logs/agent.log"
else
    echo ""
    echo "========================================"
    echo "WARNING: Service may not have started correctly"
    echo "========================================"
    systemctl status nbm-agent
fi
