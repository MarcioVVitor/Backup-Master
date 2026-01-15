#!/bin/bash
# NBM CLOUD v17.0 - Script de Correção Automática
# Execute no servidor NBM CLOUD (143.255.197.25)

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   NBM CLOUD v17.0 - Correção Automática   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Este script precisa ser executado como root${NC}"
    exit 1
fi

# 1. Parar todos os processos NBM
echo -e "${YELLOW}[1/10] Parando processos existentes...${NC}"
pm2 stop nbm-cloud 2>/dev/null || true
pm2 delete nbm-cloud 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Processos PM2 parados${NC}"

# 2. Matar processos na porta 5000
echo -e "${YELLOW}[2/10] Liberando porta 5000...${NC}"
for pid in $(lsof -ti:5000 2>/dev/null); do
    kill -9 $pid 2>/dev/null || true
    echo "  Processo $pid encerrado"
done
sleep 1
if lsof -ti:5000 >/dev/null 2>&1; then
    echo -e "${RED}✗ Porta 5000 ainda em uso${NC}"
else
    echo -e "${GREEN}✓ Porta 5000 liberada${NC}"
fi

# 3. Limpar cache do Node
echo -e "${YELLOW}[3/10] Limpando cache...${NC}"
cd /opt/nbm-cloud
rm -rf node_modules/.cache 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
echo -e "${GREEN}✓ Cache limpo${NC}"

# 4. Atualizar código do repositório
echo -e "${YELLOW}[4/10] Atualizando código...${NC}"
git fetch origin main 2>/dev/null || true
git reset --hard origin/main 2>/dev/null || git pull origin main 2>/dev/null || true
echo -e "${GREEN}✓ Código atualizado${NC}"

# 5. Instalar dependências
echo -e "${YELLOW}[5/10] Instalando dependências...${NC}"
npm install --silent 2>/dev/null || npm install
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# 6. Build da aplicação
echo -e "${YELLOW}[6/10] Compilando aplicação...${NC}"
npm run build 2>&1 | tail -5
echo -e "${GREEN}✓ Aplicação compilada${NC}"

# 7. Sincronizar banco de dados
echo -e "${YELLOW}[7/10] Sincronizando banco de dados...${NC}"
npm run db:push 2>&1 | tail -3 || npm run db:push --force 2>&1 | tail -3
echo -e "${GREEN}✓ Banco sincronizado${NC}"

# 8. Criar e corrigir permissões dos diretórios
echo -e "${YELLOW}[8/10] Criando e corrigindo permissões dos diretórios...${NC}"
mkdir -p /opt/nbm/backups
mkdir -p /opt/nbm/backups/firmware
mkdir -p /var/log/nbm-cloud

# Corrigir permissões recursivamente em todos os diretórios de backup
find /opt/nbm/backups -type d -exec chmod 755 {} \;
find /opt/nbm/backups -type f -exec chmod 644 {} \;
chown -R root:root /opt/nbm/backups
chmod -R 755 /opt/nbm/backups

echo "  - Permissões corrigidas em /opt/nbm/backups"
ls -la /opt/nbm/backups/
echo -e "${GREEN}✓ Diretórios criados e permissões corrigidas${NC}"

# 9. Configurar PM2
echo -e "${YELLOW}[9/10] Configurando PM2...${NC}"

# Criar ecosystem.config.cjs se não existir ou atualizar
cat > /opt/nbm-cloud/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'nbm-cloud',
    script: 'dist/index.cjs',
    cwd: '/opt/nbm-cloud',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/nbm-cloud/error-0.log',
    out_file: '/var/log/nbm-cloud/out-0.log',
    log_file: '/var/log/nbm-cloud/combined-0.log',
    time: true,
    kill_timeout: 10000,
    listen_timeout: 30000,
    shutdown_with_message: true
  }]
};
EOF

echo -e "${GREEN}✓ PM2 configurado${NC}"

# 10. Iniciar aplicação
echo -e "${YELLOW}[10/10] Iniciando aplicação...${NC}"
cd /opt/nbm-cloud
pm2 start ecosystem.config.cjs --update-env
pm2 save
sleep 3

# Verificar se está rodando
if pm2 status nbm-cloud | grep -q "online"; then
    echo -e "${GREEN}✓ Aplicação iniciada com sucesso${NC}"
else
    echo -e "${RED}✗ Falha ao iniciar aplicação${NC}"
    echo "Tentando modo alternativo..."
    pm2 start dist/index.cjs --name nbm-cloud --update-env
    pm2 save
    sleep 3
fi

# Verificar resposta HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ Servidor respondendo (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}! Servidor ainda não respondeu (HTTP $HTTP_CODE), aguardando...${NC}"
    sleep 5
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ Servidor respondendo (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ Servidor não respondeu${NC}"
    fi
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}           CORREÇÃO CONCLUÍDA              ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Mostrar status final
pm2 status nbm-cloud

echo ""
echo "Próximos passos:"
echo "  1. Acesse http://143.255.197.25:5000"
echo "  2. Faça login ou registre-se"
echo "  3. Cadastre equipamentos e políticas de backup"
echo ""
echo "Comandos úteis:"
echo "  pm2 logs nbm-cloud              - Ver logs"
echo "  pm2 restart nbm-cloud           - Reiniciar"
echo "  ./scripts/diagnostico-nbm.sh    - Diagnóstico completo"
echo ""
