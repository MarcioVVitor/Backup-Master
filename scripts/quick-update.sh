#!/bin/bash
#
# NBM CLOUD - Quick Update Script
# Run this on production server to update to latest version
#
# Usage: sudo ./quick-update.sh
#

set -e

APP_DIR="/opt/nbm-cloud"
APP_NAME="nbm-cloud"
SERVICE_USER="nbm"
GITHUB_BRANCH="main"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "Run as root: sudo $0"
    exit 1
fi

cd "$APP_DIR"

# Save current commit
PREVIOUS=$(git rev-parse HEAD)
echo "$PREVIOUS" > .previous-deploy
log_info "Current: ${PREVIOUS:0:8}"

# Pull latest
log_info "Pulling latest changes..."
sudo -u "$SERVICE_USER" git fetch --all
sudo -u "$SERVICE_USER" git reset --hard "origin/$GITHUB_BRANCH"

NEW=$(git rev-parse HEAD)
log_info "New: ${NEW:0:8}"

if [[ "$PREVIOUS" == "$NEW" ]]; then
    log_success "Already up to date!"
    exit 0
fi

# Build
log_info "Installing dependencies..."
sudo -u "$SERVICE_USER" npm ci --production=false

log_info "Building..."
sudo -u "$SERVICE_USER" npm run build

# Migrations
log_info "Running migrations..."
set -a; source .env; set +a
sudo -u "$SERVICE_USER" -E npm run db:push

# Restart
log_info "Restarting..."
sudo -u "$SERVICE_USER" pm2 reload "$APP_NAME" --update-env

log_success "Update complete: ${PREVIOUS:0:8} -> ${NEW:0:8}"

# Show status
sleep 2
sudo -u "$SERVICE_USER" pm2 list
