#!/bin/bash
#
# NBM CLOUD v17.0 - Production Installation Script
# For Debian 13 Server with PostgreSQL 16 and Node.js 20
#
# Usage:
#   Fresh install:  sudo ./install-production.sh install
#   Update:         sudo ./install-production.sh update
#   Rollback:       sudo ./install-production.sh rollback <commit_hash>
#   Status:         sudo ./install-production.sh status
#
# Requirements:
#   - Debian 13 (Trixie) or compatible
#   - Root or sudo access
#   - PostgreSQL 16 database (can be local or remote)
#   - Internet access for GitHub and npm
#

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

APP_NAME="nbm-cloud"
APP_DIR="/opt/nbm-cloud"
BACKUP_DIR="/opt/nbm/backups"
LOG_DIR="/var/log/nbm-cloud"
SERVICE_USER="nbm"
SERVICE_GROUP="nbm"
GITHUB_REPO="https://github.com/MarcioVVitor/Backup-Master.git"
GITHUB_BRANCH="main"
NODE_VERSION="20"
PORT=5000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# ============================================================================
# SYSTEM PREPARATION
# ============================================================================

install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update package list
    apt-get update -qq
    
    # Install essential packages
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        nginx \
        openssl \
        jq \
        postgresql-client-16 2>/dev/null || apt-get install -y -qq postgresql-client
    
    log_success "System dependencies installed"
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."
    
    # Check if Node.js is already installed with correct version
    if command -v node &> /dev/null; then
        CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_VERSION" == "$NODE_VERSION" ]]; then
            log_success "Node.js ${NODE_VERSION} already installed"
            return
        fi
    fi
    
    # Install NodeSource repository
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    
    apt-get update -qq
    apt-get install -y -qq nodejs
    
    # Install PM2 globally
    npm install -g pm2
    
    log_success "Node.js $(node -v) and PM2 installed"
}

create_user() {
    log_info "Creating service user '${SERVICE_USER}'..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        log_success "User '${SERVICE_USER}' already exists"
    else
        groupadd -r "$SERVICE_GROUP" 2>/dev/null || true
        useradd -r -g "$SERVICE_GROUP" -d "/home/$SERVICE_USER" -m -s /bin/bash "$SERVICE_USER"
        log_success "User '${SERVICE_USER}' created with home /home/$SERVICE_USER"
    fi
    
    # Ensure home directory exists and has correct permissions
    mkdir -p "/home/$SERVICE_USER"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "/home/$SERVICE_USER"
}

create_directories() {
    log_info "Creating application directories..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$BACKUP_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
    
    chmod 755 "$APP_DIR"
    chmod 755 "$BACKUP_DIR"
    chmod 755 "$LOG_DIR"
    
    log_success "Directories created"
}

# ============================================================================
# APPLICATION DEPLOYMENT
# ============================================================================

