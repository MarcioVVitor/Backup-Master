# NBM CLOUD - Manual de Instalação de Proxy/Agente

## Índice

1. [Visão Geral](#visão-geral)
2. [Requisitos](#requisitos)
3. [Instalação Rápida](#instalação-rápida)
4. [Instalação Manual](#instalação-manual)
5. [Configuração](#configuração)
6. [Systemd Service](#systemd-service)
7. [Docker](#docker)
8. [Verificação](#verificação)
9. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O **Agente NBM CLOUD** (Proxy) é um componente que permite executar backups de equipamentos em redes remotas ou isoladas. Ele atua como intermediário entre o servidor NBM CLOUD e os equipamentos de rede.

### Arquitetura

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   NBM CLOUD     │◄───────►│   Agente/Proxy  │◄───────►│  Equipamentos   │
│   (Servidor)    │  HTTPS  │   (Rede Local)  │   SSH   │    de Rede      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Funcionalidades

- Conexão segura via WebSocket com o servidor
- Execução de comandos SSH/Telnet nos equipamentos
- Buffer de backups offline
- Reconexão automática
- Métricas de performance

---

## Requisitos

### Sistema Operacional

- **Linux** (Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+)
- **Windows** (Windows Server 2019+, Windows 10+)

### Software

| Software | Versão Mínima |
|----------|---------------|
| Node.js | 18.x ou superior |
| npm | 9.x ou superior |
| Git | 2.x (opcional) |

### Rede

| Porta | Direção | Protocolo | Uso |
|-------|---------|-----------|-----|
| 443 | Saída | HTTPS/WSS | Comunicação com NBM CLOUD |
| 22 | Saída | SSH | Conexão com equipamentos |
| 23 | Saída | Telnet | Conexão com equipamentos (opcional) |

### Hardware Mínimo

- CPU: 1 core
- RAM: 512 MB
- Disco: 1 GB livre

---

## Instalação Rápida

### Linux (Script Automático)

```bash
# Download e execução do instalador
curl -fsSL https://seu-servidor.com/install/agent.sh | bash

# Ou com wget
wget -qO- https://seu-servidor.com/install/agent.sh | bash
```

### Configuração Pós-Instalação

```bash
# Configure o token do agente (obtido no NBM CLOUD)
nbm-agent config --token SEU_TOKEN_AQUI

# Inicie o serviço
sudo systemctl start nbm-agent
sudo systemctl enable nbm-agent
```

---

## Instalação Manual

### 1. Instalar Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

**Verificar instalação:**
```bash
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2. Criar Diretório do Agente

```bash
sudo mkdir -p /opt/nbm-agent
sudo chown $USER:$USER /opt/nbm-agent
cd /opt/nbm-agent
```

### 3. Baixar Agente

```bash
# Via Git
git clone https://github.com/seu-org/nbm-cloud.git .
cd agent

# Ou download direto
wget https://seu-servidor.com/releases/nbm-agent-latest.tar.gz
tar -xzf nbm-agent-latest.tar.gz
```

### 4. Instalar Dependências

```bash
npm install --production
```

### 5. Configurar

```bash
cp .env.example .env
nano .env
```

---

## Configuração

### Arquivo de Configuração (.env)

```env
# Token de autenticação (obtido no NBM CLOUD)
NBM_AGENT_TOKEN=seu-token-aqui

# URL do servidor NBM CLOUD
NBM_SERVER_URL=https://seu-servidor.nbmcloud.com

# Identificador do agente (gerado automaticamente se vazio)
NBM_AGENT_ID=

# Porta local para métricas (opcional)
NBM_METRICS_PORT=9090

# Nível de log (debug, info, warn, error)
NBM_LOG_LEVEL=info

# Diretório para cache de backups
NBM_CACHE_DIR=/var/lib/nbm-agent/cache

# Timeout de conexão SSH (segundos)
NBM_SSH_TIMEOUT=30

# Máximo de conexões simultâneas
NBM_MAX_CONNECTIONS=10

# Intervalo de heartbeat (segundos)
NBM_HEARTBEAT_INTERVAL=30

# Reconexão automática
NBM_AUTO_RECONNECT=true
NBM_RECONNECT_INTERVAL=5
```

### Obter Token

1. Acesse o NBM CLOUD como administrador
2. Vá em **Agentes** > **Novo Agente**
3. Copie o token gerado
4. Use no arquivo `.env` ou via comando:

```bash
nbm-agent config --token SEU_TOKEN
```

---

## Systemd Service

### Criar Arquivo de Serviço

```bash
sudo nano /etc/systemd/system/nbm-agent.service
```

```ini
[Unit]
Description=NBM CLOUD Agent
Documentation=https://docs.nbmcloud.com
After=network.target

[Service]
Type=simple
User=nbm-agent
Group=nbm-agent
WorkingDirectory=/opt/nbm-agent
ExecStart=/usr/bin/node /opt/nbm-agent/agent/index.js
Restart=always
RestartSec=10

# Variáveis de ambiente
EnvironmentFile=/opt/nbm-agent/.env

# Limites
LimitNOFILE=65536
LimitNPROC=4096

# Segurança
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/nbm-agent

[Install]
WantedBy=multi-user.target
```

### Criar Usuário de Serviço

```bash
sudo useradd -r -s /bin/false nbm-agent
sudo mkdir -p /var/lib/nbm-agent/cache
sudo chown -R nbm-agent:nbm-agent /var/lib/nbm-agent
sudo chown -R nbm-agent:nbm-agent /opt/nbm-agent
```

### Gerenciar Serviço

```bash
# Recarregar configurações do systemd
sudo systemctl daemon-reload

# Iniciar serviço
sudo systemctl start nbm-agent

# Habilitar início automático
sudo systemctl enable nbm-agent

# Verificar status
sudo systemctl status nbm-agent

# Ver logs
sudo journalctl -u nbm-agent -f
```

---

## Docker

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssh-client

# Copiar arquivos
COPY package*.json ./
RUN npm ci --production

COPY . .

# Usuário não-root
RUN adduser -D -u 1001 nbm-agent
USER nbm-agent

# Variáveis de ambiente
ENV NBM_LOG_LEVEL=info
ENV NBM_CACHE_DIR=/app/cache

# Criar diretório de cache
RUN mkdir -p /app/cache

CMD ["node", "agent/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  nbm-agent:
    build: .
    container_name: nbm-agent
    restart: unless-stopped
    environment:
      - NBM_AGENT_TOKEN=${NBM_AGENT_TOKEN}
      - NBM_SERVER_URL=${NBM_SERVER_URL}
      - NBM_LOG_LEVEL=info
    volumes:
      - nbm-agent-cache:/app/cache
    networks:
      - nbm-network

volumes:
  nbm-agent-cache:

networks:
  nbm-network:
    driver: bridge
```

### Executar com Docker

```bash
# Build
docker build -t nbm-agent .

# Executar
docker run -d \
  --name nbm-agent \
  --restart unless-stopped \
  -e NBM_AGENT_TOKEN=seu-token \
  -e NBM_SERVER_URL=https://seu-servidor.com \
  nbm-agent

# Com Docker Compose
docker-compose up -d
```

---

## Verificação

### Verificar Conexão

```bash
# Status do serviço
sudo systemctl status nbm-agent

# Logs em tempo real
sudo journalctl -u nbm-agent -f

# Teste de conectividade
curl -s http://localhost:9090/health
```

### Resposta Esperada (Health Check)

```json
{
  "status": "healthy",
  "connected": true,
  "uptime": 3600,
  "version": "17.0.0"
}
```

### Verificar no NBM CLOUD

1. Acesse **Agentes** no NBM CLOUD
2. O agente deve aparecer com status **Online**
3. Verifique a última comunicação (heartbeat)

---

## Troubleshooting

### Agente não conecta

**Verificar:**
```bash
# Token correto?
grep NBM_AGENT_TOKEN /opt/nbm-agent/.env

# URL do servidor acessível?
curl -v https://seu-servidor.com/api/health

# Firewall?
sudo iptables -L -n | grep 443
```

**Soluções:**
- Verifique se o token está correto
- Confirme acesso HTTPS ao servidor
- Libere porta 443 no firewall

### Erro de certificado SSL

```bash
# Ignorar verificação (apenas testes)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Ou adicionar CA customizado
export NODE_EXTRA_CA_CERTS=/path/to/ca.crt
```

### Agente desconecta frequentemente

**Verificar:**
```bash
# Logs
sudo journalctl -u nbm-agent --since "1 hour ago"

# Memória
free -m

# Processos
ps aux | grep nbm-agent
```

**Soluções:**
- Aumentar `NBM_HEARTBEAT_INTERVAL`
- Verificar estabilidade da rede
- Aumentar memória se necessário

### Backup falha em equipamento específico

**Verificar:**
```bash
# Teste de conectividade SSH manual
ssh -v usuario@ip-equipamento

# Verificar porta
nc -zv ip-equipamento 22

# Timeout configurado?
grep NBM_SSH_TIMEOUT /opt/nbm-agent/.env
```

**Soluções:**
- Verificar credenciais no NBM CLOUD
- Testar conectividade SSH manualmente
- Aumentar timeout se necessário

### Logs

**Localizações:**
```
/var/log/nbm-agent/       # Logs do agente
/var/lib/nbm-agent/cache/ # Cache de backups
```

**Aumentar verbosidade:**
```bash
# No .env
NBM_LOG_LEVEL=debug

# Reiniciar
sudo systemctl restart nbm-agent
```

---

## Atualizações

### Atualizar Agente

```bash
cd /opt/nbm-agent

# Parar serviço
sudo systemctl stop nbm-agent

# Atualizar código
git pull origin main
# ou
wget https://seu-servidor.com/releases/nbm-agent-latest.tar.gz
tar -xzf nbm-agent-latest.tar.gz

# Atualizar dependências
npm install --production

# Reiniciar
sudo systemctl start nbm-agent
```

### Rollback

```bash
# Restaurar versão anterior
git checkout v16.0.0
npm install --production
sudo systemctl restart nbm-agent
```

---

## Segurança

### Boas Práticas

1. **Token**: Mantenha o token seguro, não compartilhe
2. **Firewall**: Permita apenas tráfego necessário
3. **Atualizações**: Mantenha o agente atualizado
4. **Logs**: Monitore logs regularmente
5. **Acesso**: Use usuário dedicado sem privilégios root

### Renovar Token

Se o token for comprometido:

1. Acesse **Agentes** no NBM CLOUD
2. Clique em **Regenerar Token**
3. Atualize o `.env` no agente
4. Reinicie o serviço

---

**NBM CLOUD Agent v17.0** - Proxy para redes remotas
