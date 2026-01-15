#!/bin/bash
# NBM CLOUD v17.0 - Deployment Patch Script
# Este script aplica todas as melhorias e correções no servidor de produção

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

NBM_DIR="/opt/nbm-cloud"
BACKUP_DIR="/opt/nbm/backups"

log_info "=========================================="
log_info "NBM CLOUD v17.0 - Deployment Patch"
log_info "=========================================="

# 1. Pull latest changes
log_info "1. Pulling latest changes from repository..."
cd "$NBM_DIR"
git pull origin main

# 2. Install dependencies
log_info "2. Installing dependencies..."
npm install

# 3. Build application
log_info "3. Building application..."
npm run build

# 4. Ensure backup directories exist
log_info "4. Creating backup directories..."
mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"

# 5. Push database schema updates
log_info "5. Syncing database schema..."
npm run db:push || npm run db:push --force

# 6. Restart PM2 application
log_info "6. Restarting NBM CLOUD application..."
pm2 restart nbm-cloud --update-env

# 7. Wait for application to start
log_info "7. Waiting for application to start..."
sleep 5

# 8. Check application status
log_info "8. Checking application status..."
pm2 status nbm-cloud

# 9. Verify application is responding
log_info "9. Testing application health..."
if curl -s http://localhost:5000/api/auth/mode > /dev/null; then
    log_info "Application is responding correctly!"
else
    log_error "Application is not responding. Check logs with: pm2 logs nbm-cloud"
    exit 1
fi

log_info "=========================================="
log_info "Deployment completed successfully!"
log_info "=========================================="

log_info ""
log_info "Improvements applied in this patch:"
log_info "  - Improved WebSocket message handling with detailed logging"
log_info "  - Increased backup timeout to 10 minutes (was 2 minutes)"
log_info "  - Increased worker pool concurrency to 50 (was 10)"
log_info "  - Improved local storage with automatic directory creation"
log_info "  - Better error handling and logging for backup execution"
log_info "  - Session save fix for standalone authentication"
log_info "  - Cache invalidation after login for admin status"
log_info ""
log_info "To view logs: pm2 logs nbm-cloud"
log_info "To restart: pm2 restart nbm-cloud"
