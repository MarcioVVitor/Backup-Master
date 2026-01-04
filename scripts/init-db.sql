-- NBM CLOUD v17.0 - Script de Inicialização do Banco de Dados
-- Este script é executado automaticamente pelo Docker Compose

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configurações de performance
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';

-- Log de inicialização
DO $$
BEGIN
  RAISE NOTICE 'NBM CLOUD Database initialized successfully';
END
$$;
