# NBM CLOUD - Manual de Deploy em Nuvem

## Índice

1. [Visão Geral](#visão-geral)
2. [Preparação](#preparação)
3. [AWS (Amazon Web Services)](#aws-amazon-web-services)
4. [Azure (Microsoft Azure)](#azure-microsoft-azure)
5. [Google Cloud Platform](#google-cloud-platform)
6. [DigitalOcean](#digitalocean)
7. [Cloudflare](#cloudflare)
8. [Railway](#railway)
9. [Render](#render)
10. [Configurações de Produção](#configurações-de-produção)
11. [Monitoramento](#monitoramento)

---

## Visão Geral

Este manual detalha o processo de deploy do NBM CLOUD v17.0 em diversos provedores de nuvem.

### Requisitos do Sistema

| Componente | Requisito Mínimo | Recomendado |
|------------|------------------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB SSD | 50 GB SSD |
| PostgreSQL | 13+ | 15+ |
| Node.js | 18.x | 20.x |

### Portas Necessárias

| Porta | Serviço | Descrição |
|-------|---------|-----------|
| 80 | HTTP | Redirecionamento para HTTPS |
| 443 | HTTPS | Aplicação principal |
| 5432 | PostgreSQL | Banco de dados (interno) |

---

## Preparação

### 1. Build do Projeto

```bash
# Instalar dependências
npm install

# Build de produção
npm run build
```

### 2. Variáveis de Ambiente

Crie um arquivo `.env.production`:

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:5432/nbmcloud

# Sessão
SESSION_SECRET=sua-chave-secreta-muito-longa-e-segura

# Object Storage (GCS compatível)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=seu-bucket-id

# Ambiente
NODE_ENV=production
PORT=5000

# Auth (Replit ou Custom)
ISSUER_URL=https://replit.com
```

---

## AWS (Amazon Web Services)

### Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────┐
│                        Route 53 (DNS)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              Application Load Balancer (ALB)                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     ECS Fargate                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Task 1    │  │   Task 2    │  │   Task N    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
          │                                    │
┌─────────────────────┐          ┌─────────────────────┐
│    RDS PostgreSQL   │          │     S3 Bucket       │
└─────────────────────┘          └─────────────────────┘
```

### 1. Criar Repositório ECR

```bash
# Criar repositório
aws ecr create-repository --repository-name nbm-cloud

# Login no ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build e push
docker build -t nbm-cloud .
docker tag nbm-cloud:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/nbm-cloud:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/nbm-cloud:latest
```

### 2. Criar RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier nbm-cloud-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15 \
  --master-username nbmadmin \
  --master-user-password SUA_SENHA_SEGURA \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default
```

### 3. Criar S3 Bucket

```bash
aws s3 mb s3://nbm-cloud-backups-UNIQUE_ID
aws s3api put-bucket-versioning --bucket nbm-cloud-backups-UNIQUE_ID --versioning-configuration Status=Enabled
```

### 4. Task Definition (ECS)

```json
{
  "family": "nbm-cloud",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "nbm-cloud",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/nbm-cloud:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "5000"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:nbm-cloud/database-url"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:nbm-cloud/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/nbm-cloud",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 5. Terraform (Infraestrutura como Código)

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  name   = "nbm-cloud-vpc"
  cidr   = "10.0.0.0/16"
  
  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
}

resource "aws_db_instance" "postgres" {
  identifier        = "nbm-cloud-db"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t3.medium"
  allocated_storage = 20
  
  db_name  = "nbmcloud"
  username = "nbmadmin"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  skip_final_snapshot = true
}

resource "aws_ecs_cluster" "main" {
  name = "nbm-cloud-cluster"
}

resource "aws_ecs_service" "app" {
  name            = "nbm-cloud"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs.id]
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "nbm-cloud"
    container_port   = 5000
  }
}
```

---

## Azure (Microsoft Azure)

### Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Front Door                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Application Gateway                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Container Apps                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Replica 1  │  │  Replica 2  │  │  Replica N  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
          │                                    │
┌─────────────────────┐          ┌─────────────────────┐
│  Azure Database     │          │   Blob Storage      │
│  for PostgreSQL     │          │                     │
└─────────────────────┘          └─────────────────────┘
```

### 1. Criar Resource Group

```bash
az group create --name nbm-cloud-rg --location eastus
```

### 2. Criar Azure Database for PostgreSQL

```bash
az postgres flexible-server create \
  --resource-group nbm-cloud-rg \
  --name nbm-cloud-db \
  --admin-user nbmadmin \
  --admin-password SUA_SENHA_SEGURA \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 15
```

### 3. Criar Container Registry

```bash
az acr create \
  --resource-group nbm-cloud-rg \
  --name nbmcloudacr \
  --sku Basic

# Login
az acr login --name nbmcloudacr

# Build e push
docker build -t nbmcloudacr.azurecr.io/nbm-cloud:latest .
docker push nbmcloudacr.azurecr.io/nbm-cloud:latest
```

### 4. Criar Container Apps

```bash
# Criar ambiente
az containerapp env create \
  --name nbm-cloud-env \
  --resource-group nbm-cloud-rg \
  --location eastus

# Deploy da aplicação
az containerapp create \
  --name nbm-cloud \
  --resource-group nbm-cloud-rg \
  --environment nbm-cloud-env \
  --image nbmcloudacr.azurecr.io/nbm-cloud:latest \
  --target-port 5000 \
  --ingress external \
  --registry-server nbmcloudacr.azurecr.io \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 5 \
  --secrets database-url="postgresql://..." session-secret="..." \
  --env-vars DATABASE_URL=secretref:database-url SESSION_SECRET=secretref:session-secret NODE_ENV=production
```

### 5. Bicep Template

```bicep
// main.bicep
param location string = resourceGroup().location
param appName string = 'nbm-cloud'

resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${appName}-env'
  location: location
  properties: {}
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 5000
      }
    }
    template: {
      containers: [
        {
          name: appName
          image: 'nbmcloudacr.azurecr.io/nbm-cloud:latest'
          resources: {
            cpu: json('1.0')
            memory: '2.0Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
      }
    }
  }
}
```

---

## Google Cloud Platform

### 1. Criar Projeto

```bash
gcloud projects create nbm-cloud-prod
gcloud config set project nbm-cloud-prod
```

### 2. Cloud SQL PostgreSQL

```bash
gcloud sql instances create nbm-cloud-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=us-central1

gcloud sql databases create nbmcloud --instance=nbm-cloud-db
gcloud sql users set-password postgres --instance=nbm-cloud-db --password=SUA_SENHA
```

### 3. Cloud Run

```bash
# Build com Cloud Build
gcloud builds submit --tag gcr.io/nbm-cloud-prod/nbm-cloud

# Deploy
gcloud run deploy nbm-cloud \
  --image gcr.io/nbm-cloud-prod/nbm-cloud \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=nbm-database-url:latest,SESSION_SECRET=nbm-session-secret:latest
```

---

## DigitalOcean

### 1. App Platform

```yaml
# .do/app.yaml
name: nbm-cloud
services:
  - name: web
    github:
      repo: seu-org/nbm-cloud
      branch: main
    build_command: npm run build
    run_command: node dist/index.cjs
    instance_size_slug: professional-xs
    instance_count: 2
    http_port: 5000
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
      - key: SESSION_SECRET
        scope: RUN_TIME
        type: SECRET

databases:
  - name: nbm-cloud-db
    engine: PG
    version: "15"
    size: db-s-1vcpu-1gb
    num_nodes: 1
```

### 2. Deploy via CLI

```bash
doctl apps create --spec .do/app.yaml
```

---

## Cloudflare

### Opção 1: Cloudflare Tunnel (Recomendado)

Para hospedar em servidor próprio com proteção Cloudflare:

```bash
# Instalar cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Autenticar
cloudflared tunnel login

# Criar tunnel
cloudflared tunnel create nbm-cloud

# Configurar
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: ~/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: nbm.seudominio.com
    service: http://localhost:5000
  - service: http_status:404
EOF

# Executar
cloudflared tunnel run nbm-cloud
```

### Opção 2: Cloudflare Pages (Frontend) + Workers (API)

Para aplicações mais complexas, separe frontend e backend:

```bash
# Frontend via Pages
npx wrangler pages deploy dist/public --project-name nbm-cloud-frontend
```

---

## Railway

### Deploy Rápido

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Iniciar projeto
railway init

# Adicionar PostgreSQL
railway add --plugin postgresql

# Deploy
railway up
```

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.cjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Render

### render.yaml

```yaml
services:
  - type: web
    name: nbm-cloud
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node dist/index.cjs
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: nbm-cloud-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true

databases:
  - name: nbm-cloud-db
    databaseName: nbmcloud
    plan: starter
```

---

## Configurações de Produção

### Dockerfile Otimizado

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar build
COPY --from=builder /app/dist ./dist

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "dist/index.cjs"]
```

### docker-compose.yml (Produção)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - DEFAULT_OBJECT_STORAGE_BUCKET_ID=${BUCKET_ID}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=nbmcloud
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=nbmcloud
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nbmcloud"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Monitoramento

### Health Check Endpoint

Adicione ao seu servidor:

```typescript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '17.0.0',
    uptime: process.uptime()
  });
});
```

### Métricas (Prometheus)

```typescript
import { collectDefaultMetrics, Registry } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Logs Estruturados

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});
```

---

## Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados PostgreSQL provisionado
- [ ] Object Storage configurado
- [ ] SSL/TLS habilitado
- [ ] Health checks funcionando
- [ ] Logs centralizados
- [ ] Backups de banco configurados
- [ ] Auto-scaling configurado
- [ ] Monitoramento ativo
- [ ] DNS configurado

---

**NBM CLOUD v17.0** - Deploy em Nuvem
