#!/bin/bash
# NBM CLOUD v17.0 - Script de Diagnóstico Completo
# Execute no servidor NBM CLOUD (143.255.197.25)

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   NBM CLOUD v17.0 - Diagnóstico Completo  ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 1. Verificar status do PM2
echo -e "${YELLOW}[1/8] Verificando status do PM2...${NC}"
if pm2 status nbm-cloud | grep -q "online"; then
    echo -e "${GREEN}✓ NBM CLOUD está rodando${NC}"
    pm2 status nbm-cloud --no-color | head -6
else
    echo -e "${RED}✗ NBM CLOUD não está rodando${NC}"
    echo "Iniciando..."
    pm2 start nbm-cloud
fi
echo ""

# 2. Verificar porta 5000
echo -e "${YELLOW}[2/8] Verificando porta 5000...${NC}"
if ss -tlnp | grep -q ":5000"; then
    echo -e "${GREEN}✓ Porta 5000 está escutando${NC}"
else
    echo -e "${RED}✗ Porta 5000 não está escutando${NC}"
    echo "Reiniciando NBM CLOUD..."
    pm2 restart nbm-cloud
    sleep 3
fi
echo ""

# 3. Testar resposta HTTP
echo -e "${YELLOW}[3/8] Testando resposta HTTP...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ Servidor respondendo (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Servidor não respondendo (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# 4. Verificar banco de dados
echo -e "${YELLOW}[4/8] Verificando banco de dados...${NC}"
if command -v psql &> /dev/null; then
    EQUIP_COUNT=$(PGPASSWORD=QvVoBkXejyKcmGXYkQ48RuhT psql -h localhost -U nbm_app -d nbm_cloud -t -c "SELECT COUNT(*) FROM equipment WHERE enabled = true;" 2>/dev/null | tr -d ' ' || echo "0")
    POLICY_COUNT=$(PGPASSWORD=QvVoBkXejyKcmGXYkQ48RuhT psql -h localhost -U nbm_app -d nbm_cloud -t -c "SELECT COUNT(*) FROM backup_policies WHERE enabled = true;" 2>/dev/null | tr -d ' ' || echo "0")
    AGENT_COUNT=$(PGPASSWORD=QvVoBkXejyKcmGXYkQ48RuhT psql -h localhost -U nbm_app -d nbm_cloud -t -c "SELECT COUNT(*) FROM agents;" 2>/dev/null | tr -d ' ' || echo "0")
    BACKUP_COUNT=$(PGPASSWORD=QvVoBkXejyKcmGXYkQ48RuhT psql -h localhost -U nbm_app -d nbm_cloud -t -c "SELECT COUNT(*) FROM files WHERE created_at > NOW() - INTERVAL '24 hours';" 2>/dev/null | tr -d ' ' || echo "0")
    
    echo -e "${GREEN}✓ Banco de dados conectado${NC}"
    echo "  - Equipamentos habilitados: $EQUIP_COUNT"
    echo "  - Políticas ativas: $POLICY_COUNT"
    echo "  - Agentes cadastrados: $AGENT_COUNT"
    echo "  - Backups (últimas 24h): $BACKUP_COUNT"
else
    echo -e "${YELLOW}! psql não disponível, pulando verificação do banco${NC}"
fi
echo ""

# 5. Verificar armazenamento de backups
echo -e "${YELLOW}[5/8] Verificando armazenamento de backups...${NC}"
BACKUP_DIR="/opt/nbm/backups"
if [ -d "$BACKUP_DIR" ]; then
    echo -e "${GREEN}✓ Diretório de backups existe${NC}"
    BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    BACKUP_FILES=$(find "$BACKUP_DIR" -type f -name "*.rsc" -o -name "*.cfg" -o -name "*.txt" 2>/dev/null | wc -l)
    echo "  - Tamanho total: $BACKUP_SIZE"
    echo "  - Arquivos de backup: $BACKUP_FILES"
    
    # Últimos backups
    echo "  - Últimos 5 backups:"
    find "$BACKUP_DIR" -type f \( -name "*.rsc" -o -name "*.cfg" -o -name "*.txt" \) -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -5 | while read ts path; do
        fname=$(basename "$path")
        echo "    $fname"
    done
