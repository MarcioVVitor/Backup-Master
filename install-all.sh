#!/bin/bash
#############################################################
# NBM CLOUD v17.0 - Full Automatic Installation Script
# For Debian 13 (Trixie) / Ubuntu 22.04+
# 
# Usage: curl -sL URL | sudo bash
#############################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "=============================================="
echo "  NBM CLOUD v17.0 - Full Automatic Installer"
echo "  Network Backup Management Cloud"
echo "=============================================="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root: sudo bash install-all.sh"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/nbm-cloud"
BACKUP_DIR="/opt/nbm/backups"
DB_NAME="nbmcloud"
DB_USER="nbmcloud"
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
GITHUB_REPO="https://github.com/efrfranca/nbm-cloud.git"

log_info "Installation directory: $INSTALL_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Create directories
log_info "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p /etc/apt/keyrings

# Update system
log_info "Updating system packages..."
apt-get update -qq

# Install basic dependencies
log_info "Installing dependencies..."
apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release openssl

#############################################################
# Install Node.js 20
#############################################################
log_info "Checking Node.js..."
if ! command -v node &> /dev/null || [[ $(node -v 2>/dev/null) != v20* ]]; then
    log_info "Installing Node.js 20..."
    
    # Remove old nodejs if exists
    apt-get remove -y nodejs npm 2>/dev/null || true
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    
    apt-get update -qq
    apt-get install -y nodejs
    log_success "Node.js installed: $(node -v)"
else
    log_success "Node.js already installed: $(node -v)"
fi

#############################################################
# Install PostgreSQL 16
#############################################################
log_info "Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    log_info "Installing PostgreSQL 16..."
    
    # Add PostgreSQL repository
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    
    # Get distribution codename
    DISTRO=$(lsb_release -cs 2>/dev/null || echo "bookworm")
    
    # For Debian 13 (trixie), use bookworm repo as fallback
    if [ "$DISTRO" = "trixie" ]; then
        DISTRO="bookworm"
    fi
    
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt ${DISTRO}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    
    apt-get update -qq
    apt-get install -y postgresql-16 postgresql-contrib-16
    
    systemctl enable postgresql
    systemctl start postgresql
    
    log_success "PostgreSQL installed: $(psql --version)"
else
    log_success "PostgreSQL already installed: $(psql --version)"
    systemctl start postgresql 2>/dev/null || true
fi

#############################################################
# Install PM2
#############################################################
log_info "Installing PM2..."
npm install -g pm2 --silent
log_success "PM2 installed: $(pm2 -v)"

#############################################################
# Configure PostgreSQL Database
#############################################################
log_info "Configuring database..."

# Create user and database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

log_success "Database '${DB_NAME}' created with user '${DB_USER}'"

#############################################################
# Clone or Update Repository
#############################################################
log_info "Getting NBM Cloud source code..."

if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/main
else
    log_info "Cloning repository..."
    rm -rf "$INSTALL_DIR"/*
    git clone "$GITHUB_REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
log_success "Source code ready"

#############################################################
# Create Environment File
#############################################################
log_info "Creating environment configuration..."

cat > "$INSTALL_DIR/.env" << EOF
# NBM Cloud v17.0 Configuration
# Generated: $(date)

# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

# Session
SESSION_SECRET=${SESSION_SECRET}

# Backup Storage
LOCAL_BACKUP_DIR=${BACKUP_DIR}

# Server
PORT=5000
NODE_ENV=production
EOF

chmod 600 "$INSTALL_DIR/.env"
log_success "Environment file created"

#############################################################
# Install Dependencies and Build
#############################################################
log_info "Installing npm dependencies (this may take a few minutes)..."
cd "$INSTALL_DIR"
npm install --silent

log_info "Building application..."
npm run build

log_info "Pushing database schema..."
npm run db:push

log_success "Application built successfully"

#############################################################
# Configure PM2 Service
#############################################################
log_info "Configuring PM2 service..."

# Stop existing if running
pm2 delete nbm-cloud 2>/dev/null || true

# Start application
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root 2>/dev/null || true

log_success "PM2 service configured"

#############################################################
# Configure Firewall (if ufw is installed)
#############################################################
if command -v ufw &> /dev/null; then
    log_info "Configuring firewall..."
    ufw allow 5000/tcp 2>/dev/null || true
    log_success "Port 5000 opened"
fi

#############################################################
# Final Status
#############################################################
echo ""
echo "=============================================="
echo -e "${GREEN}  NBM CLOUD v17.0 INSTALLED SUCCESSFULLY!${NC}"
echo "=============================================="
echo ""
echo "Access: http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "Database:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Name: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Pass: ${DB_PASS}"
echo ""
echo "Files:"
echo "  App: ${INSTALL_DIR}"
echo "  Backups: ${BACKUP_DIR}"
echo "  Config: ${INSTALL_DIR}/.env"
echo ""
echo "Commands:"
echo "  pm2 status           - Check status"
echo "  pm2 logs nbm-cloud   - View logs"
echo "  pm2 restart nbm-cloud - Restart service"
echo ""
echo "The first user to register will become admin."
echo ""
