#!/bin/bash
# NBM CLOUD Agent v1.0
# Agente proxy para backup de equipamentos de rede
# Suporta: Mikrotik, Huawei, Cisco, Nokia, ZTE, Datacom, Datacom-DMOS, Juniper

set -e

AGENT_VERSION="1.0.0"
AGENT_DIR="/opt/nbm-agent"
CONFIG_FILE="$AGENT_DIR/config.json"
LOG_FILE="$AGENT_DIR/logs/agent.log"
PID_FILE="$AGENT_DIR/agent.pid"
GITHUB_REPO="https://github.com/YOUR_USERNAME/nbm-agent.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_debug() { log "DEBUG" "$@"; }

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    SERVER_URL=$(jq -r '.serverUrl' "$CONFIG_FILE")
    AGENT_TOKEN=$(jq -r '.token' "$CONFIG_FILE")
    AGENT_ID=$(jq -r '.agentId' "$CONFIG_FILE")
    AGENT_NAME=$(jq -r '.name' "$CONFIG_FILE")
    
    if [[ -z "$SERVER_URL" || -z "$AGENT_TOKEN" ]]; then
        log_error "Invalid configuration. serverUrl and token are required."
        exit 1
    fi
    
    log_info "Configuration loaded: Agent=$AGENT_NAME, Server=$SERVER_URL"
}

# Check dependencies
check_dependencies() {
    local deps=("jq" "curl" "sshpass" "ssh" "websocat" "git")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        log_info "Install with: apt-get install ${missing[*]}"
        exit 1
    fi
}

# Get system diagnostics
get_diagnostics() {
    local hostname=$(hostname)
    local uptime=$(uptime -p 2>/dev/null || uptime)
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo "N/A")
    local mem_total=$(free -m | awk '/^Mem:/{print $2}')
    local mem_used=$(free -m | awk '/^Mem:/{print $3}')
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    local ip_address=$(hostname -I | awk '{print $1}')
    local kernel=$(uname -r)
    local os=$(cat /etc/os-release 2>/dev/null | grep "PRETTY_NAME" | cut -d'"' -f2 || uname -s)
    
    cat <<EOF
{
    "hostname": "$hostname",
    "uptime": "$uptime",
    "cpuUsage": "$cpu_usage",
    "memoryTotal": "$mem_total",
    "memoryUsed": "$mem_used",
    "diskUsage": "$disk_usage",
    "ipAddress": "$ip_address",
    "kernel": "$kernel",
    "os": "$os",
    "agentVersion": "$AGENT_VERSION",
    "timestamp": "$(date -Iseconds)"
}
EOF
}

# Execute terminal command safely
execute_command() {
    local command="$1"
    local timeout="${2:-30}"
    
    # Security: Block dangerous commands
    local blocked_patterns=("rm -rf /" "dd if=" "mkfs" "> /dev/" "chmod 777 /" ":(){ :|:& };:")
    for pattern in "${blocked_patterns[@]}"; do
        if [[ "$command" == *"$pattern"* ]]; then
            echo '{"success": false, "error": "Command blocked for security reasons"}'
            return 1
        fi
    done
    
    # Execute with timeout
    local output
    local exit_code
    output=$(timeout "$timeout" bash -c "$command" 2>&1)
    exit_code=$?
    
    # Escape for JSON
    output=$(echo "$output" | jq -Rs .)
    
    echo "{\"success\": true, \"output\": $output, \"exitCode\": $exit_code}"
}

# Validate IP address format
validate_ip() {
    local ip="$1"
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    elif [[ "$ip" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$ ]]; then
        return 0
    fi
    return 1
}

# Validate port number
validate_port() {
    local port="$1"
    if [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 1 ]] && [[ "$port" -le 65535 ]]; then
        return 0
    fi
    return 1
}

