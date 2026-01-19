#!/bin/bash
#
# NBM CLOUD v17.0 - Installation Script for Debian 13
# 
# This script installs NBM CLOUD on a fresh Debian 13 server
# with PostgreSQL 16, Node.js 20, and PM2 process manager.
#
# Usage:
#   sudo ./install-server.sh
#
# After installation:
#   - Access the application at http://<server-ip>:5000
#   - Create the first user via registration (first user becomes admin)
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
BACKUP_DIR="/opt/nbm/backups"
LOG_DIR="/var/log/nbm-cloud"
APP_USER="nbmcloud"
APP_GROUP="nbmcloud"
DB_NAME="nbm_cloud"
DB_USER="nbmcloud"
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '/+=')
PORT=5000

# GitHub repository (change to your repo)
REPO_URL="${REPO_URL:-https://github.com/your-username/nbm-cloud.git}"
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
echo "  NBM CLOUD v17.0 Installation Script  "
echo "========================================"
echo ""

# Prompt for configuration
read -p "Enter PostgreSQL database password [auto-generated]: " input_db_pass
[[ -n "$input_db_pass" ]] && DB_PASS="$input_db_pass"

read -p "Enter session secret [auto-generated]: " input_session
[[ -n "$input_session" ]] && SESSION_SECRET="$input_session"

read -p "Enter application port [5000]: " input_port
[[ -n "$input_port" ]] && PORT="$input_port"

read -p "Enter GitHub repository URL [$REPO_URL]: " input_repo
[[ -n "$input_repo" ]] && REPO_URL="$input_repo"

echo ""
log_info "Starting installation..."

# Step 1: Update system
log_info "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Step 2: Install dependencies
log_info "Installing dependencies..."
apt-get install -y \
    curl \
    wget \
    git \
    gnupg2 \
    lsb-release \
    ca-certificates \
    apt-transport-https \
    software-properties-common \
    build-essential \
    openssl \
    expect \
    jq

# Step 3: Install Node.js 20
log_info "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_success "Node.js $(node -v) installed"
else
    log_warn "Node.js already installed: $(node -v)"
fi

# Step 4: Install PostgreSQL 16
log_info "Installing PostgreSQL 16..."
if ! command -v psql &> /dev/null; then
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update -y
    apt-get install -y postgresql-16 postgresql-contrib-16
    systemctl enable postgresql
    systemctl start postgresql
    log_success "PostgreSQL 16 installed"
else
    log_warn "PostgreSQL already installed"
fi

# Step 5: Install PM2
log_info "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    log_success "PM2 installed"
else
    log_warn "PM2 already installed"
fi

# Step 6: Create system user
log_info "Creating system user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -m -d /home/$APP_USER $APP_USER
    log_success "User $APP_USER created"
else
    log_warn "User $APP_USER already exists"
fi

# Step 7: Create directories
log_info "Creating directories..."
mkdir -p $APP_DIR
mkdir -p $BACKUP_DIR
mkdir -p $LOG_DIR
chown -R $APP_USER:$APP_GROUP $BACKUP_DIR
chown -R $APP_USER:$APP_GROUP $LOG_DIR
log_success "Directories created"

# Step 8: Setup PostgreSQL database
log_info "Setting up PostgreSQL database..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_user WHERE usename = '$DB_USER'\"" | grep -q 1 || {
    su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
    log_success "Database user created"
}

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\"" | grep -q 1 || {
    su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""
    log_success "Database created"
}

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# Step 9: Clone repository
log_info "Cloning repository..."
if [[ -d "$APP_DIR/.git" ]]; then
    log_warn "Repository already exists, pulling latest changes..."
    cd $APP_DIR
    git pull origin $BRANCH
else
    git clone -b $BRANCH $REPO_URL $APP_DIR
fi
chown -R $APP_USER:$APP_GROUP $APP_DIR
log_success "Repository ready"

# Step 10: Create environment file
log_info "Creating environment file..."
cat > $APP_DIR/.env << EOF
# NBM CLOUD v17.0 Configuration
# Generated on $(date)

# Database
DATABASE_URL=$DATABASE_URL

# Session
SESSION_SECRET=$SESSION_SECRET

# Local backup storage directory
LOCAL_BACKUP_DIR=$BACKUP_DIR

# Server port
PORT=$PORT

# Node environment
NODE_ENV=production
EOF
chown $APP_USER:$APP_GROUP $APP_DIR/.env
chmod 600 $APP_DIR/.env
log_success "Environment file created"

# Step 11: Install dependencies and build
log_info "Installing npm dependencies..."
cd $APP_DIR
sudo -u $APP_USER npm install
log_success "Dependencies installed"

log_info "Building application..."
sudo -u $APP_USER npm run build
log_success "Application built"

# Step 12: Push database schema
log_info "Pushing database schema..."
cd $APP_DIR
sudo -u $APP_USER bash -c "source .env && npm run db:push"
log_success "Database schema applied"

# Step 13: Setup PM2
log_info "Setting up PM2..."
cd $APP_DIR

# Create PM2 ecosystem file if not exists
if [[ ! -f "ecosystem.config.cjs" ]]; then
    cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'nbm-cloud',
    script: 'dist/index.cjs',
    cwd: '/opt/nbm-cloud',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '.env',
    error_file: '/var/log/nbm-cloud/error.log',
    out_file: '/var/log/nbm-cloud/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF
fi

# Start application with PM2
sudo -u $APP_USER bash -c "cd $APP_DIR && pm2 start ecosystem.config.cjs"
sudo -u $APP_USER bash -c "pm2 save"

# Setup PM2 startup
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
log_success "PM2 configured"

# Step 14: Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD v17.0
Documentation=https://github.com/your-username/nbm-cloud
After=network.target postgresql.service

[Service]
Type=forking
User=$APP_USER
Group=$APP_GROUP
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PM2_HOME=/home/$APP_USER/.pm2
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.cjs --env production
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nbm-cloud
log_success "Systemd service created"

# Step 15: Configure firewall (optional)
log_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp
    ufw allow 22/tcp
    ufw --force enable
    log_success "Firewall configured"
else
    log_warn "UFW not installed, skipping firewall configuration"
fi

# Step 16: Create nginx config (optional)
log_info "Creating nginx configuration..."
if command -v nginx &> /dev/null; then
    cat > /etc/nginx/sites-available/nbm-cloud << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    log_success "Nginx configured"
else
    log_warn "Nginx not installed, skipping proxy configuration"
    log_info "To install nginx: apt-get install -y nginx"
fi

# Step 17: Verification
echo ""
log_info "Verifying installation..."

# Check if application is running
sleep 5
if curl -s http://localhost:$PORT/api/auth/mode > /dev/null 2>&1; then
    log_success "Application is running!"
else
    log_error "Application may not be running. Check logs with: pm2 logs nbm-cloud"
fi

# Print summary
echo ""
echo "========================================"
echo "  Installation Complete!               "
echo "========================================"
echo ""
echo "Application URL: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "Database:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Name: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASS"
echo ""
echo "Environment file: $APP_DIR/.env"
echo "Backup directory: $BACKUP_DIR"
echo "Log directory: $LOG_DIR"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 logs nbm-cloud      - View application logs"
echo "  pm2 restart nbm-cloud   - Restart application"
echo "  systemctl status nbm-cloud - Check service status"
echo ""
echo "To update the application:"
echo "  cd $APP_DIR && git pull && npm run build && pm2 restart nbm-cloud"
echo ""
log_success "NBM CLOUD v17.0 is now installed!"
