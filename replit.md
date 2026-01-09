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