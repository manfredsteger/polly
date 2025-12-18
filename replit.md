# KITA Poll System

## Overview
KITA Poll is a modern polling and scheduling application designed for Kindergarten (KITA) teams in Bavaria, Germany. It enables users to create and manage polls for schedule coordination, surveys, and organization/slot booking, supporting both anonymous and authenticated voting. The application features a clean, responsive design and is fully localized for German users.

**Key Capabilities:**
- Streamlined poll creation with three types: Terminumfragen (Schedule), Umfragen (Survey), Orga-Listen (Organization/Booking)
- Intuitive voting with email-based vote editing links
- Robust administration tools with data export (CSV, PDF)
- QR code sharing for easy poll distribution
- Comprehensive branding/customization via admin panel

## User Preferences
Preferred communication style: Simple, everyday language (German).

## System Architecture

### Full-Stack Architecture
-   **Runtime**: Node.js 22 LTS (EOL: April 2027)
-   **Frontend**: React 18 with TypeScript, Vite, Shadcn/ui (Radix UI) + Tailwind CSS, TanStack Query v5, Wouter
-   **Backend**: Express.js server with TypeScript
-   **Database**: PostgreSQL with Drizzle ORM

### Project Structure
The project is organized into `client/` (React frontend), `server/` (Express backend), and `shared/` (shared TypeScript types).

### Key Features
- **Poll Types**: Terminumfrage (Schedule), Umfrage (Survey), Orga-Liste (Organization).
- **Vote Control**: One vote per user, configurable vote editing, and unique edit links for guests.
- **Results Visibility**: Configurable public/private results per poll - creators can choose whether all participants can see results or only the creator (defaults to public).
- **Authentication**: Anonymous token-based access, local email/password login with strong password requirements, and optional Keycloak OIDC integration with role-based access (user, admin, manager).
- **Results & Analytics**: Matrix view of results, best option highlighting, and CSV/PDF export with QR codes.
- **Poll Editing**: Creators can edit poll titles, descriptions, and options (add/update/delete) after creation, with warnings when existing votes may be affected.
- **Customization**: Admin panel for theme colors, site name, logo upload, footer text, and dark mode default settings.
- **API Versioning**: All API endpoints are versioned under `/api/v1/`, with automatic 308 redirects from legacy `/api/*` paths.
- **Mobile Integration**: API prepared for native Flutter integration with bearer token authentication and mobile-optimized theming endpoints.
- **Notification System**: Configurable email reminders with automatic expiry notifications and manual "remind participants" button. Guest accounts have strict rate limiting to prevent spam abuse.
- **Profile Security**: Secure password reset flow with email confirmation links, email change with token verification, and differentiated security settings for OIDC vs local users.
- **Live Voting**: Real-time vote tracking via WebSocket with fullscreen presentation mode for trainings and meetings.
- **Admin User Management**: Manual user creation and profile editing for local accounts.

### Live Voting System
- **WebSocket Server**: Real-time communication via `/ws/live-voting` endpoint
- **Live Presence**: Track who is currently on the voting page
- **In-Progress Votes**: Show votes being made in real-time with gray/italic styling
- **Fullscreen Presentation Mode**: Click fullscreen button or press Ctrl+F to present on projector/beamer
- **Auto-Refresh**: Results automatically refresh when votes are finalized
- **All Poll Types**: Works with Terminumfragen, Umfragen, and Orga-Listen

### Notification System
- **Expiry Reminders**: Optional automatic reminders sent before poll expiry (configurable hours before deadline)
- **Manual Reminders**: Poll creators can manually send reminder emails to all participants via "Teilnehmer erinnern" button
- **Spam Protection**: 
  - Configurable limits per poll (guests: 0-10, users: 1-20 reminders)
  - Cooldown period between reminders (10-1440 minutes)
  - Global enable/disable switches in admin panel
  - Backend enforcement prevents abuse regardless of frontend
- **Admin Settings**: Located in Admin Panel > Einstellungen > Benachrichtigungen

### Profile Security
- **Password Change**: Local users can change their password from the profile page (requires current password)
- **Email Change**: Local users can change their email with a token-based confirmation flow
- **Password Reset**: Forgot password flow with email-based reset link (1-hour expiry)
- **OIDC Users**: Redirected to Keycloak account management for password/email changes
- **Token Tables**: `password_reset_tokens` and `email_change_tokens` tables with automatic cleanup of expired tokens

### ClamAV Virus Scanner Integration
- **Security Compliance**: All file uploads are scanned BEFORE persistence (government pentest requirement)
- **Upload Flow**: User uploads → ClamAV scans in memory → Only clean files are saved to disk
- **Memory Storage**: Uses multer.memoryStorage to prevent infected files from ever touching disk
- **Admin Configuration**: Located in Admin Panel > Einstellungen > Sicherheit
  - Enable/disable toggle
  - ClamAV host and port configuration
  - Timeout and max file size settings
  - Connection test button
- **Service**: `server/services/clamavService.ts` - TCP connection to clamd using INSTREAM protocol
- **API Endpoints**: `/api/v1/admin/clamav` (GET/PUT), `/api/v1/admin/clamav/test` (POST)

