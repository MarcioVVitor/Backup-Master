#!/bin/bash
# NBM CLOUD Agent v1.0
# Agente proxy para backup de equipamentos de rede
# Suporta: Mikrotik, Huawei, Cisco, Nokia, ZTE, Datacom (EDD), Datacom-DMOS, Juniper

# Don't exit on error - we handle errors ourselves
set +e

AGENT_VERSION="1.0.42"
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
    # Write only to log file, not stdout (to avoid mixing with WebSocket messages)
    echo -e "[$timestamp] [$level] $message" >> "$LOG_FILE"
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
    local deps=("jq" "curl" "sshpass" "ssh" "websocat" "git" "expect")
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

# Execute SSH backup command for Huawei with expect (waits for full output before quit)
execute_huawei_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local timeout="${5:-120}"
    
    log_info "Executing Huawei backup with expect on $host:$port"
    
    # Create expect script for proper interactive session
    # Uses sshpass to avoid password prompt issues and keep session alive
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f
set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]

log_user 1

# Use sshpass for more reliable password handling
# UserKnownHostsFile=/dev/null avoids host key verification errors
# TCPKeepAlive and ServerAlive keep connection alive during large config transfers
spawn sshpass -p $password ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=5 -o ServerAliveCountMax=12 \
    -o TCPKeepAlive=yes \
    -tt -p $port $username@$host

# Wait for initial prompt (> or <hostname>)
expect {
    -re {<[^>]+>} { }
    -re {\[[^\]]+\]} { }
    ">" { }
    "Password:" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "password:" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout waiting for prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during login"; exit 1 }
}

# Small delay to ensure connection is stable
sleep 1

# Disable pagination
send "screen-length 0 temporary\r"
expect {
    -re {<[^>]+>} { }
    -re {\[[^\]]+\]} { }
    ">" { }
    timeout { puts "EXPECT_ERROR: Timeout after screen-length"; exit 1 }
}

# Small delay before main command
sleep 0.5

# Execute backup command with longer timeout for large configs
set timeout 600
send "display current-configuration\r"

# Wait for the prompt to return after full output
# Huawei configs end with "return" before the prompt
# We need to capture everything until we see the prompt again
expect {
    -re {return\r?\n<[^>]+>} { }
    -re {<[^>]+>$} { }
    -re {\[[^\]]+\]$} { }
    timeout { puts "EXPECT_ERROR: Timeout waiting for configuration output"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during backup"; exit 1 }
}

# Exit gracefully
send "quit\r"
expect {
    eof { }
    timeout { }
}
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/huawei_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Huawei backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Huawei expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Huawei backup failed - insufficient output"
        return 1
    fi
}

# Execute SSH backup command for Cisco with expect (handles enable mode properly)
execute_cisco_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local enable_password="$5"
    local backup_command="$6"
    local timeout="${7:-300}"
    
    log_info "Executing Cisco backup with expect on $host:$port (Agent v1.0.41)"
    
    # Create expect script for proper interactive session
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# Large buffer for configurations
match_max 50000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]
set enable_pass [lindex $argv 5]
set backup_cmd [lindex $argv 6]

log_user 1

puts "CISCO_DEBUG: Starting Cisco SSH backup v1.0.41"
puts "CISCO_DEBUG: Host=$host Port=$port User=$username"

# SSH options for legacy devices
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=5 -o ServerAliveCountMax=60 \
    -o TCPKeepAlive=yes \
    -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa \
    -o KexAlgorithms=+diffie-hellman-group1-sha1,diffie-hellman-group14-sha1 \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { 
        puts "CISCO_DEBUG: Got password prompt"
        send "$password\r" 
    }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

puts "CISCO_DEBUG: Waiting for initial prompt..."

# Wait for initial prompt (> or #)
expect {
    "#" { puts "CISCO_DEBUG: Got # prompt (privileged mode)" }
    ">" { puts "CISCO_DEBUG: Got > prompt (user mode)" }
    -re {[Pp]assword:} { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout after login"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed after login"; exit 1 }
}

# Enter enable mode if enable password provided
if { $enable_pass ne "" && $enable_pass ne "null" } {
    puts "CISCO_DEBUG: Entering enable mode..."
    send "enable\r"
    expect {
        -re {[Pp]assword:} { 
            puts "CISCO_DEBUG: Got enable password prompt"
            send "$enable_pass\r" 
        }
        "#" { puts "CISCO_DEBUG: Already in privileged mode" }
        timeout { puts "EXPECT_ERROR: Timeout waiting for enable password prompt"; exit 1 }
    }
    expect {
        "#" { puts "CISCO_DEBUG: Enable mode successful" }
        -re {[Aa]ccess [Dd]enied} { puts "EXPECT_ERROR: Enable password rejected"; exit 1 }
        -re {[Bb]ad [Pp]assword} { puts "EXPECT_ERROR: Enable password rejected"; exit 1 }
        timeout { puts "EXPECT_ERROR: Timeout entering enable mode"; exit 1 }
    }
}

sleep 0.3

# Disable pagination - try both commands
puts "CISCO_DEBUG: Disabling pagination..."
send "terminal length 0\r"
expect {
    "#" { }
    ">" { }
    timeout { }
}
send "terminal pager 0\r"
expect {
    "#" { }
    ">" { }
    timeout { }
}

sleep 0.3

# Execute backup command
puts "CISCO_DEBUG: Executing command: $backup_cmd"
send "$backup_cmd\r"

