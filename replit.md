# NBM CLOUD v17.0 - Network Backup Management Cloud

## Overview

NBM CLOUD (Network Backup Management Cloud) is a multi-tenant web application for automated network equipment backup management with distributed architecture. The system allows users to register network devices (routers, switches, etc.) from 8 supported manufacturers (Mikrotik, Huawei, Cisco, Nokia, ZTE, Datacom, Datacom-DMOS, Juniper) and execute configuration backups via SSH/SFTP protocols. Backups are stored using cloud object storage and tracked in a PostgreSQL database.

### Multi-Tenant Architecture (v17.0)
- **Tenant Isolation**: Complete data separation between companies with SQL-level enforcement
- **Server Admin Mode**: NBM CLOUD Server admins can manage multiple companies
- **Capacity**: Optimized for 2000+ backups per company with composite database indexes
- **Security**: Cross-tenant access audit logging for server admin operations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with hot module replacement

The frontend follows a page-based structure under `client/src/pages/` with shared components in `client/src/components/`. Path aliases are configured (`@/` for client source, `@shared/` for shared code).

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for development, esbuild for production bundling
- **API Design**: RESTful JSON APIs under `/api/` prefix
- **File Uploads**: Multer for multipart form handling

The server uses a modular structure with routes registered in `server/routes.ts` and database operations abstracted through a storage layer (`server/storage.ts`).

### Authentication
- **Provider**: Replit OpenID Connect (OIDC) authentication
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Implementation**: Passport.js with OpenID Client strategy
- **Location**: `server/replit_integrations/auth/`

Users authenticate via Replit accounts. The `isAuthenticated` middleware protects API routes.

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client/server)
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync
- **Connection**: pg Pool with DATABASE_URL environment variable

Key tables:
- `companies` - Multi-tenant company/organization records
- `users` - User accounts linked to Replit IDs
- `user_companies` - User-company associations with roles
- `server_admins` - NBM CLOUD Server administrators
- `sessions` - Session storage for authentication
- `equipment` - Network device records (name, IP, credentials, manufacturer) with company isolation
- `files` - Backup file metadata with object storage references and company isolation
- `backup_history` - Backup execution logs with status tracking
- `backup_policies` - Automated backup scheduling policies with frequency rules
- `backup_policy_runs` - Execution history for scheduled backup policies
- `agents` - Remote proxy agents for distributed backup execution
- `vendor_scripts` - Backup/update scripts per manufacturer

### Database Performance Indexes (v17.0)
Composite indexes optimized for multi-tenant high-volume queries:
- `idx_files_company_created` - Fast backup listing per company
- `idx_backup_history_company_executed` - Efficient history queries
- `idx_equipment_company` - Quick equipment filtering by tenant
- `idx_agents_company` - Agent lookup by company
- `idx_backup_policies_company` - Policy management per tenant

### Object Storage
- **Provider**: Google Cloud Storage via Replit's sidecar service
- **Implementation**: `server/replit_integrations/object_storage/`
- **Upload Flow**: Presigned URL pattern - client requests URL, uploads directly to storage
- **Access Control**: Custom ACL policy system stored in object metadata

### Build System
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: 
  - Frontend: Vite builds to `dist/public/`
  - Backend: esbuild bundles to `dist/index.cjs` with selected dependencies inlined
- **Build Script**: `script/build.ts` handles both frontend and backend builds

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Secret for session encryption (required for auth)
- `ISSUER_URL` - OpenID Connect issuer URL (defaults to Replit)
- `REPL_ID` - Replit environment identifier

### Third-Party Services
- **PostgreSQL Database** - Primary data store (Replit provisioned)
- **Google Cloud Storage** - Object storage for backup files (via Replit sidecar at 127.0.0.1:1106)
- **Replit OIDC** - Authentication provider

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `passport` / `openid-client` - Authentication
- `@google-cloud/storage` - Object storage client
- `@tanstack/react-query` - Client-side data fetching
- `@uppy/core` / `@uppy/aws-s3` - File upload handling
- `express` / `express-session` - Web server and sessions

