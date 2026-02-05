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

# With demo polls for instant testing:
SEED_DEMO_DATA=true docker compose up -d
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

![Polly](hero.png)

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

### Required Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/polly
SESSION_SECRET=your-secure-random-string-min-32-chars
```

### Optional: Email (SMTP)

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-email-password
EMAIL_FROM=noreply@yourdomain.com
```

### Optional: Keycloak OIDC

```env
KEYCLOAK_REALM=your-realm
KEYCLOAK_CLIENT_ID=polly
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_AUTH_SERVER_URL=https://keycloak.example.com
```

### Application URLs

```env
APP_URL=https://your-app-url.com
VITE_APP_URL=https://your-app-url.com
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Shadcn/ui, Radix UI, Tailwind CSS |
| **State** | TanStack Query v5 |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL, Drizzle ORM |
| **Auth** | Passport.js, express-session |

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
| 🤖 | **AI Voice Control** - Create polls via speech with GWDG KISSKI Free Tier | Planned |
| 🔌 | **OpenAI-Compatible API** - Support for custom AI providers | Planned |
| 🇪🇺 | **European DC Focus** - Simplified deployment for EU data centers | Version 1.0 |

> **AI Partner:** [GWDG](https://gwdg.de) provides free AI capabilities to all Polly installations.

👉 **[View Full Roadmap →](ROADMAP.md)**

## 📋 Documentation

| Document | Description |
|----------|-------------|
| [ROADMAP.md](ROADMAP.md) | Development roadmap and future plans |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [docs/openapi.yaml](docs/openapi.yaml) | OpenAPI 3.0 API specification |
| [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md) | Production deployment guide |
| [docs/FLUTTER_INTEGRATION.md](docs/FLUTTER_INTEGRATION.md) | Mobile app integration guide |

## 🤝 Contributing

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
