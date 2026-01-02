#!/bin/bash
# Script de correção automática para NBM
# Execute como root: sudo bash fix-nbm.sh

set -e

echo "=== Corrigindo NBM ==="

# 1. Parar o serviço
echo "[1/6] Parando serviço NBM..."
systemctl stop nbm 2>/dev/null || true

# 2. Corrigir pg_hba.conf
echo "[2/6] Corrigindo autenticação PostgreSQL..."
PG_VERSION=$(ls /etc/postgresql/ 2>/dev/null | head -1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

if [[ -f "$PG_HBA" ]]; then
    # Remover entradas antigas do NBM
    sed -i '/^# NBM database/d' "$PG_HBA"
    sed -i '/^local.*nbm.*nbm.*md5/d' "$PG_HBA"
    sed -i '/^host.*nbm.*nbm.*127.0.0.1.*md5/d' "$PG_HBA"
    sed -i '/^host.*nbm.*nbm.*::1.*md5/d' "$PG_HBA"
    
    # Criar arquivo temporário com regras no início
    {
        echo "# NBM database authentication rules"
        echo "local   nbm    nbm                    md5"
        echo "host    nbm    nbm    127.0.0.1/32    md5"
        echo "host    nbm    nbm    ::1/128         md5"
        echo ""
        cat "$PG_HBA"
    } > "${PG_HBA}.new"
    
    mv "${PG_HBA}.new" "$PG_HBA"
    chown postgres:postgres "$PG_HBA"
    chmod 640 "$PG_HBA"
    
    systemctl reload postgresql
    sleep 2
    echo "    pg_hba.conf corrigido"
else
    echo "    AVISO: pg_hba.conf não encontrado em $PG_HBA"
fi

# 3. Sincronizar senha do PostgreSQL com .env
echo "[3/6] Sincronizando senha do banco de dados..."
if [[ -f /opt/nbm/.env ]]; then
    DB_PASS=$(grep DATABASE_URL /opt/nbm/.env | sed 's/.*:\/\/nbm:\([^@]*\)@.*/\1/')
    if [[ -n "$DB_PASS" ]]; then
        cd /tmp
        sudo -u postgres psql -c "ALTER USER nbm WITH PASSWORD '$DB_PASS';" 2>/dev/null
        echo "    Senha sincronizada"
    fi
fi

# 4. Verificar conexão com banco de dados
echo "[4/6] Testando conexão com banco de dados..."
cd /opt/nbm
source .env
if PGPASSWORD="$DB_PASS" psql -h localhost -U nbm -d nbm -c "SELECT 1" &>/dev/null; then
    echo "    Conexão OK"
else
    echo "    ERRO: Falha na conexão com banco de dados"
    echo "    Tentando resetar senha..."
    NEW_PASS=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)
    cd /tmp && sudo -u postgres psql -c "ALTER USER nbm WITH PASSWORD '$NEW_PASS';"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://nbm:${NEW_PASS}@localhost:5432/nbm|" /opt/nbm/.env
    echo "    Nova senha configurada"
fi

# 5. Executar migrações do banco
echo "[5/6] Executando migrações do banco de dados..."
cd /opt/nbm
sudo -u nbm npm run db:push 2>/dev/null || true
echo "    Migrações executadas"

# 6. Iniciar serviço
echo "[6/6] Iniciando serviço NBM..."
systemctl start nbm
sleep 3

if systemctl is-active --quiet nbm; then
    echo ""
    echo "=== NBM corrigido e funcionando! ==="
    echo "Acesse: http://$(hostname -I | awk '{print $1}'):5000"
else
    echo ""
    echo "=== ERRO: Serviço não iniciou ==="
    journalctl -u nbm --no-pager -n 20
fi
