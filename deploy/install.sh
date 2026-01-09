#!/bin/bash
# NBM CLOUD v17.0 - Script de Instalação para Servidor Local
# Otimizado para: Debian 13 (Trixie), Ubuntu 22.04+, CentOS 9+

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
 Optimized for Debian 13 (Trixie)
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

echo -e "${GREEN}[1/9] Detectando sistema operacional...${NC}"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
    VERSION_CODENAME=${VERSION_CODENAME:-}
else
    echo -e "${RED}Sistema operacional não suportado${NC}"
    exit 1
fi

echo "Sistema detectado: $OS $VERSION ($VERSION_CODENAME)"

echo -e "${GREEN}[2/9] Instalando dependências base...${NC}"

case $OS in
    debian)
        # Update system
        apt-get update
        apt-get upgrade -y
        
        # Install base dependencies
        apt-get install -y \
            curl \
            wget \
            git \
            gnupg \
            ca-certificates \
            lsb-release \
            build-essential \
            python3 \
            python3-pip \
            openssl \
            sudo
        
        echo -e "${GREEN}[3/9] Instalando Node.js ${NODE_VERSION} via NodeSource...${NC}"
        
        # Create keyrings directory
        mkdir -p /etc/apt/keyrings
        
        # Add NodeSource GPG key (método seguro para Debian 13)
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        
        # Add NodeSource repository
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        
        # Install Node.js
        apt-get update
        apt-get install -y nodejs
        
        echo -e "${GREEN}[4/9] Instalando PostgreSQL ${POSTGRES_VERSION}...${NC}"
        
        # Add PostgreSQL GPG key
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
        
        # Add PostgreSQL repository for specific version
        echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" | tee /etc/apt/sources.list.d/pgdg.list
        
        # Install PostgreSQL 16 specifically
        apt-get update
        apt-get install -y postgresql-${POSTGRES_VERSION} postgresql-client-${POSTGRES_VERSION} postgresql-contrib
        
        # Ensure PostgreSQL is running
        systemctl enable postgresql
        systemctl start postgresql
        
        echo -e "${GREEN}[5/9] Instalando Nginx e Certbot...${NC}"
        
        apt-get install -y nginx certbot python3-certbot-nginx
        ;;
        
    ubuntu)
        apt-get update
        apt-get upgrade -y
        
        apt-get install -y \
            curl \
            wget \
            git \
            gnupg \
            ca-certificates \
            lsb-release \
            build-essential \
            python3 \
            python3-pip \
            openssl \
            software-properties-common
        
        echo -e "${GREEN}[3/9] Instalando Node.js ${NODE_VERSION}...${NC}"
        
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        apt-get update
        apt-get install -y nodejs
        
        echo -e "${GREEN}[4/9] Instalando PostgreSQL ${POSTGRES_VERSION}...${NC}"
        
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
        echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | tee /etc/apt/sources.list.d/pgdg.list
        apt-get update
        apt-get install -y postgresql-${POSTGRES_VERSION} postgresql-client-${POSTGRES_VERSION} postgresql-contrib
        
        systemctl enable postgresql
        systemctl start postgresql
        
        echo -e "${GREEN}[5/9] Instalando Nginx e Certbot...${NC}"
        
        apt-get install -y nginx certbot python3-certbot-nginx
        ;;
        
    centos|rhel|rocky|almalinux|fedora)
        dnf update -y
        
        dnf install -y \
            curl \
            wget \
            git \
            gcc-c++ \
            make \
            python3 \
            python3-pip \
            openssl
        
        echo -e "${GREEN}[3/9] Instalando Node.js ${NODE_VERSION}...${NC}"
        
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
        dnf install -y nodejs
        
        echo -e "${GREEN}[4/9] Instalando PostgreSQL ${POSTGRES_VERSION}...${NC}"
        
        dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm || true
        dnf -qy module disable postgresql || true
        dnf install -y postgresql${POSTGRES_VERSION}-server postgresql${POSTGRES_VERSION}-contrib
        
        /usr/pgsql-${POSTGRES_VERSION}/bin/postgresql-${POSTGRES_VERSION}-setup initdb
        systemctl enable postgresql-${POSTGRES_VERSION}
        systemctl start postgresql-${POSTGRES_VERSION}
        
        echo -e "${GREEN}[5/9] Instalando Nginx e Certbot...${NC}"
        
        dnf install -y nginx certbot python3-certbot-nginx
        ;;
        
    *)
        echo -e "${RED}Sistema operacional não suportado: $OS${NC}"
        echo "Sistemas suportados: Debian 13+, Ubuntu 22.04+, CentOS 9+, Rocky Linux 9+"
        exit 1
        ;;
