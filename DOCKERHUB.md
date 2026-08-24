# Polly - Open-Source Polling & Scheduling Platform

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/manfredsteger/polly)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/manfredsteger/polly/blob/v0.1.0-beta.7/LICENSE)

**Self-hosted Doodle/Calendly alternative** for teams who need GDPR-compliant, cloud-independent coordination tools.

## Quick Start

```bash
docker pull manfredsteger/polly:beta

# Option 1: Docker Compose (recommended)
git clone --branch v0.1.0-beta.7 --depth 1 https://github.com/manfredsteger/polly.git
cd polly
cp .env.example .env
# Set POSTGRES_PASSWORD, SESSION_SECRET and ADMIN_PASSWORD to strong values
docker compose -f docker-compose.image.yml up -d
# Open http://localhost:3080

# Option 2: Docker Compose with an external database
git clone --branch v0.1.0-beta.7 --depth 1 https://github.com/manfredsteger/polly.git
cd polly
cp .env.example .env
# Set DATABASE_URL, SESSION_SECRET and ADMIN_PASSWORD in .env
docker compose -f docker-compose.image.external-db.yml up -d

# Option 3: Docker Run with external database
docker run -d \
  --name polly \
  -p 3080:5000 \
  -e DATABASE_URL=postgresql://user:pass@your-db:5432/polly \
  -e SESSION_SECRET=$(openssl rand -base64 32) \
  -e APP_URL=http://localhost:3080 \
  -v polly-uploads:/app/uploads \
  manfredsteger/polly:0.1.0-beta.7
```

**Default Admin Login:** `admin` / `Admin123!`

## Features

- **3 Poll Types**: Schedule coordination, surveys, and organization/booking lists
- **Real-Time Voting**: Live results via WebSocket with fullscreen presentation mode
- **Multi-Language**: German and English with automatic browser detection
- **Authentication**: Anonymous, local email/password, and Keycloak OIDC (SSO)
- **Email Notifications**: Configurable reminders with customizable templates
- **Data Export**: CSV, PDF, ICS calendar feed, and QR code sharing
- **Admin Dashboard**: User management, branding, security scanning, email templates
- **WCAG 2.1 AA**: Automatic color contrast auditing and correction
- **ClamAV Integration**: Optional virus scanning for file uploads
- **AI Poll Assistant**: Create polls via natural language with GWDG SAIA (OpenAI-compatible API)
- **Voice Input**: Speech-to-text for AI chat using Whisper
- **GDPR Compliant**: All data stays on your server, no external tracking

## Available Tags

| Tag | Description |
|-----|-------------|
| `manfredsteger/polly:latest` | Latest stable release |
| `manfredsteger/polly:beta` | Latest beta release |
| `manfredsteger/polly:rc` | Latest release candidate |
| `manfredsteger/polly:<version>` | Specific version (e.g., `0.1.0-beta.7`) |

## Environment Variables

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured in Docker Compose |
| `SESSION_SECRET` | Session encryption key (min 32 chars) | Change in production! |

> **External / Managed PostgreSQL:** Set `DATABASE_URL` directly (e.g. `postgresql://user:pass@your-db-host:5432/polly`) — the entrypoint automatically parses host and port from it. Special characters in passwords are supported (URL-encoded).
> The `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_HOST` variables are only used by the integrated Docker Compose setup and are ignored when `DATABASE_URL` is set.

### Application

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Public URL of your instance | `http://localhost:3080` |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin123!` |
| `ADMIN_EMAIL` | Admin email address | `admin@polly.local` |
| `SEED_DEMO_DATA` | Load demo data on first start | `false` |
| `MFA_ADMIN_REQUIRED` | Set to `false` only to temporarily bypass the admin MFA setting during authenticator recovery. Remove or leave unset to use the admin-panel setting. | — |

> **Legacy aliases:** `BASE_URL`, `VITE_APP_URL` are supported as backward-compatible aliases for `APP_URL`.

### Branding (Optional)

These values can also be edited from the Admin Panel after first start. When set via ENV, the corresponding form field becomes read-only.

| Variable | Description | Example |
|----------|-------------|---------|
| `SITE_NAME` | Site name shown in navbar/title | `Poll` |
| `SITE_NAME_ACCENT` | Accented letter of the site name | `y` |
| `FAVICON_URL` | Public URL of a custom favicon (PNG/ICO/SVG) | `https://example.com/favicon.png` |
| `LOGO_URL` | Public URL of a custom logo | `https://example.com/logo.png` |
| `PRIMARY_COLOR` | Primary brand colour (hex) | `#F97316` |
| `POLLY_COPYRIGHT_TEXT` | Footer copyright text. When set, the admin field is locked | `© 2026 My Org` |
| `FORCE_HTTPS` | Force secure cookies (set `true` behind a TLS-terminating reverse proxy) | `true` |

### Email (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASSWORD` | SMTP password | — |
| `FROM_EMAIL` | Sender address | `noreply@localhost` |

### Keycloak SSO (Optional)

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_REALM` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret |
| `KEYCLOAK_AUTH_SERVER_URL` | Keycloak base URL |

### ClamAV Virus Scanning (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAMAV_ENABLED` | Enable virus scanning | `false` |
| `CLAMAV_HOST` | ClamAV daemon host | — (set `clamav` when using the Compose profile) |
| `CLAMAV_PORT` | ClamAV daemon port | `3310` |

Start with ClamAV:
```bash
CLAMAV_ENABLED=true CLAMAV_HOST=clamav docker compose --profile clamav up -d
```

### AI Assistant (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_API_URL` | OpenAI-compatible API endpoint | — |
| `AI_API_KEY` | API key for AI services | — |
| `AI_API_KEY_FALLBACK` | Fallback key (on HTTP 429) | — |
| `AI_MODEL` | AI model name | `llama-3.3-70b-instruct` |

## Docker Compose

`docker-compose.image.yml` starts the pinned public image together with PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: manfredsteger/polly:0.1.0-beta.7
    ports:
      - "3080:5000"
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  uploads_data:
```

Set `POSTGRES_PASSWORD`, `SESSION_SECRET`, and `ADMIN_PASSWORD` in `.env`
before starting. Use the pinned version tag for production; `:beta` intentionally
advances to the newest beta release.

The release image supports `linux/amd64` and `linux/arm64`, making it suitable
for compatible x86_64 and ARM64 Portainer or Synology Container Manager hosts.

## Data Persistence

| Volume | Content |
|--------|---------|
| `postgres_data` | Database (survives rebuilds) |
| `uploads_data` | Uploaded files (logos, etc.) |

## Health Check

```bash
curl http://localhost:3080/api/v1/health
# {"status":"ok","timestamp":"..."}
```

## Documentation

- [Self-Hosting Guide](https://github.com/manfredsteger/polly/blob/v0.1.0-beta.7/docs/SELF-HOSTING.md) — Full deployment instructions, reverse proxy, backups
- [Release Notes](https://github.com/manfredsteger/polly/releases) — Changelog and download links
- [Flutter Integration](https://github.com/manfredsteger/polly/blob/v0.1.0-beta.7/docs/FLUTTER_INTEGRATION.md) — Mobile app API documentation
- [OpenAPI Spec](https://github.com/manfredsteger/polly/blob/v0.1.0-beta.7/docs/openapi.yaml) — Complete API reference

## License

Polly is open-source software licensed under the [MIT License](https://github.com/manfredsteger/polly/blob/v0.1.0-beta.7/LICENSE).
