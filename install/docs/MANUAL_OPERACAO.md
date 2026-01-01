# Manual de Operacao - NBM Network Backup Manager

## Indice

1. [Introducao](#1-introducao)
2. [Acesso ao Sistema](#2-acesso-ao-sistema)
3. [Dashboard](#3-dashboard)
4. [Gerenciamento de Equipamentos](#4-gerenciamento-de-equipamentos)
5. [Execucao de Backups](#5-execucao-de-backups)
6. [Historico de Backups](#6-historico-de-backups)
7. [Gerenciamento de Scripts](#7-gerenciamento-de-scripts)
8. [Gerenciamento de Firmware](#8-gerenciamento-de-firmware)
9. [Fabricantes](#9-fabricantes)
10. [Terminal Interativo](#10-terminal-interativo)
11. [Administracao](#11-administracao)
12. [Personalizacao de Temas](#12-personalizacao-de-temas)
13. [Resolucao de Problemas](#13-resolucao-de-problemas)

---

## 1. Introducao

O NBM (Network Backup Manager) e um sistema web para gerenciamento centralizado de backups de equipamentos de rede. Suporta multiplos fabricantes e protocolos de conexao (SSH/Telnet).

### Recursos Principais

- Cadastro de equipamentos de rede com credenciais seguras
- Execucao de backups manuais e automatizados
- Gerenciamento de scripts personalizados por fabricante
- Atualizacao remota de firmware
- Terminal interativo para acesso direto aos equipamentos
- Sistema de temas visuais personalizaveis
- Backup e restauracao do banco de dados

---

## 2. Acesso ao Sistema

### Login

1. Acesse o endereco do servidor NBM no navegador: `http://seu-servidor:5000`
2. Clique em "Entrar com Replit" ou use suas credenciais locais
3. Apos autenticacao, voce sera redirecionado ao Dashboard

### Primeiro Acesso

O primeiro usuario a fazer login sera automaticamente definido como administrador do sistema.

### Logout

Clique no icone de saida (seta para a direita) no menu lateral inferior.

---

## 3. Dashboard

O Dashboard apresenta uma visao geral do sistema:

### Metricas Exibidas

- **Total de Equipamentos**: Quantidade de dispositivos cadastrados
- **Total de Backups**: Numero de backups realizados
- **Taxa de Sucesso**: Percentual de backups bem-sucedidos
- **Tamanho Total**: Espaco ocupado pelos backups

### Grafico de Fabricantes

Distribuicao de equipamentos por fabricante em formato de pizza.

### Backups Recentes

Lista dos ultimos backups executados com status e data.

---

## 4. Gerenciamento de Equipamentos

### Acessar

Menu lateral > **Equipamentos**

### Cadastrar Novo Equipamento

1. Clique no botao **"Novo Equipamento"**
2. Preencha os campos:
   - **Nome**: Identificador do equipamento
   - **IP/Hostname**: Endereco de acesso
   - **Fabricante**: Selecione o fabricante
   - **Protocolo**: SSH ou Telnet
   - **Porta**: Porta de conexao (padrao: 22 para SSH, 23 para Telnet)
   - **Usuario**: Credencial de acesso
   - **Senha**: Senha de acesso
   - **Descricao** (opcional): Notas sobre o equipamento
3. Clique em **"Salvar"**

### Editar Equipamento

1. Localize o equipamento na lista
2. Clique no icone de edicao (lapis)
3. Modifique os campos desejados
4. Clique em **"Salvar"**

### Excluir Equipamento

1. Localize o equipamento na lista
2. Clique no icone de exclusao (lixeira)
3. Confirme a exclusao

### Filtros e Busca

- Use a barra de busca para filtrar por nome ou IP
- Use os filtros por fabricante para visualizar grupos especificos

---

## 5. Execucao de Backups

### Acessar

Menu lateral > **Executar**

### Executar Backup Manual

1. Selecione os equipamentos desejados:
   - Marque individualmente usando as caixas de selecao
   - Use "Selecionar Todos" para marcar todos
   - Use a busca para filtrar equipamentos
2. Selecione o script de backup a ser utilizado
3. Clique em **"Executar Backup"**
4. Acompanhe o progresso na tela

### Resultado da Execucao

Apos a execucao, sera exibido:
- Status (sucesso/falha) para cada equipamento
- Tempo de execucao
- Mensagens de erro (se houver)

---

## 6. Historico de Backups

### Acessar

Menu lateral > **Backups**

### Visualizar Historico

A lista exibe todos os backups realizados com:
- Data e hora
- Equipamento
- Status
- Tamanho do arquivo
- Duracao

### Filtros

- Filtrar por equipamento
- Filtrar por status (sucesso/falha)
- Filtrar por periodo

### Acoes

- **Visualizar**: Exibe o conteudo do backup
- **Download**: Baixa o arquivo de backup
- **Excluir**: Remove o backup do sistema

---

## 7. Gerenciamento de Scripts

### Acessar

Menu lateral > **Scripts**

### Estrutura de Scripts

Os scripts sao organizados por fabricante. Cada fabricante pode ter multiplos scripts com diferentes finalidades:
- Script de Backup
- Script de Atualizacao
- Scripts Personalizados

### Criar Novo Script

1. Clique em **"Novo Script"**
2. Preencha:
   - **Nome**: Identificador do script
   - **Fabricante**: Fabricante alvo
   - **Comando**: Codigo do script
   - **Descricao**: Explicacao do funcionamento
   - **Extensao**: Extensao do arquivo gerado (.cfg, .rsc, etc.)
   - **Timeout**: Tempo maximo de execucao
3. Clique em **"Salvar"**

### Placeholders Disponiveis

Os scripts suportam variaveis que sao substituidas durante a execucao:

| Placeholder | Descricao |
|-------------|-----------|
| {{EQUIPMENT_IP}} | IP do equipamento |
| {{SERVER_IP}} | IP do servidor NBM |
| {{FIRMWARE_FILE}} | Nome do arquivo de firmware |

### Exemplo de Script (Mikrotik)

```bash
# Script de Backup Mikrotik
# Placeholder: {{EQUIPMENT_IP}}
/export
```

### Duplicar Script

1. Localize o script desejado
2. Clique no icone de duplicar
3. Edite o novo script conforme necessario
4. Salve

### Excluir Script

Scripts padrao (isDefault) nao podem ser excluidos.

---

## 8. Gerenciamento de Firmware

### Acessar

Menu lateral > **Firmware**

### Adicionar Firmware

1. Clique em **"Adicionar Firmware"**
2. Selecione o fabricante
3. Informe a versao
4. Faca upload do arquivo de firmware
5. Clique em **"Salvar"**

### Estrutura de Armazenamento

Os arquivos de firmware sao armazenados em:
- `/var/lib/nbm/firmware/` (Linux)
- Organizados por fabricante

### Atualizacao de Equipamentos

1. Acesse **Executar**
2. Selecione os equipamentos
3. Escolha o script de atualizacao
4. Selecione a versao do firmware
5. Execute

---

## 9. Fabricantes

### Acessar

Menu lateral > **Fabricantes**

### Fabricantes Suportados

| Fabricante | Extensao Padrao | Protocolo |
|------------|-----------------|-----------|
| Huawei | .cfg | SSH |
| Mikrotik | .rsc | SSH |
| Cisco | .cfg | SSH |
| Nokia | .cfg | SSH |
| ZTE | .cfg | SSH |
| Datacom | .cfg | SSH |
| Datacom DMOS | .cfg | SSH |
| Juniper | .cfg | SSH |

### Personalizar Cores

1. Clique no fabricante
2. Selecione uma nova cor
3. A mudanca e aplicada imediatamente

---

## 10. Terminal Interativo

### Acessar

O terminal permite acesso direto aos equipamentos via SSH/Telnet.

### Conectar a um Equipamento

1. Selecione o equipamento na lista
2. Clique em **"Conectar"**
3. O terminal abrira automaticamente

### Temas do Terminal

O terminal suporta 10 temas visuais:
- Default
- Monokai
- Dracula
- Nord
- Solarized Dark
- Solarized Light
- Material
- One Dark
- Gruvbox
- Tokyo Night

Para trocar o tema, use o seletor no canto superior do terminal.

### Comandos

Digite comandos normalmente como se estivesse conectado diretamente ao equipamento.

---

## 11. Administracao

### Acessar

Menu lateral > **Administracao**

### Abas Disponiveis

#### Sistema
- Versao do sistema
- Estatisticas gerais
- Informacoes do banco de dados

#### Backup de Dados
- **Exportar**: Gera backup completo do banco de dados
- **Importar**: Restaura backup previamente exportado

#### Usuarios
- Lista de usuarios do sistema
- Adicionar/remover usuarios
- Definir permissoes de administrador

#### Personalizacao
- Selecao de tema visual
- Modo claro/escuro
- Nome do sistema
- Logotipo personalizado
- IP do servidor

---

## 12. Personalizacao de Temas

### Temas Disponiveis

O NBM inclui 12 temas modernos:

| Tema | Descricao |
|------|-----------|
| macOS Sequoia | Estilo Apple moderno |
| Windows 11 | Design Fluent Microsoft |
| Linux Ubuntu | Tema Yaru |
| Nord | Paleta artica |
| Dracula | Tema escuro popular |
| Tokyo Night | Cores neon noturnas |
| GitHub | Tema limpo e profissional |
| Catppuccin Mocha | Cores pastel suaves |
| One Dark | Tema do Atom |
| Gruvbox | Tons quentes retro |
| Rose Pine | Elegante com tons rosados |
| Monokai Pro | Classico de desenvolvimento |

### Alterar Tema

1. Acesse **Administracao > Personalizacao**
2. Clique no tema desejado
3. Use o alternador para modo Claro/Escuro
4. O tema e aplicado instantaneamente

### Persistencia

A preferencia de tema e salva no navegador e persiste entre sessoes.

---

## 13. Resolucao de Problemas

### Falha na Conexao com Equipamento

**Sintoma**: Backup falha com "Connection refused"

**Solucoes**:
1. Verifique se o IP esta correto
2. Confirme que a porta esta acessivel
3. Verifique credenciais de acesso
4. Teste a conexao manualmente via terminal

### Backup Vazio

**Sintoma**: Arquivo de backup gerado esta vazio

**Solucoes**:
1. Verifique o script de backup
2. Confirme que o comando retorna saida
3. Aumente o timeout do script

### Timeout na Execucao

**Sintoma**: Execucao excede tempo limite

**Solucoes**:
1. Aumente o timeout do script
2. Verifique latencia de rede
3. Simplifique o script

### Sistema Lento

**Sintoma**: Interface lenta para carregar

**Solucoes**:
1. Verifique recursos do servidor
2. Limpe backups antigos
3. Otimize banco de dados

### Erro de Autenticacao

**Sintoma**: "Unauthorized" ao acessar

**Solucoes**:
1. Limpe cookies do navegador
2. Faca login novamente
3. Reinicie o servico NBM

---

## Contato e Suporte

- **Email**: suporte@exemplo.com
- **GitHub Issues**: https://github.com/seu-usuario/nbm/issues
- **Documentacao Online**: https://github.com/seu-usuario/nbm/wiki

---

*Ultima atualizacao: Janeiro 2026*
*Versao do documento: 1.0*
