#!/bin/bash
#
# NBM CLOUD v17.0 - Standalone Installation Script
# 
# This script installs NBM CLOUD from the current directory
# No GitHub authentication required - just copy the files first.
#
# Usage:
#   1. Copy all files to the server: scp -r ./* user@server:/tmp/nbm-cloud/
#   2. SSH to the server: ssh user@server
#   3. Run: cd /tmp/nbm-cloud && sudo ./install-standalone.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [[ $EUID -ne 0 ]]; then
   log_error "Execute com sudo: sudo ./install-standalone.sh"
   exit 1
fi

# Fix hostname resolution warning
CURRENT_HOSTNAME=$(hostname)
if ! grep -q "$CURRENT_HOSTNAME" /etc/hosts 2>/dev/null; then
    echo "127.0.1.1 $CURRENT_HOSTNAME" >> /etc/hosts
    log_info "Hostname adicionado ao /etc/hosts"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  NBM CLOUD v17.0 - Instalação Standalone ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if package.json exists (we're in the right directory)
if [[ ! -f "package.json" ]]; then
    log_error "Execute este script da pasta do NBM CLOUD"
    log_error "Os arquivos package.json, server/, client/ devem estar presentes"
    exit 1
fi

SOURCE_DIR=$(pwd)
log_info "Instalando de: $SOURCE_DIR"

# Step 1: System update
log_info "Atualizando sistema..."
apt-get update -y -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# Step 2: Install dependencies
log_info "Instalando dependências..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl wget gnupg2 lsb-release ca-certificates \
    apt-transport-https software-properties-common \
    build-essential openssl jq

# Step 3: Install Node.js 20
if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v20 ]]; then
    log_info "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs
    log_success "Node.js $(node -v) instalado"
else
    log_success "Node.js $(node -v) já instalado"
fi

# Step 4: Install PostgreSQL 16
if ! command -v psql &> /dev/null; then
    log_info "Instalando PostgreSQL 16..."
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - 2>/dev/null
    apt-get update -y -qq
    apt-get install -y -qq postgresql-16 postgresql-contrib-16
    systemctl enable postgresql
    systemctl start postgresql
    log_success "PostgreSQL 16 instalado"
else
    log_success "PostgreSQL já instalado"
fi

# Step 5: Install PM2
if ! command -v pm2 &> /dev/null; then
    log_info "Instalando PM2..."
    npm install -g pm2 > /dev/null 2>&1
    log_success "PM2 instalado"
else
    log_success "PM2 já instalado"
fi

# Step 6: Create system user
if ! id "$APP_USER" &>/dev/null; then
    log_info "Criando usuário $APP_USER..."
    useradd -r -s /bin/bash -m -d /home/$APP_USER $APP_USER
    log_success "Usuário criado"
else
    log_success "Usuário $APP_USER já existe"
fi

# Step 7: Create directories
log_info "Criando diretórios..."
mkdir -p $APP_DIR $BACKUP_DIR $LOG_DIR
chown -R $APP_USER:$APP_GROUP $BACKUP_DIR $LOG_DIR

# Step 8: Setup PostgreSQL
log_info "Configurando banco de dados..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_user WHERE usename = '$DB_USER'\"" | grep -q 1 || {
    su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\"" > /dev/null
}
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\"" | grep -q 1 || {
    su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\"" > /dev/null
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\"" > /dev/null
}
log_success "Banco de dados configurado"

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# Step 9: Copy application files
log_info "Copiando arquivos para $APP_DIR..."
rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' "$SOURCE_DIR/" "$APP_DIR/"
chown -R $APP_USER:$APP_GROUP $APP_DIR
log_success "Arquivos copiados"

# Step 10: Create environment file
log_info "Criando arquivo de configuração..."
cat > $APP_DIR/.env << EOF
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
LOCAL_BACKUP_DIR=$BACKUP_DIR
PORT=$PORT
NODE_ENV=production
EOF
chown $APP_USER:$APP_GROUP $APP_DIR/.env
chmod 600 $APP_DIR/.env
log_success "Configuração criada"

# Step 11: Install npm dependencies
log_info "Instalando dependências npm (pode demorar)..."
cd $APP_DIR
sudo -u $APP_USER npm install --legacy-peer-deps > /dev/null 2>&1
log_success "Dependências instaladas"

# Step 12: Build application
log_info "Compilando aplicação..."
sudo -u $APP_USER npm run build > /dev/null 2>&1
log_success "Aplicação compilada"

# Step 13: Push database schema
log_info "Aplicando schema do banco..."
sudo -u $APP_USER bash -c "cd $APP_DIR && source .env && npm run db:push" > /dev/null 2>&1 || {
    sudo -u $APP_USER bash -c "cd $APP_DIR && source .env && npm run db:push --force" > /dev/null 2>&1
}
log_success "Schema aplicado"

# Step 14: Create PM2 ecosystem
cat > $APP_DIR/ecosystem.config.cjs << 'EOF'
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
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF
chown $APP_USER:$APP_GROUP $APP_DIR/ecosystem.config.cjs

# Step 15: Start with PM2
log_info "Iniciando aplicação..."
sudo -u $APP_USER bash -c "cd $APP_DIR && pm2 delete nbm-cloud 2>/dev/null; pm2 start ecosystem.config.cjs"
sudo -u $APP_USER pm2 save > /dev/null 2>&1
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER > /dev/null 2>&1
log_success "Aplicação iniciada"

# Step 16: Create systemd service
cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD v17.0
After=network.target postgresql.service

[Service]
Type=forking
User=$APP_USER
Group=$APP_GROUP
Environment=PM2_HOME=/home/$APP_USER/.pm2
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.cjs
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable nbm-cloud > /dev/null 2>&1

# Step 17: Configure firewall
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp > /dev/null 2>&1
    ufw allow 22/tcp > /dev/null 2>&1
fi

# Verify
sleep 3
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        Instalação Concluída!             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Acesse: http://$SERVER_IP:$PORT"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│ Banco de Dados                          │"
echo "├─────────────────────────────────────────┤"
echo "│ Host: localhost                         │"
echo "│ Porta: 5432                             │"
echo "│ Banco: $DB_NAME"
echo "│ Usuário: $DB_USER"
echo "│ Senha: $DB_PASS"
echo "└─────────────────────────────────────────┘"
echo ""
echo "Arquivo de config: $APP_DIR/.env"
echo "Diretório backups: $BACKUP_DIR"
echo ""
echo "Comandos úteis:"
echo "  pm2 status             - Ver status"
echo "  pm2 logs nbm-cloud     - Ver logs"
echo "  pm2 restart nbm-cloud  - Reiniciar"
echo ""
echo "Primeiro acesso: Crie um usuário em /auth"
echo "O primeiro usuário será administrador."
echo ""
log_success "NBM CLOUD v17.0 instalado com sucesso!"
