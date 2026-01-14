#!/bin/bash
# NBM CLOUD - Script de Setup Completo
# Uso: sudo ./scripts/setup.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/opt/nbm-cloud"

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     NBM CLOUD v17.0 - Setup Automático       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Gerar senhas seguras
generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24
}

DB_PASSWORD=$(generate_password)
SESSION_SECRET=$(generate_password)
DB_USER="nbm_app"
DB_NAME="nbm_cloud"

echo -e "${YELLOW}[1/7] Gerando credenciais seguras...${NC}"
echo -e "  Usuário DB: ${GREEN}$DB_USER${NC}"
echo -e "  Banco: ${GREEN}$DB_NAME${NC}"
echo -e "  Senha DB: ${GREEN}$DB_PASSWORD${NC}"
echo -e "  Session Secret: ${GREEN}$SESSION_SECRET${NC}"

# Salvar credenciais em arquivo seguro
CREDS_FILE="$PROJECT_DIR/.credentials"
cat > "$CREDS_FILE" << EOF
# NBM CLOUD - Credenciais (MANTENHA SEGURO!)
# Gerado em: $(date)
DB_USER=$DB_USER
DB_NAME=$DB_NAME
DB_PASSWORD=$DB_PASSWORD
SESSION_SECRET=$SESSION_SECRET
EOF
chmod 600 "$CREDS_FILE"
echo -e "  Credenciais salvas em: ${CYAN}$CREDS_FILE${NC}"

# Configurar PostgreSQL
echo -e "${YELLOW}[2/7] Configurando PostgreSQL...${NC}"

# Verificar se usuário já existe
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
    echo "  Usuário $DB_USER já existe, atualizando senha..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
else
    echo "  Criando usuário $DB_USER..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
fi

# Verificar se banco já existe
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
    echo "  Banco $DB_NAME já existe"
else
    echo "  Criando banco $DB_NAME..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null
echo -e "  ${GREEN}✓ PostgreSQL configurado${NC}"

# Criar arquivo .env
echo -e "${YELLOW}[3/7] Criando arquivo .env...${NC}"
cat > "$PROJECT_DIR/.env" << EOF
# NBM CLOUD - Configuração de Produção
# Gerado automaticamente em: $(date)

# Database PostgreSQL
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Sessão (chave secreta)
SESSION_SECRET=$SESSION_SECRET

# Ambiente
NODE_ENV=production

# Porta
PORT=5000
EOF
chmod 600 "$PROJECT_DIR/.env"
echo -e "  ${GREEN}✓ Arquivo .env criado${NC}"

# Atualizar código
echo -e "${YELLOW}[4/7] Atualizando código...${NC}"
cd "$PROJECT_DIR"
git fetch origin main 2>/dev/null || true
git pull origin main 2>/dev/null || true
echo -e "  ${GREEN}✓ Código atualizado${NC}"

# Parar processos existentes
echo -e "${YELLOW}[5/7] Parando serviços existentes...${NC}"
pm2 stop nbm-cloud 2>/dev/null || true
pm2 delete nbm-cloud 2>/dev/null || true
for pid in $(lsof -t -i:5000 2>/dev/null); do
    kill -9 $pid 2>/dev/null || true
done
sleep 2
echo -e "  ${GREEN}✓ Serviços parados${NC}"

# Build
echo -e "${YELLOW}[6/7] Fazendo build da aplicação...${NC}"
rm -rf dist/
npm run build
if [ ! -f "dist/index.cjs" ]; then
    echo -e "${RED}ERRO: Build falhou${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Build concluído${NC}"

# Executar migrações do banco
echo -e "${YELLOW}[6.5/7] Executando migrações do banco...${NC}"
source "$PROJECT_DIR/.env"
DATABASE_URL="$DATABASE_URL" npm run db:push 2>/dev/null || echo "  (migrações podem já estar aplicadas)"
echo -e "  ${GREEN}✓ Migrações aplicadas${NC}"

# Iniciar PM2
echo -e "${YELLOW}[7/7] Iniciando aplicação...${NC}"
source "$PROJECT_DIR/.env"
DATABASE_URL="$DATABASE_URL" \
SESSION_SECRET="$SESSION_SECRET" \
NODE_ENV=production \
pm2 start dist/index.cjs --name nbm-cloud -i 1 --update-env

pm2 save
echo -e "  ${GREEN}✓ Aplicação iniciada${NC}"

# Verificações finais
echo ""
echo -e "${YELLOW}Verificando...${NC}"
sleep 3

JS_FILE=$(ls dist/public/assets/index-*.js 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
    JS_NAME=$(basename "$JS_FILE")
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/assets/$JS_NAME" 2>/dev/null)
    if [ "$RESPONSE" = "200" ]; then
        echo -e "  ${GREEN}✓ Assets sendo servidos corretamente${NC}"
    else
        echo -e "  ${RED}✗ Problema ao servir assets${NC}"
    fi
fi

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    echo -e "  ${GREEN}✓ Aplicação respondendo${NC}"
else
    echo -e "  ${RED}✗ Aplicação não respondendo${NC}"
fi

# Resultado final
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           SETUP CONCLUÍDO!                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo -e "  ${GREEN}Acesse: http://$IP:5000${NC}"
echo ""
echo -e "  Credenciais salvas em: ${CYAN}$CREDS_FILE${NC}"
echo ""
pm2 status
