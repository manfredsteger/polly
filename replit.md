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
- **Authentication**: Anonymous token-based, local email/password, and optional Keycloak OIDC with role-based access. `HIDE_LOGIN_FORM=true` hides local form when SSO is primary (safety: auto-shows if SSO unavailable).
- **Data Export**: CSV and PDF export of results, including QR code sharing for polls.
- **Customization**: Admin panel for branding (theme, logo, site name) and dark mode settings.
- **Multi-Language Support**: German (de) and English (en) with automatic browser detection and per-user preference storage.
- **API Versioning**: `/api/v1/` endpoints.
- **Notification System**: Configurable email reminders with spam protection and rate limiting.
- **Profile Security**: Secure password reset, email change, and GDPR-compliant account deletion request flow.
- **Live Voting**: Real-time vote tracking via WebSocket with fullscreen presentation mode.
- **AI Auto-Enable**: AI chat is automatically enabled if `AI_API_KEY` is set unless explicitly disabled by admin.
- **Voice Input (AI Chat)**: Microphone button records audio, transcodes to text via Whisper API, and inserts into chat.
- **Admin Tools**: User management (incl. manual email verification), email template customization, security scanning integration, and system package monitoring.
- **Post-Login Flow**: Regular users land on Home (`/`) with AI chat front and center; admins redirect to `/admin`.
- **Meine Umfragen**: Consolidated poll management with stat cards (active/total/participations/this week), inline action buttons (stats/share/edit/delete), and archive tab for expired/closed polls. Dashboard page removed.
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
- **Session Management**: PostgreSQL-backed sessions with `polly.sid` cookie, secure and sameSite configuration, proxy trust detection, session regeneration on login/register (session fixation prevention), role-based idle timeout middleware (admin/manager/user), and `lastActivity` tracking.
- **Rate Limiting**: In-memory rate limiter for login attempts (5 failed attempts per IP/Account → 15 min lockout).
- **Security Hardening**: Force-password-change for default admin credentials (`isInitialAdmin` middleware blocks API until password changed), Cache-Control `no-store` on all API responses, generic error messages (no `error.message` leaks), JSON body limit 1MB, field-level input length validation (voter names 100, option text 500, description 5000, email 254), `autocomplete="off"` on all password fields, `X-Powered-By` disabled.

### API Documentation
-   **OpenAPI Spec**: `docs/openapi.yaml` provides a full API specification.
-   **Flutter Integration**: `docs/FLUTTER_INTEGRATION.md` for mobile app integration.
-   **Self-Hosting Guide**: `docs/SELF-HOSTING.md` for Docker/Production Deployment.

### Docker Migration Path
Schema changes involve updating `shared/schema.ts`, `server/scripts/ensureSchema.ts`, and migration files. `ensureSchema.ts` automatically adds missing columns and indexes on startup.

### Database Indexes
Token tables (`password_reset_tokens`, `email_verification_tokens`, `email_change_tokens`) have indexes on `token` and `user_id`. `notification_logs` is indexed on `poll_id` and `type`. `votes` is indexed on `poll_id`, `option_id`, `voter_email`, `voter_key`, and `voter_edit_token`.

### Test Coverage (454+ tests)
- **API**: 174 tests (admin CRUD, user profile/theme/language, poll CRUD/voting/export, email templates, security, validation)
- **Auth**: 55 tests (login, registration, password reset, session persistence, cookie security)
- **Polls**: 30 tests (CRUD, voting, finalize, types)
- **Data/Storage**: 40 tests (settings, branding, storage, test data)
- **Unit**: 34 tests (validation, token service, QR service)
- **Services**: 68+ tests (email templates, ClamAV, ICS, PDF, WCAG audit)
- **Security**: 31 tests (WebSocket presenter escalation, poll token validation, email HTML escaping/XSS, deprovision Basic Auth, timing attack resistance)
- **E2E/Integration**: 49 tests (poll flow, multi-voter, Docker build, deployment readiness, DB migration)

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