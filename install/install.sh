#!/bin/bash

# ============================================================================
# NBM - Network Backup Manager
# Script de Instalacao para Debian 13 (Trixie)
# Versao: 1.0.0
# ============================================================================

# Verificar se o script foi executado corretamente (nao via source)
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    echo ""
    echo "ERRO: Nao execute o script com 'source' ou '.'"
    echo ""
    echo "Uso correto:"
    echo "  sudo ./install.sh install"
    echo ""
    return 1 2>/dev/null || exit 1
fi

# Verificar argumento
if [[ "$1" != "install" && "$1" != "uninstall" ]]; then
    echo ""
    echo "Uso: $0 {install|uninstall}"
    echo ""
    echo "Exemplos:"
    echo "  sudo $0 install     # Instalar NBM"
    echo "  sudo $0 uninstall   # Desinstalar NBM"
    echo ""
    exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuracoes padrao
NBM_USER="nbm"
NBM_GROUP="nbm"
NBM_HOME="/opt/nbm"
NBM_DATA="/var/lib/nbm"
NBM_LOG="/var/log/nbm"
NBM_PORT=5000
NODE_VERSION="20"
POSTGRES_VERSION="15"

# Funcoes de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se esta rodando como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script deve ser executado como root"
        exit 1
    fi
}

# Banner de instalacao
show_banner() {
    echo -e "${BLUE}"
    echo "============================================================"
    echo "     _   _ ____  __  __ "
    echo "    | \ | |  _ \|  \/  |"
    echo "    |  \| | |_) | |\/| |"
    echo "    | |\  |  __/| |  | |"
    echo "    |_| \_|_|   |_|  |_|"
    echo ""
    echo "    Network Backup Manager - Instalador"
    echo "    Versao 1.0.0 para Debian 13"
    echo "============================================================"
    echo -e "${NC}"
}

# Verificar sistema operacional
check_os() {
    log_info "Verificando sistema operacional..."
    
    if [[ ! -f /etc/debian_version ]]; then
        log_error "Este script e projetado para sistemas Debian"
        exit 1
    fi
    
    DEBIAN_VERSION=$(cat /etc/debian_version | cut -d. -f1)
    if [[ "$DEBIAN_VERSION" != "13" && "$DEBIAN_VERSION" != "trixie" ]]; then
        log_warn "Sistema detectado nao e Debian 13. Continuando mesmo assim..."
    fi
    
    log_success "Sistema operacional verificado: Debian $(cat /etc/debian_version)"
}

# Atualizar sistema
update_system() {
    log_info "Atualizando lista de pacotes..."
    apt-get update -qq
    log_success "Lista de pacotes atualizada"
}

# Instalar dependencias do sistema
install_system_deps() {
    log_info "Instalando dependencias do sistema..."
    
    # Pacotes base disponiveis em todas as versoes do Debian
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        curl \
        wget \
        gnupg \
        ca-certificates \
        lsb-release \
        build-essential \
        git \
        openssh-client \
        openssl \
        sudo \
        unzip \
        zip \
        tar \
        gzip
    
    if [ $? -eq 0 ]; then
        log_success "Dependencias do sistema instaladas"
    else
        log_error "Falha ao instalar dependencias do sistema"
        exit 1
    fi
}

# Instalar Node.js
install_nodejs() {
    log_info "Instalando Node.js ${NODE_VERSION}..."
    
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_NODE" -ge "$NODE_VERSION" ]]; then
            log_success "Node.js $(node -v) ja instalado"
            return
        fi
    fi
    
    # Adicionar repositorio NodeSource
    log_info "Adicionando repositorio NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    log_info "Instalando nodejs..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    
    if command -v node &> /dev/null; then
        log_success "Node.js $(node -v) instalado"
    else
        log_error "Falha ao instalar Node.js"
        exit 1
    fi
}