# Test connection to equipment (safe implementation)
test_connection() {
    local ip="$1"
    local port="${2:-22}"
    local protocol="${3:-ssh}"
    local timeout="${4:-10}"
    
    # Validate inputs to prevent command injection
    if ! validate_ip "$ip"; then
        echo '{"reachable": false, "error": "Invalid IP address format"}'
        return 1
    fi
    
    if ! validate_port "$port"; then
        echo '{"reachable": false, "error": "Invalid port number"}'
        return 1
    fi
    
    log_info "Testing connection to $ip:$port ($protocol)"
    
    local result
    case "$protocol" in
        ssh|telnet)
            # Use nc (netcat) for safe connection testing - no shell interpolation
            if command -v nc &> /dev/null; then
                if nc -z -w "$timeout" "$ip" "$port" 2>/dev/null; then
                    result='{"reachable": true, "latency": "OK"}'
                else
                    result='{"reachable": false, "error": "Connection refused or timeout"}'
                fi
            else
                # Fallback to timeout with direct socket - safe with validated inputs
                if timeout "$timeout" bash -c "exec 3<>/dev/tcp/\$1/\$2" -- "$ip" "$port" 2>/dev/null; then
                    result='{"reachable": true, "latency": "OK"}'
                else
                    result='{"reachable": false, "error": "Connection refused or timeout"}'
                fi
            fi
            ;;
        ping)
            # ping command is safe with validated IP
            if ping -c 3 -W "$timeout" -- "$ip" &>/dev/null; then
                result='{"reachable": true, "latency": "OK"}'
            else
                result='{"reachable": false, "error": "Host unreachable"}'
            fi
            ;;
        *)
            result='{"reachable": false, "error": "Unknown protocol"}'
            ;;
    esac
    
    echo "$result"
}

# Execute SSH backup command
execute_ssh_backup() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local command="$5"
    local timeout="${6:-60}"
    
    log_info "Executing SSH backup on $host:$port"
    
    local output
    output=$(sshpass -p "$password" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
        -p "$port" "$username@$host" "$command" 2>&1)
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo "$output"
        return 0
    else
        log_error "SSH backup failed: $output"
        return 1
    fi
}

# Self-update from GitHub
self_update() {
    local target_version="${1:-latest}"
    
    log_info "Starting self-update to version: $target_version"
    
    local update_dir="$AGENT_DIR/releases/$(date +%Y%m%d_%H%M%S)"
    local current_link="$AGENT_DIR/current"
    local backup_link="$AGENT_DIR/previous"
    
    # Create update directory
    mkdir -p "$update_dir"
    
    # Clone or pull repository
    if [[ -d "$AGENT_DIR/repo/.git" ]]; then
        log_info "Updating existing repository..."
        cd "$AGENT_DIR/repo"
        git fetch --all --tags
        
        if [[ "$target_version" == "latest" ]]; then
            git pull origin main
        else
            git checkout "v$target_version" 2>/dev/null || git checkout "$target_version"
        fi
    else
        log_info "Cloning repository..."
        git clone "$GITHUB_REPO" "$AGENT_DIR/repo"
        cd "$AGENT_DIR/repo"
        
        if [[ "$target_version" != "latest" ]]; then
            git checkout "v$target_version" 2>/dev/null || git checkout "$target_version"
        fi
    fi
    
    # Copy files to release directory
    cp -r "$AGENT_DIR/repo/agents/linux/"* "$update_dir/"
    chmod +x "$update_dir/"*.sh
    
    # Backup current version
    if [[ -L "$current_link" ]]; then
        rm -f "$backup_link"
        mv "$current_link" "$backup_link"
    fi
    
    # Create new current symlink
    ln -sf "$update_dir" "$current_link"
    
    # Get new version
    local new_version=$(grep "AGENT_VERSION=" "$update_dir/nbm-agent.sh" | cut -d'"' -f2)
    
    log_info "Update completed: $AGENT_VERSION -> $new_version"
    
    # Return result
    cat <<EOF
{
    "success": true,
    "fromVersion": "$AGENT_VERSION",
    "toVersion": "$new_version",
    "updateDir": "$update_dir"
}
EOF
    
    # Request restart
    log_info "Requesting agent restart..."
    # The systemd service will pick up the new version from the symlink
    return 0
}

