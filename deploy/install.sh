#!/bin/bash
# NBM CLOUD v17.0 - Script de Instalação para Servidor Local
# Suporta: Ubuntu 20.04+, Debian 11+, CentOS 8+

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
  _   _ ____  __  __    ____ _     ___  _   _ ____  
 | \ | | __ )|  \/  |  / ___| |   / _ \| | | |  _ \ 
 |  \| |  _ \| |\/| | | |   | |  | | | | | | | | | |
 | |\  | |_) | |  | | | |___| |__| |_| | |_| | |_| |
 |_| \_|____/|_|  |_|  \____|_____\___/ \___/|____/ 
                                                     
 Server Installation Script v17.0
EOF
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Este script deve ser executado como root${NC}"
    echo "Execute: sudo $0"
    exit 1
fi

# Variables
INSTALL_DIR="/opt/nbm-cloud"
APP_USER="nbmcloud"
NODE_VERSION="20"
POSTGRES_VERSION="16"

echo -e "${GREEN}[1/8] Detectando sistema operacional...${NC}"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}Sistema operacional não suportado${NC}"
    exit 1
fi

echo "Sistema detectado: $OS $VERSION"

echo -e "${GREEN}[2/8] Instalando dependências do sistema...${NC}"

case $OS in
    ubuntu|debian)
        apt-get update
        apt-get install -y curl wget git build-essential
        
        # Node.js
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
        fi
        
        # PostgreSQL
        if ! command -v psql &> /dev/null; then
            apt-get install -y postgresql postgresql-contrib
        fi
        
        # Nginx
        apt-get install -y nginx certbot python3-certbot-nginx
        ;;
        
    centos|rhel|fedora|rocky|almalinux)
        dnf update -y
        dnf install -y curl wget git gcc-c++ make
        
        # Node.js
        if ! command -v node &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
            dnf install -y nodejs
        fi
        
        # PostgreSQL
        if ! command -v psql &> /dev/null; then
            dnf install -y postgresql-server postgresql-contrib
            postgresql-setup --initdb
            systemctl enable postgresql
            systemctl start postgresql
        fi
        
        # Nginx
        dnf install -y nginx certbot python3-certbot-nginx
        ;;
        
    *)
        echo -e "${RED}Sistema operacional não suportado: $OS${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}[3/8] Criando usuário do sistema...${NC}"

if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -d "$INSTALL_DIR" -s /bin/bash "$APP_USER"
fi

echo -e "${GREEN}[4/8] Configurando PostgreSQL...${NC}"

# Generate random password
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
DB_NAME="nbmcloud"
DB_USER="nbmcloud"

# Create database and user
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo -e "${GREEN}[5/8] Clonando repositório...${NC}"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Atualizando repositório existente..."
    git pull origin main
else
    read -p "URL do repositório Git (ou deixe vazio para copiar local): " GIT_URL
    if [[ -n "$GIT_URL" ]]; then
        git clone "$GIT_URL" .
    else
        echo -e "${YELLOW}Copie os arquivos do projeto para $INSTALL_DIR${NC}"
        read -p "Pressione Enter quando os arquivos estiverem copiados..."
    fi
fi

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

echo -e "${GREEN}[6/8] Instalando dependências do Node.js...${NC}"

cd "$INSTALL_DIR"
sudo -u "$APP_USER" npm install

echo -e "${GREEN}[7/8] Configurando variáveis de ambiente...${NC}"

# Generate session secret
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Prompt for domain
read -p "Domínio do servidor (ex: nbmcloud.exemplo.com): " DOMAIN
read -p "Email para certificado SSL (ex: admin@exemplo.com): " ADMIN_EMAIL

# Create .env file
cat > "$INSTALL_DIR/.env" << EOF
# NBM CLOUD Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Session
SESSION_SECRET=$SESSION_SECRET

# Domain (used for authentication callbacks)
DOMAIN=$DOMAIN

# Object Storage (opcional - configure se usar storage externo)
# STORAGE_TYPE=local
# STORAGE_PATH=/opt/nbm-cloud/storage
EOF

chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env"
chmod 600 "$INSTALL_DIR/.env"

# Create storage directory
mkdir -p "$INSTALL_DIR/storage"
chown "$APP_USER:$APP_USER" "$INSTALL_DIR/storage"

echo -e "${GREEN}[8/8] Configurando serviços...${NC}"

# Build application
cd "$INSTALL_DIR"
sudo -u "$APP_USER" npm run build

# Create systemd service
cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD - Network Backup Management
After=network.target postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
cat > /etc/nginx/sites-available/nbm-cloud << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
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

# Enable site
ln -sf /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test nginx config
nginx -t

# Push database schema
cd "$INSTALL_DIR"
sudo -u "$APP_USER" npx drizzle-kit push

# Reload services
systemctl daemon-reload
systemctl enable nbm-cloud
systemctl enable nginx
systemctl restart postgresql
systemctl start nbm-cloud
systemctl restart nginx

# SSL Certificate (optional)
if [[ -n "$DOMAIN" && -n "$ADMIN_EMAIL" ]]; then
    echo ""
    read -p "Deseja configurar SSL com Let's Encrypt? (y/N) " SETUP_SSL
    if [[ "$SETUP_SSL" == "y" || "$SETUP_SSL" == "Y" ]]; then
        certbot --nginx -d "$DOMAIN" --email "$ADMIN_EMAIL" --agree-tos --non-interactive
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NBM CLOUD instalado com sucesso!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Diretório:    ${BLUE}$INSTALL_DIR${NC}"
echo -e "Usuário:      ${BLUE}$APP_USER${NC}"
echo -e "Database:     ${BLUE}$DB_NAME${NC}"
echo -e "URL:          ${BLUE}http://$DOMAIN${NC}"
echo ""
echo -e "Comandos úteis:"
echo -e "  ${YELLOW}systemctl status nbm-cloud${NC}    - Ver status"
echo -e "  ${YELLOW}systemctl restart nbm-cloud${NC}   - Reiniciar"
echo -e "  ${YELLOW}journalctl -u nbm-cloud -f${NC}    - Ver logs"
echo ""
echo -e "${YELLOW}IMPORTANTE: Crie o primeiro usuário admin acessando:${NC}"
echo -e "${BLUE}http://$DOMAIN${NC}"
echo ""
echo -e "Credenciais do banco de dados salvas em: ${BLUE}$INSTALL_DIR/.env${NC}"
