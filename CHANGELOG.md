# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Accessibility (a11y) testing with axe-core and Playwright (WCAG 2.1 AA compliance)
- README badges for Build Status, License, TypeScript version, and Docker
- Tagline positioning as "Open-source alternative to Doodle, Calendly, and LettuceMeet"
- CHANGELOG.md following Keep a Changelog format

### Fixed
- Pentest-Tools scan ID extraction (now correctly reads `created_id` from API response)
- Missing admin warning translations (defaultAdminAccount, defaultAdminWarning, createNewAdminWarning)
- Docker schema migration for `language_preference` column in ensureSchema.ts

## [1.0.0] - 2025-01-05

### Added
- **Three Poll Types**: Schedule (Terminumfrage), Survey (Umfrage), Organization (Orga-Liste)
- **Multi-Language Support**: German (de) and English (en) with automatic browser detection
- **Real-Time Voting**: WebSocket-based live updates with fullscreen presentation mode
- **Transactional Slot Booking**: PostgreSQL row-level locking prevents overbooking
- **Email Notifications**: Vote confirmation, edit links, expiry reminders via SMTP
- **Export Options**: CSV and PDF exports with QR codes
- **Calendar Integration**: ICS export and webcal:// subscription for schedule polls
- **Authentication**: Local email/password and Keycloak OIDC SSO
- **Role-Based Access**: User, Admin, Manager roles
- **Admin Dashboard**: User management, email templates, branding customization
- **Security Features**: Rate limiting, bcrypt password hashing, GDPR compliance
- **Docker Deployment**: Zero-config setup with `docker compose up -d`
- **CI/CD**: GitHub Actions and GitLab CI workflows
- **Comprehensive E2E Testing**: Playwright-based test suite

### Security
- HTTPS/TLS support
- HTTP-only secure session cookies
- Rate limiting on login endpoints (5 attempts / 15 min lockout)
- Password reset with time-limited tokens
- GDPR-compliant account deletion workflow

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2025-01-05 | Initial release with full feature set |

[Unreleased]: https://github.com/manfredsteger/polly/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/manfredsteger/polly/releases/tag/v1.0.0
