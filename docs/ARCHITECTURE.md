# Polly Architecture Documentation

**Version:** 2.0  
**Last Updated:** 2026-01-08  
**Status:** Pre-Beta (WCAG 2.1 AA Compliant)

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
2. **Survey Polls** (Umfragen) - Classic polls with text/image options
3. **Organization Lists** (Orga-Listen) - Slot booking with capacity management

### Key Characteristics

- **Self-Hosted:** No cloud dependencies, full data ownership
- **Multi-Language:** German & English (extensible via i18next)
- **Real-Time:** WebSocket-based live updates
- **GDPR-Compliant:** Privacy-first design with account deletion workflow
- **WCAG 2.1 AA Compliant:** Accessibility-first for public sector use
- **Anonymous & Authenticated:** Works for guests and registered users
- **Enterprise SSO:** Optional Keycloak OIDC integration

---

## Architecture Principles

### 1. Simplicity Over Complexity
- **Monolithic architecture** (not microservices) for easier deployment
- Single Docker container for production
- PostgreSQL as the only database (no Redis required for MVP)

### 2. Developer Experience
- **TypeScript everywhere** (frontend + backend)
- **Shared types** between client and server (`/shared/schema.ts`)
- **Hot-reload** in development
- **Type-safe database queries** with Drizzle ORM

### 3. Performance & Scalability
- **WebSocket** for real-time updates (scales to ~100 concurrent users per instance)
- **Database indexing** on critical queries
- **Row-level locking + Advisory locks** for race condition prevention (slot booking)

### 4. Security First
- **Server-side validation** with Zod
- **Session-based authentication** (not JWT for better security)
- **Rate limiting** on login endpoints (5 failed attempts → 15 min lockout)
- **XSS prevention** through React auto-escaping
- **ClamAV integration** for file upload scanning (optional)

### 5. Accessibility First
- **WCAG 2.1 AA compliant** by default
- **Color contrast ratios** meet 4.5:1 minimum
- **Focus indicators** on all interactive elements
- **Screen reader compatible** with ARIA labels
- **Admin override** available for corporate design requirements

### 6. Extensibility
- **Plugin-ready** i18n system (easy to add new languages)
- **Customizable theming** via admin panel
- **Modular poll types** (easy to add new types)
- **Email template editor** with visual builder

---

## Technology Stack

### Frontend
```
React 18           → UI library
TypeScript         → Type safety
Vite               → Build tool & dev server
TanStack Query v5  → Data fetching & caching
Shadcn/ui          → Component library (Radix UI based)
Radix UI           → Headless UI primitives
Tailwind CSS       → Styling
Wouter             → Lightweight routing
react-i18next      → Internationalization
Framer Motion      → Animations
Recharts           → Charts & visualizations
```

### Backend
```
Node.js 22 LTS     → Runtime
Express.js         → Web framework
TypeScript         → Type safety
Drizzle ORM        → Database queries
PostgreSQL         → Database (Neon-backed on Replit)
Passport.js        → Authentication (local + OIDC)
express-session    → Session management
connect-pg-simple  → PostgreSQL session store
ws                 → WebSocket server
Nodemailer         → Email sending
Puppeteer          → PDF generation
```

### DevOps
```
Docker             → Containerization
Docker Compose     → Local development & production
Playwright         → E2E testing
axe-core           → Accessibility testing
Vitest             → Unit testing
GitHub Actions     → CI/CD
GitLab CI          → Alternative CI/CD
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
│                  │   (storage.ts)     │                     │
│                  └─────────┬──────────┘                     │
│                            │                                │
│         ┌──────────────────┼──────────────────┐             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Nodemailer │    │  Puppeteer  │    │  ClamAV     │     │
│  │  (Email)    │    │  (PDF)      │    │  (Scanning) │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
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

### Request Flow

#### 1. Poll Creation (Authenticated User)
```
User → React Form → POST /api/v1/polls
                    ↓
                Check Auth (session)
                    ↓
                Validate (Zod)
                    ↓
                Insert to DB (Drizzle)
                    ↓
                Generate Tokens (publicToken, adminToken)
                    ↓
                Return Poll Data
                    ↓
User ← Poll Detail Page
```

#### 2. Vote Submission (Anonymous or Authenticated)
```
User → React Form → POST /api/v1/polls/:token/vote
                    ↓
                Validate Input (Zod)
                    ↓
                Check Poll Exists & Active
                    ↓
                Check Poll Not Expired
                    ↓
                [Organization Only] Acquire Advisory Lock
                    ↓
                Insert/Update Vote (with transaction)
                    ↓
                Broadcast to WebSocket Clients
                    ↓
                [Optional] Send Email Confirmation
                    ↓
