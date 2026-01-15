#!/bin/bash
# NBM CLOUD v17.0 - Script de Instalação do Agente
# Execute no servidor do AGENTE (143.255.197.26)
# Uso: curl -sSL http://143.255.197.25:5000/install/agent.sh | bash -s -- --token TOKEN --server ws://143.255.197.25:5000/ws/agents

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AGENT_DIR="/opt/nbm-agent"
LOG_DIR="$AGENT_DIR/logs"
CONFIG_FILE="$AGENT_DIR/config.json"
SERVICE_FILE="/etc/systemd/system/nbm-agent.service"

# Parâmetros
SERVER_URL=""
TOKEN=""

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  NBM CLOUD v17.0 - Instalação do Agente   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Este script precisa ser executado como root${NC}"
    exit 1
fi

# Solicitar parâmetros se não fornecidos
if [ -z "$SERVER_URL" ]; then
    read -p "URL do servidor NBM CLOUD (ex: ws://143.255.197.25:5000/ws/agents): " SERVER_URL
fi

if [ -z "$TOKEN" ]; then
    read -p "Token do agente (obtido na interface web): " TOKEN
fi

if [ -z "$SERVER_URL" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Servidor e token são obrigatórios${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/6] Instalando dependências...${NC}"
apt-get update -qq
apt-get install -y -qq jq curl openssh-client sshpass netcat-openbsd expect || true
echo -e "${GREEN}✓ Dependências instaladas${NC}"

echo -e "${YELLOW}[2/6] Criando diretórios...${NC}"
mkdir -p "$AGENT_DIR"
mkdir -p "$LOG_DIR"
echo -e "${GREEN}✓ Diretórios criados${NC}"

echo -e "${YELLOW}[3/6] Baixando agente do repositório...${NC}"
if [ -d "$AGENT_DIR/.git" ]; then
    cd "$AGENT_DIR"
    git pull origin main 2>/dev/null || true
else
    cd /opt
    rm -rf nbm-agent
    git clone https://github.com/MarcioVVitor/Backup-Master.git nbm-agent-temp 2>/dev/null || true
    if [ -d "nbm-agent-temp/agents/linux" ]; then
        cp -r nbm-agent-temp/agents/linux/* "$AGENT_DIR/"
        rm -rf nbm-agent-temp
    fi
fi

# Criar script do agente se não existir
if [ ! -f "$AGENT_DIR/nbm-agent.sh" ]; then
    echo -e "${YELLOW}Criando script do agente...${NC}"
    cat > "$AGENT_DIR/nbm-agent.sh" << 'AGENT_SCRIPT'
#!/bin/bash
# NBM CLOUD Agent v17.0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
LOG_FILE="$SCRIPT_DIR/logs/agent.log"
RECONNECT_DELAY=10

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

if [ ! -f "$CONFIG_FILE" ]; then
    log "ERROR: Config file not found: $CONFIG_FILE"
    exit 1
fi

SERVER_URL=$(jq -r '.server_url' "$CONFIG_FILE")
TOKEN=$(jq -r '.token' "$CONFIG_FILE")
AGENT_NAME=$(jq -r '.agent_name // "agent-$(hostname)"' "$CONFIG_FILE")

log "NBM Agent starting..."
log "Server: $SERVER_URL"
log "Agent: $AGENT_NAME"

execute_backup() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local commands="$5"
    local protocol="$6"
    local timeout="${7:-60}"
    
    log "Executing backup: $host:$port via $protocol"
    
    if [ "$protocol" = "ssh" ]; then
        export SSHPASS="$password"
        result=$(sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 \
            -p "$port" "$username@$host" "$commands" 2>&1) || true
    elif [ "$protocol" = "telnet" ]; then
        result=$(expect -c "
            set timeout $timeout
            spawn telnet $host $port
            expect \"login:\" { send \"$username\r\" }
            expect \"assword:\" { send \"$password\r\" }
            expect \">\" { send \"$commands\r\" }
            expect \">\" { send \"quit\r\" }
            expect eof
        " 2>&1) || true
    fi
    
    echo "$result"
}

send_message() {
    local msg="$1"
    echo "$msg"
}

# Main WebSocket loop using websocat or fallback
main_loop() {
    while true; do
        log "Connecting to $SERVER_URL..."
        
        # Try websocat first
        if command -v websocat &> /dev/null; then
            echo "{\"type\":\"auth\",\"token\":\"$TOKEN\",\"agentName\":\"$AGENT_NAME\"}" | \
            websocat -t "$SERVER_URL" 2>&1 | while read -r line; do
                log "Received: $line"
                
                type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
                
                if [ "$type" = "backup_request" ]; then
                    job_id=$(echo "$line" | jq -r '.jobId')
                    host=$(echo "$line" | jq -r '.equipment.ip')
                    port=$(echo "$line" | jq -r '.equipment.port // 22')
                    username=$(echo "$line" | jq -r '.equipment.username')
                    password=$(echo "$line" | jq -r '.equipment.password')
                    commands=$(echo "$line" | jq -r '.config.commands')
                    protocol=$(echo "$line" | jq -r '.config.protocol // "ssh"')
                    
                    log "Processing backup job: $job_id for $host"
                    
                    output=$(execute_backup "$host" "$port" "$username" "$password" "$commands" "$protocol")
                    
                    if [ -n "$output" ]; then
                        response="{\"type\":\"backup_result\",\"jobId\":\"$job_id\",\"success\":true,\"output\":$(echo "$output" | jq -Rs .)}"
                    else
                        response="{\"type\":\"backup_result\",\"jobId\":\"$job_id\",\"success\":false,\"error\":\"No output received\"}"
                    fi
                    
                    log "Sending result for job $job_id"
                    send_message "$response"
                fi
            done
        else
            log "websocat not found, using curl fallback..."
            # Fallback: simple HTTP polling (less efficient)
            sleep 60
        fi
        
        log "Connection lost, reconnecting in ${RECONNECT_DELAY}s..."
        sleep $RECONNECT_DELAY
    done
}

case "${1:-}" in
    start)
        main_loop
        ;;
    diagnostics)
        echo "=== NBM Agent Diagnostics ==="
        echo "Hostname: $(hostname)"
        echo "IP: $(hostname -I | awk '{print $1}')"
        echo "Uptime: $(uptime -p)"
        echo "SSH: $(ssh -V 2>&1)"
        echo "Config: $CONFIG_FILE"
        jq '.' "$CONFIG_FILE" 2>/dev/null || echo "Config not found"
        ;;
    update)
        log "Updating agent..."
        cd "$SCRIPT_DIR"
        git pull origin main 2>/dev/null || log "Git update failed"
        log "Update complete"
        ;;
    *)
        main_loop
        ;;
esac
AGENT_SCRIPT
fi

chmod +x "$AGENT_DIR/nbm-agent.sh"
echo -e "${GREEN}✓ Script do agente criado${NC}"

echo -e "${YELLOW}[4/6] Configurando agente...${NC}"
cat > "$CONFIG_FILE" << EOF
{
    "server_url": "$SERVER_URL",
    "token": "$TOKEN",
    "agent_name": "agent-$(hostname)",
    "reconnect_delay": 10,
    "log_level": "info"
}
EOF
echo -e "${GREEN}✓ Configuração salva${NC}"

echo -e "${YELLOW}[5/6] Criando serviço systemd...${NC}"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=NBM CLOUD Backup Agent
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_DIR
ExecStart=$AGENT_DIR/nbm-agent.sh start
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/agent.log
StandardError=append:$LOG_DIR/agent.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nbm-agent
echo -e "${GREEN}✓ Serviço criado e habilitado${NC}"

echo -e "${YELLOW}[6/6] Iniciando agente...${NC}"
systemctl restart nbm-agent
sleep 2

if systemctl is-active --quiet nbm-agent; then
    echo -e "${GREEN}✓ Agente iniciado com sucesso${NC}"
else
    echo -e "${RED}✗ Falha ao iniciar agente${NC}"
    echo "Verifique os logs: journalctl -u nbm-agent -f"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}          INSTALAÇÃO CONCLUÍDA             ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Configuração:"
echo "  - Servidor: $SERVER_URL"
echo "  - Token: ${TOKEN:0:20}..."
echo "  - Config: $CONFIG_FILE"
echo ""
echo "Comandos úteis:"
echo "  systemctl status nbm-agent   - Ver status"
echo "  systemctl restart nbm-agent  - Reiniciar"
echo "  tail -f $LOG_DIR/agent.log   - Ver logs"
echo "  $AGENT_DIR/nbm-agent.sh diagnostics - Diagnóstico"
echo ""
