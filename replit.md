# Polly - Open-Source Polling System

## Overview
Polly is an open-source, full-stack polling and scheduling platform designed for teams. It facilitates the creation and management of various poll types, including schedule coordination, surveys, and booking (Orga-Listen). The system supports both anonymous and authenticated voting, features a responsive design, and is localized for German users. Its core purpose is to provide a self-hosted, cloud-independent solution for team coordination and data collection.

## User Preferences
- **Communication**: Simple, everyday language (German).
- **Git Commits**: Aussagekräftige, beschreibende Commit-Nachrichten auf Englisch (kein "saved progress"). Format: Kurzer Titel + optionale Details zu den Änderungen.

## System Architecture

### Full-Stack Architecture
-   **Runtime**: Node.js 22 LTS
-   **Frontend**: React 18 with TypeScript, Vite, Shadcn/ui (Radix UI) + Tailwind CSS, TanStack Query v5, Wouter
-   **Backend**: Express.js server with TypeScript
-   **Database**: PostgreSQL with Drizzle ORM
-   **API Routing**: Modular structure in `server/routes/` with endpoints for admin, authentication, polls, votes, users, system, export, and common utilities.

### Key Features
- **Poll Types**: Terminumfrage (Schedule), Umfrage (Survey), Orga-Liste (Organization/Booking).
- **Vote Management**: Configurable vote editing, unique edit links, and results visibility.
- **Authentication**: Anonymous token-based, local email/password, and optional Keycloak OIDC with role-based access.
- **Data Export**: CSV and PDF export of results, including QR code sharing for polls.
- **Customization**: Admin panel for branding (theme, logo, site name) and dark mode settings.
- **Multi-Language Support**: German (de) and English (en) with automatic browser detection and per-user preference storage.
- **API Versioning**: `/api/v1/` endpoints.
- **Notification System**: Configurable email reminders with spam protection and rate limiting.
- **Profile Security**: Secure password reset, email change, and GDPR-compliant account deletion request flow.
- **Live Voting**: Real-time vote tracking via WebSocket with fullscreen presentation mode.
- **AI Auto-Enable**: AI chat is automatically enabled if `AI_API_KEY` is set unless explicitly disabled by admin.
- **Voice Input (AI Chat)**: Microphone button records audio, transcodes to text via Whisper API, and inserts into chat.
- **Admin Tools**: User management, email template customization, security scanning integration, and system package monitoring.
- **Calendar Integration**: ICS export and webcal:// subscription for schedule polls.
- **Test Data Isolation**: `isTestData` flags for development and purging, with specific API header for test mode.
- **Real-Time Slot Reservation (Orga-Listen)**: Uses transactional locking and advisory locks with WebSocket updates for capacity management.

### Technical Implementations
- **Timezone Handling**: Schedule poll times stored in UTC, frontend converts to local time.
- **PDF Export**: Utilizes Puppeteer for HTML/CSS-based PDF generation.
- **Email Templates**: JSON-based, customizable templates with variable substitution.
- **Internationalization (i18n)**: React-i18next for localization, covering all UI components and pages, with language preference stored in the database.
- **WCAG 2.1 AA Color Contrast**: Admin panel audits theme colors against accessibility standards, with separate corrections for light and dark modes.
- **Security Scanning**: ClamAV for file uploads, npm audit for dependencies, and Pentest-Tools.com integration for vulnerability scanning.
- **System Package Monitoring**: Displays Nix package information for core dependencies.
- **Session Management**: PostgreSQL-backed sessions with `polly.sid` cookie, secure and sameSite configuration, and proxy trust detection.
- **Rate Limiting**: In-memory rate limiter for login attempts (5 failed attempts per IP/Account → 15 min lockout).

### API Documentation
-   **OpenAPI Spec**: `docs/openapi.yaml` provides a full API specification.
-   **Flutter Integration**: `docs/FLUTTER_INTEGRATION.md` for mobile app integration.
-   **Self-Hosting Guide**: `docs/SELF-HOSTING.md` for Docker/Production Deployment.

### Docker Migration Path
Schema changes involve updating `shared/schema.ts`, `server/scripts/ensureSchema.ts`, and migration files. `ensureSchema.ts` automatically adds missing columns on update.

### Release & CI/CD
-   **GitHub Actions**: Workflows for CI (lint, type check, tests, build, E2E, security audit) and Release (Docker image build/push to Docker Hub, GitHub Release, GitLab mirror).
-   **Docker Image**: `manfredsteger/polly` with beta and stable tags.

### Docker Deployment
-   **APP_URL**: Single environment variable for the public application URL, used for OIDC redirects, email links, and sharing.
-   **Entrypoint**: `docker-entrypoint.sh` parses `DATABASE_URL` and handles `pg_isready` checks.

## External Dependencies

-   **PostgreSQL**: Main database.
-   **Keycloak OIDC**: Optional OpenID Connect provider.
-   **SMTP Service**: For sending application emails.
-   **Chromium**: Used by Puppeteer for PDF export.
-   **ClamAV**: External antivirus engine for file uploads.
-   **Pentest-Tools.com Pro API**: For automated security vulnerability scanning.