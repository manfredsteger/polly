# Polly - Open-Source Polling System

## Overview
Polly is an open-source, full-stack polling and scheduling platform designed for teams. It facilitates the creation and management of various poll types, including schedule coordination, surveys, and booking (Orga-Listen). The system supports both anonymous and authenticated voting, features a responsive design, and is localized for German users. Its core purpose is to provide a self-hosted, cloud-independent solution for team coordination and data collection.

## User Preferences
Preferred communication style: Simple, everyday language (German).

## System Architecture

### Full-Stack Architecture
-   **Runtime**: Node.js 22 LTS
-   **Frontend**: React 18 with TypeScript, Vite, Shadcn/ui (Radix UI) + Tailwind CSS, TanStack Query v5, Wouter
-   **Backend**: Express.js server with TypeScript
-   **Database**: PostgreSQL with Drizzle ORM

### Key Features
- **Poll Types**: Terminumfrage (Schedule), Umfrage (Survey), Orga-Liste (Organization/Booking).
- **Vote Management**: Configurable vote editing, unique edit links, and results visibility (public/private).
- **Authentication**: Anonymous token-based, local email/password, and optional Keycloak OIDC with role-based access.
- **Data Export**: CSV and PDF export of results, including QR code sharing for polls.
- **Customization**: Admin panel for branding (theme, logo, site name) and dark mode settings.
- **Multi-Language Support**: German (de) and English (en) with automatic browser detection and per-user preference storage.
- **API Versioning**: `/api/v1/` endpoints with redirects from legacy paths.
- **Notification System**: Configurable email reminders (expiry, manual), with spam protection and rate limiting.
- **Profile Security**: Secure password reset, email change, and GDPR-compliant account deletion request flow.
- **Live Voting**: Real-time vote tracking via WebSocket with fullscreen presentation mode.
- **Admin Tools**: User management, email template customization, security scanning integration (ClamAV, npm audit, Pentest-Tools.com), and system package monitoring (Nix).
- **Calendar Integration**: ICS export and webcal:// subscription for schedule polls.
- **Test Data Isolation**: `isTestData` flags in database for development and purging.

### Technical Implementations
- **Timezone Handling**: Schedule poll times stored in UTC, frontend displays and converts to local time.
- **PDF Export**: Utilizes Puppeteer (Headless Chrome) for high-quality HTML/CSS-based PDF generation.
- **Email Templates**: JSON-based, customizable templates with variable substitution and admin preview/test functionality.
- **Internationalization (i18n)**:
    -   **Library**: react-i18next with i18next-browser-languagedetector
    -   **Languages**: German (de), English (en) - fallback
    -   **Translation Files**: `client/src/locales/de.json`, `client/src/locales/en.json`
    -   **Configuration**: `client/src/lib/i18n.ts`
    -   **Language Switcher**: Globe icon in navigation bar
    -   **User Preference**: Stored in database (`users.language_preference`), synced with localStorage
    -   **API Endpoint**: `PATCH /api/v1/users/me/language` for updating preference
    -   **Detection Order**: localStorage → browser navigator → fallback to English
    -   **Coverage**: Complete frontend localization including:
        -   All UI components (date-picker, time-picker, datetime-picker, CalendarPicker)
        -   Large components (LiveResultsView, VotingInterface, OrganizationSlotVoting, AdminDashboard)
        -   All poll creation pages (create-poll, create-survey, create-organization)
        -   All poll viewing pages (poll, my-polls, poll-success, vote-success)
    -   **Translation Key Structure**: Organized by component/page (e.g., `pollCreation.*`, `admin.*`, `liveResults.*`)
- **Security Scanning**:
    -   **ClamAV**: On-the-fly virus scanning of file uploads using `multer.memoryStorage`.
    -   **npm Audit**: Local scanning for dependency vulnerabilities with severity and impact labels.
    -   **Pentest-Tools.com**: Integration for automated vulnerability scanning with real-time results.
- **System Package Monitoring**: Displays Nix package information and versions for core dependencies.
- **Session Management**:
    -   **Store**: MemoryStore (development), recommended Redis/PostgreSQL for production
    -   **Cookie**: `polly.sid`, httpOnly, secure (HTTPS), sameSite=lax
    -   **Proxy Trust**: Auto-detected via REPL_ID, REPLIT_DEV_DOMAIN environment variables
    -   **Session Save**: Explicit `req.session.save()` before response in login/register/callback endpoints
    -   **Production Note**: MemoryStore loses sessions on server restart; use persistent store in production

## API Documentation

-   **OpenAPI Spec**: `docs/openapi.yaml` - Vollständige API-Spezifikation im OpenAPI 3.0 Format
-   **Flutter Integration**: `docs/FLUTTER_INTEGRATION.md` - Detaillierte Dokumentation für Mobile App Integration
-   **Self-Hosting Guide**: `docs/SELF-HOSTING.md` - Anleitung für Docker/Production Deployment

## External Dependencies

-   **PostgreSQL**: Main database for all application data.
-   **Keycloak OIDC**: Optional OpenID Connect provider for enterprise SSO.
-   **SMTP Service**: For sending application emails (notifications, password resets).
-   **Chromium**: Required for PDF export functionality (used by Puppeteer).
-   **ClamAV**: External antivirus engine for file upload scanning.
-   **Pentest-Tools.com Pro API**: For automated security vulnerability scanning.