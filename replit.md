# NBM CLOUD - Network Backup Manager Cloud

## Overview

NBM CLOUD (Network Backup Manager Cloud) is a web application for automated network equipment backup management with distributed architecture. The system allows users to register network devices (routers, switches, etc.) from various manufacturers (Huawei, Mikrotik, Cisco, Nokia, ZTE, Datacom, Juniper) and execute configuration backups via SSH/SFTP protocols. Backups are stored using cloud object storage and tracked in a PostgreSQL database.

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
- `users` - User accounts linked to Replit IDs
- `sessions` - Session storage for authentication
- `equipment` - Network device records (name, IP, credentials, manufacturer)
- `files` - Backup file metadata with object storage references
- `backup_policies` - Automated backup scheduling policies with frequency rules
- `backup_policy_runs` - Execution history for scheduled backup policies

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