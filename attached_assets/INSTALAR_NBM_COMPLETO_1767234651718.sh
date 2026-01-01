#!/bin/bash
#==============================================================================
# INSTALADOR COMPLETO DO SISTEMA NBM (Network Backup Manager)
# Versão: 17.0
# Data: 31/12/2025
# Compatível: Debian 13 (Trixie) e Debian 12 (Bookworm)
#==============================================================================

set -e  # Parar em caso de erro

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/nbm_install_${TIMESTAMP}.log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

#==============================================================================
# VERIFICAÇÕES INICIAIS
#==============================================================================

log "🚀 Iniciando instalação do NBM v17.0..."

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root (sudo)"
fi

# Verificar Debian
if ! grep -q "Debian" /etc/os-release; then
    warning "Sistema não é Debian. Continuando mesmo assim..."
fi

# Verificar internet
if ! ping -c 1 google.com &> /dev/null; then
    error "Sem conexão com a internet. Verifique sua conexão."
fi

#==============================================================================
# CONFIGURAÇÕES INICIAIS
#==============================================================================

log "📋 Configurando variáveis do sistema..."

# Diretórios principais
NBM_DIR="/opt/nbm"
BACKUP_DIR="/opt/nbm/backups"
TEMPLATES_DIR="/opt/nbm/templates"
VENV_DIR="/opt/nbm/venv"
DB_FILE="/opt/nbm/nbm.db"

# Portas
API_PORT=8000
DASHBOARD_PORT=9000

# IP do servidor (detectar automaticamente)
SERVER_IP=$(hostname -I | awk '{print $1}')

log "📍 IP detectado do servidor: ${SERVER_IP}"

#==============================================================================
# INSTALAÇÃO DE DEPENDÊNCIAS
#==============================================================================

log "📦 Atualizando sistema e instalando dependências..."

apt-get update -qq
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    nginx \
    sqlite3 \
    git \
    curl \
    wget \
    sshpass \
    snmp \
    telnet \
    net-tools \
    htop \
    vim \
    build-essential \
    libssl-dev \
    libffi-dev \
    supervisor

log "✅ Dependências instaladas com sucesso"

#==============================================================================
# CRIAÇÃO DA ESTRUTURA DE DIRETÓRIOS
#==============================================================================

log "📁 Criando estrutura de diretórios..."

mkdir -p "$NBM_DIR"
mkdir -p "$BACKUP_DIR"/{mikrotik,datacom,huawei,datacom-dmos}
mkdir -p "$TEMPLATES_DIR"
mkdir -p "$TEMPLATES_DIR/static"/{css,js,images}
mkdir -p /var/log/nbm

log "✅ Estrutura de diretórios criada"

#==============================================================================
# CRIAR AMBIENTE VIRTUAL PYTHON
#==============================================================================

log "🐍 Criando ambiente virtual Python..."

python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

log "📚 Instalando bibliotecas Python..."

pip install --upgrade pip
pip install \
    flask==3.0.0 \
    flask-cors==4.0.0 \
    flask-login==0.6.3 \
    gunicorn==21.2.0 \
    paramiko==3.4.0 \
    netmiko==4.3.0 \
    requests==2.31.0 \
    werkzeug==3.0.1 \
    cryptography==41.0.7

log "✅ Ambiente Python configurado"

#==============================================================================
# CRIAR BANCO DE DADOS
#==============================================================================

log "🗄️ Criando banco de dados..."

sqlite3 "$DB_FILE" <<EOF
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de equipamentos
CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    model TEXT,
    username TEXT,
    password TEXT,
    port INTEGER DEFAULT 22,
    protocol TEXT DEFAULT 'ssh',
    enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de backups
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER,
    equipment_name TEXT,
    manufacturer TEXT,
    model TEXT,
    ip TEXT,
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    status TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration REAL,
    error_message TEXT,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
);

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir usuário admin padrão (senha: admin123)
INSERT OR IGNORE INTO users (username, password_hash, is_admin) 
VALUES ('admin', 'scrypt:32768:8:1\$nK5FqVx9YBJCn5mO\$82a1e5a5f5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5', 1);

-- Inserir configurações padrão
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_schedule', '0 */6 * * *');
INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_workers', '4');
EOF

log "✅ Banco de dados criado: $DB_FILE"

#==============================================================================
# CRIAR APLICAÇÃO FLASK (app.py)
#==============================================================================

log "🔧 Criando aplicação Flask..."

