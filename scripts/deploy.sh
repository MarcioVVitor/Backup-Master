#!/bin/bash
#
# NBM CLOUD v17.0 - Deploy Script
# Single script for production server deployment
#
# Usage: curl -sSL https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/scripts/deploy.sh | sudo bash
#    or: sudo ./deploy.sh
#

set -e

# Configuration
APP_NAME="nbm-cloud"
APP_DIR="/opt/nbm-cloud"
BACKUP_DIR="/opt/nbm/backups"
LOG_DIR="/var/log/nbm-cloud"
SERVICE_USER="nbm"
GITHUB_REPO="https://github.com/MarcioVVitor/Backup-Master.git"
GITHUB_BRANCH="main"
NODE_VERSION="20"
PORT=5000

# Colors
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
echo "   NBM CLOUD v17.0 - Production Deploy"
echo "=============================================="
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "Execute como root: sudo $0"
    exit 1
fi

# Detect mode
if [[ -d "$APP_DIR/.git" ]]; then
    MODE="update"
    log_info "Modo: ATUALIZAÇÃO (repositório existente)"
else
    MODE="install"
    log_info "Modo: INSTALAÇÃO NOVA"
fi

# ============================================================================
# STEP 1: System Dependencies
# ============================================================================
log_info "1/8 - Instalando dependências do sistema..."

apt-get update -qq

apt-get install -y -qq \
    curl wget git build-essential ca-certificates gnupg \
    lsb-release ufw nginx openssl jq 2>/dev/null || true

# Install Node.js if needed
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) != "$NODE_VERSION" ]]; then
    log_info "Instalando Node.js ${NODE_VERSION}..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y -qq nodejs
fi

# Install PM2
npm install -g pm2 2>/dev/null || true

log_success "Dependências instaladas (Node $(node -v))"

# ============================================================================
# STEP 2: Create User and Directories
# ============================================================================
log_info "2/8 - Configurando usuário e diretórios..."

# Create user if not exists
if ! id "$SERVICE_USER" &>/dev/null; then
    groupadd -r "$SERVICE_USER" 2>/dev/null || true
    useradd -r -g "$SERVICE_USER" -d "/home/$SERVICE_USER" -m -s /bin/bash "$SERVICE_USER"
fi

# Ensure directories exist
mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR" "/home/$SERVICE_USER/.pm2"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR" "/home/$SERVICE_USER"

log_success "Usuário e diretórios configurados"

# ============================================================================
# STEP 3: Clone or Update Repository
# ============================================================================
log_info "3/8 - Atualizando código fonte..."

# Fix git safe directory issue
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

cd "$APP_DIR"

if [[ "$MODE" == "update" ]]; then
    # Save current commit
    PREVIOUS=$(git rev-parse HEAD 2>/dev/null || echo "none")
    echo "$PREVIOUS" > .previous-deploy
    
    # Update
    git fetch --all
    git reset --hard "origin/$GITHUB_BRANCH"
    git pull origin "$GITHUB_BRANCH"
else
    # Fresh clone
    cd /opt
    rm -rf nbm-cloud
    git clone -b "$GITHUB_BRANCH" "$GITHUB_REPO" nbm-cloud
    cd "$APP_DIR"
fi

CURRENT=$(git rev-parse HEAD)
echo "$CURRENT" > .last-deploy
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

log_success "Código atualizado (${CURRENT:0:8})"

# ============================================================================
# STEP 4: Install NPM Packages
# ============================================================================
log_info "4/8 - Instalando pacotes npm..."

cd "$APP_DIR"
sudo -u "$SERVICE_USER" npm ci --production=false 2>/dev/null || sudo -u "$SERVICE_USER" npm install

log_success "Pacotes npm instalados"

# ============================================================================
# STEP 5: Build Application
# ============================================================================
log_info "5/8 - Compilando aplicação..."

cd "$APP_DIR"
sudo -u "$SERVICE_USER" npm run build