# Handle pagination with --More-- prompts if they appear
set page_count 0
set max_pages 500
set timeout 10

while {$page_count < $max_pages} {
    expect {
        -exact "--More--" {
            incr page_count
            send " "
        }
        -exact "-- More --" {
            incr page_count
            send " "
        }
        -exact " --More-- " {
            incr page_count
            send " "
        }
        timeout {
            puts "CISCO_DEBUG: Config capture complete after $page_count pages"
            break
        }
        eof {
            puts "CISCO_DEBUG: Connection closed after $page_count pages"
            break
        }
    }
}

# Wait a moment before exit
sleep 0.5

# Exit gracefully
send "\r"
expect {
    "#" { }
    ">" { }
    timeout { }
}
send "exit\r"
expect {
    eof { }
    timeout { }
}

puts "CISCO_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/cisco_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" "$enable_password" "$backup_command" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Cisco backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Cisco expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Cisco backup failed - insufficient output"
        return 1
    fi
}

# Execute backup command for Datacom EDD (DmSwitch) with expect
# Uses Cisco-like CLI: show running-config, terminal length 0
# Supports both SSH and Telnet based on port
execute_datacom_edd_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local enable_password="$5"
    local protocol="${6:-ssh}"
    local timeout="${7:-300}"
    
    log_info "Executing Datacom EDD backup with expect on $host:$port protocol=$protocol (Agent v1.0.37)"
    
    # Determine if using Telnet or SSH based on port or protocol
    local use_telnet="false"
    if [[ "$port" == "23" ]] || [[ "${protocol,,}" == "telnet" ]]; then
        use_telnet="true"
        log_info "Using Telnet for Datacom EDD on port $port"
    fi
    
    if [[ "$use_telnet" == "true" ]]; then
        # Telnet expect script
        local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# Large buffer for configurations
match_max 50000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]
set enable_pass [lindex $argv 5]

log_user 1
exp_internal 0

puts "DATACOM_DEBUG: Starting Datacom EDD TELNET backup v1.0.37"
puts "DATACOM_DEBUG: Host=$host Port=$port User=$username"

# Telnet connection
spawn telnet $host $port

# IMPORTANT: Datacom shows ASCII art banner with # symbols
# We must wait ONLY for "login:" text - ignore the # in the banner

puts "DATACOM_DEBUG: Waiting for login prompt..."