### npm Audit Security Scanning
- **Purpose**: Detect known security vulnerabilities in npm dependencies
- **Technology**: Local `npm audit --json` execution (no external API dependencies)
- **Features**:
  - Severity levels: Critical, High, Moderate, Low, Info
  - CVE links to vulnerability details
  - Affected version ranges and patched versions
  - Direct vs transitive dependency distinction
  - **Impact Labels**: Each vulnerability shows where it affects the system:
    - `Nur Entwicklung` (gray) - Only affects development, not production
    - `Backend` (purple) - Affects server-side code
    - `Frontend` (blue) - Affects client-side code
    - `Frontend & Backend` (indigo) - Affects both
- **Caching**: 6 hours to reduce overhead
- **Admin UI**: Located in Admin Dashboard > Übersicht > Sicherheitslücken (below System-Komponenten)
- **Service**: `server/services/npmAuditService.ts`
- **API Endpoint**: `GET /api/v1/admin/vulnerabilities`

### System Package Monitoring (Nix)
- **Purpose**: Display all system-level dependencies from Replit/Nix environment
- **Features**:
  - Lists all Nix packages from .replit config
  - Shows Nix channel version (e.g., stable-24_05)
  - Displays purpose/usage for each package (e.g., "PDF-Export (Puppeteer)")
  - Version detection for major packages (Node.js, PostgreSQL, Chromium)
- **Caching**: 24 hours
- **Admin UI**: Located in Admin Dashboard > Übersicht > System-Packages (Nix)
- **Service**: `server/services/systemPackageService.ts`
- **API Endpoint**: `GET /api/v1/admin/system-packages`

### Pentest-Tools.com Integration
- **Security Scanning**: Automated vulnerability scanning via Pentest-Tools.com Pro API
- **Features**:
  - Start scans with multiple tools (Website Scanner, SQLi, XSS, Port Scanner, etc.)
  - View scan progress and results in real-time
  - Review security findings with severity levels and remediation guidance
- **Dual-Source Token Configuration**:
  - ENV variable `PENTEST_TOOLS_API_TOKEN` takes precedence (recommended for production)
  - Database storage via Admin Panel as fallback (for open-source deployments without server access)
  - Admin UI shows locked token input when ENV is configured, editable form otherwise
- **Admin UI**: Located in Admin Panel > Einstellungen > Integrationen > Pentest-Tools.com
- **Service**: `server/services/pentestToolsService.ts` - REST API client with config caching
- **API Endpoints**: `/api/v1/admin/pentest-tools/*` (all secured with requireAdmin)

### PDF Export
- **Technology**: Puppeteer (Headless Chrome) for professional HTML/CSS-based PDF generation
- **Features**: Colored vote bars, best option highlighting, clean A4 layout with print optimization
- **Service**: `server/services/pdfService.ts` - Dynamic Chromium detection with error recovery
- **API Endpoint**: `GET /api/v1/polls/:token/export/pdf`
- **System Dependencies**: chromium and related X11/graphics libraries installed via Nix

### Timezone Handling
- Schedule poll times are stored in UTC in the database
- Frontend displays times in the user's local timezone using `formatLocalDateTime`
- When editing/saving, local times are converted to UTC ISO strings via `localToISOString` before server submission
- This ensures consistent behavior regardless of client/server timezone configuration

### Core Tables
- `polls`: Poll definitions (includes `isTestData` flag for test isolation)
- `poll_options`: Options for each poll
- `votes`: Individual votes
- `users`: Registered user accounts (includes `isTestData` flag for test isolation)
- `sessions`: Express session storage
- `system_settings`: Admin configuration

### Test Data Isolation
- **Purpose**: Prevent test data from polluting production statistics and ensure test accounts cannot be used for actual login
- **Flags**: `isTestData` boolean column on `users` and `polls` tables (defaults to false)
- **Test Mode**: Test runner sets `X-Test-Mode` header which marks all created data as test data
- **Login Blocking**: Test accounts (isTestData=true) are blocked from authenticating in `authService.localLogin`
- **Statistics Exclusion**: Dashboard stats (`getSystemStats`, `getExtendedStats`) exclude test data from all counts and recent activity
- **Purge Functionality**: Admin can view and delete all test data via Admin Panel > Tests > Testdaten-Verwaltung
- **API Endpoints**: 
  - `GET /api/v1/admin/tests/data-stats` - Get counts of test polls, options, votes, users
  - `DELETE /api/v1/admin/tests/purge-data` - Remove all test data from database

## Deployment

### Cloud-Independent Architecture
- **No Cloud Dependencies**: Application runs 100% self-hosted without any cloud service requirements
- **Database**: Standard PostgreSQL via `pg` driver (not serverless/Neon)
- **URL Configuration**: `BASE_URL` environment variable for all email links and QR codes
- **System Packages**: `SYSTEM_PACKAGES.json` manifest for production (auto-generated from .replit in dev)

### Docker Quick Start
```bash
docker compose up -d
# Opens at http://localhost:5000
```

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `BASE_URL`: Public URL (e.g., `https://poll.kita.bayern`)
- `SESSION_SECRET`: 32+ character random string

See `PRODUCTION-SETUP.md` for complete deployment documentation.

## External Dependencies

-   **PostgreSQL**: Primary database for all application data (standard driver, not serverless).
-   **Keycloak OIDC**: Optional OpenID Connect provider for enterprise SSO and role management.
-   **SMTP Service**: For sending email confirmations and vote editing links.
-   **Chromium**: Required for PDF export (Puppeteer) - included in Docker image.