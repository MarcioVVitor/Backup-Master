# Changelog

Todas as mudancas notaveis neste projeto serao documentadas neste arquivo.

O formato e baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-01-01

### Adicionado
- Dashboard com metricas e estatisticas do sistema
- Gerenciamento completo de equipamentos (CRUD)
- Suporte a 8 fabricantes: Huawei, Mikrotik, Cisco, Nokia, ZTE, Datacom, Datacom DMOS, Juniper
- Sistema de scripts personalizados por fabricante
- Scripts de backup e atualizacao padrao para todos os fabricantes
- Execucao de backups via SSH/Telnet
- Historico completo de backups com visualizacao e download
- Gerenciamento de firmware com upload e versoes
- Terminal interativo com 10 temas visuais
- Sistema de temas com 12 opcoes modernas:
  - macOS Sequoia
  - Windows 11
  - Linux Ubuntu
  - Nord
  - Dracula
  - Tokyo Night
  - GitHub
  - Catppuccin Mocha
  - One Dark
  - Gruvbox
  - Rose Pine
  - Monokai Pro
- Modo claro/escuro para todos os temas
- Administracao com backup/restore de banco de dados
- Gerenciamento de usuarios
- Personalizacao de logotipo e nome do sistema
- Configuracao de IP do servidor para scripts de firmware
- Script de instalacao para Debian 13
- Documentacao completa e manual de operacao

### Seguranca
- Autenticacao via OIDC (Replit)
- Sessoes seguras com PostgreSQL
- Protecao CSRF
- Senhas armazenadas com hash seguro

### Infraestrutura
- Backend: Node.js + Express
- Frontend: React + Vite + TailwindCSS
- Banco de dados: PostgreSQL com Drizzle ORM
- Servico systemd para producao

---

## Formato de Versao

- **MAJOR**: Mudancas incompativeis com versoes anteriores
- **MINOR**: Novas funcionalidades compativeis
- **PATCH**: Correcoes de bugs compativeis

## Links

- [Repositorio](https://github.com/seu-usuario/nbm)
- [Issues](https://github.com/seu-usuario/nbm/issues)
- [Releases](https://github.com/seu-usuario/nbm/releases)
