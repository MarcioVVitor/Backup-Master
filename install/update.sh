#!/bin/bash

# ============================================================================
# NBM - Network Backup Manager
# Script de Atualizacao para servidores com NBM ja instalado
# Versao: 1.0.1
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuracoes
NBM_HOME="/opt/nbm"
NBM_USER="nbm"
NBM_GROUP="nbm"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar se esta rodando como root
if [[ $EUID -ne 0 ]]; then
    log_error "Este script deve ser executado como root"
    exit 1
fi

echo -e "${BLUE}"
echo "============================================================"
echo "     NBM - Script de Atualizacao"
echo "============================================================"
echo -e "${NC}"

# Parar servico
log_info "Parando servico NBM..."
systemctl stop nbm 2>/dev/null || true

# Backup do .env
log_info "Fazendo backup da configuracao..."
if [[ -f "${NBM_HOME}/.env" ]]; then
    cp ${NBM_HOME}/.env /tmp/nbm-env-backup
    log_success "Backup do .env criado"
fi

# Remover instalacao antiga (exceto dados)
log_info "Removendo instalacao antiga..."
rm -rf ${NBM_HOME}/client
rm -rf ${NBM_HOME}/server
rm -rf ${NBM_HOME}/shared
rm -rf ${NBM_HOME}/script
rm -rf ${NBM_HOME}/dist
rm -rf ${NBM_HOME}/node_modules
rm -f ${NBM_HOME}/package*.json
rm -f ${NBM_HOME}/tsconfig*.json
rm -f ${NBM_HOME}/vite.config.ts
rm -f ${NBM_HOME}/tailwind.config.ts
rm -f ${NBM_HOME}/postcss.config.js
rm -f ${NBM_HOME}/drizzle.config.ts
rm -f ${NBM_HOME}/components.json
rm -f ${NBM_HOME}/theme.json

# Baixar nova versao
log_info "Baixando nova versao do GitHub..."
cd /tmp
rm -rf /tmp/nbm-update
git clone --depth 1 https://github.com/MarcioVVitor/nbm.git /tmp/nbm-update

# Copiar novos arquivos
log_info "Instalando novos arquivos..."
cp -r /tmp/nbm-update/client ${NBM_HOME}/
cp -r /tmp/nbm-update/server ${NBM_HOME}/
cp -r /tmp/nbm-update/shared ${NBM_HOME}/
cp -r /tmp/nbm-update/script ${NBM_HOME}/
cp /tmp/nbm-update/package*.json ${NBM_HOME}/
cp /tmp/nbm-update/tsconfig*.json ${NBM_HOME}/
cp /tmp/nbm-update/vite.config.ts ${NBM_HOME}/
cp /tmp/nbm-update/tailwind.config.ts ${NBM_HOME}/
cp /tmp/nbm-update/postcss.config.js ${NBM_HOME}/
cp /tmp/nbm-update/drizzle.config.ts ${NBM_HOME}/
cp /tmp/nbm-update/components.json ${NBM_HOME}/ 2>/dev/null || true
cp /tmp/nbm-update/theme.json ${NBM_HOME}/ 2>/dev/null || true

# Restaurar .env
log_info "Restaurando configuracao..."
if [[ -f /tmp/nbm-env-backup ]]; then
    cp /tmp/nbm-env-backup ${NBM_HOME}/.env
    log_success "Configuracao restaurada"
fi

# Ajustar permissoes
chown -R ${NBM_USER}:${NBM_GROUP} ${NBM_HOME}

# Instalar dependencias
log_info "Instalando dependencias..."
cd ${NBM_HOME}
sudo -u ${NBM_USER} npm install

# Compilar
log_info "Compilando aplicacao..."
source ${NBM_HOME}/.env
sudo -u ${NBM_USER} -E npx tsx script/build.ts

# Verificar build
if [[ ! -f "${NBM_HOME}/dist/index.cjs" ]]; then
    log_error "Falha na compilacao - dist/index.cjs nao foi criado"
    exit 1
fi

if [[ ! -d "${NBM_HOME}/dist/public" ]]; then
    log_error "Falha na compilacao - dist/public nao foi criado"
    exit 1
fi

# Atualizar schema do banco
log_info "Atualizando schema do banco de dados..."
sudo -u ${NBM_USER} -E npx drizzle-kit push || log_warn "Falha ao atualizar schema (pode ja estar atualizado)"

# Limpar arquivos temporarios
rm -rf /tmp/nbm-update
rm -f /tmp/nbm-env-backup

# Iniciar servico
log_info "Iniciando servico NBM..."
systemctl start nbm

# Verificar status
sleep 3
if systemctl is-active --quiet nbm; then
    log_success "Servico NBM iniciado com sucesso"
else
    log_error "Falha ao iniciar servico"
    log_info "Verifique os logs: journalctl -u nbm -f"
    exit 1
fi

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}     ATUALIZACAO CONCLUIDA COM SUCESSO!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "Acesse: ${BLUE}http://$(hostname -I | awk '{print $1}'):5000${NC}"
echo ""
echo "Comandos uteis:"
echo "  - Logs:     journalctl -u nbm -f"
echo "  - Status:   systemctl status nbm"
echo "  - Restart:  systemctl restart nbm"
echo ""