else
    echo -e "${RED}✗ Diretório de backups não existe${NC}"
    echo "Criando diretório..."
    mkdir -p "$BACKUP_DIR"
    chown -R root:root "$BACKUP_DIR"
fi
echo ""

# 6. Verificar conexões WebSocket de agentes
echo -e "${YELLOW}[6/8] Verificando agentes conectados...${NC}"
AGENT_LOGS=$(pm2 logs nbm-cloud --nostream --lines 500 2>/dev/null | grep -c "\[ws-agents\] Agent authenticated" || echo "0")
if [ "$AGENT_LOGS" -gt "0" ]; then
    echo -e "${GREEN}✓ Agentes conectaram recentemente${NC}"
    echo "  Últimas conexões de agentes:"
    pm2 logs nbm-cloud --nostream --lines 500 2>/dev/null | grep "\[ws-agents\]" | tail -5
else
    echo -e "${RED}✗ Nenhum agente conectado recentemente${NC}"
    echo "  Verifique se o agente está rodando no servidor 143.255.197.26"
fi
echo ""

# 7. Verificar scheduler
echo -e "${YELLOW}[7/8] Verificando scheduler de backups...${NC}"
SCHEDULER_LOGS=$(pm2 logs nbm-cloud --nostream --lines 100 2>/dev/null | grep -c "Scheduler started successfully" || echo "0")
if [ "$SCHEDULER_LOGS" -gt "0" ]; then
    echo -e "${GREEN}✓ Scheduler está ativo${NC}"
    
    # Verificar última execução de política
    LAST_RUN=$(pm2 logs nbm-cloud --nostream --lines 500 2>/dev/null | grep "\[scheduler\].*Running policy" | tail -1 || echo "")
    if [ -n "$LAST_RUN" ]; then
        echo "  Última execução de política:"
        echo "  $LAST_RUN"
    else
        echo "  Nenhuma política executada recentemente"
    fi
else
    echo -e "${RED}✗ Scheduler não está ativo${NC}"
fi
echo ""

# 8. Verificar erros recentes
echo -e "${YELLOW}[8/8] Verificando erros recentes...${NC}"
ERROR_COUNT=$(pm2 logs nbm-cloud --nostream --lines 200 2>/dev/null | grep -i "error\|failed" | grep -v "EADDRINUSE" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓ Nenhum erro crítico recente${NC}"
else
    echo -e "${YELLOW}! $ERROR_COUNT erros encontrados${NC}"
    echo "  Últimos erros:"
    pm2 logs nbm-cloud --nostream --lines 200 2>/dev/null | grep -i "error\|failed" | grep -v "EADDRINUSE" | tail -5
fi
echo ""

# Resumo
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}                  RESUMO                   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar se tudo está OK para backups
ALL_OK=true

if ! pm2 status nbm-cloud | grep -q "online"; then
    echo -e "${RED}✗ NBM CLOUD não está rodando${NC}"
    ALL_OK=false
fi

if [ "$EQUIP_COUNT" == "0" ] 2>/dev/null; then
    echo -e "${YELLOW}! Nenhum equipamento habilitado para backup${NC}"
    ALL_OK=false
fi

if [ "$POLICY_COUNT" == "0" ] 2>/dev/null; then
    echo -e "${YELLOW}! Nenhuma política de backup ativa${NC}"
    ALL_OK=false
fi

if [ "$AGENT_COUNT" == "0" ] 2>/dev/null; then
    echo -e "${YELLOW}! Nenhum agente cadastrado${NC}"
    echo "  Os backups serão executados via SSH direto"
fi

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✓ Sistema pronto para executar backups${NC}"
else
    echo ""
    echo "Para os backups funcionarem:"
    echo "1. Cadastre equipamentos na interface web"
    echo "2. Crie políticas de backup com horários"
    echo "3. Configure e inicie o agente (opcional para SSH direto)"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo "Comandos úteis:"
echo "  pm2 logs nbm-cloud              - Ver logs em tempo real"
echo "  pm2 restart nbm-cloud           - Reiniciar aplicação"
echo "  pm2 logs nbm-cloud | grep backup - Filtrar logs de backup"
echo -e "${BLUE}============================================${NC}"
echo ""