# Instalar PostgreSQL
install_postgresql() {
    log_info "Instalando PostgreSQL ${POSTGRES_VERSION}..."
    
    if command -v psql &> /dev/null; then
        log_success "PostgreSQL ja instalado"
        systemctl enable postgresql 2>/dev/null || true
        systemctl start postgresql 2>/dev/null || true
        return
    fi
    
    # Adicionar repositorio PostgreSQL
    log_info "Adicionando repositorio PostgreSQL..."
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    
    apt-get update
    
    log_info "Instalando postgresql-${POSTGRES_VERSION}..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-${POSTGRES_VERSION} postgresql-contrib-${POSTGRES_VERSION}
    
    # Iniciar servico
    systemctl enable postgresql
    systemctl start postgresql
    
    if command -v psql &> /dev/null; then
        log_success "PostgreSQL ${POSTGRES_VERSION} instalado e iniciado"
    else
        log_error "Falha ao instalar PostgreSQL"
        exit 1
    fi
}

# Criar usuario e grupo NBM
create_user() {
    log_info "Criando usuario e grupo do sistema..."
    
    if ! getent group ${NBM_GROUP} > /dev/null 2>&1; then
        groupadd -r ${NBM_GROUP}
    fi
    
    if ! id -u ${NBM_USER} > /dev/null 2>&1; then
        useradd -r -g ${NBM_GROUP} -d ${NBM_HOME} -s /bin/bash -c "NBM Service Account" ${NBM_USER}
    fi
    
    log_success "Usuario ${NBM_USER} criado"
}

# Criar diretorios
create_directories() {
    log_info "Criando diretorios..."
    
    mkdir -p ${NBM_HOME}
    mkdir -p ${NBM_DATA}
    mkdir -p ${NBM_DATA}/backups
    mkdir -p ${NBM_DATA}/firmware
    mkdir -p ${NBM_DATA}/uploads
    mkdir -p ${NBM_LOG}
    
    chown -R ${NBM_USER}:${NBM_GROUP} ${NBM_HOME}
    chown -R ${NBM_USER}:${NBM_GROUP} ${NBM_DATA}
    chown -R ${NBM_USER}:${NBM_GROUP} ${NBM_LOG}
    
    log_success "Diretorios criados"
}

# Configurar banco de dados
setup_database() {
    log_info "Configurando banco de dados..."
    
    # Gerar senha aleatoria
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-24)
    DB_NAME="nbm"
    DB_USER="nbm"
    
    # Verificar se usuario ja existe e atualizar senha, ou criar novo
    USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null)
    
    if [[ "$USER_EXISTS" == "1" ]]; then
        # Usuario existe - atualizar senha
        log_info "Atualizando senha do usuario PostgreSQL..."
        sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null
    else
        # Criar novo usuario
        sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null
    fi
    
    # Criar banco se nao existir
    DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null)
    if [[ "$DB_EXISTS" != "1" ]]; then
        sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null
    fi
    
    # Garantir permissoes
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null
    sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null
    sudo -u postgres psql -d ${DB_NAME} -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" 2>/dev/null
    
    # Exportar variaveis para uso posterior
    export DB_USER DB_PASSWORD DB_NAME
    
    log_success "Banco de dados configurado"
}

# Criar arquivo de configuracao .env
create_env_file() {
    log_info "Criando arquivo de configuracao..."
    
    # Usar variaveis exportadas do setup_database
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" > ${NBM_HOME}/.env
    echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '/+=')" >> ${NBM_HOME}/.env
    echo "NODE_ENV=production" >> ${NBM_HOME}/.env
    echo "PORT=${NBM_PORT}" >> ${NBM_HOME}/.env
    echo "STANDALONE=true" >> ${NBM_HOME}/.env
    
    chown ${NBM_USER}:${NBM_GROUP} ${NBM_HOME}/.env
    chmod 600 ${NBM_HOME}/.env
    
    log_success "Arquivo .env criado"
}