# Rollback to previous version
rollback() {
    local current_link="$AGENT_DIR/current"
    local backup_link="$AGENT_DIR/previous"
    
    if [[ -L "$backup_link" ]]; then
        log_warn "Rolling back to previous version..."
        rm -f "$current_link"
        mv "$backup_link" "$current_link"
        log_info "Rollback completed"
        return 0
    else
        log_error "No previous version available for rollback"
        return 1
    fi
}

# WebSocket message handler
handle_message() {
    local message="$1"
    local msg_type=$(echo "$message" | jq -r '.type')
    local request_id=$(echo "$message" | jq -r '.requestId // empty')
    
    log_debug "Received message type: $msg_type"
    
    case "$msg_type" in
        ping)
            echo '{"type": "pong"}'
            ;;
            
        request_diagnostics)
            local diagnostics=$(get_diagnostics)
            echo "{\"type\": \"diagnostics_result\", \"requestId\": \"$request_id\", \"diagnostics\": $diagnostics}"
            ;;
            
        terminal_command)
            local command=$(echo "$message" | jq -r '.command')
            local session_id=$(echo "$message" | jq -r '.sessionId')
            local result=$(execute_command "$command")
            local output=$(echo "$result" | jq -r '.output // empty')
            echo "{\"type\": \"terminal_output\", \"sessionId\": \"$session_id\", \"output\": $output, \"isComplete\": true}"
            ;;
            
        test_connection)
            local target=$(echo "$message" | jq -r '.target')
            local ip=$(echo "$target" | jq -r '.ip')
            local port=$(echo "$target" | jq -r '.port // 22')
            local protocol=$(echo "$target" | jq -r '.protocol // "ssh"')
            local result=$(test_connection "$ip" "$port" "$protocol")
            echo "{\"type\": \"test_connection_result\", \"requestId\": \"$request_id\", \"result\": $result}"
            ;;
            
        update_agent)
            local version=$(echo "$message" | jq -r '.version // "latest"')
            local result=$(self_update "$version" 2>&1)
            local success=$(echo "$result" | jq -r '.success // false')
            if [[ "$success" == "true" ]]; then
                echo "{\"type\": \"update_result\", \"requestId\": \"$request_id\", \"success\": true, \"message\": \"Update completed\"}"
            else
                echo "{\"type\": \"update_result\", \"requestId\": \"$request_id\", \"success\": false, \"error\": \"Update failed: $result\"}"
            fi
            ;;
            
        execute_backup)
            local job_id=$(echo "$message" | jq -r '.jobId')
            local equipment=$(echo "$message" | jq -r '.equipment')
            local config=$(echo "$message" | jq -r '.config')
            
            local host=$(echo "$equipment" | jq -r '.ipAddress')
            local port=$(echo "$equipment" | jq -r '.port // 22')
            local username=$(echo "$equipment" | jq -r '.username')
            local password=$(echo "$equipment" | jq -r '.password')
            local command=$(echo "$config" | jq -r '.backupCommand')
            
            log_info "Executing backup job $job_id for $host"
            
            local output
            if output=$(execute_ssh_backup "$host" "$port" "$username" "$password" "$command" 120); then
                # Escape output for JSON
                output=$(echo "$output" | jq -Rs .)
                echo "{\"type\": \"backup_result\", \"jobId\": \"$job_id\", \"success\": true, \"output\": $output}"
            else
                echo "{\"type\": \"backup_result\", \"jobId\": \"$job_id\", \"success\": false, \"error\": \"Backup execution failed\"}"
            fi
            ;;
            
        *)
            log_warn "Unknown message type: $msg_type"
            echo "{\"type\": \"error\", \"message\": \"Unknown message type: $msg_type\"}"
            ;;
    esac
}

