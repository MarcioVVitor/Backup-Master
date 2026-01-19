#!/bin/bash
# NBM Cloud v17.0 Bootstrap Installer for Debian 13
set -e

echo "=== NBM Cloud v17.0 Bootstrap Installer ==="
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./bootstrap-nbm.sh"
    exit 1
fi

INSTALL_DIR="/opt/nbm-cloud"
BACKUP_DIR="/opt/nbm/backups"

echo "[1/7] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BACKUP_DIR"

echo "[2/7] Installing system dependencies..."
apt-get update
apt-get install -y curl wget git ca-certificates gnupg

echo "[3/7] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"

echo "[4/7] Installing PostgreSQL 16..."
if ! command -v psql &> /dev/null; then
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update
    apt-get install -y postgresql-16 postgresql-contrib-16
    systemctl enable postgresql
    systemctl start postgresql
fi
echo "PostgreSQL: $(psql --version)"

echo "[5/7] Installing PM2..."
npm install -g pm2

echo "[6/7] Creating PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER nbmcloud WITH PASSWORD 'nbmcloud123';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE nbmcloud OWNER nbmcloud;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nbmcloud TO nbmcloud;" 2>/dev/null || true

echo "[7/7] Creating environment file..."
cat > "$INSTALL_DIR/.env" << 'EOF'
DATABASE_URL=postgresql://nbmcloud:nbmcloud123@localhost:5432/nbmcloud
SESSION_SECRET=nbm-cloud-session-secret-change-me-in-production
LOCAL_BACKUP_DIR=/opt/nbm/backups
PORT=5000
EOF

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Next steps:"
echo "1. Copy NBM Cloud source to $INSTALL_DIR"
echo "2. cd $INSTALL_DIR"
echo "3. npm install"
echo "4. npm run build"
echo "5. npm run db:push"
echo "6. pm2 start ecosystem.config.cjs"
echo "7. pm2 save && pm2 startup"
echo ""
echo "Database: postgresql://nbmcloud:nbmcloud123@localhost:5432/nbmcloud"