# Copiar arquivos da aplicacao
install_application() {
    log_info "Instalando aplicacao NBM..."
    
    # Diretorio do script de instalacao
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    APP_SOURCE="${SCRIPT_DIR}/../"
    
    # Verificar se os arquivos existem localmente
    if [[ ! -f "${APP_SOURCE}/package.json" ]]; then
        log_info "Baixando aplicacao do GitHub..."
        
        # Remover diretorio existente completamente
        rm -rf ${NBM_HOME}
        mkdir -p ${NBM_HOME}
        chown ${NBM_USER}:${NBM_GROUP} ${NBM_HOME}
        
        # Clonar repositorio
        git clone https://github.com/MarcioVVitor/nbm.git ${NBM_HOME} || {
            log_error "Falha ao clonar repositorio"
            exit 1
        }
        
        log_success "Aplicacao baixada com sucesso"
    else
        # Copiar arquivos principais
        cp -r ${APP_SOURCE}/* ${NBM_HOME}/
        # Copiar arquivos dotfiles especificos (sem . e ..)
        for dotfile in "${APP_SOURCE}"/.env.example "${APP_SOURCE}"/.gitignore; do
            if [[ -f "$dotfile" ]]; then
                cp "$dotfile" ${NBM_HOME}/ 2>/dev/null || true
            fi
        done
    fi
    
    # Remover arquivos desnecessarios
    rm -rf ${NBM_HOME}/install
    rm -rf ${NBM_HOME}/node_modules
    rm -rf ${NBM_HOME}/.git
    rm -f ${NBM_HOME}/.replit
    rm -f ${NBM_HOME}/replit.nix
    
    chown -R ${NBM_USER}:${NBM_GROUP} ${NBM_HOME}
    
    log_success "Arquivos da aplicacao instalados"
}

# Instalar dependencias npm
install_npm_deps() {
    log_info "Instalando dependencias Node.js..."
    
    cd ${NBM_HOME}
    
    # Instalar TODAS as dependencias (incluindo dev para build)
    sudo -u ${NBM_USER} npm install
    
    log_success "Dependencias Node.js instaladas"
}

# Compilar aplicacao
build_application() {
    log_info "Compilando aplicacao..."
    
    cd ${NBM_HOME}
    
    # Carregar variaveis de ambiente
    source ${NBM_HOME}/.env
    
    # Build usando npx para encontrar tsx
    sudo -u ${NBM_USER} -E npx tsx script/build.ts || {
        log_error "Falha ao compilar aplicacao"
        exit 1
    }
    
    # Verificar se o build foi criado
    if [[ ! -f "${NBM_HOME}/dist/index.cjs" ]]; then
        log_error "Arquivo dist/index.cjs nao foi criado"
        exit 1
    fi
    
    log_success "Aplicacao compilada"
}

# Inicializar banco de dados
init_database() {
    log_info "Inicializando esquema do banco de dados..."
    
    cd ${NBM_HOME}
    
    # Carregar variaveis de ambiente
    source ${NBM_HOME}/.env
    
    # Push schema usando npx
    sudo -u ${NBM_USER} -E npx drizzle-kit push || {
        log_error "Falha ao inicializar banco de dados"
        exit 1
    }
    
    log_success "Esquema do banco de dados inicializado"
}

# Criar servico systemd
create_systemd_service() {
    log_info "Criando servico systemd..."
    
    cat > /etc/systemd/system/nbm.service << EOF
[Unit]
Description=NBM - Network Backup Manager
Documentation=https://github.com/seu-usuario/nbm
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${NBM_USER}
Group=${NBM_GROUP}
WorkingDirectory=${NBM_HOME}
EnvironmentFile=${NBM_HOME}/.env
ExecStart=/usr/bin/node ${NBM_HOME}/dist/index.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nbm

# Seguranca
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${NBM_DATA} ${NBM_LOG} ${NBM_HOME}
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable nbm
    
    log_success "Servico systemd criado"
}

# Configurar firewall (opcional)
configure_firewall() {
    log_info "Configurando firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow ${NBM_PORT}/tcp comment "NBM Web Interface" 2>/dev/null || true
        log_success "Regra de firewall adicionada (UFW)"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=${NBM_PORT}/tcp 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        log_success "Regra de firewall adicionada (firewalld)"
    else
        log_warn "Nenhum firewall detectado. Configure manualmente a porta ${NBM_PORT}"
    fi
}

# Criar usuario administrador
create_admin_user() {
    log_info "Criando usuario administrador..."
    
    # O primeiro usuario a logar sera automaticamente administrador
    log_warn "O primeiro usuario a fazer login sera o administrador do sistema"
    
    log_success "Configuracao de administrador concluida"
}

# Iniciar servico
start_service() {
    log_info "Iniciando servico NBM..."
    
    systemctl start nbm
    
    # Aguardar inicializacao
    sleep 5
    
    if systemctl is-active --quiet nbm; then
        log_success "Servico NBM iniciado com sucesso"
    else
        log_error "Falha ao iniciar servico NBM"
        log_info "Verifique os logs: journalctl -u nbm -f"
        exit 1
    fi
}

# Mostrar informacoes finais
show_summary() {
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}     INSTALACAO CONCLUIDA COM SUCESSO!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "URL de acesso: ${BLUE}http://$(hostname -I | awk '{print $1}'):${NBM_PORT}${NC}"
    echo ""
    echo "Diretorios importantes:"
    echo "  - Aplicacao:    ${NBM_HOME}"
    echo "  - Dados:        ${NBM_DATA}"
    echo "  - Logs:         ${NBM_LOG}"
    echo "  - Configuracao: ${NBM_HOME}/.env"
    echo ""
    echo "Comandos uteis:"
    echo "  - Iniciar:      systemctl start nbm"
    echo "  - Parar:        systemctl stop nbm"
    echo "  - Reiniciar:    systemctl restart nbm"
    echo "  - Status:       systemctl status nbm"
    echo "  - Logs:         journalctl -u nbm -f"
    echo ""
    echo -e "${YELLOW}IMPORTANTE: O primeiro usuario a fazer login sera o administrador${NC}"
    echo ""
}

# Funcao de desinstalacao
uninstall() {
    log_warn "Iniciando desinstalacao do NBM..."
    
    # Parar servico
    systemctl stop nbm 2>/dev/null || true
    systemctl disable nbm 2>/dev/null || true
    
    # Remover servico
    rm -f /etc/systemd/system/nbm.service
    systemctl daemon-reload
    
    # Remover arquivos
    rm -rf ${NBM_HOME}
    rm -rf ${NBM_LOG}
    
    # Perguntar sobre dados
    read -p "Remover dados e banco de dados? (s/N): " REMOVE_DATA
    if [[ "$REMOVE_DATA" =~ ^[Ss]$ ]]; then
        rm -rf ${NBM_DATA}
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS nbm;" 2>/dev/null || true
        sudo -u postgres psql -c "DROP USER IF EXISTS nbm;" 2>/dev/null || true
    fi
    
    # Remover usuario
    userdel ${NBM_USER} 2>/dev/null || true
    groupdel ${NBM_GROUP} 2>/dev/null || true
    
    log_success "NBM desinstalado com sucesso"
}

# Menu principal
main() {
    show_banner
    
    case "${1:-install}" in
        install)
            check_root
            check_os
            update_system
            install_system_deps
            install_nodejs
            install_postgresql
            create_user
            create_directories
            setup_database
            install_application
            create_env_file
            install_npm_deps
            build_application
            init_database
            create_systemd_service
            configure_firewall
            create_admin_user
            start_service
            show_summary
            ;;
        uninstall)
            check_root
            uninstall
            ;;
        *)
            echo "Uso: $0 {install|uninstall}"
            exit 1
            ;;
    esac
}

# Executar
main "$@"
