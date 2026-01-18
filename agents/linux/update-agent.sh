#!/bin/bash
# NBM Agent Update Script - Downloads and installs all agent files from GitHub
# Usage: curl -sSL https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/agents/linux/update-agent.sh | bash

set -e

AGENT_DIR="/opt/nbm-agent"
GITHUB_RAW="https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/agents/linux"

echo "=========================================="
echo "NBM Agent Update Script"
echo "=========================================="

mkdir -p "$AGENT_DIR"

echo "[1/4] Downloading nbm-agent.sh..."
curl -sSL "$GITHUB_RAW/nbm-agent.sh" -o "$AGENT_DIR/nbm-agent.sh"

echo "[2/4] Downloading pty-proxy.py..."
curl -sSL "$GITHUB_RAW/pty-proxy.py" -o "$AGENT_DIR/pty-proxy.py"

echo "[3/4] Downloading pty-reader.py..."
curl -sSL "$GITHUB_RAW/pty-reader.py" -o "$AGENT_DIR/pty-reader.py"

echo "[4/4] Setting permissions..."
chmod +x "$AGENT_DIR/nbm-agent.sh"
chmod +x "$AGENT_DIR/pty-proxy.py"
chmod +x "$AGENT_DIR/pty-reader.py"

echo ""
echo "Files installed:"
ls -la "$AGENT_DIR/"*.sh "$AGENT_DIR/"*.py 2>/dev/null || true

echo ""
echo "=========================================="
echo "Installation complete!"
echo "=========================================="
echo ""
echo "To restart the agent service:"
echo "  systemctl restart nbm-agent"
echo ""