# Main WebSocket connection loop
connect_websocket() {
    local ws_url="${SERVER_URL/https:/wss:}/ws/agents"
    ws_url="${ws_url/http:/ws:}"
    
    log_info "Connecting to WebSocket: $ws_url"
    
    # Send authentication message first
    local register_msg=$(cat <<EOF
{"type":"auth","token":"$AGENT_TOKEN","agentId":$AGENT_ID,"name":"$AGENT_NAME","version":"$AGENT_VERSION"}
EOF
)
    
    while true; do
        log_info "Establishing WebSocket connection..."
        
        # Use websocat for WebSocket communication
        (
            echo "$register_msg"
            while read -r line; do
                if [[ -n "$line" ]]; then
                    response=$(handle_message "$line")
                    if [[ -n "$response" ]]; then
                        echo "$response"
                    fi
                fi
            done
        ) | websocat -t "$ws_url" 2>&1 | while read -r msg; do
            log_debug "Received: $msg"
            if [[ -n "$msg" ]]; then
                response=$(handle_message "$msg")
                if [[ -n "$response" ]]; then
                    log_debug "Sending: $response"
                fi
            fi
        done
        
        log_warn "WebSocket disconnected, reconnecting in 10 seconds..."
        sleep 10
    done
}

# Alternative: Simple polling mode for environments without websocat
polling_mode() {
    log_info "Starting in polling mode (no WebSocket support)"
    
    while true; do
        # Register/heartbeat
        curl -s -X POST "$SERVER_URL/api/agent/heartbeat" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AGENT_TOKEN" \
            -d "{\"agentId\": $AGENT_ID, \"version\": \"$AGENT_VERSION\"}" || true
        
        # Check for pending jobs
        local jobs=$(curl -s "$SERVER_URL/api/agent/jobs?agentId=$AGENT_ID" \
            -H "Authorization: Bearer $AGENT_TOKEN" 2>/dev/null)
        
        if [[ -n "$jobs" && "$jobs" != "null" ]]; then
            echo "$jobs" | jq -c '.[]' | while read -r job; do
                local job_type=$(echo "$job" | jq -r '.type')
                log_info "Processing job: $job_type"
                response=$(handle_message "$job")
                
                # Send result back
                curl -s -X POST "$SERVER_URL/api/agent/result" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer $AGENT_TOKEN" \
                    -d "$response" || true
            done
        fi
        
        sleep 30
    done
}

# Status check
status() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${GREEN}Agent is running (PID: $pid)${NC}"
            return 0
        fi
    fi
    echo -e "${RED}Agent is not running${NC}"
    return 1
}

# Start agent
start() {
    check_dependencies
    load_config
    
    if status &>/dev/null; then
        log_warn "Agent is already running"
        return 1
    fi
    
    mkdir -p "$AGENT_DIR/logs"
    
    log_info "Starting NBM CLOUD Agent v$AGENT_VERSION"
    
    # Check if websocat is available for WebSocket mode
    if command -v websocat &> /dev/null; then
        connect_websocket &
    else
        log_warn "websocat not found, using polling mode"
        polling_mode &
    fi
    
    echo $! > "$PID_FILE"
    log_info "Agent started with PID: $(cat $PID_FILE)"
}

# Stop agent
stop() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping agent (PID: $pid)..."
            kill "$pid"
            rm -f "$PID_FILE"
            log_info "Agent stopped"
            return 0
        fi
    fi
    log_warn "Agent is not running"
    return 1
}

# Show help
usage() {
    cat <<EOF
NBM CLOUD Agent v$AGENT_VERSION

Usage: $0 <command>

Commands:
    start       Start the agent
    stop        Stop the agent
    restart     Restart the agent
    status      Check agent status
    update      Update agent from GitHub
    rollback    Rollback to previous version
    diagnostics Show system diagnostics
    version     Show agent version

Configuration:
    Config file: $CONFIG_FILE
    Log file:    $LOG_FILE

EOF
}

# Main entry point
case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop || true
        sleep 2
        start
        ;;
    status)
        status
        ;;
    update)
        load_config
        self_update "${2:-latest}"
        ;;
    rollback)
        rollback
        ;;
    diagnostics)
        get_diagnostics
        ;;
    version)
        echo "NBM CLOUD Agent v$AGENT_VERSION"
        ;;
    *)
        usage
        exit 1
        ;;
esac