esac

# Verify installations
echo ""
echo -e "${BLUE}Versões instaladas:${NC}"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  PostgreSQL: $(psql --version)"
echo "  Nginx: $(nginx -v 2>&1)"
echo ""

echo -e "${GREEN}[6/9] Criando usuário do sistema...${NC}"

if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -d "$INSTALL_DIR" -s /bin/bash "$APP_USER"
    echo "Usuário $APP_USER criado"
else
    echo "Usuário $APP_USER já existe"
fi

echo -e "${GREEN}[7/9] Configurando PostgreSQL...${NC}"

# Generate random password
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
DB_NAME="nbmcloud"
DB_USER="nbmcloud"

# Create database and user
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "Usuário $DB_USER já existe"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Database $DB_NAME já existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Configure pg_hba.conf for local connections
PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
if [[ -n "$PG_HBA" ]]; then
    # Backup original
    cp "$PG_HBA" "${PG_HBA}.bak"
    
    # Check if md5 auth is already configured
    if ! grep -q "local.*$DB_NAME.*$DB_USER.*md5" "$PG_HBA"; then
        # Add md5 authentication for our user
        echo "local   $DB_NAME    $DB_USER    md5" >> "$PG_HBA"
    fi
    
    # Reload PostgreSQL
    systemctl reload postgresql
fi

echo "Database configurado: $DB_NAME"

echo -e "${GREEN}[8/9] Configurando aplicação...${NC}"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Check if files already exist
if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Atualizando repositório existente..."
    sudo -u "$APP_USER" git pull origin main || true
elif [[ -f "$INSTALL_DIR/package.json" ]]; then
    echo "Arquivos já existem em $INSTALL_DIR"
else
    echo ""
    echo -e "${YELLOW}Os arquivos do projeto precisam ser copiados para $INSTALL_DIR${NC}"
    echo ""
    read -p "URL do repositório Git (deixe vazio se já copiou os arquivos): " GIT_URL
    if [[ -n "$GIT_URL" ]]; then
        git clone "$GIT_URL" "$INSTALL_DIR"
    else
        echo -e "${YELLOW}Certifique-se de que os arquivos estão em $INSTALL_DIR${NC}"
        read -p "Pressione Enter quando os arquivos estiverem copiados..."
    fi
fi

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

# Prompt for domain
echo ""
read -p "Domínio do servidor (ex: nbmcloud.exemplo.com): " DOMAIN
read -p "Email para certificado SSL (ex: admin@exemplo.com): " ADMIN_EMAIL

# Generate session secret
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Create .env file
cat > "$INSTALL_DIR/.env" << EOF
# NBM CLOUD Configuration - Gerado automaticamente
# Data: $(date)

NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Session
SESSION_SECRET=$SESSION_SECRET

# Domain
DOMAIN=$DOMAIN

# Authentication mode (true = local login, false = Replit Auth)
STANDALONE_AUTH=true

# Storage
STORAGE_TYPE=local
STORAGE_PATH=$INSTALL_DIR/storage
EOF

chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env"
chmod 600 "$INSTALL_DIR/.env"

# Create storage directory
mkdir -p "$INSTALL_DIR/storage"
chown "$APP_USER:$APP_USER" "$INSTALL_DIR/storage"

# Install dependencies and build
echo "Instalando dependências npm..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" npm install --production=false

echo "Compilando aplicação..."
sudo -u "$APP_USER" npm run build

# Push database schema
echo "Criando schema do banco de dados..."
sudo -u "$APP_USER" npx drizzle-kit push

echo -e "${GREEN}[9/9] Configurando serviços do sistema...${NC}"

