# NBM - Network Backup Manager

Sistema de gerenciamento de backups automatizados para equipamentos de rede.

![NBM Dashboard](docs/screenshots/dashboard.png)

## Funcionalidades

- **Gerenciamento de Equipamentos**: Cadastro de roteadores, switches e equipamentos de rede
- **Backups Automatizados**: Execucao de backups via SSH/Telnet
- **Atualizacao de Firmware**: Gerenciamento e atualizacao remota de firmware
- **Scripts Personalizados**: Multiplos scripts por fabricante
- **Terminal Interativo**: CLI com 10 temas visuais
- **Sistema de Temas**: 12 temas modernos (macOS, Windows 11, Nord, Dracula, etc.)
- **Administracao Completa**: Backup/restore de banco de dados

## Fabricantes Suportados

- Huawei
- Mikrotik
- Cisco
- Nokia
- ZTE
- Datacom
- Datacom DMOS
- Juniper

## Requisitos do Sistema

### Hardware Minimo
- CPU: 2 cores
- RAM: 2GB
- Disco: 20GB

### Software
- Debian 13 (Trixie) ou Ubuntu 22.04+
- Node.js 20+
- PostgreSQL 15+

## Instalacao Rapida

### Debian 13

```bash
# Baixar e executar instalador
wget https://github.com/seu-usuario/nbm/releases/latest/download/install.sh
chmod +x install.sh
sudo ./install.sh install
```

### Instalacao Manual

```bash
# 1. Clonar repositorio
git clone https://github.com/seu-usuario/nbm.git
cd nbm

# 2. Instalar dependencias
npm install

# 3. Configurar banco de dados
cp .env.example .env
# Editar .env com suas configuracoes

# 4. Inicializar banco
npm run db:push

# 5. Compilar
npm run build

# 6. Executar
npm start
```

## Configuracao

### Variaveis de Ambiente

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| DATABASE_URL | String de conexao PostgreSQL | - |
| SESSION_SECRET | Chave secreta para sessoes | - |
| PORT | Porta do servidor web | 5000 |
| NODE_ENV | Ambiente (development/production) | production |

### Arquivo .env

```env
DATABASE_URL=postgresql://nbm:senha@localhost:5432/nbm
SESSION_SECRET=sua-chave-secreta-muito-longa
PORT=5000
NODE_ENV=production
```

## Uso

### Acesso Web

Acesse `http://seu-servidor:5000` no navegador.

### Primeiro Acesso

1. O primeiro usuario a fazer login sera automaticamente administrador
2. Cadastre os equipamentos de rede
3. Configure os scripts de backup/atualizacao
4. Execute backups manualmente ou configure agendamentos

### Comandos do Servico (Linux)

```bash
# Iniciar
sudo systemctl start nbm

# Parar
sudo systemctl stop nbm

# Reiniciar
sudo systemctl restart nbm

# Status
sudo systemctl status nbm

# Ver logs
sudo journalctl -u nbm -f
```

## Estrutura de Diretorios

```
/opt/nbm/           # Aplicacao
/var/lib/nbm/       # Dados
  ├── backups/      # Arquivos de backup
  ├── firmware/     # Arquivos de firmware
  └── uploads/      # Uploads temporarios
/var/log/nbm/       # Logs
```

## Desenvolvimento

### Requisitos

- Node.js 20+
- PostgreSQL 15+
- npm ou yarn

### Configurar Ambiente

```bash
# Clonar repositorio
git clone https://github.com/seu-usuario/nbm.git
cd nbm

# Instalar dependencias
npm install

# Configurar banco de dados
cp .env.example .env
# Editar .env

# Inicializar banco
npm run db:push

# Iniciar em modo desenvolvimento
npm run dev
```

### Scripts Disponiveis

| Script | Descricao |
|--------|-----------|
| npm run dev | Inicia servidor de desenvolvimento |
| npm run build | Compila para producao |
| npm start | Inicia servidor de producao |
| npm run db:push | Sincroniza schema do banco |
| npm run db:studio | Abre interface do Drizzle |

## API

### Endpoints Principais

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /api/equipment | Lista equipamentos |
| POST | /api/equipment | Cria equipamento |
| GET | /api/backups | Lista backups |
| POST | /api/backups/execute | Executa backup |
| GET | /api/scripts | Lista scripts |
| GET | /api/firmware | Lista firmware |

### Autenticacao

A API usa sessoes baseadas em cookies. Faca login via interface web ou via:

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "senha"}'
```

## Backup e Restauracao

### Backup do Banco de Dados

Via interface web em Administracao > Backup de Dados, ou via CLI:

```bash
pg_dump -U nbm -d nbm > backup_$(date +%Y%m%d).sql
```

### Restauracao

```bash
psql -U nbm -d nbm < backup_20260101.sql
```

## Seguranca

- Use HTTPS em producao (configure Nginx/Caddy como proxy reverso)
- Mantenha o sistema operacional atualizado
- Use senhas fortes para banco de dados e usuarios
- Configure firewall para expor apenas portas necessarias

### Configuracao HTTPS com Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name nbm.exemplo.com;
    
    ssl_certificate /etc/letsencrypt/live/nbm.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nbm.exemplo.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Resolucao de Problemas

### Servico nao inicia

```bash
# Verificar logs
sudo journalctl -u nbm -n 50

# Verificar configuracao
cat /opt/nbm/.env

# Verificar permissoes
ls -la /opt/nbm/
```

### Erro de conexao com banco

```bash
# Verificar se PostgreSQL esta rodando
sudo systemctl status postgresql

# Testar conexao
psql -U nbm -d nbm -h localhost
```

### Erro de autenticacao

- Limpe cookies do navegador
- Verifique se SESSION_SECRET esta configurado
- Reinicie o servico

## Contribuicao

1. Fork o repositorio
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudancas (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licenca

Este projeto esta licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Suporte

- **Issues**: https://github.com/seu-usuario/nbm/issues
- **Discussoes**: https://github.com/seu-usuario/nbm/discussions
- **Email**: suporte@exemplo.com

## Changelog

### v1.0.0 (2026-01-01)
- Lancamento inicial
- Suporte a 8 fabricantes
- Sistema de temas com 12 opcoes
- Terminal interativo
- Gerenciamento de firmware
