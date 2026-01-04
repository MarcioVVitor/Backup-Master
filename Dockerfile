# NBM CLOUD v17.0 - Dockerfile
# Multi-stage build para produção

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema para build
RUN apk add --no-cache python3 make g++

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar todas as dependências (incluindo dev)
RUN npm ci

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Instalar dependências do sistema necessárias em runtime
RUN apk add --no-cache \
    openssh-client \
    curl \
    && rm -rf /var/cache/apk/*

# Copiar apenas package.json para instalação de produção
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar build do stage anterior
COPY --from=builder /app/dist ./dist

# Copiar arquivos estáticos e configurações necessárias
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nbmcloud -u 1001 -G nodejs

# Criar diretórios necessários
RUN mkdir -p /app/logs /app/cache && \
    chown -R nbmcloud:nodejs /app

# Trocar para usuário não-root
USER nbmcloud

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Expor porta
EXPOSE 5000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=5000
ENV LOG_LEVEL=info

# Comando de inicialização
CMD ["node", "dist/index.cjs"]