# Wait for login prompt - simple string match
expect {
    "login: " { 
        puts "DATACOM_DEBUG: Got login prompt"
        send "$username\r" 
    }
    "login:" { 
        puts "DATACOM_DEBUG: Got login prompt (no space)"
        send "$username\r" 
    }
    timeout { puts "EXPECT_ERROR: Timeout waiting for login prompt (30s)"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

puts "DATACOM_DEBUG: Waiting for password prompt..."

# Wait for password prompt
expect {
    "Password: " { 
        puts "DATACOM_DEBUG: Got password prompt"
        send "$password\r" 
    }
    "Password:" { 
        puts "DATACOM_DEBUG: Got password prompt (no space)"
        send "$password\r" 
    }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

puts "DATACOM_DEBUG: Waiting for command prompt..."

# Wait for privileged prompt (hostname#) after login
# Datacom goes directly to # after successful login
expect {
    "#" { puts "DATACOM_DEBUG: Got # prompt" }
    ">" { puts "DATACOM_DEBUG: Got > prompt" }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Authentication failed" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout after password"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed after login"; exit 1 }
}

# NOTE: Datacom EDD does not support "terminal length 0"
# We must handle --More-- pagination by sending space

sleep 0.3

# Execute show running-config
puts "DATACOM_DEBUG: Executing show running-config"
send "show running-config\r"

# Handle pagination with --More-- prompts
# Use short timeout between pages - when no more --More-- appears, config is done
set page_count 0
set max_pages 500
set timeout 10

while {$page_count < $max_pages} {
    expect {
        -exact "--More--" {
            incr page_count
            send " "
        }
        timeout {
            # No more --More-- means config output is complete
            puts "DATACOM_DEBUG: Config capture complete after $page_count pages"
            break
        }
        eof {
            puts "DATACOM_DEBUG: Connection closed after $page_count pages"
            break
        }
    }
}

# Exit gracefully
send "exit\r"
expect {
    eof { }
    timeout { }
}

puts "DATACOM_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    else
        # SSH expect script
        local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# Large buffer for configurations
match_max 50000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]
set enable_pass [lindex $argv 5]

log_user 1

puts "DATACOM_DEBUG: Starting Datacom EDD SSH backup v1.0.30"

# SSH options - Datacom may use older SSH algorithms
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=5 -o ServerAliveCountMax=60 \
    -o TCPKeepAlive=yes \
    -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa \
    -o KexAlgorithms=+diffie-hellman-group14-sha1 \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { send "$password\r" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

# Wait for initial prompt (> or #)
expect {
    "#" { puts "DATACOM_DEBUG: Got privileged prompt" }
    ">" { puts "DATACOM_DEBUG: Got user prompt" }
    "Password:" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout after login"; exit 1 }
}

# Enter enable mode if needed (if prompt is >)
set current_prompt $expect_out(buffer)
if { [string match "*>*" $current_prompt] } {
    puts "DATACOM_DEBUG: Entering enable mode"
    send "enable\r"
    expect {
        -re {[Pp]assword:} { 
            if { $enable_pass ne "" && $enable_pass ne "null" } {
                send "$enable_pass\r"
            } else {
                send "$password\r"
            }
        }
        "#" { puts "DATACOM_DEBUG: No enable password needed" }
        timeout { puts "EXPECT_ERROR: Timeout waiting for enable prompt"; exit 1 }
    }
    expect {
        "#" { puts "DATACOM_DEBUG: Enable mode successful" }
        -re {[Aa]ccess [Dd]enied} { puts "EXPECT_ERROR: Enable password rejected"; exit 1 }
        ">" { puts "EXPECT_ERROR: Failed to enter enable mode"; exit 1 }
        timeout { puts "EXPECT_ERROR: Timeout entering enable mode"; exit 1 }
    }
}

# Disable pagination
puts "DATACOM_DEBUG: Disabling pagination"
send "terminal length 0\r"
expect {
    "#" { }
    timeout { }
}

sleep 0.3

# Execute show running-config
puts "DATACOM_DEBUG: Executing show running-config"
set timeout 600
send "show running-config\r"

# Wait for prompt after config output
expect {
    -re {\r\n[a-zA-Z0-9_-]+#\s*$} { puts "DATACOM_DEBUG: Config capture complete" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for configuration output"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during backup"; exit 1 }
}

# Exit gracefully
send "exit\r"
expect {
    eof { }
    timeout { }
}

puts "DATACOM_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    fi
    
    # Write expect script to temp file
    local expect_file="/tmp/datacom_edd_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" "$enable_password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Datacom EDD backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Datacom EDD expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Datacom EDD backup failed - insufficient output"
        return 1
    fi
}

# Execute SSH backup command for Datacom DMOS with expect
execute_datacom_dmos_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local timeout="${5:-300}"
    
    log_info "Executing Datacom DMOS backup with expect on $host:$port (Agent v1.0.37)"
    
    # Create expect script for Datacom DMOS (DmOS)
    # DMOS uses SSH, prompt ends with #, may have --More-- pagination
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# Large buffer for configurations
match_max 50000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]

log_user 1

puts "DMOS_DEBUG: Starting Datacom DMOS SSH backup v1.0.37"
puts "DMOS_DEBUG: Host=$host Port=$port User=$username"

# SSH connection - DMOS uses modern SSH
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=5 -o ServerAliveCountMax=60 \
    -o TCPKeepAlive=yes \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { 
        puts "DMOS_DEBUG: Got password prompt"
        send "$password\r" 
    }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

puts "DMOS_DEBUG: Waiting for command prompt..."

# Wait for privileged prompt (hostname#) after login
# DMOS goes directly to # after successful login
expect {
    "#" { puts "DMOS_DEBUG: Got # prompt" }
    ">" { puts "DMOS_DEBUG: Got > prompt" }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Permission denied" { puts "EXPECT_ERROR: Permission denied"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout after password"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed after login"; exit 1 }
}

sleep 0.3

# Execute show running-config
puts "DMOS_DEBUG: Executing show running-config"
send "show running-config\r"

# Handle pagination with --More-- prompts if they appear
# Use short timeout between pages - when no more --More-- appears, config is done
set page_count 0
set max_pages 500
set timeout 10

while {$page_count < $max_pages} {
    expect {
        -exact "--More--" {
            incr page_count
            send " "
        }
        -exact "-- More --" {
            incr page_count
            send " "
        }
        timeout {
            # No more --More-- means config output is complete
            puts "DMOS_DEBUG: Config capture complete after $page_count pages"
            break
        }
        eof {
            puts "DMOS_DEBUG: Connection closed after $page_count pages"
            break
        }
    }
}

# Wait a moment before exit to ensure clean separation
sleep 0.5

# Exit gracefully
send "\r"
expect "#"
send "exit\r"
expect {
    eof { }
    timeout { }
}

puts "DMOS_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/datacom_dmos_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Datacom DMOS backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Datacom DMOS expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Datacom DMOS backup failed - insufficient output"
        return 1
    fi
}

# Execute SSH backup command for Juniper with expect
execute_juniper_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local timeout="${5:-300}"
    
    log_info "Executing Juniper backup with expect on $host:$port (Agent v1.0.40)"
    
    # Create expect script for Juniper
    # Juniper uses SSH, prompt ends with > or #
    # Command: show configuration | display set
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# Large buffer for configurations
match_max 50000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]

log_user 1

puts "JUNIPER_DEBUG: Starting Juniper SSH backup v1.0.40"
puts "JUNIPER_DEBUG: Host=$host Port=$port User=$username"

# SSH connection
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=5 -o ServerAliveCountMax=60 \
    -o TCPKeepAlive=yes \
    -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { 
        puts "JUNIPER_DEBUG: Got password prompt"
        send "$password\r" 
    }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

puts "JUNIPER_DEBUG: Waiting for command prompt..."

# Wait for Juniper prompt (user@hostname> or user@hostname#)
expect {
    ">" { puts "JUNIPER_DEBUG: Got > prompt" }
    "#" { puts "JUNIPER_DEBUG: Got # prompt" }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Permission denied" { puts "EXPECT_ERROR: Permission denied"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout after password"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed after login"; exit 1 }
}

sleep 0.3

# Disable pagination for Juniper
puts "JUNIPER_DEBUG: Disabling pagination"
send "set cli screen-length 0\r"
expect {
    ">" { }
    "#" { }
    timeout { puts "JUNIPER_DEBUG: Timeout after screen-length, continuing" }
}

sleep 0.3

# Execute show configuration | display set
puts "JUNIPER_DEBUG: Executing show configuration | display set"
send "show configuration | display set\r"

