# KITA Poll 🗳️

A modern, German-language polling and scheduling application designed for Kindergarten (KITA) teams in Bavaria, Germany. Create surveys, schedule meetings, and manage event signups with ease.

---

## ⚡ Zero-Config Quick Start (10 Minuten)

```bash
# Clone & Start - No configuration needed!
git clone https://github.com/your-org/kita-poll.git
cd kita-poll
docker compose up -d

# With demo polls for instant testing:
SEED_DEMO_DATA=true docker compose up -d
```

**That's it!** Open http://localhost:5000 and start exploring.

- ✅ Database auto-configured (PostgreSQL included)
- ✅ Schema auto-applied on first start
- ✅ Works out of the box - no `.env` file needed
- ✅ Demo data shows all three poll types

---

![KITA Poll](hero.png)

## ✨ Features

### Three Poll Types

| Type | German Name | Description |
|------|-------------|-------------|
| 📅 **Schedule** | Terminumfrage | Find the best date/time with Yes/Maybe/No voting |
| 📊 **Survey** | Umfrage | Classic polls with text options and optional images |
| 📋 **Organization** | Orga-Liste | Slot booking with capacity limits and comments |

### Core Capabilities

- **Anonymous & Authenticated Voting**: Works for guests and registered users
- **Email Notifications**: Vote confirmation and edit links via email
- **Matrix Results View**: Visual participant × options grid with color-coded responses
- **Export Options**: CSV and PDF exports with QR codes
- **QR Code Sharing**: Easy poll distribution via QR codes
- **Full Customization**: Theme colors, logo, site name via admin panel
- **Dark Mode**: System-wide dark mode with admin defaults

### Authentication Options

- **Local Login**: Email/password for registered users
- **Keycloak OIDC**: Enterprise SSO integration (optional)
- **Role-Based Access**: User, Admin, Manager roles

## 🚀 Detailed Setup

### Option 1: Production with Custom Settings

```bash
# Clone the repository
git clone https://github.com/your-org/kita-poll.git
cd kita-poll

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
git clone https://github.com/your-org/kita-poll.git
cd kita-poll
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and settings

# Push database schema
npm run db:push

# Start development server
npm run dev

# Open http://localhost:5000
```

## ⚙️ Configuration

### Required Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/kitapoll
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
KEYCLOAK_CLIENT_ID=kita-poll
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
make publish IMAGE_NAME=yourusername/kita-poll
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
docker pull yourusername/kita-poll:latest
```

## 📖 API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/polls/:token` | Get poll by token |
| POST | `/api/polls/:publicToken/vote` | Submit vote |
| GET | `/api/polls/:token/results` | Get results |

### Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/polls` | Create poll |
| PATCH | `/api/polls/:id` | Update poll |
| DELETE | `/api/polls/:id` | Delete poll |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/polls` | List all polls |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/settings` | Update settings |

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

Made with ❤️ for KITA teams in Bavaria