User ← Confirmation + Edit Link (voterEditToken)
```

#### 3. Real-Time Updates
```
User A votes → Server receives vote
                    ↓
                WebSocket.broadcast({ type: 'vote_update' })
                    ↓
User B, C, D... ← Receive update, invalidate cache
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────┐
│                          users                               │
├─────────────────────────────────────────────────────────────┤
│ id (serial PK)           │ Primary key                      │
│ username (text UNIQUE)   │ Display name                     │
│ email (text UNIQUE)      │ Login identifier                 │
│ name (text)              │ Full name                        │
│ role (text)              │ user / admin / manager           │
│ organization (text)      │ Company/org name                 │
│ passwordHash (text?)     │ bcrypt hash (null for OIDC)      │
│ keycloakId (text?)       │ OIDC subject ID from Keycloak    │
│ provider (text)          │ 'local' or 'keycloak'            │
│ themePreference (text)   │ light / dark / system            │
│ languagePreference (text)│ de / en                          │
│ calendarToken (text?)    │ Secret for ICS subscription      │
│ isTestData (boolean)     │ Test accounts excluded from prod │
│ isInitialAdmin (boolean) │ First admin created at startup   │
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
│ title (text)             │ Poll title                       │
│ description (text?)      │ Optional description             │
│ type (text)              │ schedule / survey / organization │
│ userId (int FK?)         │ Creator (null for anonymous)     │
│ creatorEmail (text?)     │ Email for anonymous polls        │
│ adminToken (text UNIQUE) │ For owner/admin access           │
│ publicToken (text UNIQUE)│ For public voting                │
│ isActive (boolean)       │ Can receive votes                │
│ isAnonymous (boolean)    │ Hide voter names                 │
│ allowAnonymousVoting     │ Guest voting allowed             │
│ allowMultipleSlots       │ Orga: multiple slot signup       │
│ maxSlotsPerUser (int?)   │ Orga: max slots per person       │
│ allowVoteEdit (boolean)  │ Voters can edit submissions      │
│ allowVoteWithdrawal      │ Voters can delete submissions    │
│ resultsPublic (boolean)  │ Results visible to everyone      │
│ allowMaybe (boolean)     │ Schedule: show maybe option      │
│ isTestData (boolean)     │ Excluded from production stats   │
│ expiresAt (timestamp?)   │ Auto-close date                  │
│ enableExpiryReminder     │ Send reminder before expiry      │
│ expiryReminderHours      │ Hours before expiry to remind    │
│ expiryReminderSent       │ Reminder already sent            │
│ createdAt (timestamp)    │                                  │
│ updatedAt (timestamp)    │                                  │
└─────────────────────────────────────────────────────────────┘
       │
       │ pollId (FK)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                       pollOptions                            │
├─────────────────────────────────────────────────────────────┤
│ id (serial PK)           │ Primary key                      │
│ pollId (UUID FK)         │ Parent poll                      │
│ text (text)              │ Option label                     │
│ imageUrl (text?)         │ For survey with images           │
│ altText (text?)          │ Alt text for accessibility       │
│ startTime (timestamp?)   │ Schedule: slot start time (UTC)  │
│ endTime (timestamp?)     │ Schedule: slot end time (UTC)    │
│ maxCapacity (int?)       │ Orga: max signups per slot       │
│ order (int)              │ Display order                    │
│ createdAt (timestamp)    │                                  │
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
│ voterName (text)         │ Display name                     │
│ voterEmail (text)        │ For confirmation emails          │
│ userId (int FK?)         │ Logged-in user (null for guests) │
│ voterKey (text?)         │ Dedup key: "user:123" / "device:x"│
│ voterSource (text?)      │ "user" or "device"               │
│ response (text)          │ yes / maybe / no / signup        │
│ comment (text?)          │ Optional comment                 │
│ voterEditToken (text?)   │ Unique token for vote editing    │
│ createdAt (timestamp)    │                                  │
│ updatedAt (timestamp)    │                                  │
└─────────────────────────────────────────────────────────────┘
```

### Supporting Tables

```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  systemSettings   │  │  emailTemplates   │  │  notificationLogs │
├───────────────────┤  ├───────────────────┤  ├───────────────────┤
│ id (serial PK)    │  │ id (serial PK)    │  │ id (serial PK)    │
│ key (text UNIQUE) │  │ type (text UNIQUE)│  │ pollId (UUID FK)  │
│ value (jsonb)     │  │ name (text)       │  │ type (text)       │
│ description       │  │ subject (text)    │  │ recipientEmail    │
│ updatedAt         │  │ jsonContent (json)│  │ sentBy            │
└───────────────────┘  │ htmlContent       │  │ success (boolean) │
                       │ textContent       │  │ errorMessage      │
                       │ variables (json)  │  │ createdAt         │
                       │ isDefault         │  └───────────────────┘
                       │ isActive          │
                       │ createdAt         │
                       │ updatedAt         │
                       └───────────────────┘