## Linux Agent

### Agent Location
- **Path**: `agents/linux/`
- **Main Script**: `nbm-agent.sh` - Main agent script with WebSocket support
- **Installer**: `install.sh` - Automated installation script
- **Uninstaller**: `uninstall.sh` - Clean removal script

### Agent Features
- WebSocket connection to NBM CLOUD server
- SSH/Telnet backup execution for network equipment
- Remote terminal access (admin-only)
- System diagnostics reporting
- Self-update from GitHub repository
- Automatic reconnection on disconnect

### Agent Installation
```bash
# Clone repository and run installer
git clone https://github.com/YOUR_USERNAME/nbm-agent.git
cd nbm-agent/agents/linux
sudo ./install.sh
```

### Agent Configuration
- Config file: `/opt/nbm-agent/config.json`
- Log file: `/opt/nbm-agent/logs/agent.log`
- Systemd service: `nbm-agent`

### Agent Commands
- `systemctl status nbm-agent` - Check status
- `systemctl restart nbm-agent` - Restart agent
- `/opt/nbm-agent/nbm-agent.sh update` - Update from GitHub
- `/opt/nbm-agent/nbm-agent.sh diagnostics` - Show diagnostics

## Standalone Mode (Production Deployment)

### Overview
NBM CLOUD supports standalone mode for production deployment on Linux servers without Replit dependencies.

### Detection
- **Replit Mode**: When `REPL_ID` environment variable is present
- **Standalone Mode**: When `REPL_ID` is not set

### Authentication in Standalone Mode
- **Implementation**: `server/standalone-auth.ts`
- **Session Storage**: PostgreSQL using `connect-pg-simple`
- **Password Hashing**: PBKDF2 with SHA-512
- **Cookies**: HTTP-only, SameSite=Lax, Secure=false (for reverse proxy)
- **First User**: Automatically becomes admin

### Backup Storage in Standalone Mode
- **Local Storage**: `server/local-storage.ts`
- **Default Directory**: `/opt/nbm/backups` (configurable via `LOCAL_BACKUP_DIR`)
- **Company Isolation**: Files stored in `company_{id}/backups/` subdirectories

### High-Capacity Backup System
- **Worker Pool**: 50 concurrent backup jobs (configurable up to 100)
- **Timeout**: 10 minutes per backup (5 min execution + 5 min buffer)
- **Retry**: 3 attempts with 10-second delay
- **Batch Processing**: Up to 200 jobs per batch

### Production Deployment Commands
```bash
# Initial setup
cd /opt/nbm-cloud
git pull origin main
npm install
npm run build
npm run db:push

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save

# Apply updates
cd /opt/nbm-cloud && git pull origin main && npm run build && pm2 restart nbm-cloud --update-env

# View logs
pm2 logs nbm-cloud
```

### Environment Variables for Standalone
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `LOCAL_BACKUP_DIR` - Custom backup directory (default: /opt/nbm/backups)
- `PORT` - Server port (default: 5000)

## Recent Changes (January 2026)

### Credential Management System (v17.0)
- **Similar to Termius**: Complete credential management system for reusing saved passwords across equipment
- **Credential Groups**: Organize credentials by categories (data centers, regions, etc.)
- **Credential Storage**: Save username, password, enable password with manufacturer/model filters
- **Security**: Passwords always masked as "••••••••" in responses; /api/credentials/:id/reveal requires admin role
- **Equipment Integration**: Toggle between saved credentials or manual entry in equipment forms
- **Manufacturer Filtering**: Credentials filtered by selected manufacturer in equipment form
- **Multi-tenant**: Complete company isolation for all credential operations

