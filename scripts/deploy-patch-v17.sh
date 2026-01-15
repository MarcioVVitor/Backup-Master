#!/bin/bash
# NBM CLOUD v17.0 - Patch de Atualização Completo
# Execute no servidor de produção: 143.255.197.25
# Data: Janeiro 2026

set -e

echo "======================================"
echo "NBM CLOUD v17.0 - Patch de Atualização"
echo "======================================"
echo ""

cd /opt/nbm-cloud

echo "[1/7] Verificando status do serviço..."
pm2 status nbm-cloud || true

echo ""
echo "[2/7] Baixando atualizações do repositório..."
git fetch origin main
git pull origin main

echo ""
echo "[3/7] Instalando dependências..."
npm install

echo ""
echo "[4/7] Compilando aplicação..."
npm run build

echo ""
echo "[5/7] Aplicando migrações do banco de dados..."
npm run db:push --force || npm run db:push

echo ""
echo "[6/7] Reiniciando aplicação..."
pm2 restart nbm-cloud --update-env

echo ""
echo "[7/7] Verificando status..."
sleep 3
pm2 status nbm-cloud
pm2 logs nbm-cloud --lines 20 --nostream

echo ""
echo "======================================"
echo "Patch aplicado com sucesso!"
echo "======================================"
echo ""
echo "Melhorias incluídas:"
echo "  - Dashboard com gráficos por fabricante"
echo "  - Status de agentes online/offline"
echo "  - Métricas de backups do dia e duração média"
echo "  - Upload de firmware com campo de modelo"
echo "  - Worker pool de 50 jobs concorrentes"
echo "  - Timeout de 10 minutos por backup"
echo "  - Logging detalhado do scheduler"
echo "  - Organização de backups por fabricante/equipamento"
echo "  - Sanitização de nomes para evitar erros de caminho"
echo "  - Correção de divisão por zero na duração média"
echo ""
echo "Para verificar logs em tempo real:"
echo "  pm2 logs nbm-cloud"
echo ""
echo "Para verificar status do scheduler:"
echo "  curl -s http://localhost:5000/api/scheduler/status | jq"
echo ""