┌───────────────────────┐  ┌───────────────────────┐
│  passwordResetTokens  │  │  emailChangeTokens    │
├───────────────────────┤  ├───────────────────────┤
│ id (serial PK)        │  │ id (serial PK)        │
│ userId (int FK)       │  │ userId (int FK)       │
│ token (text UNIQUE)   │  │ newEmail (text)       │
│ expiresAt (timestamp) │  │ token (text UNIQUE)   │
│ usedAt (timestamp?)   │  │ expiresAt (timestamp) │
│ createdAt (timestamp) │  │ usedAt (timestamp?)   │
└───────────────────────┘  │ createdAt (timestamp) │
                           └───────────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│     testRuns      │  │    testResults    │  │  clamavScanLogs   │
├───────────────────┤  ├───────────────────┤  ├───────────────────┤
│ id (serial PK)    │  │ id (serial PK)    │  │ id (serial PK)    │
│ status (text)     │  │ runId (int FK)    │  │ filename (text)   │
│ triggeredBy       │  │ testFile (text)   │  │ fileSize (int)    │
│ totalTests        │  │ testName (text)   │  │ mimeType (text)   │
│ passed            │  │ category (text)   │  │ scanResult        │
│ failed            │  │ status (text)     │  │ isInfected        │
│ skipped           │  │ duration (int)    │  │ virusName         │
│ duration          │  │ error (text?)     │  │ scannedBy         │
│ startedAt         │  │ errorStack        │  │ createdAt         │
│ completedAt       │  │ createdAt         │  └───────────────────┘
└───────────────────┘  └───────────────────┘
```

### Poll Types & Option Types

| Poll Type | Option Fields | Vote Response | Special Logic |
|-----------|---------------|---------------|---------------|
| **Schedule** | startTime, endTime | yes/maybe/no | Best Match Calculation, Calendar Export |
| **Survey** | text, imageUrl | Single/Multiple Choice | Percentage Calculation |
| **Organization** | text, maxCapacity | signup + comment | Row-Level Locking, Capacity Enforcement |

---

## Core Concepts

### 1. Token-Based Access

Every poll has two tokens:
- **Public Token:** For sharing (voting + viewing results)
- **Admin Token:** For owner (editing, deleting, managing)

Additionally, each vote can have:
- **Voter Edit Token:** Allows anonymous voters to edit their submission

**Why?** 
- No login required for basic participation
- Owner can edit without exposing admin rights
- Voters can modify their own votes via unique link

### 2. Polymorphic Poll Types

All three poll types share the same `polls` table but have different `options` structures:

```typescript
// Shared Poll Base
type PollBase = {
  id: string; // UUID
  title: string;
  type: 'schedule' | 'survey' | 'organization';
  publicToken: string;
  adminToken: string;
};

// Type-Specific Options
type ScheduleOption = {
  text: string; // Display label (can be auto-formatted)
  startTime: Date; // UTC
  endTime?: Date; // UTC
};

type SurveyOption = {
  text: string;
  imageUrl?: string;
  altText?: string; // Accessibility
};

type OrganizationOption = {
  text: string;
  maxCapacity: number; // 0 = unlimited
};
```

### 3. Real-Time Architecture

**WebSocket Server** runs alongside Express on `/ws`:

```typescript
// server/websocket.ts
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'join') {
      // Subscribe to poll updates
      ws.pollId = msg.pollId;
    }
  });
});

// Broadcast vote update to all clients watching this poll
function broadcastVoteUpdate(pollId: string, data: any) {
  wss.clients.forEach((client) => {
    if (client.pollId === pollId) {
      client.send(JSON.stringify({ type: 'vote_update', ...data }));
    }
  });
}

