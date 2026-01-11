#!/bin/bash
set -e

echo "=========================================="
echo "NBM CLOUD - Production Update Script"
echo "=========================================="

SOURCE_DIR="/root/nbm-cloud"
DEPLOY_DIR="/opt/nbm"
BACKUP_DIR="/opt/nbm-backup-$(date +%Y%m%d_%H%M%S)"

echo ""
echo "[1/7] Backing up current deployment..."
cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
echo "Backup created: $BACKUP_DIR"

echo ""
echo "[2/7] Pulling latest code from GitHub..."
cd "$SOURCE_DIR"
git fetch origin main
git reset --hard origin/main
echo "Code updated to: $(git rev-parse --short HEAD)"

echo ""
echo "[3/7] Installing dependencies..."
npm install --silent

echo ""
echo "[4/7] Building application..."
npm run build

echo ""
echo "[5/7] Deploying to production (removing old files)..."
rm -rf "$DEPLOY_DIR/public" "$DEPLOY_DIR/index.cjs" 2>/dev/null || true
cp -r "$SOURCE_DIR/dist/"* "$DEPLOY_DIR/"

echo ""
echo "[6/7] Setting permissions..."
chown -R nbm:nbm "$DEPLOY_DIR"

echo ""
echo "[7/7] Restarting service..."
systemctl restart nbm

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Verifying deployment..."
sleep 2

BUNDLE=$(curl -s http://127.0.0.1:5000/ | grep -oP 'index-[A-Za-z0-9]+\.js')
echo "Current bundle: $BUNDLE"

SERVICE_STATUS=$(systemctl is-active nbm)
echo "Service status: $SERVICE_STATUS"

echo ""
echo "To view logs: journalctl -u nbm -f"
echo "Backup location: $BACKUP_DIR"
echo ""