clone_repository() {
    log_info "Cloning repository from GitHub..."
    
    if [[ -d "$APP_DIR/.git" ]]; then
        log_info "Repository already exists, pulling latest changes..."
        cd "$APP_DIR"
        sudo -u "$SERVICE_USER" git fetch --all
        sudo -u "$SERVICE_USER" git reset --hard "origin/$GITHUB_BRANCH"
        sudo -u "$SERVICE_USER" git pull origin "$GITHUB_BRANCH"
    else
        rm -rf "$APP_DIR"/*
        sudo -u "$SERVICE_USER" git clone -b "$GITHUB_BRANCH" "$GITHUB_REPO" "$APP_DIR"
    fi
    
    # Save current commit for rollback
    cd "$APP_DIR"
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > "$APP_DIR/.last-deploy"
    
    log_success "Repository cloned/updated (commit: ${CURRENT_COMMIT:0:8})"
}

install_npm_packages() {
    log_info "Installing npm packages..."
    
    cd "$APP_DIR"
    sudo -u "$SERVICE_USER" npm ci --production=false
    
    log_success "npm packages installed"
}

build_application() {
    log_info "Building application..."
    
    cd "$APP_DIR"
    sudo -u "$SERVICE_USER" npm run build
    
    log_success "Application built"
}

setup_environment() {
    log_info "Setting up environment variables..."
    
    ENV_FILE="$APP_DIR/.env"
    
    if [[ -f "$ENV_FILE" ]]; then
        log_warn ".env file already exists, skipping creation"
        log_info "Review and update $ENV_FILE if needed"
    else
        # Generate secure session secret
        SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
        
        cat > "$ENV_FILE" << EOF
# NBM CLOUD Production Environment
# Generated: $(date -Iseconds)

# Database connection (REQUIRED - update with your credentials)
DATABASE_URL=postgresql://nbm_user:YOUR_PASSWORD@localhost:5432/nbm_cloud

# Session encryption secret (auto-generated)
SESSION_SECRET=$SESSION_SECRET

# Local backup storage directory
LOCAL_BACKUP_DIR=$BACKUP_DIR

# Server port
PORT=$PORT

# Worker pool settings
WORKER_POOL_CONCURRENCY=50

# Optional: Custom settings
# WORKER_TIMEOUT=600000
# BATCH_SIZE=200
EOF
        
        chown "$SERVICE_USER:$SERVICE_GROUP" "$ENV_FILE"
        chmod 640 "$ENV_FILE"
        
        log_warn "Created .env file - PLEASE UPDATE DATABASE_URL with your credentials!"
        log_info "Edit: nano $ENV_FILE"
    fi
}

run_migrations() {
    log_info "Running database migrations..."
    
    cd "$APP_DIR"
    
    # Check if DATABASE_URL is configured
    if grep -q "YOUR_PASSWORD" "$APP_DIR/.env"; then
        log_error "DATABASE_URL not configured! Please update .env file first"
        log_info "Edit: nano $APP_DIR/.env"
        return 1
    fi
    
    # Load environment and run migrations
    set -a
    source "$APP_DIR/.env"
    set +a
    
    sudo -u "$SERVICE_USER" -E npm run db:push
    
    log_success "Database migrations completed"
}

# ============================================================================
# PROCESS MANAGEMENT
# ============================================================================

setup_pm2() {
    log_info "Setting up PM2 process manager..."
    
    cd "$APP_DIR"
    
    # Stop existing process if running
    sudo -u "$SERVICE_USER" pm2 delete "$APP_NAME" 2>/dev/null || true
    
    # Start application with PM2
    sudo -u "$SERVICE_USER" pm2 start ecosystem.config.cjs
    
    # Save PM2 process list
    sudo -u "$SERVICE_USER" pm2 save
    
    # Setup PM2 startup script for systemd
    pm2 startup systemd -u "$SERVICE_USER" --hp "/home/$SERVICE_USER" 2>/dev/null || \
    pm2 startup systemd -u "$SERVICE_USER" --hp "$APP_DIR"
    
    log_success "PM2 configured"
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    # Ensure PM2 home directory exists
    PM2_HOME="/home/$SERVICE_USER/.pm2"
    mkdir -p "$PM2_HOME"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$PM2_HOME"
    
    cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD v17.0 - Network Backup Management
Documentation=https://github.com/MarcioVVitor/Backup-Master
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=forking
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$APP_DIR
Environment=PATH=/usr/bin:/usr/local/bin
Environment=HOME=/home/$SERVICE_USER
Environment=PM2_HOME=/home/$SERVICE_USER/.pm2
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable nbm-cloud.service
    
    log_success "Systemd service created and enabled"
}

# ============================================================================
# NGINX CONFIGURATION
# ============================================================================

setup_nginx() {
    log_info "Configuring Nginx reverse proxy..."
    
    cat > /etc/nginx/sites-available/nbm-cloud << EOF
# NBM CLOUD Nginx Configuration
upstream nbm_backend {
    server 127.0.0.1:$PORT;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    # Uncomment for SSL redirect
    # return 301 https://\$host\$request_uri;
    
    location / {
        proxy_pass http://nbm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    location /health {
        proxy_pass http://nbm_backend/api/health;
        proxy_http_version 1.1;
    }
    
    # WebSocket support for agents
    location /ws {
        proxy_pass http://nbm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400s;
    }
    
    # Increase upload size for firmware uploads
    client_max_body_size 100M;
}

# SSL Configuration (uncomment and configure with your certificate)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name your-domain.com;
#     
#     ssl_certificate /etc/ssl/certs/nbm-cloud.crt;
#     ssl_certificate_key /etc/ssl/private/nbm-cloud.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_prefer_server_ciphers on;
#     ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
#     
#     # Same location blocks as above
# }
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    
    log_success "Nginx configured"
}

# ============================================================================
# FIREWALL CONFIGURATION
# ============================================================================

setup_firewall() {
    log_info "Configuring firewall (ufw)..."
    
    # Reset and configure
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow essential ports
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured"
}

# ============================================================================
# UPDATE AND ROLLBACK
# ============================================================================

update_application() {
    log_info "Updating NBM CLOUD..."
    
    cd "$APP_DIR"
    
    # Save current commit for potential rollback
    PREVIOUS_COMMIT=$(git rev-parse HEAD)
    echo "$PREVIOUS_COMMIT" > "$APP_DIR/.previous-deploy"
    
    # Pull latest changes
    clone_repository
    
    # Install packages and build
    install_npm_packages
    build_application
    
    # Run migrations
    run_migrations
    
    # Restart application
    sudo -u "$SERVICE_USER" pm2 reload "$APP_NAME" --update-env
    
    log_success "Application updated successfully"
    log_info "Previous commit saved for rollback: ${PREVIOUS_COMMIT:0:8}"
}

rollback_application() {
    ROLLBACK_COMMIT=$1
    
    if [[ -z "$ROLLBACK_COMMIT" ]]; then
        if [[ -f "$APP_DIR/.previous-deploy" ]]; then
            ROLLBACK_COMMIT=$(cat "$APP_DIR/.previous-deploy")
            log_info "Rolling back to previous deployment: ${ROLLBACK_COMMIT:0:8}"
        else
            log_error "No commit specified and no previous deployment found"
            exit 1
        fi
    fi
    
    log_info "Rolling back to commit: $ROLLBACK_COMMIT"
    
    cd "$APP_DIR"
    
    # Checkout specific commit
    sudo -u "$SERVICE_USER" git fetch --all
    sudo -u "$SERVICE_USER" git checkout "$ROLLBACK_COMMIT"
    
    # Rebuild
    install_npm_packages
    build_application
    
    # Restart
    sudo -u "$SERVICE_USER" pm2 reload "$APP_NAME" --update-env
    
    log_success "Rolled back to commit: ${ROLLBACK_COMMIT:0:8}"
}

# ============================================================================
# STATUS AND HEALTH
# ============================================================================

show_status() {
    echo ""
    echo "=============================================="
    echo "  NBM CLOUD v17.0 - System Status"
    echo "=============================================="
    echo ""
    
    # Application status
    echo -e "${BLUE}Application:${NC}"
    if sudo -u "$SERVICE_USER" pm2 list | grep -q "$APP_NAME"; then
        sudo -u "$SERVICE_USER" pm2 list
    else
        echo "  Not running"
    fi
    echo ""
    
    # Git info
    echo -e "${BLUE}Git Status:${NC}"
    if [[ -d "$APP_DIR/.git" ]]; then
        cd "$APP_DIR"
        echo "  Branch: $(git branch --show-current)"
        echo "  Commit: $(git rev-parse --short HEAD)"
        echo "  Date: $(git log -1 --format=%ci)"
    else
        echo "  Not a git repository"
    fi
    echo ""
    
    # Service status
    echo -e "${BLUE}Services:${NC}"
    echo -n "  Nginx: "
    systemctl is-active nginx || echo "inactive"
    echo -n "  PostgreSQL: "
    systemctl is-active postgresql || echo "inactive"
    echo ""
    
    # Disk usage
    echo -e "${BLUE}Disk Usage:${NC}"
    echo "  App: $(du -sh $APP_DIR 2>/dev/null | cut -f1)"
    echo "  Backups: $(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)"
    echo "  Logs: $(du -sh $LOG_DIR 2>/dev/null | cut -f1)"
    echo ""
    
    # Health check
    echo -e "${BLUE}Health Check:${NC}"
    HEALTH=$(curl -s http://127.0.0.1:$PORT/api/health 2>/dev/null || echo '{"status":"error"}')
    echo "  $HEALTH"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

print_banner() {
    echo ""
    echo "=============================================="
    echo "   NBM CLOUD v17.0 Production Installer"
    echo "   Network Backup Management System"
    echo "=============================================="
    echo ""
}

print_usage() {
    echo "Usage: $0 {install|update|rollback|status}"
    echo ""
    echo "Commands:"
    echo "  install           Full installation (fresh server)"
    echo "  update            Update to latest version"
    echo "  rollback [hash]   Rollback to previous or specific commit"
    echo "  status            Show system status"
    echo ""
}

main() {
    print_banner
    check_root
    
    case "${1:-}" in
        install)
            log_info "Starting fresh installation..."
            install_dependencies
            install_nodejs
            create_user
            create_directories
            clone_repository
            install_npm_packages
            build_application
            setup_environment
            
            echo ""
            log_warn "=== IMPORTANT: Configure database connection ==="
            log_info "1. Edit the .env file: nano $APP_DIR/.env"
            log_info "2. Update DATABASE_URL with your PostgreSQL credentials"
            log_info "3. Run: sudo $0 install-continue"
            echo ""
            ;;
            
        install-continue)
            log_info "Continuing installation..."
            run_migrations
            setup_pm2
            create_systemd_service
            setup_nginx
            setup_firewall
            
            echo ""
            log_success "=== Installation Complete ==="
            echo ""
            log_info "NBM CLOUD is running at: http://$(hostname -I | awk '{print $1}')"
            log_info "Default port: $PORT"
            echo ""
            log_info "Useful commands:"
            echo "  pm2 logs $APP_NAME     - View logs"
            echo "  pm2 restart $APP_NAME  - Restart application"
            echo "  pm2 monit              - Monitor resources"
            echo "  sudo $0 status         - Show status"
            echo "  sudo $0 update         - Update to latest"
            echo ""
            show_status
            ;;
            
        update)
            update_application
            show_status
            ;;
            
        rollback)
            rollback_application "$2"
            show_status
            ;;
            
        status)
            show_status
            ;;
            
        *)
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