log_success "Aplicação compilada"

# ============================================================================
# STEP 6: Environment Configuration
# ============================================================================
log_info "6/8 - Configurando ambiente..."

ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
    
    cat > "$ENV_FILE" << EOF
# NBM CLOUD Production - $(date -Iseconds)
DATABASE_URL=postgresql://nbm_user:SUA_SENHA@localhost:5432/nbm_cloud
SESSION_SECRET=$SESSION_SECRET
LOCAL_BACKUP_DIR=$BACKUP_DIR
PORT=$PORT
WORKER_POOL_CONCURRENCY=50
EOF
    
    chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
    chmod 640 "$ENV_FILE"
    
    log_warn "Arquivo .env criado - CONFIGURE DATABASE_URL!"
    ENV_CREATED=true
else
    log_success "Arquivo .env já existe"
    ENV_CREATED=false
fi

# ============================================================================
# STEP 7: Database Migration
# ============================================================================
log_info "7/8 - Executando migrações..."

if grep -q "SUA_SENHA" "$ENV_FILE" 2>/dev/null; then
    log_warn "DATABASE_URL não configurado - pulando migrações"
    log_info "Após configurar, execute: cd $APP_DIR && npm run db:push"
    SKIP_DB=true
else
    cd "$APP_DIR"
    set -a; source "$ENV_FILE"; set +a
    sudo -u "$SERVICE_USER" -E npm run db:push 2>/dev/null || log_warn "Migração falhou - verifique DATABASE_URL"
    SKIP_DB=false
    log_success "Migrações executadas"
fi

# ============================================================================
# STEP 8: Start Services
# ============================================================================
log_info "8/8 - Iniciando serviços..."

cd "$APP_DIR"

# Stop existing PM2 process
sudo -u "$SERVICE_USER" pm2 delete "$APP_NAME" 2>/dev/null || true

# Start with PM2
export HOME="/home/$SERVICE_USER"
export PM2_HOME="/home/$SERVICE_USER/.pm2"
sudo -u "$SERVICE_USER" -E pm2 start ecosystem.config.cjs
sudo -u "$SERVICE_USER" -E pm2 save

# Create systemd service
cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD v17.0
After=network.target postgresql.service

[Service]
Type=forking
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment=HOME=/home/$SERVICE_USER
Environment=PM2_HOME=/home/$SERVICE_USER/.pm2
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nbm-cloud.service 2>/dev/null || true

# Configure Nginx
cat > /etc/nginx/sites-available/nbm-cloud << 'EOF'
upstream nbm_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://nbm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
    location /ws {
        proxy_pass http://nbm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
    
    client_max_body_size 100M;
}
EOF

ln -sf /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

log_success "Serviços iniciados"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  DEPLOY CONCLUÍDO!${NC}"
echo "=============================================="
echo ""

if [[ "$ENV_CREATED" == "true" ]] || [[ "$SKIP_DB" == "true" ]]; then
    echo -e "${YELLOW}PRÓXIMOS PASSOS:${NC}"
    echo ""
    echo "1. Configure o banco de dados:"
    echo "   nano $ENV_FILE"
    echo ""
    echo "2. Atualize DATABASE_URL com suas credenciais PostgreSQL"
    echo ""
    echo "3. Execute as migrações:"
    echo "   cd $APP_DIR && source .env && npm run db:push"
    echo ""
    echo "4. Reinicie a aplicação:"
    echo "   pm2 restart $APP_NAME"
    echo ""
else
    echo -e "${GREEN}NBM CLOUD está rodando em:${NC}"
    echo "   http://$(hostname -I | awk '{print $1}')"
    echo ""
fi

echo "Comandos úteis:"
echo "  pm2 logs $APP_NAME      - Ver logs"
echo "  pm2 restart $APP_NAME   - Reiniciar"
echo "  pm2 monit               - Monitor"
echo ""

# Show PM2 status
sudo -u "$SERVICE_USER" pm2 list
