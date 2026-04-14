# Polly Architecture Documentation

**Version:** 3.0  
**Last Updated:** 2026-03-25  
**Status:** Beta

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Data Model](#data-model)
6. [Core Concepts](#core-concepts)
7. [Feature Architecture](#feature-architecture)
8. [Security Architecture](#security-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Architecture Decision Records (ADRs)](#architecture-decision-records)

---

## System Overview

### What is Polly?

Polly is a **self-hosted polling and scheduling platform** that supports three distinct poll types:

1. **Schedule Polls** (Terminumfragen) - Find the best date/time with Yes/Maybe/No voting
2. **Survey Polls** (Umfragen) - Classic polls with text/image options and optional free-text answers
3. **Organization Lists** (Orga-Listen) - Slot booking with capacity management and real-time reservation

### Key Characteristics

- **Self-Hosted:** No cloud dependencies, full data ownership
- **Multi-Language:** German & English with system-wide default language setting and per-user preference
- **Real-Time:** WebSocket-based live updates and fullscreen presentation mode
- **GDPR-Compliant:** Privacy-first design with account deletion workflow (Art. 17)
- **WCAG 2.1 AA Compliant:** Accessibility-first for public sector use
- **Anonymous & Authenticated:** Works for guests and registered users
- **Enterprise SSO:** Optional Keycloak OIDC integration
- **AI-Assisted:** Optional AI-powered poll creation and voice input (Whisper transcription)
- **Calendar Integration:** ICS export, webcal subscription, calendar feed for finalized dates
- **Email Templates:** Customizable V3 template system with visual builder and dark mode support

---

## Architecture Principles

### 1. Simplicity Over Complexity
- **Monolithic architecture** (not microservices) for easier deployment
- Single Docker container for production
- PostgreSQL as the only database (no Redis required)

### 2. Developer Experience
- **TypeScript everywhere** (frontend + backend)
- **Shared types** between client and server (`/shared/schema.ts`)
- **Hot-reload** in development via Vite
- **Type-safe database queries** with Drizzle ORM
- **Zod schema validation** shared between frontend forms and backend routes

### 3. Performance & Scalability
- **WebSocket** for real-time updates (scales to ~100 concurrent users per instance)
- **Database indexing** on critical queries (polls, votes, tokens)
- **Row-level locking + Advisory locks** for race condition prevention (Orga-Listen slot booking)
- **Admin stats caching** (5-minute TTL with background warming)

### 4. Security First
- **Server-side validation** with Zod schemas
- **Session-based authentication** (not JWT for better revocation)
- **Rate limiting** on login (5 attempts → 15 min lockout), registration, password reset, and API endpoints
- **XSS prevention** through React auto-escaping and `htmlEscape()` for email templates
- **ClamAV integration** for file upload scanning (optional)
- **SSRF protection** on logo URL fetching for email embedding
- **Session fixation prevention** via session regeneration on login/register
- **Generic error messages** (no `error.message` leaks to client)
- **Cache-Control `no-store`** on all API responses
- **Force-password-change** for default admin credentials

### 5. Accessibility First
- **WCAG 2.1 AA compliant** by default
- **Color contrast ratios** meet 4.5:1 minimum
- **Focus indicators** on all interactive elements
- **Screen reader compatible** with ARIA labels
- **Admin WCAG audit** with automated contrast checking and correction suggestions
- **Admin override** available for corporate design requirements

### 6. Extensibility
- **Plugin-ready** i18n system (easy to add new languages)
- **Customizable theming** via admin panel (colors, logo, branding, footer)
- **Modular poll types** (easy to add new types)
- **Email template editor** with V3 shell, dark mode support, and footer customization
- **External deprovisioning API** for Keycloak/Kafka integration

---

## Technology Stack

### Frontend
```
React 18            → UI library
TypeScript          → Type safety
Vite                → Build tool & dev server
TanStack Query v5   → Data fetching & caching
Shadcn/ui           → Component library (Radix UI based)
Radix UI            → Headless UI primitives
Tailwind CSS        → Styling
Wouter              → Lightweight routing
react-i18next       → Internationalization
Framer Motion       → Animations
Recharts            → Charts & visualizations
react-hook-form     → Form management
react-markdown      → Markdown rendering
Embla Carousel      → Carousel / image gallery
@dnd-kit            → Drag and drop (option reordering)
cmdk                → Command palette
```

### Backend
```
Node.js 22 LTS      → Runtime
Express.js          → Web framework
TypeScript          → Type safety
Drizzle ORM         → Database queries
PostgreSQL          → Database (Neon-backed on Replit)
Passport.js         → Authentication (local + OIDC)
express-session     → Session management
connect-pg-simple   → PostgreSQL session store
ws                  → WebSocket server
Nodemailer          → Email sending (SMTP)
@sendgrid/mail      → Email sending (SendGrid alternative)
Puppeteer           → PDF generation
OpenAI SDK          → AI poll creation (GWDG SAIA compatible)
openid-client       → Keycloak OIDC integration
matrix-js-sdk       → Matrix chat integration
bcryptjs            → Password hashing
multer              → File upload handling
qrcode              → QR code generation
nanoid              → Token generation
```

### DevOps
```
Docker              → Containerization
Docker Compose      → Local development & production
Playwright          → E2E testing
axe-core            → Accessibility testing
Vitest              → Unit & integration testing
GitHub Actions      → CI/CD (lint, test, build, release)
GitLab CI           → Alternative CI/CD
ESLint + Prettier   → Code formatting & linting
```

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────────┐  │
│  │  React SPA   │◄───┤  WebSocket   │   │   Static      │  │
│  │  (Vite)      │    │  Connection  │   │   Assets      │  │
│  └──────┬───────┘    └──────┬───────┘   └───────────────┘  │
└─────────┼──────────────────┼──────────────────────────────┘
          │                  │
          │ HTTP/REST        │ WS
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Server                         │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────────┐  │
│  │   Routes     │    │  WebSocket   │   │     Auth      │  │
│  │   /api/v1/*  │    │   Handler    │   │ (Passport.js) │  │
│  └──────┬───────┘    └──────┬───────┘   └───────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                            │                                │
│                  ┌─────────▼──────────┐                     │
│                  │   Business Logic   │                     │
│                  │   (storage.ts +    │                     │
│                  │    services/*.ts)  │                     │
│                  └─────────┬──────────┘                     │
│                            │                                │
│    ┌───────────┬───────────┼───────────┬───────────┐        │
│    ▼           ▼           ▼           ▼           ▼        │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ │Nodemailer│ │Puppeteer│ │ ClamAV  │ │   AI    │ │ Matrix  │
│ │(Email)   │ │(PDF)    │ │(Scan)   │ │(OpenAI) │ │(Chat)   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Drizzle ORM    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   PostgreSQL     │
                    │   Database       │
                    └──────────────────┘
```

### Route Architecture

```
server/routes/
├── index.ts        → Route mounting & middleware registration
├── common.ts       → Shared schemas (Zod), middleware (requireAuth, requireAdmin, extractUserId)
├── auth.ts         → /api/v1/auth/* (login, register, password reset, email change, OIDC)
├── polls.ts        → /api/v1/polls/* (CRUD, options, invite, remind, finalize)
├── votes.ts        → /api/v1/polls/:token/vote*, /api/v1/votes/edit/:editToken
├── users.ts        → /api/v1/user/profile, /api/v1/users/me/*
├── admin.ts        → /api/v1/admin/* (users, polls, settings, security, customization, email templates, WCAG, ClamAV, pentest-tools, test runs, GDPR)
├── export.ts       → /api/v1/polls/:token/export/* (QR, PDF, CSV, ICS), calendar feed
├── system.ts       → /api/v1/health, /api/v1/customization, /api/v1/theme, /api/v1/upload/image, /api/v1/matrix/*, SMTP/OIDC config
└── ai.ts           → /api/v1/ai/* (transcribe, create-poll, apply, admin settings)
```

### Service Architecture

```
server/services/
├── authService.ts           → Local + OIDC authentication logic
├── tokenService.ts          → Bearer token (JWT) validation
├── emailService.ts          → Email sending (SMTP/SendGrid)
├── emailTemplateService.ts  → V3 email template rendering & management
├── liveVotingService.ts     → WebSocket rooms, live updates, presence tracking
├── icsService.ts            → ICS calendar generation & parsing
├── pdfService.ts            → PDF report generation (Puppeteer)
├── qrService.ts             → QR code generation (PNG/SVG)
├── imageService.ts          → Image upload + ClamAV scanning
├── clamavService.ts         → ClamAV daemon interface
├── aiService.ts             → AI-powered poll creation (OpenAI-compatible)
├── whisperService.ts        → Audio transcription (Whisper + ffmpeg)
├── matrixService.ts         → Matrix protocol chat integration
├── rateLimiterService.ts    → Login-specific rate limiting
├── apiRateLimiterService.ts → General API rate limiting (configurable)
├── aiRateLimiterService.ts  → AI feature rate limiting
├── deviceTokenService.ts    → Anonymous voter device token signing
├── adminCacheService.ts     → Dashboard stats caching (5-min TTL)
├── npmAuditService.ts       → npm audit vulnerability scanning
├── pentestToolsService.ts   → Pentest-Tools.com API integration
├── systemPackageService.ts  → System package monitoring
└── testRunnerService.ts     → Vitest/Playwright execution from admin UI
```

### Request Flow

#### 1. Poll Creation (Authenticated User)
```
User → React Form → POST /api/v1/polls
                    ↓
                Check Auth (session, optional)
                    ↓
                Validate (Zod: createPollSchema)
                    ↓
                Insert to DB (Drizzle)
                    ↓
                Generate Tokens (publicToken, adminToken via nanoid)
                    ↓
                [Optional] Send Creator Email (adminToken link)
                    ↓
                Return { poll, publicToken, adminToken }
                    ↓
User ← Poll Success Page (links to share/admin)
```

#### 2. Vote Submission (Anonymous or Authenticated)
```
User → React Form → POST /api/v1/polls/:token/vote
                    ↓
                Validate Input (Zod: bulkVoteSchema)
                    ↓
                Check Poll Exists & Active & Not Expired
                    ↓
                Check Voter Identity (email ownership for logged-in users)
                    ↓
                [Organization Only] Acquire Advisory Lock
                    ↓
                Insert/Update Vote (with transaction)
                    ↓
                Broadcast to WebSocket Clients
                    ↓
                [Optional] Send Email Confirmation (with voterEditToken link)
                    ↓
User ← Confirmation + Edit Link (voterEditToken)
```

#### 3. Real-Time Updates
```
User A votes → Server receives vote
                    ↓
                WebSocket.broadcast({ type: 'vote_update' })
                    ↓
User B, C, D... ← Receive update, invalidate TanStack Query cache
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────┐
│                          users                               │
├─────────────────────────────────────────────────────────────┤
│ id (serial PK)           │ Primary key                      │
│ username (text UNIQUE)   │ Login name (3-30 chars)           │
│ email (text UNIQUE)      │ Login identifier                 │
│ name (text)              │ Full name (1-100 chars)           │
│ role (text)              │ user / manager / admin            │
│ organization (text?)     │ Company/org name                 │
│ passwordHash (text?)     │ bcrypt hash (null for OIDC)      │
│ keycloakId (text? UNIQUE)│ OIDC subject ID from Keycloak    │
│ provider (text)          │ 'local' or 'keycloak'            │
│ themePreference (text)   │ light / dark / system            │
│ languagePreference (text)│ de / en                          │
│ emailVerified (boolean)  │ Email address confirmed          │
│ calendarToken (text? UNI)│ Secret for ICS subscription      │
│ isTestData (boolean)     │ Test accounts excluded from prod │
│ isInitialAdmin (boolean) │ First admin (force pwd change)   │
│ deletionRequestedAt (ts?)│ GDPR: Account deletion request   │
│ lastLoginAt (timestamp?) │ Last successful login            │
│ createdAt (timestamp)    │                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ userId (FK)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          polls                               │
├─────────────────────────────────────────────────────────────┤
│ id (UUID PK)             │ Primary key (auto-generated)     │
│ title (text)             │ Poll title (1-200 chars)          │
│ description (text?)      │ Optional description (max 5000)  │
│ type (text)              │ schedule / survey / organization │
│ userId (int FK?)         │ Creator (null for anonymous)     │
│ creatorEmail (text?)     │ Email for anonymous polls        │
│ adminToken (text UNIQUE) │ For owner/admin access (hex)     │
│ publicToken (text UNIQUE)│ For public voting (hex)          │
│ isActive (boolean)       │ Can receive votes                │
│ isAnonymous (boolean)    │ Hide voter names                 │
│ allowAnonymousVoting     │ Guest voting allowed             │
│ allowMultipleSlots       │ Orga: multiple slot signup       │
│ maxSlotsPerUser (int?)   │ Orga: max slots per person       │
│ allowVoteEdit (boolean)  │ Voters can edit submissions      │
│ allowVoteWithdrawal      │ Voters can delete submissions    │
│ resultsPublic (boolean)  │ Results visible to everyone      │
│ allowMaybe (boolean)     │ Schedule: show maybe option      │
│ finalOptionId (int?)     │ Confirmed/finalized option       │
│ isTestData (boolean)     │ Excluded from production stats   │
│ expiresAt (timestamp?)   │ Auto-close date                  │
│ enableExpiryReminder     │ Send reminder before expiry      │
│ expiryReminderHours      │ Hours before expiry to remind    │
│ expiryReminderSent       │ Reminder already sent            │
│ createdAt (timestamp)    │                                  │
│ updatedAt (timestamp)    │                                  │
├─────────────────────────────────────────────────────────────┤
│ Indexes: user_id, type, is_active, expires_at              │
└─────────────────────────────────────────────────────────────┘
       │
       │ pollId (FK)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                       poll_options                           │
├─────────────────────────────────────────────────────────────┤
│ id (serial PK)           │ Primary key                      │
│ pollId (UUID FK)         │ Parent poll                      │
│ text (text)              │ Option label (1-500 chars)       │
│ imageUrl (text?)         │ For survey with images           │
│ altText (text?)          │ Alt text for accessibility       │
│ startTime (timestamp?)   │ Schedule: slot start time (UTC)  │
│ endTime (timestamp?)     │ Schedule: slot end time (UTC)    │
│ maxCapacity (int?)       │ Orga: max signups per slot       │
│ isFreeText (boolean)     │ Survey: free-text answer field   │
│ order (int)              │ Display order                    │
│ createdAt (timestamp)    │                                  │
├─────────────────────────────────────────────────────────────┤
│ Indexes: poll_id                                            │
└─────────────────────────────────────────────────────────────┘
       │
       │ optionId (FK)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                          votes                               │
├─────────────────────────────────────────────────────────────┤
│ id (serial PK)           │ Primary key                      │
│ pollId (UUID FK)         │ Parent poll                      │
│ optionId (int FK)        │ Selected option                  │
│ voterName (text)         │ Display name (1-100 chars)       │
│ voterEmail (text)        │ For confirmation emails          │
│ userId (int FK?)         │ Logged-in user (null for guests) │
│ voterKey (text?)         │ Dedup key: "user:123"/"device:x" │
│ voterSource (text?)      │ "user" or "device"               │
│ response (text)          │ yes/maybe/no/freetext/signup     │
│ comment (text?)          │ Optional comment                 │
│ freeTextAnswer (text?)   │ Survey free-text (max 2000)      │
│ voterEditToken (text?)   │ Unique token for vote editing    │
│ isTestData (boolean)     │ Excluded from production stats   │
│ createdAt (timestamp)    │                                  │
│ updatedAt (timestamp)    │                                  │
├─────────────────────────────────────────────────────────────┤
│ Indexes: poll_id, option_id, voter_email, voter_key,       │
│          voter_edit_token                                    │
└─────────────────────────────────────────────────────────────┘
```

### Supporting Tables

```
┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐
│  system_settings  │  │  email_templates  │  │  notification_logs │
├───────────────────┤  ├───────────────────┤  ├────────────────────┤
│ id (serial PK)    │  │ id (serial PK)    │  │ id (serial PK)     │
│ key (text UNIQUE) │  │ type (text UNIQUE)│  │ pollId (UUID FK)   │
│ value (jsonb)     │  │ name (text)       │  │ type (text)        │
│ description       │  │ subject (text)    │  │ recipientEmail     │
│ updatedAt         │  │ jsonContent (jsonb│  │ sentBy             │
└───────────────────┘  │ htmlContent (text)│  │ sentByGuest (bool) │
                       │ textContent (text)│  │ success (boolean)  │
                       │ variables (jsonb) │  │ errorMessage       │
                       │ isDefault (bool)  │  │ createdAt          │
                       │ isActive (bool)   │  └────────────────────┘
                       │ createdAt         │
                       │ updatedAt         │
                       └───────────────────┘

┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│  password_reset_tokens│  │  email_change_tokens  │  │  email_verification_  │
├───────────────────────┤  ├───────────────────────┤  │  tokens               │
│ id (serial PK)        │  │ id (serial PK)        │  ├───────────────────────┤
│ userId (int FK)       │  │ userId (int FK)       │  │ id (serial PK)        │
│ token (text UNIQUE)   │  │ newEmail (text)       │  │ userId (int FK)       │
│ expiresAt (timestamp) │  │ token (text UNIQUE)   │  │ token (text UNIQUE)   │
│ usedAt (timestamp?)   │  │ expiresAt (timestamp) │  │ expiresAt (timestamp) │
│ createdAt (timestamp) │  │ usedAt (timestamp?)   │  │ createdAt (timestamp) │
├───────────────────────┤  │ createdAt (timestamp) │  ├───────────────────────┤
│ Idx: token, user_id   │  ├───────────────────────┤  │ Idx: token, user_id   │
└───────────────────────┘  │ Idx: token, user_id   │  └───────────────────────┘
                           └───────────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐
│     test_runs     │  │    test_results   │  │  test_configurations  │
├───────────────────┤  ├───────────────────┤  ├───────────────────────┤
│ id (serial PK)    │  │ id (serial PK)    │  │ id (serial PK)        │
│ status (text)     │  │ runId (int FK)    │  │ testId (text UNIQUE)  │
│ triggeredBy       │  │ testFile (text)   │  │ testFile (text)       │
│ totalTests        │  │ testName (text)   │  │ testName (text)       │
│ passed            │  │ category (text)   │  │ testType (text)       │
│ failed            │  │ status (text)     │  │ category (text)       │
│ skipped           │  │ duration (int)    │  │ description (text?)   │
│ duration          │  │ error (text?)     │  │ enabled (boolean)     │
│ startedAt         │  │ errorStack        │  │ lastStatus (text?)    │
│ completedAt       │  │ createdAt         │  │ lastRunAt (timestamp?)│
└───────────────────┘  └───────────────────┘  │ createdAt             │
                                               │ updatedAt             │
                                               └───────────────────────┘

┌─────────────────────────┐
│     clamav_scan_logs    │
├─────────────────────────┤
│ id (serial PK)          │
│ filename (text)         │
│ fileSize (int)          │
│ mimeType (text?)        │
│ scanStatus (text)       │
│ virusName (text?)       │
│ errorMessage (text?)    │
│ actionTaken (text)      │
│ uploaderUserId (int?)   │
│ uploaderEmail (text?)   │
│ requestIp (text?)       │
│ scanDurationMs (int?)   │
│ adminNotifiedAt (ts?)   │
│ createdAt (timestamp)   │
└─────────────────────────┘
```

### Poll Types & Option Types

| Poll Type | Option Fields | Vote Response | Special Logic |
|-----------|---------------|---------------|---------------|
| **Schedule** | startTime, endTime | yes/maybe/no | Best Match Calculation, Calendar Export (ICS), Finalization |
| **Survey** | text, imageUrl, isFreeText | yes/maybe/no/freetext | Percentage Calculation, Free-Text Answers |
| **Organization** | text, maxCapacity | signup (→ yes) + comment | Row-Level Locking, Advisory Locks, Capacity Enforcement, Real-Time Slot Updates |

---

## Core Concepts

### 1. Token-Based Access

Every poll has two tokens:
- **Public Token (publicToken):** For sharing — voting + viewing results
- **Admin Token (adminToken):** For owner — editing, deleting, managing, finalizing

Additionally, each vote can have:
- **Voter Edit Token (voterEditToken):** Allows anonymous voters to edit/withdraw their submission

**Owner on Public URL:** When a logged-in poll creator accesses their poll via the public URL, the system detects ownership (`userId` match) and automatically shows all admin features — the same as via the admin URL.

**Why?**
- No login required for basic participation
- Owner can manage without exposing admin token
- Voters can modify their own votes via unique link

### 2. Polymorphic Poll Types

All three poll types share the same `polls` table but have different `options` structures:

```typescript
type PollBase = {
  id: string;  // UUID
  title: string;
  type: 'schedule' | 'survey' | 'organization';
  publicToken: string;
  adminToken: string;
  finalOptionId?: number;  // Set when owner confirms a result
};

type ScheduleOption = {
  text: string;
  startTime: Date;  // UTC
  endTime?: Date;   // UTC
};

type SurveyOption = {
  text: string;
  imageUrl?: string;
  altText?: string;
  isFreeText?: boolean;  // Enables free-text answer input
};

type OrganizationOption = {
  text: string;
  maxCapacity: number;  // 0 = unlimited
};
```

### 3. Real-Time Architecture

**WebSocket Server** runs alongside Express on `/ws`:

```
Messages:
  join     → Subscribe to poll room
  leave    → Leave poll room
  
Broadcasts:
  vote_update       → New/changed vote
  slot_update       → Capacity change (Orga)
  results_refresh   → Full results invalidation
  presence_update   → Active participant count
```

**Client subscribes via `useLiveVoting` hook** — manages WebSocket connection, presence tracking, and TanStack Query cache invalidation.

### 4. Authentication Model

```
                    ┌──────────────────┐
                    │   extractUserId  │
                    │   middleware     │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
            ┌───────▼──────┐  ┌──────▼───────┐
            │ Session Cookie│  │ Bearer Token │
            │ (polly.sid)  │  │ (Keycloak)   │
            └──────────────┘  └──────────────┘

Middleware chain:
  extractUserId    → Checks session OR Bearer token
  requireAuth      → Ensures user is authenticated
  requireAdmin     → Ensures admin role
  requireEmailVerified → Ensures email is verified
```

**Session Management:**
- Store: PostgreSQL (`connect-pg-simple`) or MemoryStore (fallback)
- Cookie: `polly.sid`, HttpOnly, SameSite=Lax, Secure=auto
- Expiry: 24 hours
- Role-based idle timeout: Admin 8h, Manager 4h, User 1h
- Session regeneration on login/register (session fixation prevention)

---

## Feature Architecture

### Email Template System (V3)

```
Template Rendering Pipeline:
  1. Load template by type from DB
  2. Check isDefault → use V3 body builder OR custom htmlContent
  3. Wrap in v3Shell() (beige outer, white card, compact header)
  4. Substitute {{VARIABLE}} placeholders
  5. Apply htmlEscape() on user-supplied variables
  6. Embed logo as base64 data URI (5-min cache)
  7. Apply ensureButtonTextContrast() for button accessibility
  8. Load centralized footer from getEmailFooter()
  9. Render footer markup ({{link:URL|Label}} syntax)
  10. Generate plain-text version via stripFooterMarkupToText()
```

**Template Types:** `poll_created`, `invitation`, `vote_confirmation`, `reminder`, `password_reset`, `email_change`, `password_changed`, `welcome`, `test_report`, `poll_finalized`

### Calendar Integration

- **ICS Export:** Download calendar file for finalized poll dates (only available after finalization)
- **ICS Feed (webcal):** Subscribe to personal calendar feed with all participated polls
- **Finalization:** Owner confirms a poll option → optionally closes poll + notifies participants with ICS attachment
- **Empty ICS Protection:** Backend returns 400 error if options have no valid date/time values

### AI Features (Optional)

Requires `AI_API_KEY` environment variable. Auto-enabled unless admin disables.

- **Poll Creation Assistant:** Natural language → structured poll suggestion via OpenAI-compatible API
- **Voice Input (Whisper):** Microphone recording → audio transcription → text input
- **Admin Controls:** Enable/disable, usage quotas, model selection

### Admin Panel

```
client/src/pages/admin.tsx
└── Admin Panel Tabs:
    ├── OverviewPanel.tsx        → Stats, system health, recent activity
    ├── UsersPanel.tsx           → User CRUD, role management, email verification
    ├── PollsPanel.tsx           → All polls, moderation, deletion
    ├── CustomizePanel.tsx       → Branding, theme, footer, language, Matrix, email templates
    ├── SettingsPanel.tsx        → Security, rate limits, session timeout, calendar, ClamAV, AI
    ├── MonitoringPanel.tsx      → System status, npm audit, system packages, pentest tools
    ├── TestsPanel.tsx           → Test runner, test history, data cleanup
    └── DeletionRequestsPanel   → GDPR Art. 17 deletion queue
```

### Frontend Page Architecture

```
client/src/pages/
├── home.tsx              → Landing page with AI chat + quick-start
├── login.tsx             → Combined login + registration
├── poll.tsx              → Main poll view (vote, results, live, tools)
├── my-polls.tsx          → User dashboard (active/archived polls)
├── create-poll.tsx       → Schedule poll creation
├── create-survey.tsx     → Survey creation
├── create-organization.tsx → Organization list creation
├── poll-success.tsx      → Post-creation success page
├── vote-success.tsx      → Post-voting confirmation
├── vote-edit.tsx         → Edit/withdraw existing votes
├── profile.tsx           → User profile & security settings
├── admin.tsx             → Admin dashboard
├── confirm-email.tsx     → Email verification handler
├── forgot-password.tsx   → Password recovery request
├── reset-password.tsx    → Password reset form
└── not-found.tsx         → 404 page
```

### Context Providers

```
client/src/contexts/
├── AuthContext.tsx          → User session, login/logout, auth methods
├── CustomizationContext.tsx → Dynamic CSS variables, branding, system language
└── ThemeContext.tsx         → Light/Dark/System theme management
```

---

## Security Architecture

### Rate Limiting

| Endpoint | Max Attempts | Window | Lockout |
|----------|-------------|--------|---------|
| Login | 5 | 15 min | 15 min (IP + account) |
| Registration | 5 | 1 hour | – |
| Password Reset | 3 | 15 min | – |
| Email Check | 10 | 1 min | – |
| AI Features | Role-based | Configurable | – |
| Voting | Configurable | Configurable | – |

All rate limit settings are dynamically configurable via Admin API.

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 digit (0-9)
- At least 1 special character

### Security Hardening

- `X-Powered-By` disabled
- `Cache-Control: no-store` on all API responses
- JSON body limit: 1MB
- Field-level input length validation (voter names 100, option text 500, description 5000, email 254)
- `autocomplete="off"` on all password fields
- Generic error messages (no stack traces or `error.message` leaks)
- Content Security Policy (CSP) headers
- HSTS in production
- X-Frame-Options for clickjacking prevention
- Permissions-Policy for browser feature restriction
- SSRF-safe URL validation for logo fetching (only http/https protocols)
- XSS-safe data URI validation for embedded logos

### GDPR Compliance

- Account deletion request flow (Art. 17)
- Admin approval/rejection queue
- External deprovisioning API (Basic Auth, for Keycloak/Kafka)
- `anonymize` option (preserve data, remove identity)

---

## Deployment Architecture

### Docker Deployment

```
┌──────────────────────────────────┐
│         Docker Container         │
│  ┌────────────────────────────┐  │
│  │      Node.js Server       │  │
│  │  (Express + Vite SSR)     │  │
│  │  Port: 3080 (internal)    │  │
│  └────────────┬───────────────┘  │
│               │                  │
│  ┌────────────▼───────────────┐  │
│  │   docker-entrypoint.sh    │  │
│  │   - Wait for PostgreSQL   │  │
│  │   - Run ensureSchema.ts   │  │
│  │   - Seed admin user       │  │
│  │   - Start server          │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
         │
         │ DATABASE_URL
         ▼
┌──────────────────────────────────┐
│        PostgreSQL (external)     │
└──────────────────────────────────┘
```

### Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption key |
| `APP_URL` | Yes | Public URL (for emails, OIDC redirects) |
| `SMTP_HOST` | No | SMTP server for emails |
| `SMTP_PORT` | No | SMTP port |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SENDGRID_API_KEY` | No | SendGrid API key (alternative to SMTP) |
| `KEYCLOAK_REALM_URL` | No | Keycloak OIDC realm URL |
| `KEYCLOAK_CLIENT_ID` | No | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | No | OIDC client secret |
| `AI_API_KEY` | No | OpenAI-compatible API key |
| `AI_API_URL` | No | AI endpoint URL |
| `HIDE_LOGIN_FORM` | No | Hide local login when SSO is primary |
| `ADMIN_USERNAME` | No | Initial admin username (seed) |
| `ADMIN_EMAIL` | No | Initial admin email (seed) |
| `ADMIN_PASSWORD` | No | Initial admin password (seed) |

### Schema Management

Schema changes involve updating `shared/schema.ts` and `server/scripts/ensureSchema.ts`. The `ensureSchema.ts` script automatically adds missing columns, tables, and indexes on startup — no manual migration needed.

---

## Architecture Decision Records

### ADR-001: Monolithic Architecture

**Status:** Accepted  
**Context:** Polly serves teams of 10-500 users, typically self-hosted.

**Decision:** Single Node.js process serving both frontend and API.

**Consequences:**
- ✅ Single Docker container deployment
- ✅ Shared TypeScript types between frontend and backend
- ✅ Simple WebSocket integration (same process)
- ❌ Vertical scaling only (single instance)

---

### ADR-002: PostgreSQL as Sole Datastore

**Status:** Accepted  
**Context:** Need reliable storage for polls, votes, sessions, and settings.

**Decision:** PostgreSQL for everything — application data, sessions (`connect-pg-simple`), and system settings.

**Consequences:**
- ✅ Single dependency to manage
- ✅ ACID transactions for slot booking
- ✅ JSONB for flexible settings storage
- ❌ No built-in caching (in-memory admin cache as workaround)

---

### ADR-003: Token-Based Poll Access

**Status:** Accepted  
**Context:** Polls need to be shareable without requiring authentication.

**Decision:** Each poll gets a `publicToken` (sharing) and `adminToken` (management). Votes get an optional `voterEditToken`. Logged-in owners see admin features on public URL.

**Consequences:**
- ✅ Anonymous participation (no account required)
- ✅ Simple URL sharing
- ✅ Owner convenience (admin features visible on any URL when logged in)
- ❌ Token compromise = full access (mitigated by separate public/admin tokens)

---

### ADR-004: WebSocket for Real-Time Updates

**Status:** Accepted  
**Context:** Organization polls need instant capacity updates to prevent overbooking.

**Decision:** Native WebSocket server (`ws` library) alongside Express.

**Consequences:**
- ✅ Sub-second updates for slot booking
- ✅ Live voting presentation mode
- ✅ Presence tracking (active participant count)
- ❌ Requires sticky sessions for horizontal scaling

---

### ADR-005: V3 Email Template System

**Status:** Accepted  
**Context:** Need customizable, branded emails that work across email clients and support dark mode.

**Decision:** Server-side HTML rendering with V3 shell template, `{{VARIABLE}}` substitution, centralized footer, and base64-embedded logos.

**Consequences:**
- ✅ Consistent branding across all email types
- ✅ Admin can customize templates via visual builder
- ✅ Dark mode support via `@media (prefers-color-scheme: dark)`
- ✅ XSS-safe variable substitution
- ❌ Complex rendering pipeline

---

### ADR-006: WCAG 2.1 AA Default Compliance

**Status:** Accepted  
**Context:** Public sector deployment requires accessibility compliance.

**Decision:** Ship with WCAG AA compliant color scheme by default. Admin can override for corporate branding (takes responsibility for compliance).

1. **Default Mode (`enforceDefaultTheme: true`):**
   - System ships with WCAG AA compliant color scheme
   - Automated color contrast audit in admin panel

2. **Custom Mode (`enforceDefaultTheme: false`):**
   - Auto-enabled when admin customizes theme colors
   - Admin takes responsibility for accessibility compliance

3. **API Endpoint:**
   - `GET /api/v1/settings/accessibility` returns current compliance mode

**Consequences:**
- ✅ Meets public sector accessibility requirements out of the box
- ✅ Admin can override for corporate branding
- ✅ Clear responsibility handoff when colors are customized
- ❌ More restrictive color choices by default

---

### ADR-007: System-Wide Default Language

**Status:** Accepted  
**Context:** Anonymous visitors should see the admin-configured language, not browser-detected.

**Decision:** System-wide `defaultLanguage` setting in customization. i18n loads system language from `/api/v1/system/language` on startup. Per-user language preference overrides system default for logged-in users.

**Consequences:**
- ✅ Consistent experience for anonymous visitors
- ✅ Admin controls default language
- ✅ Per-user preference still works
- ❌ Extra API call on app initialization

---

## API Documentation

- **REST API Reference:** `docs/API-DOCUMENTATION.md` — Complete endpoint documentation with schemas, auth requirements, and error codes. **Must be updated when API changes.**
- **OpenAPI Spec:** `docs/openapi.yaml` — Machine-readable API specification for Flutter/Mobile integration.
- **Flutter Integration:** `docs/FLUTTER_INTEGRATION.md` — Mobile app integration guide.
- **Self-Hosting Guide:** `docs/SELF-HOSTING.md` — Docker/Production deployment instructions.

---

## Test Coverage (454+ tests)

- **API**: 174 tests (admin CRUD, user profile/theme/language, poll CRUD/voting/export, email templates, security, validation)
- **Auth**: 55 tests (login, registration, password reset, session persistence, cookie security)
- **Polls**: 30 tests (CRUD, voting, finalize, types)
- **Data/Storage**: 40 tests (settings, branding, storage, test data)
- **Unit**: 34 tests (validation, token service, QR service)
- **Services**: 132+ tests (email templates 63, email integration 13, live voting WebSocket multi-user 19, image upload file types 16, ClamAV, ICS, PDF, WCAG audit)
- **Security**: 31 tests (WebSocket presenter escalation, poll token validation, email HTML escaping/XSS, deprovision Basic Auth, timing attack resistance)
- **E2E/Integration**: 49 tests (poll flow, multi-voter, Docker build, deployment readiness, DB migration)

---

## Future Considerations

### Potential Enhancements

1. **Caching Layer (Redis)**
   - Cache poll data (5-minute TTL)
   - Session store in Redis (better performance)
   - Rate limiting with Redis
   - **When:** > 1000 concurrent users

2. **Queue System (BullMQ)**
   - Background email sending
   - Scheduled expiry reminders
   - PDF generation queue
   - **When:** Email sending becomes bottleneck

3. **CDN for Static Assets**
   - Serve JS/CSS/Images from Cloudflare
   - **When:** Global user base

4. **Horizontal Scaling**
   - Multiple app instances behind load balancer
   - Redis session store (required)
   - WebSocket sticky sessions
   - **When:** > 10,000 concurrent users

5. **Mobile App (Flutter)**
   - See `docs/FLUTTER_INTEGRATION.md` for API documentation
   - Native push notifications
   - Offline voting (sync when online)

---

**Maintained by:** @manfredsteger  
**Version History:**
- v3.0 (2026-03-25): Complete rewrite to match actual codebase. Added all tables (email_verification_tokens, test_configurations), corrected clamav_scan_logs schema, added finalOptionId/isFreeText/freeTextAnswer/emailVerified fields, updated service/route/component listings, added ADR-007 (system language), updated security architecture, added calendar/ICS and AI feature documentation.
- v2.0 (2026-01-08): Updated to current implementation, added WCAG, security scanning, calendar integration.
- v1.0 (2026-01-05): Initial architecture documentation.
