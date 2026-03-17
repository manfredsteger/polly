# Polly - Open-Source Polling System

## Overview
Polly is an open-source, full-stack polling and scheduling platform designed for teams. It facilitates the creation and management of various poll types, including schedule coordination, surveys, and booking (Orga-Listen). The system supports both anonymous and authenticated voting, features a responsive design, and is localized for German users. Its core purpose is to provide a self-hosted, cloud-independent solution for team coordination and data collection.

## User Preferences
- **Communication**: Simple, everyday language (German).
- **Git Commits**: Aussagekräftige, beschreibende Commit-Nachrichten auf Englisch (kein "saved progress"). Format: Kurzer Titel + optionale Details zu den Änderungen.
- **Test Discipline (MANDATORY)**: When adding a new feature, fixing a bug, or changing existing functionality:
  1. First check if tests already exist for the affected code (search `server/tests/`).
  2. If no tests exist, always create or extend tests to cover the change.
  3. If tests exist but don't cover the new behavior, extend them.
  4. Ask the user for confirmation only if the test scope is unclear — by default, tests should be written.
  5. All existing tests must still pass after changes (`npx vitest run`).
- **Test-Cleanup (MANDATORY)**: When a test modifies database settings (`storage.setCustomizationSettings()`, `storage.setSetting()`, `service.saveTemplate()` etc.), it MUST save and restore the original state:
  1. `beforeAll`: Read the current state into a variable (e.g. `origCustomization = await storage.getCustomizationSettings();`)
  2. `afterAll`: Restore the saved state (e.g. `await storage.setCustomizationSettings(origCustomization);`). `afterAll` runs even when tests fail.
  3. Tests must NOT pollute production DB — after a test run, all settings must be identical to before.
  4. Pattern: `const orig = await storage.getCustomizationSettings(); ... afterAll: await storage.setCustomizationSettings(orig);`
- **i18n Discipline (MANDATORY)**: Every user-visible string in the frontend MUST use `t()` from react-i18next. When adding, changing, or removing any UI text:
  1. Always add/update the key in BOTH `client/src/locales/de.json` AND `client/src/locales/en.json`.
  2. If a text is modified, update the translation in both locale files immediately.
  3. If a new key is added, both German and English translations must be provided — never leave one language empty or missing.
  4. Run `node scripts/validate-translations.cjs` after locale changes to verify key parity, no duplicates, and no empty values.
  5. The i18n regression test suite (`server/tests/ui/i18n-hardcoded-strings.test.ts`, 152 tests) must pass before any PR or deployment.

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
- **Email Templates**: JSON-based, customizable templates with variable substitution. All 9 email types (poll_created, invitation, vote_confirmation, reminder, password_reset, email_change, password_changed, welcome, test_report) render via `emailTemplateService.renderEmail()`. Container block type for grouped content (colored boxes), primary/secondary button types. **Dark mode**: Per-container dark background colors read from template JSON `darkBackgroundColor`, no filter:brightness hack. **Logo embedding**: Logos fetched and converted to base64 data URIs at render time (5-min cache, SSRF-safe URL validation, fallback to text header). **Button contrast**: `ensureButtonTextContrast()` auto-selects dark/light text based on background luminance using `normalizeHex()` (handles 3/6/8-digit hex, rejects non-hex). URL validation via `validateEmailUrl()` ensures absolute URLs. XSS protection: user-supplied variables are HTML-escaped before JSON substitution.
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
- **Services**: 132+ tests (email templates 63, email integration 13, live voting WebSocket multi-user 19, image upload file types 16, ClamAV, ICS, PDF, WCAG audit)
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