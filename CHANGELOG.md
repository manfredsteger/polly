# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Accessibility (a11y) testing with axe-core and Playwright (WCAG 2.1 AA compliance)
- README badges for Build Status, License, TypeScript version, and Docker

### Fixed
- Pentest-Tools scan ID extraction (now correctly reads `created_id` from API response)
- Missing admin warning translations (defaultAdminAccount, defaultAdminWarning, createNewAdminWarning)
- Docker schema migration for `language_preference` column in ensureSchema.ts

---

## [0.1.0-beta.1] - 2025-02-XX

### Added

#### Poll Types & Core Features
- **Three poll types**: Schedule (Terminumfrage), Survey (Umfrage), Organization (Orga-Liste)
- **Real-time voting**: WebSocket-based live updates with fullscreen presentation mode
- **Matrix results view**: Visual participant × options grid with color-coded responses
- **Vote management**: Configurable vote editing, unique edit links, vote withdrawal support
- **Anonymous & authenticated voting**: Works for guests and registered users

#### Multi-Language Support
- **Internationalization (i18n)**: Complete German (de) and English (en) interface
- **Automatic language detection**: Browser-based detection with user preference storage
- **Language switcher**: Globe icon in navigation for manual language selection

#### Notifications & Communication
- **Email notifications**: Vote confirmation, edit links, expiry reminders via SMTP
- **Customizable email templates**: JSON-based templates with variable substitution and admin preview
- **Notification preferences**: Per-user email notification settings

#### Export & Sharing
- **CSV export**: Download poll results as spreadsheet
- **PDF export**: High-quality HTML/CSS-based PDF generation via Puppeteer
- **QR code sharing**: Easy poll distribution with QR code generation
- **Calendar integration**: ICS export and webcal:// subscription for schedule polls
- **Dynamic calendar status**: Tentative/Confirmed prefixes with automatic cleanup

#### Administration
- **Admin dashboard**: Comprehensive management panel with tabbed interface
- **Branding customization**: Theme colors, logo, site name configuration
- **Dark mode support**: System-wide dark mode with admin-configurable defaults
- **User management**: View, edit, delete users with role-based permissions
- **Email template editor**: Customize all system emails with live preview
- **Test data management**: `isTestData` flags with admin purge functionality

#### Authentication & SSO
- **Local authentication**: Email/password with secure session management
- **Keycloak OIDC integration**: Enterprise SSO with automatic role mapping
- **Role-based access control**: User, Admin, Manager roles
- **Password reset flow**: Secure token-based password reset via email
- **Email change verification**: Two-step email change with confirmation codes

#### Organization Polls (Orga-Listen)
- **Slot booking with capacity limits**: Define maximum participants per slot
- **Real-time slot reservation**: PostgreSQL row-level locking prevents overbooking
- **Advisory locks**: `pg_advisory_xact_lock()` prevents race conditions
- **Live slot updates**: WebSocket broadcasts current availability to all clients

#### Developer Experience
- **Docker deployment**: Zero-config setup with `docker compose up -d`
- **Auto-schema application**: Database schema applied automatically on first start
- **Demo data seeding**: `SEED_DEMO_DATA=true` for instant testing
- **Comprehensive test suite**: 200+ unit/integration tests with Vitest
- **E2E testing**: Playwright-based end-to-end tests
- **API documentation**: OpenAPI 3.0 specification in `docs/openapi.yaml`
- **CI/CD pipelines**: GitHub Actions and GitLab CI workflows

### Security
- **Session-based authentication**: PostgreSQL-backed session store with connect-pg-simple
- **Server-side validation**: Zod schemas for all API endpoints
- **Email ownership verification**: Email confirmation for sensitive operations
- **CSRF protection**: SameSite=Lax cookies with signed session tokens
- **Bcrypt password hashing**: Secure password storage with salt rounds
- **Rate limiting**: Configurable limits for login, registration, poll creation, voting
- **ClamAV integration**: Optional virus scanning for file uploads
- **npm audit integration**: Dependency vulnerability scanning in admin panel
- **Pentest-Tools.com integration**: Automated security vulnerability scanning
- **GDPR compliance**: Account deletion workflow with data export

### Infrastructure
- **PostgreSQL database**: Drizzle ORM with type-safe queries
- **Express.js backend**: TypeScript with modular route structure (156 endpoints)
- **React frontend**: Vite, Shadcn/ui, TanStack Query v5, Wouter
- **WebSocket server**: Real-time communication for live voting features
- **Nix environment**: Reproducible development environment

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0-beta.1 | 2025-02-XX | Initial beta release |

---

[Unreleased]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/manfredsteger/polly/releases/tag/v0.1.0-beta.1
