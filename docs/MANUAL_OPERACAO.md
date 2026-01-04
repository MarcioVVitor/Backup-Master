# NBM CLOUD v17.0 - Manual de Operação

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura Multi-Tenant](#arquitetura-multi-tenant)
3. [Primeiros Passos](#primeiros-passos)
4. [Gestão de Empresas](#gestão-de-empresas)
5. [Gestão de Equipamentos](#gestão-de-equipamentos)
6. [Execução de Backups](#execução-de-backups)
7. [Agendamento Automático](#agendamento-automático)
8. [Gestão de Scripts](#gestão-de-scripts)
9. [Agentes Remotos (Proxies)](#agentes-remotos-proxies)
10. [Atualização de Firmware](#atualização-de-firmware)
11. [Terminal SSH](#terminal-ssh)
12. [Administração](#administração)
13. [API REST](#api-rest)

---

## Visão Geral

O **NBM CLOUD** (Network Backup Management Cloud) é uma plataforma multi-tenant para gerenciamento automatizado de backups de equipamentos de rede. O sistema suporta 8 fabricantes:

| Fabricante | Protocolos | Scripts |
|------------|-----------|---------|
| Mikrotik | SSH | 3 |
| Huawei | SSH/Telnet | 3 |
| Cisco | SSH/Telnet | 2 |
| Nokia | SSH | 2 |
| ZTE | SSH/Telnet | 2 |
| Datacom | SSH | 2 |
| Datacom DMOS | SSH | 2 |
| Juniper | SSH | 2 |

### Capacidade
- **2000+ backups por empresa** com performance otimizada
- Índices de banco de dados compostos para consultas rápidas
- Isolamento total de dados entre empresas (tenants)

---

## Arquitetura Multi-Tenant

### Hierarquia de Usuários

```
NBM CLOUD Server
├── Server Admins (Super Administradores)
│   ├── server_admin - Acesso total ao sistema
│   └── support_engineer - Suporte técnico
│
└── Empresas (Tenants)
    ├── company_admin - Administrador da empresa
    ├── operator - Operador (executa backups)
    └── viewer - Visualizador (somente leitura)
```

### Isolamento de Dados

Cada empresa possui seus próprios:
- Equipamentos de rede
- Arquivos de backup
- Histórico de execuções
- Políticas de agendamento
- Agentes remotos

**Importante**: Usuários de uma empresa **nunca** têm acesso aos dados de outra empresa.

---

## Primeiros Passos

### 1. Login no Sistema

1. Acesse a URL do NBM CLOUD
2. Faça login com suas credenciais (Replit Auth ou usuário local)
3. Se pertencer a múltiplas empresas, selecione a empresa no seletor do cabeçalho

### 2. Navegação Principal

O menu lateral contém:

| Menu | Função |
|------|--------|
| Dashboard | Visão geral e estatísticas |
| Fabricantes | Lista de fabricantes suportados |
| Equipamentos | Cadastro e gestão de dispositivos |
| Scripts | Scripts de backup por fabricante |
| Executar Backup | Execução manual de backups |
| Backups | Lista de arquivos de backup |
| Agendador | Políticas de backup automático |
| Firmware | Gestão de atualizações |
| Terminal | Acesso SSH aos equipamentos |
| Agentes | Proxies remotos |
| Administração | Configurações e usuários |
| NBM Server | (Super Admins) Gestão de empresas |

---

## Gestão de Empresas

*Disponível apenas para Super Administradores*

### Criar Empresa

1. Acesse **NBM Server** > **Empresas**
2. Clique em **Nova Empresa**
3. Preencha:
   - Nome da empresa
   - Slug (identificador único)
   - Descrição (opcional)
   - Limites: usuários, equipamentos, agentes

### Configurar Limites

| Limite | Descrição | Padrão |
|--------|-----------|--------|
| max_users | Máximo de usuários | 10 |
| max_equipment | Máximo de equipamentos | 100 |
| max_agents | Máximo de agentes | 5 |

---

## Gestão de Equipamentos

### Cadastrar Equipamento

1. Acesse **Equipamentos**
2. Clique em **Novo Equipamento**
3. Preencha os campos:

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Nome | Nome identificador | Sim |
| IP | Endereço IP do dispositivo | Sim |
| Fabricante | Mikrotik, Huawei, etc. | Sim |
| Modelo | Modelo do equipamento | Não |
| Usuário | Login SSH/Telnet | Sim |
| Senha | Senha de acesso | Sim |
| Porta | Porta de conexão (padrão: 22) | Não |
| Protocolo | SSH ou Telnet | Não |

### Editar/Excluir

- Use os botões de ação na lista de equipamentos
- A exclusão remove também o histórico de backups associado

---

## Execução de Backups

### Backup Manual

1. Acesse **Executar Backup**
2. Selecione os equipamentos desejados
3. Clique em **Executar Backup**
4. Acompanhe o progresso em tempo real

### Processo de Backup

1. Sistema conecta via SSH/Telnet ao equipamento
2. Executa o script apropriado para o fabricante
3. Captura a configuração do dispositivo
4. Salva no Object Storage
5. Registra no histórico

### Visualizar Backups

1. Acesse **Backups**
2. Use os filtros para localizar arquivos:
   - Por equipamento
   - Por data
   - Por status
3. Ações disponíveis:
   - **Visualizar**: Ver conteúdo do backup
   - **Download**: Baixar arquivo
   - **Excluir**: Remover backup

---

## Agendamento Automático

### Criar Política de Backup

1. Acesse **Agendador**
2. Clique em **Nova Política**
3. Configure:

| Campo | Opções |
|-------|--------|
| Nome | Identificador da política |
| Frequência | Diário, Semanal, Mensal |
| Hora | Horário de execução |
| Dia da Semana | (Se semanal) |
| Equipamentos | Selecione os dispositivos |

### Monitoramento

- Veja o histórico de execuções de cada política
- Status: Sucesso, Falha, Em andamento
- Próxima execução programada

---

## Gestão de Scripts

### Scripts por Fabricante

Cada fabricante possui scripts pré-configurados:

**Mikrotik**
- `backup` - Backup completo
- `export` - Export de configuração
- `system-backup` - Backup binário

**Huawei**
- `display-current` - Configuração atual
- `save-config` - Salvar configuração
- `backup-full` - Backup completo

**Cisco**
- `show-running` - Running-config
- `show-startup` - Startup-config

### Personalizar Scripts

1. Acesse **Scripts**
2. Selecione o fabricante
3. Edite ou crie novo script
4. Campos:
   - Nome do script
   - Tipo (backup/update)
   - Conteúdo (comandos)

---

## Agentes Remotos (Proxies)

### Função

Agentes são proxies instalados em redes remotas que permitem:
- Acesso a equipamentos em redes privadas
- Execução de backups sem VPN
- Distribuição de carga

### Cadastrar Agente

1. Acesse **Agentes**
2. Clique em **Novo Agente**
3. Anote o token de autenticação
4. Instale o agente na rede remota (ver Manual de Instalação de Proxy)

### Status do Agente

| Status | Descrição |
|--------|-----------|
| Online | Conectado e operacional |
| Offline | Sem comunicação |
| Manutenção | Em manutenção programada |

---

## Atualização de Firmware

### Gerenciar Firmwares

1. Acesse **Firmware**
2. Faça upload de arquivos de firmware
3. Associe a fabricantes específicos

### Atualizar Equipamento

1. Selecione o equipamento
2. Escolha o firmware
3. Execute a atualização
4. Acompanhe o progresso

**Atenção**: Atualizações de firmware podem causar reinicialização dos equipamentos.

---

## Terminal SSH

### Acesso Direto

1. Acesse **Terminal**
2. Selecione o equipamento
3. Conecte via WebSocket SSH
4. Execute comandos em tempo real

### Funcionalidades

- Terminal interativo no navegador
- Histórico de comandos
- Copiar/colar suportado
- Timeout configurável

---

## Administração

### Usuários

1. Acesse **Administração** > **Usuários**
2. Gerencie usuários da empresa:
   - Adicionar novos usuários
   - Alterar roles (admin/operator/viewer)
   - Ativar/desativar acesso

### Configurações

| Configuração | Descrição |
|--------------|-----------|
| Logo | Logo personalizado da empresa |
| Nome do Sistema | Nome exibido no cabeçalho |
| Cor Primária | Cor tema da interface |
| Timezone | Fuso horário para agendamentos |

---

## API REST

### Autenticação

Todas as requisições requerem autenticação via sessão.

### Endpoints Principais

#### Equipamentos
```
GET    /api/equipment          - Listar equipamentos
POST   /api/equipment          - Criar equipamento
PUT    /api/equipment/:id      - Atualizar equipamento
DELETE /api/equipment/:id      - Excluir equipamento
```

#### Backups
```
GET    /api/backups            - Listar backups
POST   /api/backups            - Upload manual
POST   /api/backups/execute    - Executar backup
GET    /api/backups/:id/view   - Visualizar conteúdo
GET    /api/backups/:id/download - Download
DELETE /api/backups/:id        - Excluir
```

#### Histórico
```
GET    /api/backup-history     - Histórico de execuções
```

#### Políticas
```
GET    /api/backup-policies    - Listar políticas
POST   /api/backup-policies    - Criar política
PUT    /api/backup-policies/:id - Atualizar
DELETE /api/backup-policies/:id - Excluir
```

#### Agentes
```
GET    /api/agents             - Listar agentes
POST   /api/agents             - Registrar agente
DELETE /api/agents/:id         - Remover agente
```

### Resposta Padrão

```json
{
  "success": true,
  "data": { ... },
  "total": 100
}
```

### Erros

```json
{
  "success": false,
  "error": "Mensagem de erro",
  "code": "ERROR_CODE"
}
```

---

## Suporte

Para suporte técnico:
- Documentação: `/docs`
- Logs: Acesse o painel de administração
- Contato: Consulte o administrador do sistema

---

**NBM CLOUD v17.0** - Network Backup Management Cloud