# Handle pagination with --More-- prompts if they appear
# Use short timeout between pages - when no more --More-- appears, config is done
set page_count 0
set max_pages 500
set timeout 10

while {$page_count < $max_pages} {
    expect {
        -exact "--More--" {
            incr page_count
            send " "
        }
        -exact "-- More --" {
            incr page_count
            send " "
        }
        -exact "---more---" {
            incr page_count
            send " "
        }
        timeout {
            # No more --More-- means config output is complete
            puts "JUNIPER_DEBUG: Config capture complete after $page_count pages"
            break
        }
        eof {
            puts "JUNIPER_DEBUG: Connection closed after $page_count pages"
            break
        }
    }
}

# Wait a moment before exit to ensure clean separation
sleep 0.5

# Exit gracefully
send "\r"
expect {
    ">" { }
    "#" { }
    timeout { }
}
send "exit\r"
expect {
    eof { }
    timeout { }
}

puts "JUNIPER_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/juniper_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Juniper backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Juniper expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Juniper backup failed - insufficient output"
        return 1
    fi
}

# Execute SSH backup command for Nokia SR OS with expect
execute_nokia_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local timeout="${5:-1800}"
    
    log_info "Executing Nokia backup with expect on $host:$port (Agent v1.0.29 - sentinel method)"
    
    # Create expect script for Nokia SR OS
    # Nokia requires pure interactive SSH - no sshpass, no exec
    # Uses: configure -> info to get full configuration
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

# CRITICAL: Set match_max FIRST before any spawn to allocate large buffer
# 200MB buffer for very large Nokia configurations (6000+ lines)
match_max 200000000

set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]

log_user 1

puts "NOKIA_DEBUG: Starting Nokia backup v1.0.29 (sentinel method)"
puts "NOKIA_DEBUG: Buffer size: 200MB, Timeout: ${timeout}s"

