# NBM CLOUD Agent - Network Backup Manager Cloud

O NBM CLOUD Agent é um proxy local que se conecta ao servidor NBM CLOUD para executar backups de equipamentos de rede em redes remotas.

## Requisitos

- Debian 13 (ou compatível)
- Node.js 20.x ou superior
- Acesso root para instalação
- Conectividade de saída para o servidor NBM (porta 443)

## Instalação Rápida

```bash
# Extrair o pacote
tar -xzf nbm-agent.tar.gz
cd nbm-agent

# Executar instalação (sem firewall)
sudo ./scripts/install.sh

# Ou com configuração automática do firewall UFW (recomendado para IP público)
sudo ./scripts/install.sh --with-ufw
```

## Configuração do Firewall UFW

Para agentes com IP público, é altamente recomendado configurar o firewall. A opção `--with-ufw` configura automaticamente:

- **Política padrão**: Bloqueia todas conexões de entrada, permite saídas
- **Saída 443/tcp**: WebSocket para o servidor NBM na nuvem
- **Saída 22/tcp**: SSH para equipamentos de rede
- **Saída 23/tcp**: Telnet para equipamentos legados
- **Entrada 22/tcp**: Acesso SSH administrativo com rate limiting
- **Logging**: Ativado para auditoria

### Configuração Manual do UFW

Se preferir configurar manualmente:

```bash
# Instalar UFW
sudo apt-get install ufw

# Políticas padrão
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir saídas necessárias
sudo ufw allow out 443/tcp comment 'NBM Agent - WebSocket'
sudo ufw allow out 22/tcp comment 'NBM Agent - SSH to equipment'
sudo ufw allow out 23/tcp comment 'NBM Agent - Telnet'

# SSH admin com rate limiting (proteção contra brute force)
sudo ufw limit 22/tcp comment 'SSH admin - rate limited'

# Habilitar logging
sudo ufw logging on

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status verbose
```

### Restringir Acesso SSH por IP

Para maior segurança, restrinja SSH a IPs específicos:

```bash
# Remover regra genérica
sudo ufw delete limit 22/tcp

# Permitir apenas IPs específicos
sudo ufw allow from 10.0.0.0/24 to any port 22 comment 'SSH from trusted network'
sudo ufw allow from 203.0.113.50 to any port 22 comment 'SSH from admin IP'
```

## Configuração

Após a instalação, edite o arquivo de configuração:

```bash
sudo nano /etc/nbm-agent/config.json
```

Configure os seguintes campos:

| Campo | Descrição |
|-------|-----------|
| `serverUrl` | URL do servidor NBM (ex: https://seu-servidor.com) |
| `agentToken` | Token de autenticação gerado na interface web |
| `agentId` | ID do agente registrado no NBM |
| `heartbeatInterval` | Intervalo de heartbeat em ms (padrão: 30000) |
| `logLevel` | Nível de log: debug, info, warn, error |

## Gerenciamento do Serviço

```bash
# Iniciar o serviço
sudo systemctl start nbm-agent

# Parar o serviço
sudo systemctl stop nbm-agent

# Reiniciar o serviço
sudo systemctl restart nbm-agent

# Verificar status
sudo systemctl status nbm-agent

# Habilitar início automático
sudo systemctl enable nbm-agent

# Desabilitar início automático
sudo systemctl disable nbm-agent
```

## Logs

```bash
# Ver logs em tempo real
sudo tail -f /var/log/nbm-agent/agent.log

# Ver erros
sudo tail -f /var/log/nbm-agent/agent-error.log

# Ver últimas 100 linhas
sudo tail -100 /var/log/nbm-agent/agent.log
```

## Variáveis de Ambiente

Alternativamente ao arquivo de configuração, você pode usar variáveis de ambiente:

| Variável | Descrição |
|----------|-----------|
| `NBM_SERVER_URL` | URL do servidor NBM |
| `NBM_AGENT_TOKEN` | Token de autenticação |
| `NBM_AGENT_ID` | ID do agente |
| `NBM_HEARTBEAT_INTERVAL` | Intervalo de heartbeat |
| `NBM_LOG_LEVEL` | Nível de log |
| `NBM_CONFIG_PATH` | Caminho do arquivo de configuração |

## Desinstalação

```bash
sudo ./scripts/uninstall.sh
```

## Arquitetura

```
NBM Cloud Server <---> [Internet] <---> NBM Agent <---> Equipamentos de Rede
                   WebSocket (TLS)                    SSH/Telnet
```

O agente mantém uma conexão WebSocket persistente com o servidor na nuvem, eliminando a necessidade de abrir portas de entrada na rede local.

## Fabricantes Suportados

- Huawei
- Mikrotik
- Cisco
- Nokia
- ZTE
- Datacom
- Juniper
- Genérico

## Suporte

Para suporte, entre em contato com o administrador do seu sistema NBM.
