#!/bin/bash
# Deploy NBM CLOUD to Production Server (143.255.197.25)
# Run this script from the project root directory

set -e

SERVER="143.255.197.25"
SERVER_USER="root"
APP_DIR="/opt/nbm-cloud"
AGENT_DIR="/opt/nbm-agent"

echo "=========================================="
echo "NBM CLOUD v17.0 - Production Deploy"
echo "Server: $SERVER"
echo "=========================================="

echo ""
echo "[1/5] Building application..."
npm run build

echo ""
echo "[2/5] Syncing application files to server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.replit' \
  --exclude 'replit.nix' \
  --exclude '.upm' \
  --exclude '.cache' \
  --exclude 'attached_assets' \
  ./ ${SERVER_USER}@${SERVER}:${APP_DIR}/

echo ""
echo "[3/5] Syncing agent files to server..."
ssh ${SERVER_USER}@${SERVER} "mkdir -p ${AGENT_DIR}"
rsync -avz \
  agents/linux/nbm-agent.sh \
  agents/linux/pty-proxy.py \
  agents/linux/pty-reader.py \
  agents/linux/install.sh \
  agents/linux/uninstall.sh \
  ${SERVER_USER}@${SERVER}:${AGENT_DIR}/

echo ""
echo "[4/5] Installing dependencies and applying database migrations..."
ssh ${SERVER_USER}@${SERVER} << 'EOF'
cd /opt/nbm-cloud
npm install --production
npm run db:push
chmod +x /opt/nbm-agent/*.sh
chmod +x /opt/nbm-agent/*.py
EOF

echo ""
echo "[5/5] Restarting services..."
ssh ${SERVER_USER}@${SERVER} << 'EOF'
cd /opt/nbm-cloud
pm2 restart nbm-cloud --update-env || pm2 start ecosystem.config.cjs
pm2 save

# Restart local agent if running
if systemctl is-active --quiet nbm-agent; then
  systemctl restart nbm-agent
  echo "NBM Agent restarted"
fi
EOF

echo ""
echo "=========================================="
echo "Deploy complete!"
echo "Application: http://${SERVER}:5000"
echo "=========================================="
echo ""
echo "To check status:"
echo "  ssh ${SERVER_USER}@${SERVER} 'pm2 status'"
echo "  ssh ${SERVER_USER}@${SERVER} 'pm2 logs nbm-cloud'"
