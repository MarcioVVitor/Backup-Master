#!/bin/bash
# NBM CLOUD - Script de Deployment Automático
# Uso: sudo ./scripts/deploy.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== NBM CLOUD - Deployment ===${NC}"

# Diretório do projeto
PROJECT_DIR="/opt/nbm-cloud"
cd "$PROJECT_DIR"

# 1. Atualizar código do GitHub
echo -e "${YELLOW}[1/6] Atualizando código do GitHub...${NC}"
git fetch origin main
git pull origin main

# 2. Parar PM2 e matar processos órfãos
echo -e "${YELLOW}[2/6] Parando serviços...${NC}"
pm2 stop nbm-cloud 2>/dev/null || true
pm2 delete nbm-cloud 2>/dev/null || true

# Matar qualquer processo na porta 5000
for pid in $(lsof -t -i:5000 2>/dev/null); do
    echo "Matando processo $pid na porta 5000"
    kill -9 $pid 2>/dev/null || true
done
sleep 2

# 3. Limpar e rebuild
echo -e "${YELLOW}[3/6] Fazendo build...${NC}"
rm -rf dist/
npm run build

# 4. Verificar se o build foi bem sucedido
if [ ! -f "dist/index.cjs" ]; then
    echo -e "${RED}ERRO: Build falhou - dist/index.cjs não encontrado${NC}"
    exit 1
fi

if [ ! -f "dist/public/assets/"*.js ]; then
    echo -e "${RED}ERRO: Build falhou - arquivos JS não encontrados${NC}"
    exit 1
fi

# 5. Carregar variáveis de ambiente e iniciar PM2
echo -e "${YELLOW}[5/6] Iniciando aplicação...${NC}"
source .env

# Verificar se DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://usuario:senha@localhost:5432/nbm_cloud" ]; then
    echo -e "${RED}ERRO: DATABASE_URL não está configurado corretamente no .env${NC}"
    echo "Edite /opt/nbm-cloud/.env e configure as credenciais do banco de dados"
    exit 1
fi

# Iniciar com PM2 (modo fork, 1 instância)
DATABASE_URL="$DATABASE_URL" \
SESSION_SECRET="$SESSION_SECRET" \
NODE_ENV=production \
pm2 start dist/index.cjs --name nbm-cloud -i 1 --update-env

pm2 save

# 6. Verificar se está funcionando
echo -e "${YELLOW}[6/6] Verificando...${NC}"
sleep 3

# Testar se assets estão sendo servidos corretamente
JS_FILE=$(ls dist/public/assets/index-*.js | head -1)
JS_NAME=$(basename "$JS_FILE")
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/assets/$JS_NAME")

if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Assets sendo servidos corretamente${NC}"
else
    echo -e "${RED}✗ Problema ao servir assets (HTTP $RESPONSE)${NC}"
fi

# Verificar se a aplicação está respondendo
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Aplicação respondendo${NC}"
else
    echo -e "${RED}✗ Aplicação não respondendo (HTTP $HEALTH)${NC}"
fi

echo -e "${GREEN}=== Deployment concluído! ===${NC}"
echo "Acesse: http://$(hostname -I | awk '{print $1}'):5000"
pm2 status
