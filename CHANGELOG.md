# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*(no pending changes)*

---

## [0.1.0-beta.2] - 2026-04-10

### Added

#### AI-Powered Poll Creation (GWDG KISSKI Integration)
- AI assistant for poll creation via natural language input (German & English)
- **Free tier included** for all Polly installations (GWDG SAIA / KISSKI)
- Voice input (speech-to-text) via GWDG Whisper API with real-time waveform visualization
- Audio transcription endpoint (`POST /api/v1/ai/transcribe`) with ffmpeg WebM→MP3 conversion
- Whisper hallucination filter (removes artifacts like "Vielen Dank fürs Zuschauen")
- Large audio file chunking (>20 MB split into 150 s segments for transcription)
- Microphone permission handling with user-friendly error messages
- Drag-and-drop reordering for organization poll slots and AI suggestions
- AI suggestion preview with inline editing, follow-up refinement, and one-click apply
- AI rate limiting with configurable guest/user limits via admin panel

#### Schedule Poll Improvements
- **Video conference URL**: Optional Videokonferenz-Link for schedule polls (shown in confirmation email and ICS)
- Chronological sorting of date options in finalization view
- Finalize button visible directly on the best-voted option
- Labeled voting links in calendar event descriptions (direct Yes/Maybe/No links)

#### Notifications & Email
- **End Poll notifications for all poll types** (was Schedule-only before):
  - Survey: winning option text shown in email ("Festgelegtes Ergebnis: …")
  - Organization: compact slot summary in email (up to 5 slots with filled/capacity)
  - Schedule: sends full date + time + ICS if a date was previously confirmed; generic notification otherwise
- Frontend "End Poll" notify-participants toggle is now wired to the backend (was disconnected in beta.1)
- Creator email always included in all finalization notification recipient lists
- Email deliverability improvements: correct bulk headers, List-Unsubscribe, precedence settings

#### Administration & Configuration
- System-wide default language setting in admin panel
- Matrix Chat Integration admin panel — "Coming Soon" placeholder (planned for v1.0)
- Poll owner now gets admin/finalize features directly on the public poll URL (no separate admin link required)
- Finalize button visibility fixed for all poll types and for poll owners

#### Export & Calendar
- CSV export now includes participant summary and total rows at the bottom
- ICS calendar: CANCELLED events removed from exports and email attachments
- ICS email status corrected (METHOD:REQUEST with TENTATIVE/CONFIRMED prefixes)
- Calendar events automatically cleaned up (old options marked CANCELLED, removed on re-export)

#### Developer Experience
- OpenAPI 3.0 API documentation (`docs/openapi.yaml`) — full endpoint reference
- Architecture documentation (`docs/ARCHITECTURE.md`) updated with current structure
- Accessibility (a11y) testing with axe-core and Playwright (WCAG 2.1 AA compliance)
- README badges: Build Status, License, TypeScript version, Docker
- Flutter integration guide (`docs/FLUTTER_INTEGRATION.md`)

### Fixed
- Multi-day organization poll time slots from AI suggestions now correctly preserve start/end times
- Date regex for AI-generated slots now accepts single-digit day/month formats (e.g., `5.9.2026`)
- Permissions-Policy header updated to allow microphone access (`microphone=(self)`)
- Pentest-Tools scan ID extraction (now correctly reads `created_id` from API response)
- Missing admin warning translations (`defaultAdminAccount`, `defaultAdminWarning`, `createNewAdminWarning`)
- Docker schema migration for `language_preference` column in `ensureSchema.ts`
- Duplicate date/time display removed from finalized poll confirmation view
- Vote deselection: re-submitting a vote form no longer clears already-selected options
- Missing translations added for vote editing and multiple UI strings (de + en)
- Test suite race conditions in auth tests resolved — all 55 tests pass reliably

### Security
- File content validation: actual byte-level content type verified, not just MIME header
- Strengthened password hashing (increased bcrypt rounds)
- Inline scripts removed from HTML pages (CSP hardening)
- Stricter cookie settings (HttpOnly, Secure, SameSite enforcement)
- AI API keys proxied server-side — never exposed to the frontend
- `microphone` Permissions-Policy restricted to same-origin only

---

## [0.1.0-beta.1] - 2025-02-24

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
| 0.1.0-beta.2 | 2026-04-10 | AI integration, schedule improvements, notification fixes |
| 0.1.0-beta.1 | 2025-02-24 | Initial beta release |

---

[Unreleased]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/manfredsteger/polly/releases/tag/v0.1.0-beta.1