// Broadcast slot capacity update (for organization polls)
function broadcastSlotUpdate(pollId: string, optionId: number, currentCount: number) {
  wss.clients.forEach((client) => {
    if (client.pollId === pollId) {
      client.send(JSON.stringify({ 
        type: 'slot_update', 
        optionId, 
        currentCount 
      }));
    }
  });
}
```

**Client subscribes via `useLiveVoting` hook:**

```typescript
// client/src/hooks/useLiveVoting.ts
useEffect(() => {
  const ws = new WebSocket(`wss://${host}/ws`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', pollId }));
  };
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    if (update.type === 'vote_update') {
      queryClient.invalidateQueries(['poll', pollId]);
    }
    if (update.type === 'slot_update') {
      setLiveSlotUpdates(prev => ({
        ...prev,
        [update.optionId]: update.currentCount
      }));
    }
  };
}, [pollId]);
```

### 4. Race Condition Prevention (Slot Booking)

**Problem:** Two users booking the last slot simultaneously.

**Solution:** PostgreSQL advisory locks + row-level locking

```typescript
// server/storage.ts
async function bookSlot(pollId: string, optionId: number, voterEmail: string) {
  return await db.transaction(async (tx) => {
    // Acquire advisory lock based on poll + voter email
    // Prevents same user from double-booking simultaneously
    const lockKey = hashToInt(`${pollId}:${voterEmail}`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
    
    // Lock the option row
    const [slot] = await tx
      .select()
      .from(pollOptions)
      .where(eq(pollOptions.id, optionId))
      .for('update'); // Row-level lock
    
    // Count current bookings
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(and(
        eq(votes.optionId, optionId),
        eq(votes.response, 'signup')
      ));
    
    // Check capacity
    if (slot.maxCapacity && count >= slot.maxCapacity) {
      throw new Error('SLOT_FULL');
    }
    
    // Check if already signed up
    const existing = await tx.select().from(votes)
      .where(and(
        eq(votes.pollId, pollId),
        eq(votes.voterEmail, voterEmail)
      ));
    
    if (existing.length > 0 && !poll.allowMultipleSlots) {
      throw new Error('ALREADY_SIGNED_UP');
    }
    
    // Insert vote
    await tx.insert(votes).values({ 
      pollId, 
      optionId, 
      voterEmail,
      response: 'signup' 
    });
    
    // Broadcast update
    broadcastSlotUpdate(pollId, optionId, count + 1);
  });
}
```

**Why Advisory Locks + FOR UPDATE?**
- Advisory lock prevents same user from racing against themselves
- Row-level lock prevents different users from overbooking
- Both release automatically when transaction commits
- Returns clear error codes: `SLOT_FULL` (409) or `ALREADY_SIGNED_UP` (409)

---

## Feature Architecture

### 1. Authentication System

```
┌─────────────────────────────────────────────────────────────┐
│                  Authentication Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐      │
│  │   Local    │     │  Keycloak  │     │ Anonymous  │      │
│  │   Login    │     │   OIDC     │     │   Token    │      │
│  └─────┬──────┘     └─────┬──────┘     └─────┬──────┘      │
│        │                  │                   │             │
│        ▼                  ▼                   ▼             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Passport.js Strategies                  │  │
│  │  • passport-local (email/password + bcrypt)          │  │
│  │  • openid-client (Keycloak/OIDC)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               express-session                         │  │
│  │  • Store: PostgreSQL (connect-pg-simple)             │  │
│  │  • Cookie: polly.sid (httpOnly, secure='auto')       │  │
│  │  • TTL: Configurable (default 24h)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Rate Limiting (Login Protection)            │  │
│  │  • 5 failed attempts → 15 min lockout per IP/email   │  │
│  │  • In-memory store (Redis recommended for prod)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**User Roles:**
| Role | Permissions |
|------|-------------|
| `user` | Create polls, vote, view own polls |
| `manager` | + View all polls in organization |
| `admin` | + System settings, user management, email templates |

### 2. Email System

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Email Template Editor (Admin)              │ │
│  │  • Visual builder (@usewaypoint/email-builder)         │ │
│  │  • JSON storage in database                            │ │
│  │  • Variable substitution ({pollTitle}, {voterName})    │ │
│  │  • Preview & test functionality                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Email Service (Nodemailer)                 │ │
│  │  • SMTP transport (configurable)                       │ │
│  │  • SendGrid integration (optional)                     │ │
│  │  • HTML + plain text versions                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Notification Logs (Audit)                  │ │
│  │  • All sent emails logged to database                  │ │
│  │  • Rate limiting: Max 10 emails per poll per day       │ │
│  │  • Success/failure tracking                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Email Template Types:**
- `poll_created` - Sent to creator after poll creation
- `invitation` - Invite participants to vote
- `vote_confirmation` - Confirm vote submission
- `reminder` - Manual reminder from poll creator
- `expiry_reminder` - Automatic reminder before poll expires
- `password_reset` - Password reset link
- `email_change` - Email change confirmation
- `password_changed` - Password change notification
- `test_report` - Automated test results (admin)

### 3. Calendar Integration

```
┌─────────────────────────────────────────────────────────────┐
│                  Calendar Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Schedule Polls ──────────────────────────────────────────► │
│                                                              │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │  ICS Download  │    │  webcal://     │                   │
│  │  (One-time)    │    │  Subscription  │                   │
│  └───────┬────────┘    └───────┬────────┘                   │
│          │                     │                             │
│          ▼                     ▼                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              ICS Generator                              │ │
│  │  • VEVENT for each option with votes                   │ │
│  │  • VTIMEZONE for correct timezone handling             │ │
│  │  • UID based on pollId + optionId                      │ │
│  │  • ATTENDEE list from vote responses                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Subscription Feed:                                          │
│  • User-specific calendarToken for authentication           │
│  • Auto-updates when polls change                           │
│  • Shows all user's schedule polls with voted dates         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. PDF Export

```
┌─────────────────────────────────────────────────────────────┐
│                   PDF Export Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET /api/v1/polls/admin/:token/export/pdf                  │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              HTML Template Rendering                    │ │
│  │  • Server-side React rendering                         │ │
│  │  • Full CSS styling (matching app theme)               │ │
│  │  • Charts and visualizations (Recharts)                │ │
│  │  • QR code for poll link                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Puppeteer (Headless Chrome)                │ │
│  │  • page.setContent(html)                               │ │
│  │  • page.pdf({ format: 'A4' })                          │ │
│  │  • High-quality vector output                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PDF Response                               │ │
│  │  • Content-Type: application/pdf                       │ │
│  │  • Content-Disposition: attachment                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### 1. Authentication & Authorization

| Layer | Implementation |
|-------|----------------|
| Password Storage | bcrypt (cost factor 10) |
| Session Storage | PostgreSQL (connect-pg-simple) |
| Session Cookie | httpOnly, secure='auto', sameSite=lax |
| Rate Limiting | 5 attempts / 15 min lockout (per IP + email) |
| OIDC | Keycloak (OpenID Connect, optional) |

### 2. Input Validation

```typescript
// All API inputs validated with Zod schemas
// Example: Vote submission
const voteSchema = z.object({
  optionId: z.number().positive(),
  voterName: z.string().min(1).max(100),
  voterEmail: z.string().email(),
  response: z.enum(['yes', 'maybe', 'no', 'signup']),
  comment: z.string().max(500).optional()
});

// Middleware applies validation
app.post('/api/v1/polls/:token/vote', 
  validateBody(voteSchema),
  async (req, res) => { ... }
);
```

### 3. File Upload Security

```
┌─────────────────────────────────────────────────────────────┐
│                 File Upload Security                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Upload Request ─────────────────────────────────────────►  │
│                                                              │
│  ┌────────────────┐                                         │
│  │  Multer        │  • memoryStorage (no disk write)        │
│  │  (Middleware)  │  • File size limit: 5MB                 │
│  │                │  • Allowed types: image/*, pdf          │
│  └───────┬────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌────────────────┐                                         │
│  │  ClamAV Scan   │  • On-the-fly virus scanning           │
│  │  (Optional)    │  • Reject infected files (HTTP 422)    │
│  │                │  • Log all scans to database            │
│  └───────┬────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌────────────────┐                                         │
│  │  Storage       │  • Save to /uploads directory          │
│  │                │  • Generate unique filename             │
│  └────────────────┘                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Security Scanning (Admin)

- **npm audit**: Dependency vulnerability scanning
- **ClamAV**: File upload malware detection
- **Pentest-Tools.com**: External vulnerability scanning (optional, requires API key)
- **System packages**: Nix package version monitoring

---

## Deployment Architecture

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  polly:
    build: .
    ports:
      - "3000:5000"
    environment:
      - DATABASE_URL=postgresql://...
      - SESSION_SECRET=...
      - SMTP_HOST=...
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=polly
      - POSTGRES_USER=polly
      - POSTGRES_PASSWORD=...
    restart: unless-stopped

volumes:
  postgres_data:
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random 32+ char secret |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |
| `SMTP_FROM` | No | Sender email address |
| `KEYCLOAK_ISSUER` | No | Keycloak realm URL |
| `KEYCLOAK_CLIENT_ID` | No | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | No | OIDC client secret |
| `CLAMAV_HOST` | No | ClamAV daemon host |
| `CLAMAV_PORT` | No | ClamAV daemon port |

---

## Architecture Decision Records (ADRs)

### ADR-001: Monolithic Architecture

**Decision:** Single application (not microservices)

**Context:** Polly is designed for small-medium teams (10-1000 users)

**Consequences:**
- ✅ Simple deployment (one Docker container)
- ✅ Easier debugging
- ✅ Lower operational overhead
- ❌ Harder to scale horizontally (future consideration)

### ADR-002: PostgreSQL as Single Database

**Decision:** Use PostgreSQL for everything (data, sessions, advisory locks)

**Context:** Reduces operational complexity

**Consequences:**
- ✅ Single backup strategy
- ✅ Transactional guarantees across all data
- ✅ Built-in row-level locking
- ❌ May need Redis for high-traffic scenarios (caching, rate limiting)

### ADR-003: Session-Based Authentication (not JWT)

**Decision:** Use server-side sessions instead of JWT

**Context:** Better security for stateful applications

**Consequences:**
- ✅ Immediate logout (session invalidation)
- ✅ No token in localStorage (XSS protection)
- ✅ Server-controlled session lifetime
- ❌ Requires sticky sessions for horizontal scaling

### ADR-004: UUID for Poll IDs

**Decision:** Use UUID instead of sequential integers for poll IDs

**Context:** Prevent enumeration attacks, enable URL-based access

**Consequences:**
- ✅ Non-guessable poll URLs
- ✅ Distributed ID generation
- ✅ No need for separate token columns
- ❌ Larger storage, slower indexing

### ADR-005: Row-Level Locking for Slot Booking

**Decision:** Use PostgreSQL `SELECT ... FOR UPDATE` + advisory locks

**Context:** Prevent overbooking in organization polls

**Consequences:**
- ✅ Correct capacity enforcement
- ✅ Simple to implement with Drizzle
- ❌ Slightly slower than optimistic locking
- ✅ Correctness > performance for booking use case

### ADR-006: WCAG 2.1 AA by Default

**Decision:** Ship with accessibility compliance enabled, allow admin override

**Context:** Public sector requirements in Germany (BITV 2.0, EU Directive 2016/2102)

**Implementation:**

1. **Default Mode (`enforceDefaultTheme: true`):**
   - System ships with WCAG AA compliant color scheme
   - Default primary color: `#7A3800` (4.5:1 contrast with white)
   - E2E tests enforce zero critical/serious violations

2. **Custom Mode (`enforceDefaultTheme: false`):**
   - Auto-enabled when admin customizes theme colors in Admin Panel → Anpassen
   - Admin takes responsibility for accessibility compliance
   - E2E tests log warning but don't fail on contrast issues

3. **Environment Override:**
   - Set `POLLY_WCAG_OVERRIDE=true` to disable default theme without UI changes
   - Useful for custom corporate branding in self-hosted instances

4. **API Endpoint:**
   - `GET /api/v1/settings/accessibility` returns current compliance mode
   - Used by E2E tests and frontend to determine enforcement level

5. **axe-core Limitation:**
   - `color-contrast` rule excluded from E2E tests (false positives with CSS variables)
   - Manual verification of all color combinations documented in `index.css`

**Consequences:**
- ✅ Meets public sector accessibility requirements out of the box
- ✅ Better UX for all users
- ✅ Admin can override for corporate branding
- ✅ Clear responsibility handoff when colors are customized
- ❌ More restrictive color choices by default

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

## API Documentation

- **OpenAPI Spec:** `docs/openapi.yaml`
- **Flutter Integration:** `docs/FLUTTER_INTEGRATION.md`
- **Self-Hosting Guide:** `docs/SELF-HOSTING.md`

---

## Questions & Feedback

For architecture discussions, open an issue on GitHub/GitLab:
- 🐛 Bug reports: `architecture:bug` label
- 💡 Feature requests: `architecture:enhancement` label
- 🤔 Questions: `architecture:question` label

---

**Maintained by:** @manfredsteger  
**Version History:**
- v2.0 (2026-01-08): Updated to current implementation, added WCAG, security scanning, calendar integration
- v1.0 (2026-01-05): Initial architecture documentation
