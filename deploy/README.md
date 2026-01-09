# NBM CLOUD v17.0 - Guia de Instalação Local

## Requisitos Mínimos

- **Sistema Operacional**: Debian 13 (Trixie), Ubuntu 22.04+, CentOS 9+, Rocky Linux 9+
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disco**: 20GB (+ espaço para backups)
- **Rede**: Acesso às redes dos equipamentos

## Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/nbm-cloud.git
cd nbm-cloud

# 2. Execute o instalador como root
sudo ./deploy/install.sh
```

O instalador vai:
- Detectar automaticamente o sistema operacional
- Instalar Node.js 20 LTS via repositório oficial NodeSource
- Instalar PostgreSQL 16 via repositório oficial PGDG
- Configurar Nginx como proxy reverso com suporte a WebSocket
- Criar serviço systemd para inicialização automática
- Opcionalmente configurar SSL com Let's Encrypt
- Opcionalmente configurar firewall UFW

## Instalação Manual no Debian 13 (Trixie)

### 1. Instalar Dependências Base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git gnupg ca-certificates lsb-release build-essential python3 openssl
```

### 2. Instalar Node.js 20 (via NodeSource)

```bash
# Criar diretório de chaves
sudo mkdir -p /etc/apt/keyrings

# Adicionar chave GPG do NodeSource
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# Adicionar repositório
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

# Instalar Node.js
sudo apt update
sudo apt install -y nodejs

# Verificar
node --version  # v20.x.x
npm --version
```

### 3. Instalar PostgreSQL 16 (via PGDG)

```bash
# Adicionar chave GPG do PostgreSQL
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg

# Adicionar repositório (para Debian 13 Trixie)
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Instalar PostgreSQL 16
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16 postgresql-contrib

# Habilitar e iniciar
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verificar
psql --version  # PostgreSQL 16.x
```

### 4. Criar Banco de Dados

```bash
sudo -u postgres psql

CREATE USER nbmcloud WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE nbmcloud OWNER nbmcloud;
GRANT ALL PRIVILEGES ON DATABASE nbmcloud TO nbmcloud;
\q
```

### 4. Configurar Aplicação

```bash
# Criar diretório
sudo mkdir -p /opt/nbm-cloud
cd /opt/nbm-cloud

# Copiar arquivos
sudo cp -r /caminho/do/projeto/* .

# Criar usuário
sudo useradd -r -m -d /opt/nbm-cloud nbmcloud
sudo chown -R nbmcloud:nbmcloud /opt/nbm-cloud

# Configurar ambiente
sudo cp deploy/.env.example .env
sudo nano .env  # Edite as configurações

# Instalar dependências
sudo -u nbmcloud npm install

# Build
sudo -u nbmcloud npm run build

# Criar schema do banco
sudo -u nbmcloud npx drizzle-kit push
```

### 5. Configurar Systemd

```bash
sudo nano /etc/systemd/system/nbm-cloud.service
```

```ini
[Unit]
Description=NBM CLOUD - Network Backup Management
After=network.target postgresql.service

[Service]
Type=simple
User=nbmcloud
WorkingDirectory=/opt/nbm-cloud
ExecStart=/usr/bin/node /opt/nbm-cloud/dist/index.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nbm-cloud
sudo systemctl start nbm-cloud
```

### 6. Configurar Nginx (Proxy Reverso)

```bash
sudo nano /etc/nginx/sites-available/nbm-cloud
```

```nginx
server {
    listen 80;
    server_name seu.dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nbm-cloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Configurar SSL com Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu.dominio.com
```

## Comandos Úteis

```bash
# Status do serviço
sudo systemctl status nbm-cloud

# Logs em tempo real
sudo journalctl -u nbm-cloud -f

# Reiniciar serviço
sudo systemctl restart nbm-cloud

# Atualizar aplicação
cd /opt/nbm-cloud
sudo -u nbmcloud git pull
sudo -u nbmcloud npm install
sudo -u nbmcloud npm run build
sudo systemctl restart nbm-cloud
```

## Primeiro Acesso

1. Acesse `https://seu.dominio.com`
2. Faça login com sua conta Replit (ou crie usuário local se STANDALONE_AUTH=true)
3. Acesse o painel de administração para configurar empresas e usuários

## Instalação do Agente Linux

Para instalar o agente de backup em servidores remotos:

```bash
cd /opt/nbm-cloud/agents/linux
sudo ./install.sh
```

## Backup do Sistema

```bash
# Backup do banco de dados
pg_dump -U nbmcloud nbmcloud > backup_$(date +%Y%m%d).sql

# Backup dos arquivos de configuração
tar -czf config_backup.tar.gz /opt/nbm-cloud/.env /opt/nbm-cloud/storage
```

## Solução de Problemas

### Erro de conexão com banco
- Verifique se PostgreSQL está rodando: `systemctl status postgresql`
- Verifique credenciais no arquivo `.env`
- Teste conexão: `psql -U nbmcloud -d nbmcloud -h localhost`

### Erro 502 Bad Gateway
- Verifique se NBM CLOUD está rodando: `systemctl status nbm-cloud`
- Verifique logs: `journalctl -u nbm-cloud -n 50`

### Agente não conecta
- Verifique firewall: porta 443 (ou 80) deve estar aberta
- Verifique WebSocket: nginx deve ter `proxy_http_version 1.1` e headers de upgrade
- Verifique token do agente no arquivo de configuração

## Suporte

Para suporte, abra uma issue no repositório GitHub ou entre em contato com a equipe de desenvolvimento.