### Database Tables Added
- `credential_groups` - Groups for organizing credentials (id, companyId, name, description)
- `credentials` - Saved credentials (id, companyId, groupId, name, username, password, enablePassword, manufacturer, model, description)
- `equipment.credentialId` - Optional reference to saved credential

### Session Fix for Standalone Authentication
- Added explicit `req.session.save()` before responding to login/register
- Fixed cookie persistence with `secure: false` and `sameSite: "lax"` for HTTP

### Cache Invalidation on Login
- Frontend now invalidates both `/api/auth/user` and `/api/server/check-admin` queries after login
- Ensures Super Admin status is immediately reflected after login

### Improved Backup Logging
- Detailed logging for WebSocket backup_result handling
- Logging for local storage file operations
- Progress tracking for scheduled backup execution

### Increased Backup Timeout
- Changed from 2 minutes to 10 minutes total timeout
- Better handling of large configuration backups (Huawei, Nokia, Juniper)

### Worker Pool Optimization
- Increased default concurrency from 10 to 50
- Larger batch size (200 jobs)
- Optimized for processing 2000+ backups per company

### Dashboard Enhancements
- Pie chart showing equipment distribution by manufacturer
- Agent status section with online/offline indicators
- Additional metrics: backups today, average duration
- Success/failure trend visualization with AreaChart
- Expanded history table with manufacturer and duration columns

### Firmware Upload Improvements
- Added model field to firmware upload form
- Grid layout for manufacturer and model inputs
- Backend support for optional model parameter

### Remote Agent Administration (v17.0)
- **Server Control**: Reboot and shutdown server remotely via WebSocket
- **Service Control**: Restart NBM Agent service, check status, restart agent process
- **Quick Commands**: Execute common diagnostics (df -h, free -h, uptime, ip addr) with one click
- **Security**: Admin-only routes with confirmation dialogs for destructive actions
- **API Endpoint**: POST /api/agents/:id/admin with actions: reboot, shutdown, restart_service, restart_agent, service_status
- **Timeout Handling**: 10s for reboot/shutdown (expected disconnect), 30s for other commands
- **Console Button**: Quick access to agent console from agents list page (online agents only)

### Interactive Terminal with xterm.js (v17.0)
- **Component**: `client/src/components/xterm-terminal.tsx`
- **Library**: @xterm/xterm with FitAddon and WebLinksAddon
- **Theme**: Tokyo Night professional dark theme
- **Features**:
  - Command history navigation with arrow keys (↑/↓)
  - Local commands: clear, help, exit
  - Execute Linux commands on remote agent server
  - Professional prompt with agent name
- **Architecture**: Commands sent via REST API POST to `/api/agents/:id/terminal`
- **Agent Handler**: WebSocket message type `terminal_command` processed by agent
- **Security**: Admin-only access, tenant-isolated

### Backup Archiving System (v17.0)
- **Manual Archiving**: Archive/unarchive individual or bulk backups via UI
- **Archive Policies**: Automatic archiving based on configurable criteria
  - **Age-based**: Archive backups older than X days
  - **Count-based**: Keep only N most recent backups per equipment
  - **Filters**: Filter by manufacturer, model, or equipment name pattern
  - **Auto-delete**: Optionally delete archived backups after configurable period
- **UI Features**:
  - Toggle between active/archived backups view
  - Archive/restore buttons on cards, list items, and table rows
  - Bulk archive with confirmation dialog
  - Visual indicators for archived count
- **API Endpoints**:
  - `POST /api/backups/:id/archive` - Archive single backup
  - `POST /api/backups/:id/unarchive` - Restore single backup
  - `POST /api/backups/archive-bulk` - Archive multiple backups
  - `GET /api/backups/archived` - List archived backups
  - `GET/POST/PATCH/DELETE /api/archive-policies` - Manage archive policies
- **Scheduler**: Archive policies checked hourly
- **Database**: `archived`, `archivedAt`, `archivedBy` fields on files table; `archivePolicies` table for policy configuration