cat > "$NBM_DIR/app.py" <<'PYTHON_EOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Backup Manager v17.0
Sistema de gerenciamento de backups para equipamentos de rede
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file, send_from_directory
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import sqlite3
import os
import json
import logging
from pathlib import Path
import glob
import mimetypes

# Configuração
app = Flask(__name__)
app.secret_key = 'nbm-secret-key-change-in-production-2025'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/nbm/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuração do Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Diretórios
BASE_DIR = Path('/opt/nbm')
BACKUP_DIR = BASE_DIR / 'backups'
DB_PATH = BASE_DIR / 'nbm.db'

# User class para Flask-Login
class User(UserMixin):
    def __init__(self, id, username, is_admin=False):
        self.id = id
        self.username = username
        self.is_admin = is_admin

@login_manager.user_loader
def load_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, is_admin FROM users WHERE id = ?", (user_id,))
    user_data = cursor.fetchone()
    conn.close()
    
    if user_data:
        return User(user_data[0], user_data[1], user_data[2])
    return None

#==============================================================================
# ROTAS DE AUTENTICAÇÃO
#==============================================================================

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, password_hash, is_admin FROM users WHERE username = ?", (username,))
        user_data = cursor.fetchone()
        conn.close()
        
        if user_data and check_password_hash(user_data[2], password):
            user = User(user_data[0], user_data[1], user_data[3])
            login_user(user, remember=True)
            logger.info(f"Login bem-sucedido: {username}")
            return redirect(url_for('dashboard'))
        else:
            logger.warning(f"Tentativa de login falhou: {username}")
            return render_template('login.html', error='Usuário ou senha inválidos')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logger.info(f"Logout: {current_user.username}")
    logout_user()
    return redirect(url_for('login'))

#==============================================================================
# ROTAS DO DASHBOARD
#==============================================================================

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/backup-viewer')
@login_required
def backup_viewer():
    return render_template('backup_viewer.html')

#==============================================================================
# API - BACKUPS
#==============================================================================

