# NBM CLOUD v17.0 - Documentação

## Network Backup Management Cloud

Sistema multi-tenant para gerenciamento automatizado de backups de equipamentos de rede.

---

## Documentação Disponível

| Documento | Descrição |
|-----------|-----------|
| [Manual de Operação](./MANUAL_OPERACAO.md) | Guia completo de uso do sistema |
| [Instalação de Proxy](./INSTALL_PROXY.md) | Como instalar e configurar agentes remotos |
| [Deploy em Nuvem](./DEPLOY_CLOUD.md) | Deploy em AWS, Azure, GCP, DigitalOcean e outros |

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

## Fabricantes Suportados

| Fabricante | Protocolos | Backup | Firmware Update |
|------------|-----------|--------|-----------------|
| Mikrotik | SSH | Sim | Sim |
| Huawei | SSH/Telnet | Sim | Sim |
| Cisco | SSH/Telnet | Sim | Sim |
| Nokia | SSH | Sim | Sim |
| ZTE | SSH/Telnet | Sim | Sim |
| Datacom | SSH | Sim | Sim |
| Datacom DMOS | SSH | Sim | Sim |
| Juniper | SSH | Sim | Sim |

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

## Suporte

Para suporte técnico, consulte a documentação ou entre em contato com o administrador do sistema.

---

**NBM CLOUD v17.0** - Todos os direitos reservados