# Create systemd service
cat > /etc/systemd/system/nbm-cloud.service << EOF
[Unit]
Description=NBM CLOUD - Network Backup Management v17.0
Documentation=https://github.com/seu-usuario/nbm-cloud
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nbm-cloud

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/storage

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
cat > /etc/nginx/sites-available/nbm-cloud << EOF
# NBM CLOUD - Nginx Configuration
# Generated: $(date)

upstream nbmcloud_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/nbm-cloud.access.log;
    error_log /var/log/nginx/nbm-cloud.error.log;

    # Max upload size (for backup files)
    client_max_body_size 100M;

    location / {
        proxy_pass http://nbmcloud_backend;
        proxy_http_version 1.1;
        
        # WebSocket support (required for agents)
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        
        # Timeouts (increased for WebSocket)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 86400s;  # 24h for WebSocket
        
        # Buffer settings
        proxy_buffering off;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://nbmcloud_backend/api/health;
        access_log off;
    }
}
EOF

# Enable Nginx site
mkdir -p /etc/nginx/sites-enabled
ln -sf /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test nginx config
nginx -t

# Reload services
systemctl daemon-reload
systemctl enable nbm-cloud
systemctl enable nginx
systemctl restart postgresql
systemctl start nbm-cloud
systemctl restart nginx

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet nbm-cloud; then
    echo -e "${GREEN}Serviço NBM CLOUD iniciado com sucesso!${NC}"
else
    echo -e "${YELLOW}Verificando logs do serviço...${NC}"
    journalctl -u nbm-cloud -n 20 --no-pager
fi

# SSL Certificate (optional)
echo ""
if [[ -n "$DOMAIN" && -n "$ADMIN_EMAIL" && "$DOMAIN" != "localhost" ]]; then
    read -p "Deseja configurar SSL com Let's Encrypt? (y/N) " SETUP_SSL
    if [[ "$SETUP_SSL" == "y" || "$SETUP_SSL" == "Y" ]]; then
        certbot --nginx -d "$DOMAIN" --email "$ADMIN_EMAIL" --agree-tos --non-interactive --redirect
    fi
fi

# Configure firewall if available
if command -v ufw &> /dev/null; then
    echo ""
    read -p "Configurar firewall UFW? (y/N) " SETUP_UFW
    if [[ "$SETUP_UFW" == "y" || "$SETUP_UFW" == "Y" ]]; then
        ufw allow 22/tcp    # SSH
        ufw allow 80/tcp    # HTTP
        ufw allow 443/tcp   # HTTPS
        ufw --force enable
        echo "Firewall UFW configurado"
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║       NBM CLOUD v17.0 instalado com sucesso!              ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Diretório:${NC}    $INSTALL_DIR"
echo -e "  ${BLUE}Usuário:${NC}      $APP_USER"
echo -e "  ${BLUE}Database:${NC}     $DB_NAME"
echo -e "  ${BLUE}URL:${NC}          http://$DOMAIN"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo -e "    systemctl status nbm-cloud     - Ver status"
echo -e "    systemctl restart nbm-cloud    - Reiniciar"
echo -e "    journalctl -u nbm-cloud -f     - Ver logs em tempo real"
echo ""
echo -e "  ${YELLOW}Credenciais salvas em:${NC} $INSTALL_DIR/.env"
echo ""
echo -e "  ${GREEN}Acesse o sistema em:${NC} ${BLUE}http://$DOMAIN${NC}"
echo ""

# Save installation log
cat > "$INSTALL_DIR/INSTALL_INFO.txt" << EOF
NBM CLOUD v17.0 - Installation Info
====================================
Date: $(date)
OS: $OS $VERSION
Domain: $DOMAIN
Database: $DB_NAME
User: $DB_USER
Install Dir: $INSTALL_DIR

Node.js: $(node --version)
PostgreSQL: $(psql --version)
Nginx: $(nginx -v 2>&1)

Service: nbm-cloud.service
Config: $INSTALL_DIR/.env
Logs: journalctl -u nbm-cloud
EOF

chown "$APP_USER:$APP_USER" "$INSTALL_DIR/INSTALL_INFO.txt"
