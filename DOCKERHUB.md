# Polly - Open-Source Polling & Scheduling Platform

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/manfredsteger/polly)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/manfredsteger/polly/blob/main/LICENSE)

**Self-hosted Doodle/Calendly alternative** for teams who need GDPR-compliant, cloud-independent coordination tools.

## Quick Start

```bash
docker pull manfredsteger/polly:beta

# Option 1: Docker Compose (recommended)
git clone https://github.com/manfredsteger/polly.git
cd polly
docker compose up -d
# Open http://localhost:3080

# Option 2: Docker Run with external database
docker run -d \
  --name polly \
  -p 3080:5000 \
  -e DATABASE_URL=postgresql://user:pass@your-db:5432/polly \
  -e SESSION_SECRET=$(openssl rand -base64 32) \
  -e APP_URL=http://localhost:3080 \
  -e VITE_APP_URL=http://localhost:3080 \
  -v polly-uploads:/app/uploads \
  manfredsteger/polly:beta
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
- **GDPR Compliant**: All data stays on your server, no external tracking

## Available Tags

| Tag | Description |
|-----|-------------|
| `manfredsteger/polly:latest` | Latest stable release |
| `manfredsteger/polly:beta` | Latest beta release |
| `manfredsteger/polly:rc` | Latest release candidate |
| `manfredsteger/polly:<version>` | Specific version (e.g., `0.1.0-beta.1`) |

## Environment Variables

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured in Docker Compose |
| `SESSION_SECRET` | Session encryption key (min 32 chars) | Change in production! |

### Application

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Public URL of your instance | `http://localhost:3080` |
| `VITE_APP_URL` | Same as APP_URL (for frontend) | `http://localhost:3080` |
| `BASE_URL` | Base URL for links in emails | `http://localhost:3080` |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin123!` |
| `ADMIN_EMAIL` | Admin email address | `admin@polly.local` |
| `SEED_DEMO_DATA` | Load demo data on first start | `false` |

### Email (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASSWORD` | SMTP password | — |
| `EMAIL_FROM` | Sender address | `noreply@localhost` |

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
| `CLAMAV_HOST` | ClamAV daemon host | `localhost` |
| `CLAMAV_PORT` | ClamAV daemon port | `3310` |

Start with ClamAV:
```bash
docker compose --profile clamav up -d
```

## Docker Compose

The included `docker-compose.yml` provides a zero-config setup with PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: manfredsteger/polly:beta
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

Docker Compose auto-configures `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, and all other environment variables with sensible defaults.

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

- [Self-Hosting Guide](https://github.com/manfredsteger/polly/blob/main/docs/SELF-HOSTING.md) — Full deployment instructions, reverse proxy, backups
- [Release Notes](https://github.com/manfredsteger/polly/releases) — Changelog and download links
- [Flutter Integration](https://github.com/manfredsteger/polly/blob/main/docs/FLUTTER_INTEGRATION.md) — Mobile app API documentation
- [OpenAPI Spec](https://github.com/manfredsteger/polly/blob/main/docs/openapi.yaml) — Complete API reference

## License

Polly is open-source software licensed under the [MIT License](https://github.com/manfredsteger/polly/blob/main/LICENSE).
