# NBM CLOUD v17.0 - Production Deployment Guide

## Requirements

- **OS**: Debian 13 (Trixie) or Ubuntu 22.04+
- **Node.js**: 20.x LTS
- **PostgreSQL**: 16.x
- **RAM**: Minimum 4GB (8GB recommended for 2000+ backups)
- **Disk**: 50GB+ for backups storage
- **Ports**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Quick Start

### 1. Download and run the installer

```bash
# Clone the repository
git clone https://github.com/MarcioVVitor/Backup-Master.git /opt/nbm-cloud
cd /opt/nbm-cloud

# Run the installer
sudo ./scripts/install-production.sh install
```

### 2. Configure the database connection

```bash
# Edit the environment file
sudo nano /opt/nbm-cloud/.env

# Update DATABASE_URL with your PostgreSQL credentials:
DATABASE_URL=postgresql://nbm_user:your_password@localhost:5432/nbm_cloud
```

### 3. Complete the installation

```bash
sudo ./scripts/install-production.sh install-continue
```

## PostgreSQL Setup

If you need to set up a local PostgreSQL database:

```bash
# Install PostgreSQL 16
sudo apt install postgresql-16 postgresql-contrib-16

# Create database and user
sudo -u postgres psql << EOF
CREATE USER nbm_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE nbm_cloud OWNER nbm_user;
GRANT ALL PRIVILEGES ON DATABASE nbm_cloud TO nbm_user;
EOF
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | - |
| `SESSION_SECRET` | Yes | Session encryption key (auto-generated) | - |
| `LOCAL_BACKUP_DIR` | No | Backup storage directory | `/opt/nbm/backups` |
| `PORT` | No | Application port | `5000` |
| `WORKER_POOL_CONCURRENCY` | No | Concurrent backup workers | `50` |
| `WORKER_TIMEOUT` | No | Backup timeout in ms | `600000` |
| `BATCH_SIZE` | No | Jobs per batch | `200` |

## Management Commands

### Application

```bash
# View status
sudo ./scripts/install-production.sh status

# View logs
pm2 logs nbm-cloud

# Restart application
pm2 restart nbm-cloud

# Monitor resources
pm2 monit
```

### Updates

```bash
# Quick update (recommended)
sudo ./scripts/quick-update.sh

# Full update with all checks
sudo ./scripts/install-production.sh update
```

### Rollback

```bash
# Rollback to previous version
sudo ./scripts/install-production.sh rollback

# Rollback to specific commit
sudo ./scripts/install-production.sh rollback abc1234
```

## SSL Configuration

### Using Let's Encrypt (recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### Manual SSL

1. Place your certificate at `/etc/ssl/certs/nbm-cloud.crt`
2. Place your private key at `/etc/ssl/private/nbm-cloud.key`
3. Edit `/etc/nginx/sites-available/nbm-cloud` and uncomment the SSL section
4. Reload Nginx: `sudo systemctl reload nginx`

## Firewall Rules

The installer configures UFW with these rules:

```bash
# View current rules
sudo ufw status

# Allow additional ports if needed
sudo ufw allow 8080/tcp
```

## Agent Installation

Install the backup agent on remote servers:

```bash
# On the agent server (143.255.197.26)
git clone https://github.com/MarcioVVitor/Backup-Master.git
cd Backup-Master/agents/linux
sudo ./install.sh

# Configure the agent
sudo nano /opt/nbm-agent/config.json

# Set the server URL:
{
  "server_url": "ws://143.255.197.25:5000/ws",
  "agent_key": "your-agent-key"
}

# Start the agent
sudo systemctl start nbm-agent
sudo systemctl enable nbm-agent
```

## Backup Storage

Backups are stored in `/opt/nbm/backups` organized by company:

```
/opt/nbm/backups/
├── company_1/
│   └── backups/
│       ├── equipment_1_2026-01-16.conf
│       └── equipment_2_2026-01-16.conf
├── company_2/
│   └── backups/
│       └── ...
```

### Disk Space Management

```bash
# Check disk usage
df -h /opt/nbm/backups

# Find large backup files
find /opt/nbm/backups -type f -size +10M -exec ls -lh {} \;

# Remove backups older than 90 days (example)
find /opt/nbm/backups -type f -name "*.conf" -mtime +90 -delete
```

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:5000/api/health
```

### Log Locations

- Application logs: `/var/log/nbm-cloud/`
- Nginx logs: `/var/log/nginx/`
- System logs: `journalctl -u nbm-cloud`

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Process list
pm2 list

# CPU/Memory usage
pm2 show nbm-cloud
```

## Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs nbm-cloud --lines 100

# Verify environment
cat /opt/nbm-cloud/.env

# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Database connection issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify credentials
psql -U nbm_user -h localhost -d nbm_cloud
```

### Port already in use

```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill if needed
sudo kill -9 <PID>
```

### Nginx issues

```bash
# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx

# View logs
tail -f /var/log/nginx/error.log
```

## Performance Tuning

### For high-volume deployments (2000+ backups)

```bash
# Edit .env
nano /opt/nbm-cloud/.env

# Increase concurrency
WORKER_POOL_CONCURRENCY=100
BATCH_SIZE=500
WORKER_TIMEOUT=900000
```

### PostgreSQL tuning

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/16/main/postgresql.conf

# Recommended settings for NBM CLOUD:
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_connections = 200
```

## Security Recommendations

1. **Use SSL/TLS**: Always enable HTTPS in production
2. **Strong passwords**: Use generated SESSION_SECRET and strong DB password
3. **Firewall**: Keep UFW enabled with minimal ports open
4. **Updates**: Regularly update system and NBM CLOUD
5. **Backups**: Configure off-site backup for the database
6. **Monitoring**: Set up alerts for disk space and service health

## Support

- Repository: https://github.com/MarcioVVitor/Backup-Master
- Issues: https://github.com/MarcioVVitor/Backup-Master/issues
