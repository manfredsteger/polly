# Polly 🗳️

[![Build Status](https://github.com/manfredsteger/polly/actions/workflows/ci.yml/badge.svg)](https://github.com/manfredsteger/polly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://hub.docker.com/)
[![Changelog](https://img.shields.io/badge/Changelog-Keep%20a%20Changelog-E05735.svg)](CHANGELOG.md)
[![Roadmap](https://img.shields.io/badge/Roadmap-2025-00B4D8.svg)](ROADMAP.md)

**Open-source alternative to Doodle, Calendly, and LettuceMeet**

A modern, self-hosted polling and scheduling platform for teams. Create surveys, schedule meetings, and manage event signups with ease. Multi-language support (German & English), GDPR-compliant, accessibility-tested (WCAG 2.1 AA), and fully self-hosted.

---

## ⚡ Zero-Config Quick Start (10 Minuten)

```bash
# Clone & Start - No configuration needed!
git clone https://github.com/manfredsteger/polly.git
cd polly
docker compose up -d

# OR: All-in-one with Makefile (includes seed data)
make complete
```

**That's it!** Open http://localhost:3080 and start exploring.

### Default Admin Credentials

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `Admin123!` |
| **Email** | `admin@polly.local` |

> ⚠️ **Security Warning**: After first login, create a new admin account and delete the default admin!

- ✅ Database auto-configured (PostgreSQL included)
- ✅ Schema auto-applied on first start
- ✅ Initial admin account created automatically
- ✅ Works out of the box - no `.env` file needed
- ✅ Demo data shows all three poll types

---

## 🎬 See It In Action

### For Users: Create Polls Instantly

<p align="center">
  <img src="docs/screenshots/hero-create-poll.gif" alt="Polly - Create a Poll in Seconds" width="100%"/>
</p>

<p align="center">
  <em>Create your first poll in under 30 seconds – no login required</em>
</p>

### For Admins: Full Control Dashboard

<p align="center">
  <img src="docs/screenshots/hero-admin-overview.gif" alt="Polly - Admin Dashboard Overview" width="100%"/>
</p>

<p align="center">
  <em>Manage users, polls, and system settings from one central dashboard</em>
</p>

---

## 📸 Screenshots

### Poll Types

<table>
<tr>
<td align="center" width="33%">
<img src="docs/screenshots/polly-poll-create-001-en.png" alt="Schedule Poll Creation" width="280"/>
<br/><strong>📅 Schedule Poll</strong>
<br/><sub>Find the best meeting time</sub>
</td>
<td align="center" width="33%">
<img src="docs/screenshots/polly-survey-001-en.png" alt="Survey Poll" width="280"/>
<br/><strong>📊 Survey</strong>
<br/><sub>Collect opinions & feedback</sub>
</td>
<td align="center" width="33%">
<img src="docs/screenshots/polly-orga-001-en.png" alt="Organization List" width="280"/>
<br/><strong>📋 Organization List</strong>
<br/><sub>Slot booking with capacity</sub>
</td>
</tr>
</table>

<details>
<summary><strong>🖥️ Admin Dashboard Screenshots</strong> (click to expand)</summary>

<br/>

| Overview | User Management |
|----------|-----------------|
| ![Admin Overview](docs/screenshots/polly-admin-overview-en.png) | ![User Management](docs/screenshots/polly-admin-users-en.png) |
| System stats, recent activity, quick actions | Manage users, roles, and permissions |

| Branding & Theming | Settings |
|--------------------|----------|
| ![Branding](docs/screenshots/polly-admin-branding-en.png) | ![Settings](docs/screenshots/polly-admin-settings-en.png) |
| Customize logo, colors, and site name | Email, security, and system configuration |

| Monitoring | Test Suite |
|------------|------------|
| ![Monitoring](docs/screenshots/polly-admin-monitoring-en.png) | ![Tests](docs/screenshots/polly-admin-tests-en.png) |
| System health and performance | Built-in security and integration tests |

</details>

<details>
<summary><strong>🇩🇪 Deutsche Screenshots</strong> (click to expand)</summary>

<br/>

| Dashboard | Benutzer |
|-----------|----------|
| ![Admin Übersicht](docs/screenshots/polly-admin-overview-de.png) | ![Benutzerverwaltung](docs/screenshots/polly-admin-users-de.png) |

| Branding | Einstellungen |
|----------|---------------|
| ![Branding](docs/screenshots/polly-admin-branding-de.png) | ![Einstellungen](docs/screenshots/polly-admin-settings-de.png) |

</details>

---

## ✨ Features

### Three Poll Types

| Type | German Name | Description |
|------|-------------|-------------|
| 📅 **Schedule** | Terminumfrage | Find the best date/time with Yes/Maybe/No voting |
| 📊 **Survey** | Umfrage | Classic polls with text options and optional images |
| 📋 **Organization** | Orga-Liste | Slot booking with capacity limits and comments |

### Core Capabilities

- **Multi-Language Support**: Full German (de) and English (en) interface with automatic browser detection. Easily extensible—add new languages by creating a translation JSON file in `client/src/locales/`
- **Anonymous & Authenticated Voting**: Works for guests and registered users
- **Real-Time Updates**: Live voting with WebSocket connections and fullscreen presentation mode
- **Email Notifications**: Vote confirmation, edit links, and expiry reminders via email
- **Matrix Results View**: Visual participant × options grid with color-coded responses
- **Export Options**: CSV and PDF exports with QR codes
- **Calendar Integration**: ICS export and webcal:// subscription for schedule polls
- **QR Code Sharing**: Easy poll distribution via QR codes
- **Full Customization**: Theme colors, logo, site name via admin panel
- **Dark Mode**: System-wide dark mode with admin defaults
- **AI Poll Assistant**: Create polls via natural language with AI-powered suggestions (GWDG SAIA integration)
- **Voice Input**: Speech-to-text for AI chat with real-time waveform visualization
- **Transactional Slot Booking**: PostgreSQL row-level locking prevents overbooking in organization polls

### Authentication Options

- **Local Login**: Email/password for registered users
- **Keycloak OIDC**: Enterprise SSO integration (optional)
- **Role-Based Access**: User, Admin, Manager roles

## 🚀 Detailed Setup

### Option 1: Production with Custom Settings

```bash
# Clone the repository
git clone https://github.com/manfredsteger/polly.git
cd polly

# Copy and customize environment
cp .env.example .env
nano .env  # Add your SMTP, Keycloak settings

# Start with Docker Compose
docker compose up -d

# The app auto-configures on first start!
```

### Option 2: Local Development

```bash
# Prerequisites: Node.js 20+, PostgreSQL 16+

# Clone and install
git clone https://github.com/manfredsteger/polly.git
cd polly
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and settings

# Push database schema
npm run db:push

# Start development server
npm run dev

# Open http://localhost:3080
```

## ⚙️ Configuration

> **Full reference**: See [`.env.example`](.env.example) for a ready-to-use template with all variables.
> **Production guide**: See [`docs/SELF-HOSTING.md`](docs/SELF-HOSTING.md) for deployment-specific configuration.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@host:5432/polly` |
| `SESSION_SECRET` | Session encryption key (min 32 chars). Generate with `openssl rand -base64 32` | `a1b2c3d4...` |

### Application URL

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Public URL of your application (used for OIDC redirects, email links, QR codes, sharing) | `https://poll.example.com` |

> **Note:** `BASE_URL` and `VITE_APP_URL` are supported as legacy aliases. Use `APP_URL` for new deployments.

### Email (SMTP) — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS (`true`/`false`) | `false` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASSWORD` | SMTP password | — |
| `FROM_EMAIL` | Sender address for outgoing emails | `noreply@polly.example.com` |
| `FROM_NAME` | Sender display name | `Polly` |

> **Legacy aliases:** `EMAIL_FROM` (same as `FROM_EMAIL`), `SMTP_PASS` (same as `SMTP_PASSWORD`)

### Keycloak OIDC — Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `KEYCLOAK_REALM` | Keycloak realm name | `university` |
| `KEYCLOAK_CLIENT_ID` | Client ID | `polly` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret | `secret-uuid` |
| `KEYCLOAK_AUTH_SERVER_URL` | Keycloak base URL | `https://keycloak.example.com` |
| `KEYCLOAK_ISSUER_URL` | Full OIDC issuer URL (auto-derived if not set) | `https://keycloak.example.com/realms/myrealm` |
| `SSO_BUTTON_LABEL` | Custom login button text (e.g. "Kita Hub Login"). Also configurable in Admin panel | — |
| `SHOW_LOGIN_FORM` | Show/hide local username+password login form. Set `false` when SSO is primary | `true` |

> **Legacy alias:** `KEYCLOAK_URL` (same as `KEYCLOAK_AUTH_SERVER_URL`)

### AI Assistant — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_API_URL` | OpenAI-compatible API endpoint | — |
| `AI_API_KEY` | API key. When set via ENV, AI chat is **auto-enabled** without admin toggle | — |
| `AI_API_KEY_FALLBACK` | Fallback key (used on HTTP 429 rate limit) | — |
| `AI_MODEL` | AI model name | `llama-3.3-70b-instruct` |

### Security Scanning — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAMAV_ENABLED` | Enable ClamAV virus scanning for uploads | `false` |
| `CLAMAV_HOST` | ClamAV daemon hostname | `clamav` |
| `CLAMAV_PORT` | ClamAV daemon port | `3310` |
| `PENTEST_TOOLS_API_TOKEN` | Pentest-Tools.com Pro API token | — |

### Docker / Initial Admin — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_EMAIL` | Initial admin email | `admin@polly.local` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin123!` |
| `SEED_DEMO_DATA` | Seed demo polls on first start | `false` |
| `POSTGRES_USER` | Bundled PostgreSQL user (docker-compose only) | `polly` |
| `POSTGRES_PASSWORD` | Bundled PostgreSQL password (docker-compose only) | `polly_secret` |
| `POSTGRES_DB` | Bundled PostgreSQL database (docker-compose only) | `polly` |

### Advanced

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Node environment | `production` |
| `DATABASE_SSL` | Enable SSL for database connections | `false` |
| `FORCE_HTTPS` | Force secure cookies (behind TLS-terminating proxy) | auto-detect from `APP_URL` |
| `LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` | `info` (prod) / `debug` (dev) |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path for PDF export | auto-detected |
| `POLLY_WCAG_OVERRIDE` | Disable WCAG default theme enforcement | `false` |
| `TEST_MODE_SECRET` | Custom header value for E2E test mode | `polly-e2e-test-mode` |

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Shadcn/ui, Radix UI, Tailwind CSS |
| **State** | TanStack Query v5 |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL, Drizzle ORM |
| **Auth** | Passport.js, express-session |
| **AI** | GWDG SAIA (OpenAI-compatible), Whisper |

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities
├── server/                 # Express backend
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database operations
│   └── auth.ts            # Authentication
├── shared/                 # Shared types
│   └── schema.ts          # Drizzle schemas
├── Dockerfile             # Production container
└── docker-compose.yml     # Local development
```

## 🛠️ Development Commands

```bash
npm run dev          # Start development server (frontend + backend)
npm run build        # Build for production
npm start            # Start production server
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (DB viewer)
```

## 🎨 Customization

Access the admin panel at `/admin` to customize:

- **Theme Colors**: Primary, secondary, and feature-specific colors
- **Branding**: Logo, site name, footer text
- **Dark Mode**: Set system default (light/dark/system)
- **Registration**: Enable/disable user registration
- **Email Settings**: Configure SMTP for notifications

### Feature Colors

| Feature | Default Color | Description |
|---------|--------------|-------------|
| Schedule | Orange #F97316 | Terminumfragen |
| Survey | Green #7DB942 | Umfragen |
| Organization | Teal #72BEB7 | Orga-Listen |

## 🔒 Security

- Session-based authentication with secure cookies
- Server-side validation of all inputs with Zod
- Email ownership verification for registered users
- Role-based access control
- CSRF protection
- Secure password hashing with bcrypt
- AI API key proxying (server-side only)

## 🐳 Docker Deployment

### Using Makefile (Recommended)

```bash
# Show all available commands
make help

# Quick setup (first time)
make setup

# Start production
make prod

# Start development with hot-reload
make dev

# View logs
make logs

# Push database schema
make db-push

# Open database shell
make shell-db

# All-in-one: Build, start, migrate & seed (first time or after updates)
make complete

# Build and publish to Docker Hub
make publish IMAGE_NAME=yourusername/polly
```

### Manual Docker Commands

```bash
# Build and run
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

### Development with Hot Reload

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Docker Hub

Pull the official image:
```bash
docker pull yourusername/polly:latest
```

## 📖 API Documentation

All API endpoints use the `/api/v1/` prefix. Full OpenAPI specification available in `docs/openapi.yaml`.

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/polls/public/:token` | Get poll by public token |
| POST | `/api/v1/polls/:publicToken/vote` | Submit vote |
| GET | `/api/v1/polls/:token/results` | Get poll results |
| GET | `/api/v1/polls/:publicToken/calendar.ics` | ICS calendar export |

### Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/polls` | Create poll |
| PATCH | `/api/v1/polls/:id` | Update poll |
| DELETE | `/api/v1/polls/:id` | Delete poll |
| GET | `/api/v1/users/me` | Get current user |
| PATCH | `/api/v1/users/me/language` | Update language preference |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/polls` | List all polls |
| GET | `/api/v1/admin/users` | List all users |
| PUT | `/api/v1/admin/settings` | Update settings |
| GET | `/api/v1/admin/email-templates` | Manage email templates |

### WebSocket (Real-Time Voting)

Connect to `/ws` for live vote updates during presentations. Events: `vote_update`, `slot_update`.

## 🗺️ Roadmap

Polly is currently in **Beta Phase** (Q1-Q2 2025). Our focus areas:

| Priority | Feature | Status |
|----------|---------|--------|
| 🔐 | **Keycloak SSO (OIDC)** - Enterprise single sign-on integration | In Progress |
| 🤖 | **AI Voice Control** - Create polls via speech with GWDG KISSKI Free Tier | ✅ Done |
| 🔌 | **OpenAI-Compatible API** - Support for custom AI providers | Planned |
| 💬 | **Matrix / Element Chatbot** - Create and manage polls directly from Matrix chat | Version 1.0 |
| 🇪🇺 | **European DC Focus** - Simplified deployment for EU data centers | Version 1.0 |

👉 **[View Full Roadmap →](ROADMAP.md)**

## 🤝 Service Partners

<table>
<tr>
<td align="center" width="120">
<a href="https://gwdg.de/">
<img src="docs/gwdg-logo.svg" alt="GWDG Logo" height="60"/>
</a>
</td>
<td>
<strong><a href="https://gwdg.de/">GWDG – Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen</a></strong><br/>
The GWDG is the joint computing and IT competence center for the Georg-August-Universität Göttingen and the Max Planck Society. As infrastructure partner, they provide the hosting and computing resources that power Polly's self-hosted deployment capabilities.
</td>
</tr>
<tr>
<td align="center" width="120">
<a href="https://kisski.gwdg.de/">
<img src="docs/kisski-logo.svg" alt="KISSKI Logo" height="60"/>
</a>
</td>
<td>
<strong><a href="https://kisski.gwdg.de/">KISSKI – KI-Servicezentrum für sensible und kritische Infrastrukturen</a></strong><br/>
KISSKI is a BMBF-funded AI service center operated by the GWDG, providing free AI inference capabilities for research and public infrastructure. Polly uses KISSKI's OpenAI-compatible API to offer AI-powered agentic control for poll creation – hosted in Germany, GDPR-compliant, and offers a free AI tier for every Polly user (please get in touch with GWDG/KISSKI for an AI production licence).
</td>
</tr>
</table>

## 📋 Documentation

| Document | Description |
|----------|-------------|
| [ROADMAP.md](ROADMAP.md) | Development roadmap and future plans |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [docs/openapi.yaml](docs/openapi.yaml) | OpenAPI 3.0 API specification |
| [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md) | Production deployment guide |
| [docs/FLUTTER_INTEGRATION.md](docs/FLUTTER_INTEGRATION.md) | Mobile app integration guide |

## 👥 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Write TypeScript with proper types
- Use Tailwind CSS for styling
- Test changes before submitting PR
- Update documentation as needed

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)
- Hosted on [Replit](https://replit.com/)

---

Made with ❤️ for teams everywhere