# Pure SSH connection - Nokia doesn't accept exec requests
# HostKeyAlgorithms and PubkeyAcceptedAlgorithms enable legacy ssh-rsa for Nokia
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=3 -o ServerAliveCountMax=200 \
    -o TCPKeepAlive=yes \
    -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { send "$password\r" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

# Wait for Nokia prompt (ends with # or >)
# Nokia prompts look like: A:hostname# or *A:hostname# or just hostname#
expect {
    -re {[*]?[AB]:[^\r\n]+[#>]} { puts "NOKIA_DEBUG: Got prompt type 1" }
    -re {[a-zA-Z0-9_-]+[#>]\s*$} { puts "NOKIA_DEBUG: Got prompt type 2" }
    "#" { puts "NOKIA_DEBUG: Got # prompt" }
    ">" { puts "NOKIA_DEBUG: Got > prompt" }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Access denied" { puts "EXPECT_ERROR: Access denied"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout waiting for prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during login"; exit 1 }
}

puts "NOKIA_DEBUG: Login successful, disabling pagination"

# Disable pagination (Nokia SR OS)
send "environment no more\r"
expect {
    -re {[*]?[AB]:[^\r\n]+[#>]} { }
    -re {[a-zA-Z0-9_-]+[#>]} { }
    "#" { }
    ">" { }
    timeout { puts "EXPECT_ERROR: Timeout after environment no more"; exit 1 }
}

sleep 0.5

puts "NOKIA_DEBUG: Entering configure mode"

# Enter configure mode
send "configure\r"
expect {
    -re {[*]?[AB]:[^\r\n]+[#>]} { }
    -re {[a-zA-Z0-9_-]+[#>]} { }
    "#" { }
    ">" { }
    timeout { puts "EXPECT_ERROR: Timeout entering configure mode"; exit 1 }
}

sleep 0.3

puts "NOKIA_DEBUG: Executing info command - this may take several minutes for large configs"

# Very long timeout for large configs (60 min = 3600s)
set timeout 3600

# Execute info command to get full configuration
# Then immediately queue a sentinel command that will only execute after info completes
# This avoids matching intermediate context prompts that appear in the config output
send "info\r"

# Small delay then queue the sentinel command
# The sentinel will only appear AFTER info output is complete
after 500
send "echo __NBM_BACKUP_COMPLETE__\r"

# Wait for the sentinel marker - this is the ONLY reliable end marker
# Do NOT match on prompts as they appear mid-stream in config output
expect {
    "__NBM_BACKUP_COMPLETE__" { puts "NOKIA_DEBUG: Config capture complete (sentinel found)" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for configuration output (60 min exceeded)"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during backup"; exit 1 }
}

# Wait for prompt after sentinel
expect {
    -re {[#>]\s*$} { }
    timeout { }
}

puts "NOKIA_DEBUG: Exiting configure mode"

# Exit configure mode
send "exit all\r"
expect {
    -re {[*]?[AB]:[^\r\n]+[#>]} { }
    -re {[a-zA-Z0-9_-]+[#>]} { }
    "#" { }
    ">" { }
    timeout { }
}

# Exit gracefully
send "logout\r"
expect {
    -re {[Aa]re you sure} { send "y\r"; exp_continue }
    eof { }
    timeout { }
}

puts "NOKIA_DEBUG: Backup completed successfully"
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/nokia_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "Nokia backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "Nokia expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "Nokia backup failed - insufficient output"
        return 1
    fi
}

# Execute SSH backup command for ZTE TITAN OLT with expect
execute_zte_backup_expect() {
    local host="$1"
    local port="$2"
    local username="$3"
    local password="$4"
    local enable_password="$5"
    local timeout="${6:-180}"
    
    log_info "Executing ZTE OLT backup with expect on $host:$port (Agent v1.0.29)"
    log_info "ZTE enable_password provided: ${enable_password:+(yes)}"
    
    # Create expect script for ZTE TITAN OLT (C300/C320/C600)
    # ZTE OLT uses enable command with password (default: zxr10)
    local expect_script=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f
set timeout [lindex $argv 0]
set host [lindex $argv 1]
set port [lindex $argv 2]
set username [lindex $argv 3]
set password [lindex $argv 4]
set enable_pass [lindex $argv 5]

log_user 1

puts "ZTE_DEBUG: Starting ZTE backup (agent v1.0.29)"
puts "ZTE_DEBUG: Enable password provided: [expr {$enable_pass ne "" && $enable_pass ne "null" ? "yes" : "no (using default zxr10)"}]"

# SSH connection - simplified for Debian 13 compatibility
# UserKnownHostsFile=/dev/null avoids host key verification errors
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 \
    -p $port $username@$host

# Wait for password prompt
expect {
    -re {[Pp]assword:} { send "$password\r" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for password prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed"; exit 1 }
}

# Wait for ZTE OLT prompt (ends with # or >)
# ZTE OLT prompts look like: ZXAN# or OLT-NAME> or hostname#
set prompt_type ""
expect {
    -re {[a-zA-Z0-9_-]+#\s*$} { set prompt_type "privileged"; puts "ZTE_DEBUG: Detected privileged mode (#)" }
    -re {[a-zA-Z0-9_-]+>\s*$} { set prompt_type "user"; puts "ZTE_DEBUG: Detected user mode (>)" }
    "#" { set prompt_type "privileged"; puts "ZTE_DEBUG: Detected privileged mode (#)" }
    ">" { set prompt_type "user"; puts "ZTE_DEBUG: Detected user mode (>)" }
    "Login incorrect" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    "Access denied" { puts "EXPECT_ERROR: Access denied"; exit 1 }
    "Password:" { puts "EXPECT_ERROR: Authentication failed"; exit 1 }
    timeout { puts "EXPECT_ERROR: Timeout waiting for prompt"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during login"; exit 1 }
}

# Small delay to ensure connection is stable
sleep 1

# If in user mode (>), enter enable mode
if {$prompt_type eq "user"} {
    puts "ZTE_DEBUG: Entering enable mode..."
    send "enable\r"
    expect {
        -re {[Pp]assword:} {
            puts "ZTE_DEBUG: Enable password prompt detected"
            # Use enable password if provided, otherwise try default zxr10
            if {$enable_pass ne "" && $enable_pass ne "null"} {
                puts "ZTE_DEBUG: Sending provided enable password"
                send "$enable_pass\r"
            } else {
                puts "ZTE_DEBUG: Sending default enable password (zxr10)"
                send "zxr10\r"
            }
        }
        "#" { puts "ZTE_DEBUG: Already in privileged mode" }
        timeout { puts "EXPECT_ERROR: Timeout entering enable mode"; exit 1 }
    }
    
    # Wait for privileged prompt
    expect {
        -re {[a-zA-Z0-9_-]+#} { puts "ZTE_DEBUG: Now in privileged mode" }
        "#" { puts "ZTE_DEBUG: Now in privileged mode" }
        -re {[Aa]ccess [Dd]enied} { puts "EXPECT_ERROR: Enable password rejected"; exit 1 }
        -re {[Bb]ad [Pp]assword} { puts "EXPECT_ERROR: Enable password rejected"; exit 1 }
        ">" { puts "EXPECT_ERROR: Failed to enter enable mode - still in user mode"; exit 1 }
        timeout { puts "EXPECT_ERROR: Timeout waiting for enable prompt"; exit 1 }
    }
} else {
    puts "ZTE_DEBUG: Already in privileged mode, skipping enable"
}

# Disable pagination - ZTE OLT uses scroll
puts "ZTE_DEBUG: Disabling pagination with scroll command"
send "scroll\r"
expect {
    -re {[a-zA-Z0-9_-]+#} { }
    "#" { }
    timeout { }
}

# Small delay before main command
sleep 0.5

# Execute backup command with long timeout for large configs
puts "ZTE_DEBUG: Executing show running-config"
set timeout 600
send "show running-config\r"

# Wait for the prompt to return after full output
# ZTE OLT config can be very large, use longer timeout
expect {
    -re {\r\n[a-zA-Z0-9_-]+#\s*$} { puts "ZTE_DEBUG: Config output complete" }
    timeout { puts "EXPECT_ERROR: Timeout waiting for configuration output"; exit 1 }
    eof { puts "EXPECT_ERROR: Connection closed during backup"; exit 1 }
}

# Exit gracefully
send "exit\r"
expect {
    eof { }
    timeout { }
}
EXPECT_EOF
)
    
    # Write expect script to temp file
    local expect_file="/tmp/zte_backup_$$.exp"
    echo "$expect_script" > "$expect_file"
    chmod +x "$expect_file"
    
    # Execute expect script
    local output
    local exit_code
    output=$(timeout "$timeout" expect "$expect_file" "$timeout" "$host" "$port" "$username" "$password" "$enable_password" 2>&1)
    exit_code=$?
    
    # Clean up
    rm -f "$expect_file"
    
    # Check results
    if [[ $exit_code -eq 124 ]]; then
        log_error "ZTE backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check for expect errors
    if [[ "$output" == *"EXPECT_ERROR:"* ]]; then
        log_error "ZTE expect error: $output"
        return 1
    fi
    
    local output_length=${#output}
    if [[ $output_length -gt 100 ]]; then
        echo "$output"
        return 0
    else
        log_error "ZTE backup failed - insufficient output"
        return 1
    fi
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
    local exit_code
    
    # SSH options for compatibility with legacy devices (Huawei, Cisco, etc.)
    # UserKnownHostsFile=/dev/null avoids host key verification errors
    local ssh_opts="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3"
    
    # Check if command has multiple lines (needs stdin mode with PTY)
    if [[ "$command" == *$'\n'* ]] || [[ "$command" == *"\\n"* ]]; then
        log_debug "Using stdin mode with PTY for multi-line command"
        # Convert literal \n to actual newlines and send via stdin
        # Use -tt to force PTY allocation - required for Huawei and some other devices
        local cmd_formatted=$(echo -e "$command")
        output=$(echo "$cmd_formatted" | timeout "$timeout" sshpass -p "$password" ssh $ssh_opts -tt -p "$port" "$username@$host" 2>&1)
        exit_code=$?
    else
        log_debug "Using direct command mode"
        output=$(timeout "$timeout" sshpass -p "$password" ssh $ssh_opts -p "$port" "$username@$host" "$command" 2>&1)
        exit_code=$?
    fi
    
    # Check for timeout first
    if [[ $exit_code -eq 124 ]]; then
        log_error "SSH backup timed out after ${timeout}s"
        return 1
    fi
    
    # Check if we got valid configuration output (even if exit code is non-zero)
    # Network devices often close connection after 'quit' with non-zero exit code
    # but the backup data is still valid
    local output_length=${#output}
    
    if [[ $exit_code -eq 0 ]]; then
        echo "$output"
        return 0
    elif [[ $output_length -gt 100 ]] && [[ "$output" != *"Permission denied"* ]] && [[ "$output" != *"Connection refused"* ]] && [[ "$output" != *"No route to host"* ]] && [[ "$output" != *"Connection timed out"* ]] && [[ "$output" != *"Host key verification failed"* ]] && [[ "$output" != *"authentication methods failed"* ]]; then
        # Got substantial output without error indicators - consider it success
        log_debug "SSH exited with code $exit_code but output looks valid ($output_length bytes)"
        echo "$output"
        return 0
    else
        log_error "SSH backup failed (exit code $exit_code)"
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

# Execute terminal command on equipment (single command mode)
execute_terminal_command() {
    local session_id="$1"
    local host="$2"
    local port="$3"
    local username="$4"
    local password="$5"
    local protocol="$6"
    local command="$7"
    local enable_password="$8"
    
    log_info "Executing terminal command for session $session_id: $command"
    
    local output=""
    local timeout=30
    
    if [[ "$protocol" == "telnet" ]]; then
        # Use expect for telnet
        output=$(timeout $timeout expect -c "
            log_user 1
            spawn telnet $host $port
            expect {
                -re {[Uu]sername:|[Ll]ogin:} { send \"$username\r\"; exp_continue }
                -re {[Pp]assword:} { send \"$password\r\"; exp_continue }
                -re {[>#\$%]} { }
                timeout { puts \"Connection timeout\"; exit 1 }
            }
            send \"$command\r\"
            expect {
                -re {[>#\$%]} { }
                timeout { }
            }
            send \"exit\r\"
            expect eof
        " 2>&1)
    else
        # Use sshpass for SSH
        output=$(timeout $timeout sshpass -p "$password" ssh \
            -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            -o ConnectTimeout=10 -o HostKeyAlgorithms=+ssh-rsa \
            -p "$port" "$username@$host" "$command" 2>&1)
    fi
    
    echo "$output"
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
            
        terminal_connect)
            local session_id=$(echo "$message" | jq -r '.sessionId')
            local equipment=$(echo "$message" | jq -r '.equipment')
            local ip=$(echo "$equipment" | jq -r '.ip')
            local port=$(echo "$equipment" | jq -r '.port // 22')
            local username=$(echo "$equipment" | jq -r '.username')
            local password=$(echo "$equipment" | jq -r '.password')
            local protocol=$(echo "$equipment" | jq -r '.protocol // "ssh"')
            local enable_password=$(echo "$equipment" | jq -r '.enablePassword // empty')
            
            log_info "Terminal connect request: $session_id to $ip:$port ($protocol)"
            
            # Store session info for later commands
            mkdir -p /tmp/nbm-terminal-sessions
            echo "{\"ip\":\"$ip\",\"port\":$port,\"username\":\"$username\",\"password\":\"$password\",\"protocol\":\"$protocol\",\"enablePassword\":\"$enable_password\"}" > "/tmp/nbm-terminal-sessions/$session_id.json"
            
            # Test connection by trying to connect
            local test_output
            if [[ "$protocol" == "telnet" ]]; then
                test_output=$(timeout 10 bash -c "echo quit | telnet $ip $port 2>&1" || echo "Connection failed")
            else
                test_output=$(timeout 10 sshpass -p "$password" ssh \
                    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
                    -o ConnectTimeout=5 -o HostKeyAlgorithms=+ssh-rsa \
                    -p "$port" "$username@$ip" "echo connected" 2>&1 || echo "Connection failed")
            fi
            
            if [[ "$test_output" == *"connected"* ]] || [[ "$test_output" == *"Connected"* ]] || [[ "$test_output" == *"Escape"* ]]; then
                echo "{\"type\": \"terminal_connected\", \"sessionId\": \"$session_id\"}"
            else
                echo "{\"type\": \"terminal_output\", \"sessionId\": \"$session_id\", \"output\": \"Conectado a $ip:$port via $protocol\", \"isComplete\": false}"
                echo "{\"type\": \"terminal_connected\", \"sessionId\": \"$session_id\"}"
            fi
            ;;
            
        terminal_input)
            local session_id=$(echo "$message" | jq -r '.sessionId')
            local input_data=$(echo "$message" | jq -r '.data')
            local session_file="/tmp/nbm-terminal-sessions/${session_id}.json"
            
            if [[ -f "$session_file" ]]; then
                local session_info=$(cat "$session_file")
                local ip=$(echo "$session_info" | jq -r '.ip')
                local port=$(echo "$session_info" | jq -r '.port')
                local username=$(echo "$session_info" | jq -r '.username')
                local password=$(echo "$session_info" | jq -r '.password')
                local protocol=$(echo "$session_info" | jq -r '.protocol')
                
                # Execute command and return output
                local output
                if [[ "$protocol" == "telnet" ]]; then
                    output=$(execute_terminal_command "$session_id" "$ip" "$port" "$username" "$password" "$protocol" "$input_data" "")
                else
                    output=$(timeout 30 sshpass -p "$password" ssh \
                        -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
                        -o ConnectTimeout=10 -o HostKeyAlgorithms=+ssh-rsa \
                        -o KexAlgorithms=+diffie-hellman-group1-sha1,diffie-hellman-group14-sha1 \
                        -p "$port" "$username@$ip" "$input_data" 2>&1 || echo "Command failed")
                fi
                
                # Escape output for JSON
                local escaped_output=$(echo "$output" | jq -Rs '.')
                echo "{\"type\": \"terminal_output\", \"sessionId\": \"$session_id\", \"output\": $escaped_output, \"isComplete\": true}"
            else
                echo "{\"type\": \"terminal_output\", \"sessionId\": \"$session_id\", \"output\": \"Sessao nao encontrada\", \"isComplete\": true}"
            fi
            ;;
            
        terminal_disconnect)
            local session_id=$(echo "$message" | jq -r '.sessionId')
            log_info "Terminal disconnect request: $session_id"
            
            # Clean up session files
            rm -f "/tmp/nbm-terminal-sessions/${session_id}.json"
            
            echo "{\"type\": \"terminal_disconnected\", \"sessionId\": \"$session_id\"}"
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
            
        execute_backup|backup_job)
            local job_id=$(echo "$message" | jq -r '.jobId')
            local equipment=$(echo "$message" | jq -r '.equipment')
            local config=$(echo "$message" | jq -r '.config')
            
            # Support both field naming conventions
            local host=$(echo "$equipment" | jq -r '.ip // .ipAddress')
            local port=$(echo "$equipment" | jq -r '.port // 22')
            local username=$(echo "$equipment" | jq -r '.username')
            local password=$(echo "$equipment" | jq -r '.password')
            local enable_password=$(echo "$equipment" | jq -r '.enablePassword // empty')
            local manufacturer=$(echo "$equipment" | jq -r '.manufacturer // empty')
            local command=$(echo "$config" | jq -r '.command // .backupCommand')
            
            log_info "Executing backup job $job_id for $host:$port with command: $command"
            
            local output
            local json_response
            local tmp_file="/tmp/backup_output_$$"
            local backup_success=false
            
            # Use expect-based sessions for vendors that need interactive handling
            if [[ "${manufacturer,,}" == "cisco" ]] && [[ -n "$enable_password" ]] && [[ "$enable_password" != "null" ]]; then
                # Cisco with enable password - use expect for interactive enable mode
                log_debug "Cisco device with enable password - using expect session"
                if output=$(execute_cisco_backup_expect "$host" "$port" "$username" "$password" "$enable_password" "$command" 180); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "huawei" ]]; then
                # Huawei - use expect to properly wait for full config before quit
                log_debug "Huawei device - using expect session"
                if output=$(execute_huawei_backup_expect "$host" "$port" "$username" "$password" 180); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "nokia" ]]; then
                # Nokia SR OS - use expect with environment no more + admin display-config
                log_debug "Nokia device - using expect session"
                if output=$(execute_nokia_backup_expect "$host" "$port" "$username" "$password" 1800); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "zte" ]]; then
                # ZTE ZXR10/TITAN - use expect with enable mode + show running-config
                log_debug "ZTE device - using expect session"
                if output=$(execute_zte_backup_expect "$host" "$port" "$username" "$password" "$enable_password" 180); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "datacom" ]]; then
                # Datacom EDD (DmSwitch family) - Cisco-like CLI, supports SSH and Telnet
                local protocol=$(echo "$equipment" | jq -r '.protocol // "ssh"')
                log_debug "Datacom EDD device - using expect session (protocol: $protocol)"
                if output=$(execute_datacom_edd_backup_expect "$host" "$port" "$username" "$password" "$enable_password" "$protocol" 300); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "datacom-dmos" ]]; then
                # Datacom DMOS (DmOS) - switches and OLTs, SSH only
                log_debug "Datacom DMOS device - using expect session"
                if output=$(execute_datacom_dmos_backup_expect "$host" "$port" "$username" "$password" 300); then
                    backup_success=true
                fi
            elif [[ "${manufacturer,,}" == "juniper" ]]; then
                # Juniper - SSH, uses 'show configuration | display set'
                log_debug "Juniper device - using expect session"
                if output=$(execute_juniper_backup_expect "$host" "$port" "$username" "$password" 300); then
                    backup_success=true
                fi
            else
                # Standard SSH backup for other vendors
                if output=$(execute_ssh_backup "$host" "$port" "$username" "$password" "$command" 120); then
                    backup_success=true
                fi
            fi
            
            if [[ "$backup_success" == "true" ]]; then
                log_info "Backup successful, output length: ${#output} bytes"
                # Write output to temp file to avoid argument list too long error
                printf '%s' "$output" > "$tmp_file"
                # Use jq with rawfile to read large text content from file
                json_response=$(jq -n --arg type "backup_result" --arg jobId "$job_id" --rawfile output "$tmp_file" \
                    '{type: $type, jobId: $jobId, success: true, output: $output}')
                rm -f "$tmp_file"
            else
                json_response=$(jq -n --arg type "backup_result" --arg jobId "$job_id" --arg error "Backup execution failed" \
                    '{type: $type, jobId: $jobId, success: false, error: $error}')
                log_error "Backup failed for $host"
            fi
            # Output JSON on single line (jq -c ensures compact output)
            echo "$json_response" | jq -c .
            ;;
            
        *)
            log_warn "Unknown message type: $msg_type"
            echo "{\"type\": \"error\", \"message\": \"Unknown message type: $msg_type\"}"
            ;;
    esac
}

# Main WebSocket connection loop using coproc
connect_websocket() {
    local ws_url="${SERVER_URL/https:/wss:}/ws/agents"
    ws_url="${ws_url/http:/ws:}"
    
    log_info "Connecting to WebSocket: $ws_url"
    
    while true; do
        log_info "Establishing WebSocket connection..."
        
        # Use coproc for bidirectional communication with websocat
        # Ping interval of 10s helps detect disconnections faster
        # Buffer size of 512KB to handle large backup outputs
        coproc WSCAT { websocat -t --ping-interval 10 -B 524288 "$ws_url" 2>&1; }
        
        if [[ -z "${WSCAT_PID:-}" ]]; then
            log_error "Failed to start websocat"
            sleep 10
            continue
        fi
        
        log_debug "WebSocket process started with PID: $WSCAT_PID"
        
        # Send authentication message
        local auth_msg="{\"type\":\"auth\",\"token\":\"$AGENT_TOKEN\",\"agentId\":$AGENT_ID,\"name\":\"$AGENT_NAME\",\"version\":\"$AGENT_VERSION\"}"
        echo "$auth_msg" >&"${WSCAT[1]}"
        log_debug "Sent auth message"
        
        # Duplicate fd for heartbeat - fd 5 will be a copy of the write fd
        exec 5>&"${WSCAT[1]}"
        
        # Start heartbeat sender in background using duplicated fd
        # 15 second interval ensures faster reconnection when server restarts
        {
            while kill -0 $WSCAT_PID 2>/dev/null; do
                sleep 15
                echo '{"type":"heartbeat"}' >&5 2>/dev/null || break
                log_debug "Sent heartbeat"
            done
        } &
        local heartbeat_pid=$!
        
        # Read responses and handle messages
        while IFS= read -r msg <&"${WSCAT[0]}"; do
            if [[ -z "$msg" ]]; then
                continue
            fi
            
            log_debug "Received: $msg"
            local msg_type=$(echo "$msg" | jq -r '.type // empty' 2>/dev/null)
            
            case "$msg_type" in
                auth_success)
                    log_info "Authentication successful"
                    ;;
                auth_error)
                    log_error "Authentication failed: $(echo "$msg" | jq -r '.message')"
                    break
                    ;;
                heartbeat_ack)
                    log_debug "Heartbeat acknowledged"
                    ;;
                execute_backup|backup_job|test_connection|request_diagnostics|terminal_command|terminal_connect|terminal_input|terminal_disconnect|update_agent)
                    response=$(handle_message "$msg")
                    if [[ -n "$response" ]]; then
                        local resp_len=${#response}
                        log_info "Sending response, length: $resp_len bytes"
                        if printf '%s\n' "$response" >&"${WSCAT[1]}" 2>/dev/null; then
                            log_info "Response sent successfully ($resp_len bytes)"
                        else
                            log_error "Failed to send response ($resp_len bytes)"
                        fi
                    fi
                    ;;
                job)
                    response=$(handle_message "$msg")
                    if [[ -n "$response" ]]; then
                        local resp_len=${#response}
                        log_info "Sending job response, length: $resp_len bytes"
                        printf '%s\n' "$response" >&"${WSCAT[1]}" 2>/dev/null || log_error "Failed to send job response"
                    fi
                    ;;
                error)
                    log_warn "Server error: $(echo "$msg" | jq -r '.message')"
                    ;;
                *)
                    log_debug "Unhandled message type: $msg_type"
                    ;;
            esac
        done
        
        # Cleanup
        exec 5>&- 2>/dev/null || true  # Close duplicated fd
        kill $heartbeat_pid 2>/dev/null || true
        kill $WSCAT_PID 2>/dev/null || true
        
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
    
    # Save PID before starting (this is the main process for systemd)
    echo $$ > "$PID_FILE"
    log_info "Agent started with PID: $$"
    
    # Check if websocat is available for WebSocket mode
    # Run in foreground for systemd
    if command -v websocat &> /dev/null; then
        connect_websocket
    else
        log_warn "websocat not found, using polling mode"
        polling_mode
    fi
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
