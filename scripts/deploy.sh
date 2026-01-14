#!/bin/bash
# NBM CLOUD v17.0 - Script de Deployment Automático
# Uso: sudo ./scripts/deploy.sh
# Servidor: Debian 13 | PostgreSQL 16 | Node.js 20

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/opt/nbm-cloud"
LOG_FILE="/var/log/nbm-cloud/deploy.log"

log() {
    echo -e "$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   NBM CLOUD v17.0 - Deployment Production    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Criar diretório de logs se não existir
mkdir -p /var/log/nbm-cloud

cd "$PROJECT_DIR"

# 1. Verificar pré-requisitos
log "${YELLOW}[1/8] Verificando pré-requisitos...${NC}"
command -v node >/dev/null 2>&1 || { log "${RED}ERRO: Node.js não instalado${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { log "${RED}ERRO: npm não instalado${NC}"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { log "${RED}ERRO: PM2 não instalado${NC}"; exit 1; }
command -v psql >/dev/null 2>&1 || { log "${RED}ERRO: PostgreSQL client não instalado${NC}"; exit 1; }
log "  Node.js: $(node -v)"
log "  npm: $(npm -v)"
log "  PM2: $(pm2 -v)"
log "  ${GREEN}✓ Pré-requisitos OK${NC}"

# 2. Backup do código atual
log "${YELLOW}[2/8] Criando backup...${NC}"
BACKUP_DIR="/opt/nbm-cloud-backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date '+%Y%m%d_%H%M%S').tar.gz"
tar -czf "$BACKUP_FILE" --exclude='node_modules' --exclude='dist' -C /opt nbm-cloud 2>/dev/null || true
log "  Backup: $BACKUP_FILE"
# Manter apenas últimos 5 backups
ls -t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
log "  ${GREEN}✓ Backup criado${NC}"

# 3. Atualizar código do GitHub
log "${YELLOW}[3/8] Atualizando código do GitHub...${NC}"
git fetch origin main 2>&1 | head -5
CURRENT_COMMIT=$(git rev-parse --short HEAD)
git pull origin main 2>&1 | head -10
NEW_COMMIT=$(git rev-parse --short HEAD)
if [ "$CURRENT_COMMIT" != "$NEW_COMMIT" ]; then
    log "  Atualizado: $CURRENT_COMMIT -> $NEW_COMMIT"
else
    log "  Já está na versão mais recente: $CURRENT_COMMIT"
fi
log "  ${GREEN}✓ Código atualizado${NC}"

# 4. Parar serviços existentes
log "${YELLOW}[4/8] Parando serviços...${NC}"
pm2 stop nbm-cloud 2>/dev/null || true
pm2 delete nbm-cloud 2>/dev/null || true
# Matar processos na porta 5000
for pid in $(lsof -t -i:5000 2>/dev/null); do
    log "  Matando processo $pid na porta 5000"
    kill -9 $pid 2>/dev/null || true
done
sleep 2
log "  ${GREEN}✓ Serviços parados${NC}"

# 5. Instalar dependências se necessário
log "${YELLOW}[5/8] Verificando dependências...${NC}"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    log "  Instalando dependências..."
    npm ci --production=false 2>&1 | tail -5
fi
log "  ${GREEN}✓ Dependências OK${NC}"

# 6. Build
log "${YELLOW}[6/8] Fazendo build da aplicação...${NC}"
rm -rf dist/
npm run build 2>&1 | tail -10

# Verificar build
if [ ! -f "dist/index.cjs" ]; then
    log "${RED}ERRO: Build falhou - dist/index.cjs não encontrado${NC}"
    exit 1
fi
JS_COUNT=$(ls dist/public/assets/*.js 2>/dev/null | wc -l)
if [ "$JS_COUNT" -eq 0 ]; then
    log "${RED}ERRO: Build falhou - arquivos JS não encontrados${NC}"
    exit 1
fi
log "  ${GREEN}✓ Build concluído ($JS_COUNT arquivos JS)${NC}"

# 7. Verificar configuração
log "${YELLOW}[7/8] Verificando configuração...${NC}"
if [ ! -f ".env" ]; then
    log "${RED}ERRO: Arquivo .env não encontrado${NC}"
    log "Execute primeiro: sudo ./scripts/setup.sh"
    exit 1
fi

source .env

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"usuario:senha"* ]]; then
    log "${RED}ERRO: DATABASE_URL não configurado corretamente${NC}"
    log "Execute primeiro: sudo ./scripts/setup.sh"
    exit 1
fi

# Testar conexão com banco
if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
    log "  ${GREEN}✓ Conexão com banco OK${NC}"
else
    log "${RED}ERRO: Não foi possível conectar ao banco de dados${NC}"
    exit 1
fi

# Executar migrações
log "  Aplicando migrações..."
DATABASE_URL="$DATABASE_URL" npm run db:push 2>&1 | tail -3 || true
log "  ${GREEN}✓ Configuração OK${NC}"

# 8. Iniciar aplicação
log "${YELLOW}[8/8] Iniciando aplicação...${NC}"
DATABASE_URL="$DATABASE_URL" \
SESSION_SECRET="$SESSION_SECRET" \
NODE_ENV=production \
pm2 start dist/index.cjs --name nbm-cloud -i 1 --update-env

pm2 save
sleep 3

# Verificações finais
log ""
log "${YELLOW}Verificações finais...${NC}"

# Testar assets
JS_FILE=$(ls dist/public/assets/index-*.js 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
    JS_NAME=$(basename "$JS_FILE")
    ASSET_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/assets/$JS_NAME" 2>/dev/null)
    if [ "$ASSET_TEST" = "200" ]; then
        log "  ${GREEN}✓ Assets sendo servidos corretamente${NC}"
    else
        log "  ${RED}✗ Problema ao servir assets (HTTP $ASSET_TEST)${NC}"
    fi
fi

# Testar aplicação
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    log "  ${GREEN}✓ Aplicação respondendo${NC}"
else
    log "  ${RED}✗ Aplicação não respondendo (HTTP $HEALTH)${NC}"
fi

# Testar API
API_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/api/auth/mode" 2>/dev/null)
if [ "$API_TEST" = "200" ] || [ "$API_TEST" = "304" ]; then
    log "  ${GREEN}✓ API respondendo${NC}"
else
    log "  ${RED}✗ API não respondendo (HTTP $API_TEST)${NC}"
fi

# Resultado
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        DEPLOYMENT CONCLUÍDO!                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo -e "  ${GREEN}URL: http://$IP:5000${NC}"
echo -e "  Commit: $NEW_COMMIT"
echo -e "  Log: $LOG_FILE"
echo ""
pm2 status
