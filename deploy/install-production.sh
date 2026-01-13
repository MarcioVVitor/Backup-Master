#!/bin/bash
# NBM CLOUD - Script de Instalação/Atualização para Produção
# Servidor: 143.255.197.25
# Uso: curl -fsSL https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/deploy/install-production.sh | sudo bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/nbm-cloud"
APP_NAME="nbm-cloud"
GITHUB_REPO="https://github.com/MarcioVVitor/Backup-Master.git"

echo -e "${BLUE}"
cat << 'EOF'
==========================================
  NBM CLOUD v17.0 - Production Installer
  Network Backup Management Cloud
==========================================
EOF
echo -e "${NC}"

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo $0${NC}"
    exit 1
fi

# Detect if this is first install or update
if [[ -d "$APP_DIR/.git" ]]; then
    echo -e "${YELLOW}Detectada instalação existente. Atualizando...${NC}"
    IS_UPDATE=true
else
    echo -e "${YELLOW}Nova instalação detectada.${NC}"
    IS_UPDATE=false
fi

# Install system dependencies
echo -e "${BLUE}[1/7] Instalando dependências do sistema...${NC}"
apt update -qq
apt install -y curl git postgresql-client

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
    echo -e "${BLUE}[2/7] Instalando Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}[2/7] Node.js $(node -v) já instalado${NC}"
fi

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo -e "${BLUE}[3/7] Instalando PM2...${NC}"
    npm install -g pm2
else
    echo -e "${GREEN}[3/7] PM2 já instalado${NC}"
fi

# Clone or update repository
if [[ "$IS_UPDATE" == true ]]; then
    echo -e "${BLUE}[4/7] Atualizando código do repositório...${NC}"
    cd "$APP_DIR"
    
    # Stop application before update
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # Fetch and reset to latest
    git fetch origin main
    git reset --hard origin/main
else
    echo -e "${BLUE}[4/7] Clonando repositório...${NC}"
    mkdir -p "$APP_DIR"
    git clone "$GITHUB_REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install dependencies
echo -e "${BLUE}[5/7] Instalando dependências do projeto...${NC}"
npm install

# Create .env if not exists
if [[ ! -f "$APP_DIR/.env" ]]; then
    echo -e "${YELLOW}[6/7] Criando arquivo .env...${NC}"
    
    # Generate random session secret
    SESSION_SECRET=$(openssl rand -hex 32)
    
    cat > "$APP_DIR/.env" << EOF
# NBM CLOUD - Configuração de Produção
# Gerado em: $(date)

# Database PostgreSQL (CONFIGURE COM SEUS DADOS)
DATABASE_URL=postgresql://nbm_user:SUA_SENHA@localhost:5432/nbm_cloud

# Sessão (gerado automaticamente)
SESSION_SECRET=$SESSION_SECRET

# Ambiente
NODE_ENV=production

# Porta (padrão 5000)
PORT=5000
EOF

    chmod 600 "$APP_DIR/.env"
    
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}IMPORTANTE: Edite o arquivo .env com${NC}"
    echo -e "${RED}suas credenciais do PostgreSQL:${NC}"
    echo -e "${YELLOW}nano $APP_DIR/.env${NC}"
    echo -e "${RED}========================================${NC}"
else
    echo -e "${GREEN}[6/7] Arquivo .env já existe${NC}"
fi

# Build application
echo -e "${BLUE}[7/7] Compilando aplicação...${NC}"
npm run build

# Start/Restart with PM2
if pm2 list | grep -q "$APP_NAME"; then
    echo -e "${BLUE}Reiniciando aplicação...${NC}"
    pm2 restart $APP_NAME
else
    echo -e "${BLUE}Iniciando aplicação...${NC}"
    pm2 start dist/index.cjs --name $APP_NAME
fi

# Save PM2 config and setup startup
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NBM CLOUD Instalado/Atualizado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Diretório: ${BLUE}$APP_DIR${NC}"
echo -e "Logs:      ${BLUE}pm2 logs $APP_NAME${NC}"
echo -e "Status:    ${BLUE}pm2 status${NC}"
echo -e "Restart:   ${BLUE}pm2 restart $APP_NAME${NC}"
echo ""

if [[ "$IS_UPDATE" != true ]]; then
    echo -e "${YELLOW}Próximos passos:${NC}"
    echo -e "1. Edite o arquivo .env: ${BLUE}nano $APP_DIR/.env${NC}"
    echo -e "2. Configure DATABASE_URL com suas credenciais PostgreSQL"
    echo -e "3. Reinicie: ${BLUE}pm2 restart $APP_NAME${NC}"
    echo ""
fi

# Show status
pm2 status
