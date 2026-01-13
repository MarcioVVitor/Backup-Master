#!/bin/bash
# ============================================================================
# NBM CLOUD v17.0 - Script Completo de Instalação/Atualização para Produção
# Servidor: Debian 13 (ou compatível)
# Uso: curl -fsSL https://raw.githubusercontent.com/MarcioVVitor/Backup-Master/main/deploy/install-production.sh | sudo bash
# ============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
APP_DIR="/opt/nbm-cloud"
APP_NAME="nbm-cloud"
GITHUB_REPO="https://github.com/MarcioVVitor/Backup-Master.git"
ENV_FILE="$APP_DIR/.env"

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_header() {
    echo -e "${CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║         NBM CLOUD v17.0 - Production Installer               ║
║         Network Backup Management Cloud                      ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# ============================================================================
# PREFLIGHT CHECKS
# ============================================================================
preflight_check() {
    log_info "Verificando pré-requisitos..."
    
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script deve ser executado como root"
        echo "Execute: sudo $0"
        exit 1
    fi
    
    # Detectar tipo de instalação
    if [[ -d "$APP_DIR/.git" ]]; then
        log_info "Instalação existente detectada. Modo: ATUALIZAÇÃO"
        IS_UPDATE=true
    else
        log_info "Nova instalação detectada. Modo: INSTALAÇÃO"
        IS_UPDATE=false
    fi
}

# ============================================================================
# INSTALAR DEPENDÊNCIAS DO SISTEMA
# ============================================================================
install_system_deps() {
    log_info "Instalando dependências do sistema..."
    
    apt update -qq
    apt install -y curl git postgresql-client openssl gnupg 2>/dev/null || {
        log_error "Falha ao instalar dependências"
        exit 1
    }
    
    log_success "Dependências do sistema instaladas"
}

# ============================================================================
# INSTALAR NODE.JS 20
# ============================================================================
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
        if [[ $NODE_VERSION -ge 20 ]]; then
            log_success "Node.js $(node -v) já instalado"
            return
        fi
    fi
    
    log_info "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    log_success "Node.js $(node -v) instalado"
}

# ============================================================================
# INSTALAR PM2
# ============================================================================
install_pm2() {
    if command -v pm2 &> /dev/null; then
        log_success "PM2 já instalado"
        return
    fi
    
    log_info "Instalando PM2..."
    npm install -g pm2
    log_success "PM2 instalado"
}