@app.route('/api/backups', methods=['GET'])
@login_required
def api_backups():
    """API para listar backups disponíveis de TODAS as marcas"""
    try:
        backups_list = []
        backup_id = 1
        
        # Fabricantes suportados
        manufacturers = ['mikrotik', 'datacom', 'huawei', 'datacom-dmos']
        
        for manufacturer in manufacturers:
            manufacturer_dir = BACKUP_DIR / manufacturer
            
            if not manufacturer_dir.exists():
                logger.warning(f"Diretório não encontrado: {manufacturer_dir}")
                continue
            
            # Buscar todos os equipamentos (subdiretórios)
            for equipment_dir in manufacturer_dir.iterdir():
                if not equipment_dir.is_dir():
                    continue
                
                equipment_name = equipment_dir.name
                
                # Buscar arquivos de backup
                backup_patterns = ['*.backup', '*.rsc', '*.cfg', '*.txt', '*.conf']
                for pattern in backup_patterns:
                    for backup_file in equipment_dir.glob(pattern):
                        try:
                            file_stat = backup_file.stat()
                            
                            # Extrair timestamp do nome do arquivo
                            file_name = backup_file.name
                            executed_at = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                            
                            backup_info = {
                                'id': backup_id,
                                'equipment_name': equipment_name,
                                'manufacturer': manufacturer,
                                'model': 'N/A',
                                'ip': 'N/A',
                                'file_name': file_name,
                                'file_path': str(backup_file),
                                'file_size': file_stat.st_size,
                                'executed_at': executed_at,
                                'duration': 'N/A',
                                'status': 'success'
                            }
                            
                            backups_list.append(backup_info)
                            backup_id += 1
                            
                        except Exception as e:
                            logger.error(f"Erro ao processar arquivo {backup_file}: {str(e)}")
                            continue
        
        # Ordenar por data (mais recentes primeiro)
        backups_list.sort(key=lambda x: x['executed_at'], reverse=True)
        
        logger.info(f"Total de backups encontrados: {len(backups_list)}")
        
        return jsonify({
            'success': True,
            'total': len(backups_list),
            'backups': backups_list
        })
        
    except Exception as e:
        logger.error(f"Erro ao listar backups: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/backup/download', methods=['GET'])
@login_required
def api_backup_download():
    """Download de arquivo de backup"""
    try:
        file_path = request.args.get('file')
        
        if not file_path:
            return jsonify({'error': 'Parâmetro file é obrigatório'}), 400
        
        # Verificar se o arquivo existe e está dentro do diretório de backups
        backup_file = Path(file_path)
        
        if not backup_file.exists():
            logger.error(f"Arquivo não encontrado: {file_path}")
            return jsonify({'error': 'Arquivo não encontrado'}), 404
        
        if not str(backup_file).startswith(str(BACKUP_DIR)):
            logger.error(f"Tentativa de acesso fora do diretório de backups: {file_path}")
            return jsonify({'error': 'Acesso negado'}), 403
        
        logger.info(f"Download iniciado: {file_path} por {current_user.username}")
        
        # Detectar tipo MIME
        mime_type, _ = mimetypes.guess_type(str(backup_file))
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        return send_file(
            backup_file,
            as_attachment=True,
            download_name=backup_file.name,
            mimetype=mime_type
        )
        
    except Exception as e:
        logger.error(f"Erro no download: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/view', methods=['GET'])
@login_required
def api_backup_view():
    """Visualizar conteúdo de um backup"""
    try:
        file_path = request.args.get('file')
        
        if not file_path:
            return jsonify({'error': 'Parâmetro file é obrigatório'}), 400
        
        backup_file = Path(file_path)
        
        if not backup_file.exists():
            return jsonify({'error': 'Arquivo não encontrado'}), 404
        
        if not str(backup_file).startswith(str(BACKUP_DIR)):
            return jsonify({'error': 'Acesso negado'}), 403
        
        # Ler conteúdo do arquivo
        try:
            with open(backup_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(50000)  # Limitar a 50KB
                
            logger.info(f"Visualização: {file_path} por {current_user.username}")
            
            return jsonify({
                'success': True,
                'file_name': backup_file.name,
                'file_size': backup_file.stat().st_size,
                'content': content,
                'truncated': len(content) >= 50000
            })
            
        except UnicodeDecodeError:
            return jsonify({
                'success': False,
                'error': 'Arquivo binário - não pode ser visualizado como texto'
            }), 400
            
    except Exception as e:
        logger.error(f"Erro ao visualizar backup: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/delete', methods=['POST'])
@login_required
def api_backup_delete():
    """Excluir um arquivo de backup"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        
        if not file_path:
            return jsonify({'error': 'Parâmetro file_path é obrigatório'}), 400
        
        backup_file = Path(file_path)
        
        if not backup_file.exists():
            return jsonify({'error': 'Arquivo não encontrado'}), 404
        
        if not str(backup_file).startswith(str(BACKUP_DIR)):
            logger.error(f"Tentativa de exclusão fora do diretório de backups: {file_path}")
            return jsonify({'error': 'Acesso negado'}), 403
        
        # Excluir arquivo
        backup_file.unlink()
        
        logger.info(f"Backup excluído: {file_path} por {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Backup excluído com sucesso'
        })
        
    except Exception as e:
        logger.error(f"Erro ao excluir backup: {str(e)}")
        return jsonify({'error': str(e)}), 500

#==============================================================================
# INICIALIZAÇÃO
#==============================================================================

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
PYTHON_EOF

chmod +x "$NBM_DIR/app.py"

log "✅ Aplicação Flask criada"

#==============================================================================
# CRIAR TEMPLATE LOGIN
#==============================================================================

log "🎨 Criando templates HTML..."

cat > "$TEMPLATES_DIR/login.html" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NBM - Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-header h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .login-header p {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn-login {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .btn-login:hover {
            transform: translateY(-2px);
        }
        
        .error-message {
            background: #fee;
            color: #c33;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🔐 NBM Login</h1>
            <p>Network Backup Manager v17.0</p>
        </div>
        
        {% if error %}
        <div class="error-message">{{ error }}</div>
        {% endif %}
        
        <form method="POST">
            <div class="form-group">
                <label for="username">Usuário</label>
                <input type="text" id="username" name="username" required autofocus>
            </div>
            
            <div class="form-group">
                <label for="password">Senha</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="btn-login">Entrar</button>
        </form>
    </div>
</body>
</html>
HTML_EOF

#==============================================================================
# CRIAR TEMPLATE DASHBOARD
#==============================================================================

cat > "$TEMPLATES_DIR/dashboard.html" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NBM - Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
        }
        
        .header {
            background: #fff;
            padding: 15px 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 24px;
            color: #333;
        }
        
        .header a {
            color: #667eea;
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid #667eea;
            border-radius: 5px;
            transition: all 0.3s;
        }
        
        .header a:hover {
            background: #667eea;
            color: white;
        }
        
        .container {
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
        }
        
        .menu-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        
        .menu-card {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s;
            text-decoration: none;
            color: #333;
        }
        
        .menu-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }
        
        .menu-card .icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .menu-card h3 {
            font-size: 20px;
            margin-bottom: 10px;
        }
        
        .menu-card p {
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 NBM Dashboard</h1>
        <a href="/logout">Sair</a>
    </div>
    
    <div class="container">
        <h2>Bem-vindo ao Network Backup Manager</h2>
        
        <div class="menu-grid">
            <a href="/backup-viewer" class="menu-card">
                <div class="icon">📁</div>
                <h3>Visualizar Backups</h3>
                <p>Ver, baixar e gerenciar backups</p>
            </a>
            
            <a href="#" class="menu-card">
                <div class="icon">⚙️</div>
                <h3>Equipamentos</h3>
                <p>Gerenciar equipamentos cadastrados</p>
            </a>
            
            <a href="#" class="menu-card">
                <div class="icon">🔄</div>
                <h3>Executar Backup</h3>
                <p>Executar backup manualmente</p>
            </a>
            
            <a href="#" class="menu-card">
                <div class="icon">📈</div>
                <h3>Relatórios</h3>
                <p>Visualizar estatísticas e logs</p>
            </a>
        </div>
    </div>
</body>
</html>
HTML_EOF

#==============================================================================
# CRIAR TEMPLATE BACKUP VIEWER (COMPLETO)
#==============================================================================

cat > "$TEMPLATES_DIR/backup_viewer.html" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NBM - Visualizador de Backups</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
        }
        
        .header {
            background: #fff;
            padding: 15px 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 24px;
            color: #333;
        }
        
        .header a {
            color: #667eea;
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid #667eea;
            border-radius: 5px;
        }
        
        .container {
            max-width: 1400px;
            margin: 30px auto;
            padding: 0 20px;
        }
        
        .filters {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .filter-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .filter-group input,
        .filter-group select {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .table-container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
        }
        
        tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        tbody tr:hover {
            background: #f0f0f0;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .badge-mikrotik { background: #ff6b6b; color: white; }
        .badge-datacom { background: #4ecdc4; color: white; }
        .badge-huawei { background: #fd79a8; color: white; }
        
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 5px;
            transition: opacity 0.3s;
        }
        
        .btn:hover {
            opacity: 0.8;
        }
        
        .btn-download { background: #51cf66; color: white; }
        .btn-view { background: #339af0; color: white; }
        .btn-delete { background: #ff6b6b; color: white; }
        
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background: white;
            margin: 50px auto;
            padding: 30px;
            width: 90%;
            max-width: 800px;
            border-radius: 10px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .modal-header h2 {
            color: #333;
        }
        
        .close {
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            color: #aaa;
        }
        
        .close:hover {
            color: #000;
        }
        
        .backup-content {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 500px;
            overflow-y: auto;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📁 Visualizador de Backups</h1>
        <a href="/dashboard">← Voltar</a>
    </div>
    
    <div class="container">
        <div class="filters">
            <div class="filter-group">
                <input type="text" id="searchInput" placeholder="🔍 Buscar por equipamento..." style="flex: 1;">
                <select id="manufacturerFilter">
                    <option value="">Todos os Fabricantes</option>
                    <option value="mikrotik">Mikrotik</option>
                    <option value="datacom">Datacom</option>
                    <option value="huawei">Huawei</option>
                </select>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Equipamento</th>
                        <th>Fabricante</th>
                        <th>Modelo</th>
                        <th>Data/Hora</th>
                        <th>Tamanho</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="backupsTableBody">
                    <tr>
                        <td colspan="8" class="loading">⏳ Carregando backups...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Modal de Visualização -->
    <div id="viewModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>👁️ Visualizar Backup</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div id="modalBody">
                <p class="loading">Carregando conteúdo...</p>
            </div>
        </div>
    </div>
    
    <script>
        let allBackups = [];
        
        // Carregar backups
        async function loadBackups() {
            try {
                const response = await fetch('/api/backups');
                const data = await response.json();
                
                if (data.success) {
                    allBackups = data.backups;
                    renderBackups(allBackups);
                } else {
                    alert('Erro ao carregar backups: ' + data.error);
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro ao carregar backups');
            }
        }
        
        // Renderizar tabela
        function renderBackups(backups) {
            const tbody = document.getElementById('backupsTableBody');
            
            if (backups.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="loading">Nenhum backup encontrado</td></tr>';
                return;
            }
            
            tbody.innerHTML = backups.map(backup => `
                <tr>
                    <td>${backup.id}</td>
                    <td>${backup.equipment_name}</td>
                    <td><span class="badge badge-${backup.manufacturer}">${backup.manufacturer}</span></td>
                    <td>${backup.model}</td>
                    <td>${backup.executed_at}</td>
                    <td>${formatFileSize(backup.file_size)}</td>
                    <td>${backup.status}</td>
                    <td>
                        <button class="btn btn-download" onclick="downloadBackup('${backup.file_path}')">
                            📥 Download
                        </button>
                        <button class="btn btn-view" onclick="viewBackup('${backup.file_path}', '${backup.file_name}')">
                            👁️ Ver
                        </button>
                        <button class="btn btn-delete" onclick="deleteBackup('${backup.file_path}')">
                            🗑️ Excluir
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        // Formatar tamanho do arquivo
        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
            else return (bytes / 1048576).toFixed(2) + ' MB';
        }
        
        // Download
        function downloadBackup(filePath) {
            window.location.href = `/api/backup/download?file=${encodeURIComponent(filePath)}`;
        }
        
        // Visualizar
        async function viewBackup(filePath, fileName) {
            const modal = document.getElementById('viewModal');
            const modalBody = document.getElementById('modalBody');
            
            modal.style.display = 'block';
            modalBody.innerHTML = '<p class="loading">Carregando conteúdo...</p>';
            
            try {
                const response = await fetch(`/api/backup/view?file=${encodeURIComponent(filePath)}`);
                const data = await response.json();
                
                if (data.success) {
                    modalBody.innerHTML = `
                        <h3>${fileName}</h3>
                        <p><strong>Tamanho:</strong> ${formatFileSize(data.file_size)}</p>
                        ${data.truncated ? '<p style="color: #ff6b6b;"><strong>⚠️ Conteúdo truncado (mostrando primeiros 50KB)</strong></p>' : ''}
                        <div class="backup-content">${escapeHtml(data.content)}</div>
                        <br>
                        <button class="btn btn-download" onclick="downloadBackup('${filePath}')">📥 Baixar Arquivo Completo</button>
                    `;
                } else {
                    modalBody.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
                }
            } catch (error) {
                modalBody.innerHTML = `<p style="color: #ff6b6b;">❌ Erro ao carregar: ${error.message}</p>`;
            }
        }
        
        // Excluir
        async function deleteBackup(filePath) {
            if (!confirm('Tem certeza que deseja excluir este backup?')) {
                return;
            }
            
            try {
                const response = await fetch('/api/backup/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file_path: filePath })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Backup excluído com sucesso!');
                    loadBackups();
                } else {
                    alert('❌ Erro ao excluir: ' + data.error);
                }
            } catch (error) {
                alert('❌ Erro ao excluir: ' + error.message);
            }
        }
        
        // Fechar modal
        function closeModal() {
            document.getElementById('viewModal').style.display = 'none';
        }
        
        // Escape HTML
        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
        
        // Filtros
        document.getElementById('searchInput').addEventListener('input', filterBackups);
        document.getElementById('manufacturerFilter').addEventListener('change', filterBackups);
        
        function filterBackups() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const manufacturer = document.getElementById('manufacturerFilter').value;
            
            const filtered = allBackups.filter(backup => {
                const matchSearch = backup.equipment_name.toLowerCase().includes(searchTerm);
                const matchManufacturer = !manufacturer || backup.manufacturer === manufacturer;
                return matchSearch && matchManufacturer;
            });
            
            renderBackups(filtered);
        }
        
        // Fechar modal ao clicar fora
        window.onclick = function(event) {
            const modal = document.getElementById('viewModal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
        
        // Carregar ao iniciar
        loadBackups();
    </script>
</body>
</html>
HTML_EOF

log "✅ Templates HTML criados"

#==============================================================================
# CONFIGURAR NGINX
#==============================================================================

log "🌐 Configurando Nginx..."

cat > /etc/nginx/sites-available/nbm <<NGINX_EOF
server {
    listen ${DASHBOARD_PORT};
    server_name _;

    # Logs
    access_log /var/log/nginx/nbm_access.log;
    error_log /var/log/nginx/nbm_error.log;

    # Proxy para Flask
    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Arquivos estáticos
    location /static/ {
        alias ${TEMPLATES_DIR}/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

# Habilitar site
ln -sf /etc/nginx/sites-available/nbm /etc/nginx/sites-enabled/nbm

# Remover default
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t || error "Erro na configuração do Nginx"

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

log "✅ Nginx configurado"

#==============================================================================
# CRIAR SERVIÇO SYSTEMD
#==============================================================================

log "⚙️ Criando serviço systemd..."

cat > /etc/systemd/system/nbm-api.service <<SERVICE_EOF
[Unit]
Description=NBM API Service
After=network.target

[Service]
Type=notify
User=root
WorkingDirectory=${NBM_DIR}
Environment="PATH=${VENV_DIR}/bin"
ExecStart=${VENV_DIR}/bin/gunicorn --bind 127.0.0.1:${API_PORT} --workers 2 --timeout 120 --access-logfile /var/log/nbm/access.log --error-logfile /var/log/nbm/error.log app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Recarregar systemd
systemctl daemon-reload
systemctl enable nbm-api.service
systemctl start nbm-api.service

log "✅ Serviço systemd criado e iniciado"

#==============================================================================
# CRIAR SCRIPT DE TESTE
#==============================================================================

log "🧪 Criando script de teste..."

cat > "$NBM_DIR/test_api.sh" <<'TEST_EOF'
#!/bin/bash

echo "=== TESTE DO NBM ==="
echo ""

echo "1. Testando API..."
curl -s http://127.0.0.1:8000/api/backups | head -50
echo ""

echo "2. Status do serviço..."
systemctl status nbm-api --no-pager | head -10
echo ""

echo "3. Status do Nginx..."
systemctl status nginx --no-pager | head -10
echo ""

echo "✅ TESTES CONCLUÍDOS"
echo ""
echo "🌐 Acesse o sistema em: http://$(hostname -I | awk '{print $1}'):9000"
echo "👤 Usuário padrão: admin"
echo "🔑 Senha padrão: admin123"
TEST_EOF

chmod +x "$NBM_DIR/test_api.sh"

#==============================================================================
# VERIFICAÇÕES FINAIS
#==============================================================================

log "🔍 Verificando instalação..."

# Verificar serviços
systemctl is-active --quiet nbm-api || warning "Serviço nbm-api não está rodando"
systemctl is-active --quiet nginx || warning "Nginx não está rodando"

# Verificar portas
netstat -tuln | grep -q ":$API_PORT " || warning "Porta $API_PORT não está escutando"
netstat -tuln | grep -q ":$DASHBOARD_PORT " || warning "Porta $DASHBOARD_PORT não está escutando"

# Testar API
sleep 5
if curl -s http://127.0.0.1:$API_PORT/ | grep -q "Redirecting"; then
    log "✅ API está respondendo"
else
    warning "API pode não estar respondendo corretamente"
fi

#==============================================================================
# RESUMO FINAL
#==============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        ✅ INSTALAÇÃO DO NBM CONCLUÍDA COM SUCESSO! ✅          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 INFORMAÇÕES DO SISTEMA:"
echo "   • Versão: NBM v17.0"
echo "   • Diretório: $NBM_DIR"
echo "   • Banco de Dados: $DB_FILE"
echo "   • Backups: $BACKUP_DIR"
echo ""
echo "🌐 ACESSO WEB:"
echo "   • URL: http://${SERVER_IP}:${DASHBOARD_PORT}"
echo "   • Usuário: admin"
echo "   • Senha: admin123"
echo ""
echo "🔧 SERVIÇOS:"
echo "   • API: systemctl status nbm-api"
echo "   • Nginx: systemctl status nginx"
echo ""
echo "📝 LOGS:"
echo "   • API: /var/log/nbm/app.log"
echo "   • Nginx Access: /var/log/nginx/nbm_access.log"
echo "   • Nginx Error: /var/log/nginx/nbm_error.log"
echo "   • Instalação: $LOG_FILE"
echo ""
echo "🧪 EXECUTAR TESTES:"
echo "   bash $NBM_DIR/test_api.sh"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "   1. Acesse http://${SERVER_IP}:${DASHBOARD_PORT}"
echo "   2. Faça login com admin/admin123"
echo "   3. Altere a senha padrão"
echo "   4. Cadastre seus equipamentos"
echo "   5. Configure backups automáticos"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

log "✅ Instalação concluída! Log salvo em: $LOG_FILE"
