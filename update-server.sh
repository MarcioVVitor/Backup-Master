#!/bin/bash
#
# NBM CLOUD v17.0 - Update Script
# 
# This script updates NBM CLOUD to the latest version
#
# Usage:
#   sudo ./update-server.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/nbm-cloud"
APP_USER="nbmcloud"
BRANCH="${BRANCH:-main}"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

echo ""
echo "========================================"
echo "  NBM CLOUD v17.0 Update Script        "
echo "========================================"
echo ""

# Check if application directory exists
if [[ ! -d "$APP_DIR" ]]; then
    log_error "Application directory not found: $APP_DIR"
    log_error "Please run install-server.sh first"
    exit 1
fi

cd $APP_DIR

# Get current version
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_info "Current version: $CURRENT_COMMIT"

# Create backup
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
log_info "Creating backup..."
cp .env ".env.backup.$BACKUP_TIME" 2>/dev/null || true
log_success "Backup created: .env.backup.$BACKUP_TIME"

# Stop application
log_info "Stopping application..."
sudo -u $APP_USER pm2 stop nbm-cloud || true

# Pull latest changes
log_info "Pulling latest changes from $BRANCH..."
sudo -u $APP_USER git fetch origin
sudo -u $APP_USER git reset --hard origin/$BRANCH
NEW_COMMIT=$(git rev-parse --short HEAD)
log_success "Updated to: $NEW_COMMIT"

# Show changelog
log_info "Recent changes:"
git log --oneline -n 10

# Install dependencies
log_info "Installing dependencies..."
sudo -u $APP_USER npm install
log_success "Dependencies installed"

# Build application
log_info "Building application..."
sudo -u $APP_USER npm run build
log_success "Application built"

# Push database schema (if needed)
log_info "Updating database schema..."
sudo -u $APP_USER bash -c "source .env && npm run db:push" || {
    log_warn "Schema push failed, trying with --force..."
    sudo -u $APP_USER bash -c "source .env && npm run db:push --force"
}
log_success "Database schema updated"

# Restart application
log_info "Restarting application..."
sudo -u $APP_USER pm2 restart nbm-cloud --update-env
log_success "Application restarted"

# Verify
sleep 3
if curl -s http://localhost:5000/api/auth/mode > /dev/null 2>&1; then
    log_success "Application is running!"
else
    log_error "Application may not be running. Check: pm2 logs nbm-cloud"
fi

echo ""
echo "========================================"
echo "  Update Complete!                     "
echo "========================================"
echo ""
echo "Updated from $CURRENT_COMMIT to $NEW_COMMIT"
echo ""
echo "To rollback:"
echo "  cd $APP_DIR && git checkout $CURRENT_COMMIT"
echo "  npm run build && pm2 restart nbm-cloud"
echo ""
log_success "Update completed successfully!"