# ============================================================================
# CONFIGURAR CREDENCIAIS DO POSTGRESQL
# ============================================================================
configure_database() {
    log_info "Configurando banco de dados PostgreSQL..."
    
    # Se já existe .env com DATABASE_URL válida, perguntar se quer manter
    if [[ -f "$ENV_FILE" ]] && grep -q "DATABASE_URL=" "$ENV_FILE"; then
        EXISTING_URL=$(grep "DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
        echo ""
        echo -e "${YELLOW}Configuração existente encontrada:${NC}"
        echo -e "DATABASE_URL=${EXISTING_URL:0:50}..."
        echo ""
        read -p "Manter configuração existente? [S/n]: " KEEP_CONFIG
        KEEP_CONFIG=${KEEP_CONFIG:-S}
        
        if [[ "${KEEP_CONFIG^^}" == "S" ]]; then
            log_success "Mantendo configuração existente"
            return
        fi
    fi
    
    echo ""
    echo -e "${CYAN}=== Configuração do PostgreSQL ===${NC}"
    echo ""
    
    # Valores padrão
    DEFAULT_HOST="localhost"
    DEFAULT_PORT="5432"
    DEFAULT_DB="nbm_cloud"
    DEFAULT_USER="nbm_user"
    
    read -p "Host PostgreSQL [$DEFAULT_HOST]: " DB_HOST
    DB_HOST=${DB_HOST:-$DEFAULT_HOST}
    
    read -p "Porta [$DEFAULT_PORT]: " DB_PORT
    DB_PORT=${DB_PORT:-$DEFAULT_PORT}
    
    read -p "Nome do banco [$DEFAULT_DB]: " DB_NAME
    DB_NAME=${DB_NAME:-$DEFAULT_DB}
    
    read -p "Usuário [$DEFAULT_USER]: " DB_USER
    DB_USER=${DB_USER:-$DEFAULT_USER}
    
    read -sp "Senha: " DB_PASS
    echo ""
    
    if [[ -z "$DB_PASS" ]]; then
        log_error "Senha não pode ser vazia"
        exit 1
    fi
    
    # Montar DATABASE_URL
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    # Testar conexão
    log_info "Testando conexão com o banco de dados..."
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
        log_success "Conexão com banco de dados OK"
    else
        log_warn "Não foi possível conectar ao banco. Tentando criar..."
        
        echo ""
        read -p "Senha do usuário postgres (para criar banco/usuário): " -s POSTGRES_PASS
        echo ""
        
        if [[ -n "$POSTGRES_PASS" ]]; then
            # Criar usuário se não existir
            PGPASSWORD="$POSTGRES_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c \
                "DO \$\$ BEGIN CREATE USER $DB_USER WITH PASSWORD '$DB_PASS'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" 2>/dev/null || true
            
            # Criar banco se não existir
            PGPASSWORD="$POSTGRES_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c \
                "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
                PGPASSWORD="$POSTGRES_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c \
                "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
            
            # Dar permissões
            PGPASSWORD="$POSTGRES_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c \
                "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
            
            log_success "Banco de dados configurado"
        else
            log_warn "Continuando sem criar banco. Certifique-se de que ele existe."
        fi
    fi
    
    # Salvar DATABASE_URL para uso posterior
    export DATABASE_URL
}

# ============================================================================
# CLONAR OU ATUALIZAR REPOSITÓRIO
# ============================================================================
sync_repository() {
    if [[ "$IS_UPDATE" == true ]]; then
        log_info "Atualizando código do repositório..."
        cd "$APP_DIR"
        
        # Parar aplicação antes de atualizar
        pm2 stop $APP_NAME 2>/dev/null || true
        
        # Fetch e reset para a versão mais recente
        git fetch origin main
        git reset --hard origin/main
        
        log_success "Código atualizado"
    else
        log_info "Clonando repositório..."
        mkdir -p "$APP_DIR"
        git clone "$GITHUB_REPO" "$APP_DIR"
        cd "$APP_DIR"
        
        log_success "Repositório clonado"
    fi
}

# ============================================================================
# INSTALAR DEPENDÊNCIAS DO PROJETO
# ============================================================================
install_project_deps() {
    log_info "Instalando dependências do projeto (npm install)..."
    cd "$APP_DIR"
    npm install --legacy-peer-deps
    log_success "Dependências do projeto instaladas"
}

# ============================================================================
# CRIAR/ATUALIZAR ARQUIVO .ENV
# ============================================================================
create_env_file() {
    log_info "Configurando arquivo .env..."
    
    # Gerar ou manter SESSION_SECRET
    if [[ -f "$ENV_FILE" ]] && grep -q "SESSION_SECRET=" "$ENV_FILE"; then
        SESSION_SECRET=$(grep "SESSION_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
    else
        SESSION_SECRET=$(openssl rand -hex 32)
    fi
    
    # Se DATABASE_URL não foi definida, tentar carregar do .env existente
    if [[ -z "$DATABASE_URL" ]] && [[ -f "$ENV_FILE" ]]; then
        DATABASE_URL=$(grep "DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
    fi
    
    # Criar arquivo .env
    cat > "$ENV_FILE" << EOF
# NBM CLOUD - Configuração de Produção
# Gerado/Atualizado em: $(date)

# Database PostgreSQL
DATABASE_URL=$DATABASE_URL

# Sessão (chave secreta)
SESSION_SECRET=$SESSION_SECRET

# Ambiente
NODE_ENV=production

# Porta
PORT=5000
EOF

    chmod 600 "$ENV_FILE"
    log_success "Arquivo .env configurado"
}

# ============================================================================
# BUILD DA APLICAÇÃO
# ============================================================================
build_application() {
    log_info "Compilando aplicação (npm run build)..."
    cd "$APP_DIR"
    
    # Limpar build anterior
    rm -rf dist
    
    # Carregar variáveis de ambiente para o build
    set -a
    source "$ENV_FILE"
    set +a
    
    # Build
    npm run build
    
    log_success "Aplicação compilada"
}

# ============================================================================
# CONFIGURAR E INICIAR PM2
# ============================================================================
start_pm2() {
    log_info "Configurando PM2..."
    cd "$APP_DIR"
    
    # Criar arquivo ecosystem do PM2
    cat > "$APP_DIR/ecosystem.config.cjs" << 'EOF'
module.exports = {
  apps: [{
    name: 'nbm-cloud',
    script: 'dist/index.cjs',
    cwd: '/opt/nbm-cloud',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/nbm-cloud/error.log',
    out_file: '/var/log/nbm-cloud/out.log',
    log_file: '/var/log/nbm-cloud/combined.log',
    time: true
  }]
};
EOF

    # Criar diretório de logs
    mkdir -p /var/log/nbm-cloud
    
    # Parar processo existente
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Carregar variáveis e iniciar
    cd "$APP_DIR"
    set -a
    source "$ENV_FILE"
    set +a
    
    pm2 start ecosystem.config.cjs
    
    # Salvar e configurar startup
    pm2 save
    pm2 startup systemd -u root --hp /root 2>/dev/null || true
    
    log_success "PM2 configurado e aplicação iniciada"
}

# ============================================================================
# VERIFICAÇÃO FINAL
# ============================================================================
verify_installation() {
    log_info "Verificando instalação..."
    
    sleep 3
    
    if pm2 list | grep -q "$APP_NAME" && pm2 list | grep "$APP_NAME" | grep -q "online"; then
        log_success "Aplicação rodando corretamente!"
    else
        log_error "Aplicação pode não estar rodando. Verifique os logs:"
        echo "pm2 logs $APP_NAME"
        return 1
    fi
}

# ============================================================================
# RESUMO FINAL
# ============================================================================
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           NBM CLOUD Instalado/Atualizado com Sucesso!        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Informações:${NC}"
    echo -e "  Diretório:    ${BLUE}$APP_DIR${NC}"
    echo -e "  Configuração: ${BLUE}$ENV_FILE${NC}"
    echo -e "  Logs:         ${BLUE}/var/log/nbm-cloud/${NC}"
    echo ""
    echo -e "${CYAN}Comandos úteis:${NC}"
    echo -e "  ${YELLOW}pm2 status${NC}              - Ver status"
    echo -e "  ${YELLOW}pm2 logs nbm-cloud${NC}      - Ver logs"
    echo -e "  ${YELLOW}pm2 restart nbm-cloud${NC}   - Reiniciar"
    echo -e "  ${YELLOW}pm2 stop nbm-cloud${NC}      - Parar"
    echo ""
    echo -e "${CYAN}Acesso:${NC}"
    echo -e "  URL: ${BLUE}http://$(hostname -I | awk '{print $1}'):5000${NC}"
    echo ""
    
    pm2 status
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    print_header
    preflight_check
    install_system_deps
    install_nodejs
    install_pm2
    configure_database
    sync_repository
    install_project_deps
    create_env_file
    build_application
    start_pm2
    verify_installation
    print_summary
}

# Executar
main "$@"
