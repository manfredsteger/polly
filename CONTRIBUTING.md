# Beitragen zu Polly

Vielen Dank für Ihr Interesse, zu Polly beizutragen! Diese Anleitung erklärt, wie Sie Tests schreiben und zum Projekt beitragen können.

## Inhaltsverzeichnis

- [Entwicklungsumgebung einrichten](#entwicklungsumgebung-einrichten)
- [Projektstruktur](#projektstruktur)
- [Tests schreiben](#tests-schreiben)
- [Test-Kategorien](#test-kategorien)
- [Code-Stil](#code-stil)
- [Pull Requests](#pull-requests)

## Entwicklungsumgebung einrichten

### Voraussetzungen

- Node.js 22+
- PostgreSQL 15+
- npm oder yarn

### Installation

```bash
# Repository klonen
git clone https://github.com/manfredsteger/polly.git
cd polly

# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env mit Ihren Datenbankzugangsdaten

# Datenbank initialisieren
npm run db:push

# Entwicklungsserver starten
npm run dev
```

## Projektstruktur

```
polly/
├── client/                 # React Frontend
│   └── src/
│       ├── components/     # UI-Komponenten
│       │   └── ai/         # AI Chat Widget & Voice Input
│       ├── pages/          # Seitenkomponenten
│       ├── lib/            # Utilities
│       ├── hooks/          # React Hooks
│       └── locales/        # i18n Übersetzungen (de.json, en.json)
├── server/                 # Express Backend
│   ├── routes/             # API-Routen (modular)
│   │   ├── admin.ts        # Admin-Endpunkte
│   │   ├── auth.ts         # Authentifizierung
│   │   ├── polls.ts        # Umfragen-CRUD
│   │   ├── votes.ts        # Abstimmungen
│   │   ├── ai.ts           # AI-Assistent & Transkription
│   │   └── ...             # Weitere Route-Module
│   ├── services/           # Business-Logik
│   │   ├── aiService.ts    # AI Poll-Erstellung (GWDG SAIA)
│   │   └── whisperService.ts # Spracheingabe (Whisper API)
│   ├── storage.ts          # Datenbank-Interface
│   └── tests/              # Backend-Tests
├── shared/                 # Geteilte TypeScript-Typen
│   ├── schema.ts           # Drizzle-Schema & Zod-Validierung
│   └── servicePartners.ts  # GWDG/KISSKI-Partnerdaten (README + Admin synchron)
├── docs/                   # Dokumentation
│   ├── openapi.yaml        # API-Spezifikation
│   └── SELF-HOSTING.md     # Deployment-Anleitung
├── Dockerfile              # Production Container
└── docker-compose.yml      # Docker Setup
```

## Tests schreiben

Datenbankgestützte Tests benötigen eine separate, initialisierte Datenbank und
`TEST_DATABASE_URL`. Die Anwendungsdatenbank darf nicht verwendet werden.
Einrichtung und datenbankfreie Regressionstests: [TESTING.md](TESTING.md#automated-tests-and-database-isolation).

Polly verwendet [Vitest](https://vitest.dev/) für Backend-Tests und [Playwright](https://playwright.dev/) für E2E-Tests. Die Test-Suite umfasst derzeit **454+ Tests** (Unit, Integration, API, Services, Security, E2E).

### Backend-Tests ausführen

```bash
# Alle Tests ausführen
npx vitest run

# Tests mit Coverage
npx vitest run --coverage

# Einzelne Test-Datei
npx vitest run server/tests/auth/login.test.ts

# Tests im Watch-Modus
npx vitest --watch
```

### Neuen Test erstellen

#### 1. Test-Datei anlegen

Erstellen Sie eine neue Datei in der entsprechenden Kategorie:

```typescript
// server/tests/polls/create-poll.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, resetTestDatabase } from '../fixtures/testHelpers';
import request from 'supertest';

describe('Poll Creation', () => {
  let app: Express.Application;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  describe('POST /api/v1/polls', () => {
    it('sollte eine neue Terminumfrage erstellen', async () => {
      const pollData = {
        title: 'Team-Meeting',
        type: 'schedule',
        options: [
          { text: 'Montag 10:00', startTime: '2024-12-20T10:00:00Z' },
          { text: 'Dienstag 14:00', startTime: '2024-12-21T14:00:00Z' },
        ],
      };

      const response = await request(app)
        .post('/api/v1/polls')
        .send(pollData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Team-Meeting',
        type: 'schedule',
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.adminToken).toBeDefined();
    });

    it('sollte bei fehlendem Titel einen Fehler zurückgeben', async () => {
      const response = await request(app)
        .post('/api/v1/polls')
        .send({ type: 'survey', options: [] })
        .expect(400);

      expect(response.body.error).toContain('title');
    });
  });
});
```

#### 2. Test-Fixtures verwenden

Nutzen Sie die bereitgestellten Test-Helpers:

```typescript
import { 
  createTestApp,
  resetTestDatabase,
  createTestUser,
  createTestPoll,
  loginAsUser,
} from '../fixtures/testHelpers';

describe('Authenticated Poll Operations', () => {
  let app: Express.Application;
  let authCookie: string;
  let testUser: User;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    
    // Testbenutzer erstellen und einloggen
    testUser = await createTestUser({ role: 'user' });
    const loginRes = await loginAsUser(app, testUser.email, 'testpassword123');
    authCookie = loginRes.headers['set-cookie'];
  });

  it('sollte eigene Umfragen auflisten', async () => {
    await createTestPoll({ userId: testUser.id });
    
    const response = await request(app)
      .get('/api/v1/polls/my')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.length).toBe(1);
  });
});
```

### Test-Struktur

Jeder Test sollte folgende Struktur haben:

```typescript
describe('Feature/Component Name', () => {
  // Setup
  beforeEach(async () => {
    // Datenbank zurücksetzen, App initialisieren
  });

  describe('HTTP-Methode /api/path', () => {
    // Erfolgsfall
    it('sollte X tun wenn Y', async () => {
      // Arrange - Testdaten vorbereiten
      // Act - Aktion ausführen
      // Assert - Ergebnis prüfen
    });

    // Fehlerfall
    it('sollte Fehler zurückgeben wenn Z', async () => {
      // ...
    });
  });
});
```

## Test-Kategorien

### auth/ - Authentifizierungstests
- Login/Logout
- Session-Verwaltung
- Token-Validierung
- Passwort-Reset
- OIDC-Integration

### api/ - API-Sicherheitstests
- Berechtigungsprüfungen
- Input-Validierung
- Rate-Limiting
- Security-Header

### polls/ - Umfragen-Tests
- CRUD-Operationen
- Voting-Logik
- Ergebnis-Berechnung
- Export-Funktionen

### security/ - Sicherheitstests
- SQL-Injection-Schutz
- XSS-Prävention
- CSRF-Schutz
- Header-Konfiguration

### fixtures/ - Test-Utilities
- Datenbank-Helpers
- Test-Daten-Generatoren
- Mock-Services

## Code-Stil

### TypeScript-Konventionen

- Nutzen Sie strenge TypeScript-Typisierung
- Vermeiden Sie `any`-Typen
- Exportieren Sie Interface-Typen aus `shared/schema.ts`

### Namenskonventionen

- Test-Dateien: `feature-name.test.ts`
- Deutsche Beschreibungen in Tests für Konsistenz
- camelCase für Variablen, PascalCase für Typen

### Kommentare

- Kommentare nur wenn notwendig
- Komplexe Logik dokumentieren
- Keine offensichtlichen Kommentare

## Pull Requests

### Branch-Strategie

Der aktuelle öffentliche Beta-Stand wird vom freigegebenen Beta-Branch aus erstellt:

| Branch | Zweck |
|--------|-------|
| `main` | Upstream für stabile Releases; wird nicht als Teil eines Beta-Releases geändert. |
| `feature/guest-access-control` | Freigegebener Branch für den aktuellen Beta-Stand und dessen Release-Tag. |
| `feature/<name>` | Dein Feature-Branch, abgezweigt vom aktuell freigegebenen Beta-Branch. |

**Workflow:**

```bash
# Aktuellen Beta-Stand holen
git fetch origin feature/guest-access-control
git checkout -b feature/mein-feature origin/feature/guest-access-control

# … arbeiten, committen …

git push origin feature/mein-feature
# PR auf GitHub gegen den für die nächste Version vereinbarten Branch öffnen
```

Maintainer entscheiden den Zielbranch und erstellen den Release-Tag erst nach
erfolgreichen Prüfungen.

### Vor dem Einreichen

1. **Tests ausführen**: `npx vitest run`
2. **Type-Check**: `npx tsc --noEmit`
3. **Lokale Funktionsprüfung**: Testen Sie die Änderung manuell
4. **Doku aktualisieren**: `README.md`, `CHANGELOG.md` (`[Unreleased]`-Abschnitt) und `.env.example` bei neuen Konfigurationsvariablen

### PR-Beschreibung

```markdown
## Beschreibung
Kurze Zusammenfassung der Änderungen.

## Typ der Änderung
- [ ] Bugfix
- [ ] Neue Funktion
- [ ] Breaking Change
- [ ] Dokumentation

## Tests
- [ ] Neue Tests hinzugefügt
- [ ] Bestehende Tests angepasst
- [ ] Alle Tests bestehen

## Checkliste
- [ ] Code folgt dem Projekt-Stil
- [ ] Dokumentation aktualisiert
- [ ] Keine sensiblen Daten im Code
```

### Review-Prozess

1. Automatische CI-Checks müssen bestehen
2. Mindestens ein Approval von einem Maintainer
3. Alle Kommentare bearbeitet
4. Merge nach Freigabe

## GitHub und GitLab

Polly wird auf einer internen GitLab-Instanz entwickelt. GitHub enthält nur den veröffentlichten Produktionsstand.

- **Es gibt keine automatische Synchronisierung** zwischen GitHub und GitLab, weder per Mirror noch per CI-Job.
- Entwicklung, Merge Requests und Reviews laufen in GitLab. Die GitLab-Pipeline testet den jeweiligen GitLab-Branch.
- `main` wird nur auf GitHub gemergt: Für ein Release wird der freigegebene Branch von Hand nach GitHub gepusht, per Pull Request in `main` gemergt und direkt released. Danach wird `main` von Hand nach GitLab gepusht (siehe [docs/RELEASING.md](docs/RELEASING.md)).
- Pull Requests von außen auf GitHub sind willkommen. Sie werden von Hand nach GitLab übernommen.

## Hilfe & Kontakt

Bei Fragen oder Problemen:

- GitHub Issues für Bugs und Feature-Requests
- Diskussionen im GitHub Discussions-Bereich

Vielen Dank für Ihren Beitrag!
