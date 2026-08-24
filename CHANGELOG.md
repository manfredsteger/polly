# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.7] - 2026-08-24

### Fixed
- **Changelog accuracy**: The `v0.1.0-beta.6` release notes incorrectly repeated the `v0.1.0-beta.5` feature/fix entries instead of describing only its own (documentation/lockfile) changes. This release corrects the changelog history; no application behavior changes.

## [0.1.0-beta.6] - 2026-08-24

### Fixed
- **Release documentation**: Corrected lingering `v0.1.0-beta.4` references in the self-hosting guide and the external-database Docker Compose template that were left over from the `v0.1.0-beta.5` release, and regenerated `package-lock.json` to match the published version. No application behavior changes; supersedes `v0.1.0-beta.5`, whose Docker image and GitHub release remain published but whose docs pointed at the wrong version.

## [0.1.0-beta.5] - 2026-08-24

### Added
- **Simple choice voting mode**: Schedule and survey polls can now use a "Simple" response mode alongside the classic Yes/Maybe/No voting — participants pick a single option (radio) or up to a configurable number of options (checkboxes) with a clear, high-contrast selected state instead of per-option Yes/Maybe/No. Fully supported by the AI poll assistant, translations, poll editing, and results display; existing "classic" polls are unaffected.

### Fixed
- **Theming**: Selected options (and other elements using the primary brand color) could render with no visible background instead of the configured brand color, because the `--primary` / `--primary-foreground` CSS variables were defined as raw color components instead of a valid CSS color value — an invalid value that browsers silently ignore. Both the base stylesheet and the runtime branding code that applies a custom primary color from the admin panel are corrected, and a regression test guards the format going forward.

## [0.1.0-beta.4] - 2026-08-23

### Fixed
- **Image uploads (branding & polls)**: A stale persisted scanner setting could keep blocking uploads even though `CLAMAV_ENABLED=false` was set at runtime, returning `503` for valid images. Explicit, non-empty ClamAV environment values (`CLAMAV_ENABLED`, `CLAMAV_HOST`, `CLAMAV_PORT`) now take precedence over the stored admin configuration; without them the admin panel remains authoritative.
- **Upload security hardening**: Scanner, connection and configuration errors stay fail-secure. When scanning is effectively enabled — or its admin-managed state cannot be read — uploads are blocked instead of silently allowed.
- **Survey voting**: Submitting a vote no longer requires a second click. The submit button is no longer disabled by the background email check triggered when leaving the email field, and duplicate submissions during an in-flight vote are prevented.
- **MFA enforcement**: An admin with an enrolled authenticator app is now always challenged for a TOTP code after password or Keycloak browser login, even when the server-wide admin MFA setup policy is disabled. `MFA_ADMIN_REQUIRED=false` remains an emergency recovery override only.

### Changed
- **Docker Compose**: ClamAV environment variables are passed through empty when unset instead of exporting defaults, so admin-managed scanner settings are no longer unintentionally overridden by Compose. The documented ClamAV service host for the Compose profile is `clamav`.

## [0.1.0-beta.3] - 2026-08-22

### Fixed
- **Image uploads**: A valid image signature is no longer reported as an invalid file type when image re-encoding fails later in processing. This keeps upload validation feedback accurate across supported Sharp environments.

## [0.1.0-beta.2] - 2026-08-22

### Added

#### Guest Access & Admin Security
- **Guest access controls**: Administrators can independently allow or disable guest poll creation and guest voting from the admin settings.
- **Guest poll creation protection**: The guest-creation policy covers both the standard poll form and AI-assisted poll creation.
- **Guest voting protection**: Disabling guest voting also blocks guest vote edits and withdrawals while keeping public poll links readable.
- **Admin MFA policy**: Optional server-wide requirement for administrator MFA, with a pre-activation warning and MFA coverage indicator in the admin panel.
- **MFA emergency override**: `MFA_ADMIN_REQUIRED=false` lets self-hosters recover access without changing the database setting when administrator authenticators are unavailable.

#### Branding
- **Branding**: Favicon upload directly in the admin panel and `FAVICON_URL` ENV-Var support
- **Footer**: New rich default footer with MIT-License link, GitHub repository icon and "Made in Bayern" tagline
- **Footer**: `POLLY_COPYRIGHT_TEXT` ENV-Var locks the copyright line and disables the form field in the admin panel
- **Footer**: Copyright year is rendered dynamically from the current date
- **Admin AI Settings**: KISSKI service-partner block with logo, GDPR notice (DE/EN) and contact link
- **Service Partners**: Centralised in `shared/servicePartners.ts` so README and admin panel stay in sync

### Fixed
- **Auth (Docker)**: Session cookie was marked `Secure` whenever `NODE_ENV=production`, which silently broke login on plain-HTTP Docker deployments (`http://localhost:3080`). Browsers dropped the cookie and bounced users back to the login page with no error. Cookies are now only marked `Secure` when the app is actually served over HTTPS (`FORCE_HTTPS=true`, `https://` `APP_URL`, or Replit hosting). Covered by `server/tests/unit/sessionConfig.test.ts`.
- **Docker**: KISSKI logo moved from `attached_assets/` (excluded from Docker context) to `client/src/assets/` so the production image builds successfully

### Documentation
- README roadmap section synchronised with `ROADMAP.md` (Beta runs Q1 2025 – Q2 2026, AI/Voice Control + OpenAI-compatible API marked as done)
- Project structure section updated to reflect the modular `server/routes/` layout
- New `Branding (ENV)` section in README and `.env.example` covering `SITE_NAME`, `SITE_NAME_ACCENT`, `FAVICON_URL`, `LOGO_URL`, `PRIMARY_COLOR`, `POLLY_COPYRIGHT_TEXT`
 - Release and self-hosting documentation now reflects the public `feature/guest-access-control` beta branch, Docker tags, guest access controls, and the administrator MFA override.

### Tests
- `packageMeta.test.ts` — guards `name` and `version` in `package.json`
- `changelogSync.test.ts` — fails when `[Unreleased]` is empty without a matching version block
- `depsHygiene.test.ts` — flags accidental re-introduction of unused dependencies (passport)
- `envDocsSync.test.ts` — every `process.env.X` read in server code must be documented
- `loginCookieFlow.test.ts` — full login + `/me` round-trip on plain HTTP (Docker scenario)
- `sessionConfig.test.ts` — secure-cookie decision for HTTPS / HTTP / Replit / Docker
- `openapiSync.test.ts` — flags routes missing from `docs/openapi.yaml`

---

### Previously prepared beta.2 features

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
| 0.1.0-beta.7 | 2026-08-24 | Changelog history correction (supersedes beta.6) |
| 0.1.0-beta.6 | 2026-08-24 | Release documentation/lockfile correction (supersedes beta.5) |
| 0.1.0-beta.5 | 2026-08-24 | Simple choice voting mode + brand color theming fix |
| 0.1.0-beta.3 | 2026-08-22 | Public beta release with corrected image-upload error classification |
| 0.1.0-beta.2 | 2026-08-22 | Guest access controls, administrator MFA policy, AI integration, branding, Docker reliability, and notification improvements |
| 0.1.0-beta.1 | 2025-02-24 | Initial beta release |

---

[Unreleased]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.7...HEAD
[0.1.0-beta.7]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.6...v0.1.0-beta.7
[0.1.0-beta.6]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.5...v0.1.0-beta.6
[0.1.0-beta.5]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.4...v0.1.0-beta.5
[0.1.0-beta.4]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.3...v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/manfredsteger/polly/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/manfredsteger/polly/releases/tag/v0.1.0-beta.1
