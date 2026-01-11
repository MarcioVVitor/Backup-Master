#!/bin/bash
# Deploy NBM Agent v1.0.17 to production server
# Execute this script on the production server (143.255.197.26)

set -e

echo "=== NBM Agent Deploy v1.0.17 ==="
echo ""

# Stop the agent service
echo "[1/4] Stopping nbm-agent service..."
sudo systemctl stop nbm-agent 2>/dev/null || true

# Backup current agent
echo "[2/4] Creating backup of current agent..."
if [ -f /opt/nbm-agent/nbm-agent.sh ]; then
    sudo cp /opt/nbm-agent/nbm-agent.sh /opt/nbm-agent/nbm-agent.sh.bak
fi

# Download latest agent from GitHub
echo "[3/4] Downloading latest agent from GitHub..."
cd /tmp
rm -rf nbm-update 2>/dev/null || true
git clone --depth 1 https://github.com/MarcioVVitor/Backup-Master.git nbm-update

# Copy new agent script
echo "[4/4] Installing new agent..."
sudo cp nbm-update/agents/linux/nbm-agent.sh /opt/nbm-agent/nbm-agent.sh
sudo chmod +x /opt/nbm-agent/nbm-agent.sh

# Clean up
rm -rf nbm-update

# Verify version
echo ""
echo "=== Verifying installation ==="
AGENT_VERSION=$(grep '^AGENT_VERSION=' /opt/nbm-agent/nbm-agent.sh | cut -d'"' -f2)
echo "Installed agent version: $AGENT_VERSION"

# Restart agent service
echo ""
echo "=== Restarting agent service ==="
sudo systemctl start nbm-agent
sleep 2
sudo systemctl status nbm-agent --no-pager

echo ""
echo "=== Deploy complete! ==="
echo "Agent version $AGENT_VERSION is now running."
echo ""
echo "To verify ZTE backup functionality:"
echo "  1. Check agent logs: sudo tail -f /opt/nbm-agent/logs/agent.log"
echo "  2. Look for 'ZTE_DEBUG:' messages during backup"
echo "  3. Verify enable mode is being entered"
