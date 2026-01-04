# NBM Agent - Network Backup Manager Remote Agent

O NBM Agent é um proxy local que se conecta ao servidor NBM na nuvem para executar backups de equipamentos de rede em redes remotas.

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

# Executar instalação
sudo ./scripts/install.sh
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
