# NBM CLOUD v17.0

![NBM CLOUD](https://img.shields.io/badge/version-17.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D13-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Network Backup Management Cloud

Sistema multi-tenant para gerenciamento automatizado de backups de equipamentos de rede.

---

## Funcionalidades Principais

- **Multi-Tenant**: Isolamento completo de dados entre empresas
- **8 Fabricantes Suportados**: Mikrotik, Huawei, Cisco, Nokia, ZTE, Datacom, Datacom-DMOS, Juniper
- **Backup Automatizado**: Agendamento flexível com políticas personalizadas
- **Atualização de Firmware**: Gerenciamento centralizado de atualizações
- **Terminal SSH**: Acesso direto aos equipamentos via navegador
- **Agentes Remotos**: Proxies para redes isoladas
- **Alta Performance**: Otimizado para 2000+ backups por empresa

---

## Fabricantes Suportados

| Fabricante | Protocolos | Backup | Firmware Update |
|------------|-----------|--------|-----------------|
| Mikrotik | SSH | ✓ | ✓ |
| Huawei | SSH/Telnet | ✓ | ✓ |
| Cisco | SSH/Telnet | ✓ | ✓ |
| Nokia | SSH | ✓ | ✓ |
| ZTE | SSH/Telnet | ✓ | ✓ |
| Datacom | SSH | ✓ | ✓ |
| Datacom DMOS | SSH | ✓ | ✓ |
| Juniper | SSH | ✓ | ✓ |

---

## Início Rápido

### Requisitos

- Node.js 18+
- PostgreSQL 13+
- Object Storage (S3 compatível)

### Instalação Local

```bash
# Clonar repositório
git clone https://github.com/MarcioVVitor/nbm-cloud.git
cd nbm-cloud

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Edite .env com suas configurações

# Executar migrações
npm run db:push

# Iniciar em desenvolvimento
npm run dev
```

### Deploy com Docker

```bash
# Build e execução
docker-compose up -d

# Verificar logs
docker-compose logs -f app
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        NBM CLOUD                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite)  │  Backend (Express + Node.js)    │
├─────────────────────────────────────────────────────────────┤
│            PostgreSQL            │      Object Storage       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Agente  │    │ Agente  │    │ Agente  │
         │ (Proxy) │    │ (Proxy) │    │ (Proxy) │
         └────┬────┘    └────┬────┘    └────┬────┘
              │               │               │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │ Rede A  │    │ Rede B  │    │ Rede C  │
         │ Devices │    │ Devices │    │ Devices │
         └─────────┘    └─────────┘    └─────────┘
```

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [Manual de Operação](./docs/MANUAL_OPERACAO.md) | Guia completo de uso do sistema |
| [Instalação de Proxy](./docs/INSTALL_PROXY.md) | Como instalar e configurar agentes remotos |
| [Deploy em Nuvem](./docs/DEPLOY_CLOUD.md) | Deploy em AWS, Azure, GCP, DigitalOcean e outros |

---

## Stack Tecnológica

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TanStack React Query
- Tailwind CSS + shadcn/ui
- Wouter (routing)

### Backend
- Node.js + Express
- Drizzle ORM
- PostgreSQL
- Passport.js (autenticação)

### Infraestrutura
- Docker + Docker Compose
- GitHub Actions CI/CD
- Object Storage (S3 compatível)

---

## Deploy em Produção

O sistema pode ser deployado em:

- **AWS**: ECS Fargate + RDS + S3
- **Azure**: Container Apps + Azure Database + Blob Storage
- **GCP**: Cloud Run + Cloud SQL + Cloud Storage
- **DigitalOcean**: App Platform + Managed Database + Spaces
- **Railway**: Container deploy + PostgreSQL plugin
- **Render**: Web Service + PostgreSQL
- **Cloudflare**: Workers + D1 + R2

Consulte o [Manual de Deploy](./docs/DEPLOY_CLOUD.md) para instruções detalhadas.

---

## Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:5432/nbmcloud

# Sessão
SESSION_SECRET=sua-chave-secreta-segura

# Object Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID=seu-bucket-id

# Ambiente
NODE_ENV=production
PORT=5000
```

---

## Licença

MIT License - Veja [LICENSE](./LICENSE) para detalhes.

---

## Suporte

Para suporte técnico, consulte a documentação ou abra uma issue no GitHub.

---

**NBM CLOUD v17.0** - Network Backup Management Cloud
