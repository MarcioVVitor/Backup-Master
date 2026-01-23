# Guia de Instalação - Debian 13 (Trixie)

Este guia descreve como instalar e configurar o sistema **rest-express** em um servidor rodando Debian 13.

## 1. Pré-requisitos

- Debian 13 (Trixie) instalado.
- Acesso root ou usuário com privilégios sudo.
- Node.js (v20 ou superior).
- PostgreSQL (v15 ou superior).

## 2. Instalação de Dependências do Sistema

```bash
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib
```

### Instalação do Node.js (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Configuração do Banco de Dados

```bash
sudo -u postgres psql -c "CREATE DATABASE rest_express_db;"
sudo -u postgres psql -c "CREATE USER app_user WITH PASSWORD 'seu_password_seguro';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rest_express_db TO app_user;"
```

## 4. Configuração do Aplicativo

Clone o repositório e instale as dependências:

```bash
git clone <url-do-repositorio> /opt/rest-express
cd /opt/rest-express
npm install
```

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL=postgresql://app_user:seu_password_seguro@localhost:5432/rest_express_db
NODE_ENV=production
PORT=5000
```

## 5. Build do Projeto

```bash
npm run build
```

## 6. Configuração do systemd

Crie o arquivo de serviço para o sistema iniciar automaticamente:

```bash
sudo nano /etc/systemd/system/rest-express.service
```

(Veja o conteúdo no arquivo `app.service` gerado)

Ative o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rest-express
sudo systemctl start rest-express
```

## 7. Configuração do Nginx (Reverse Proxy)

Configure o Nginx para servir o aplicativo na porta 80/443:

```bash
sudo nano /etc/nginx/sites-available/rest-express
```

(Veja o conteúdo no arquivo `nginx.conf` gerado)

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/rest-express /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
