# Polly – API-Dokumentation

**Version:** 2.0  
**Zuletzt aktualisiert:** 2026-03-25  
**API-Präfix:** `/api/v1/`  
**API-Typ:** REST  
**Datenformat:** JSON (`Content-Type: application/json`, sofern nicht anders angegeben)  
**Authentifizierung:** Session-basiert (Cookie `polly.sid`) + optionaler Bearer-Token (Keycloak)

---

## Inhaltsverzeichnis

1. [Authentifizierung](#1-authentifizierung)
2. [Polls – Umfragen](#2-polls--umfragen)
3. [Voting – Abstimmungen](#3-voting--abstimmungen)
4. [Vote-Bearbeitung](#4-vote-bearbeitung)
5. [Benutzer-Profil](#5-benutzer-profil)
6. [Export](#6-export)
7. [Kalender-Integration](#7-kalender-integration)
8. [KI-Funktionen](#8-ki-funktionen)
9. [System-Endpunkte (öffentlich)](#9-system-endpunkte-öffentlich)
10. [Datei-Upload](#10-datei-upload)
11. [Admin – Übersicht](#11-admin--übersicht)
12. [Admin – Benutzerverwaltung](#12-admin--benutzerverwaltung)
13. [Admin – Umfragenverwaltung](#13-admin--umfragenverwaltung)
14. [Admin – Systemeinstellungen](#14-admin--systemeinstellungen)
15. [Admin – Sicherheit & Rate Limiting](#15-admin--sicherheit--rate-limiting)
16. [Admin – Customization & Branding](#16-admin--customization--branding)
17. [Admin – E-Mail-Templates](#17-admin--e-mail-templates)
18. [Admin – WCAG Barrierefreiheit](#18-admin--wcag-barrierefreiheit)
19. [Admin – Benachrichtigungen & Session](#19-admin--benachrichtigungen--session)
20. [Admin – Antivirus (ClamAV)](#20-admin--antivirus-clamav)
21. [Admin – Kalender & Deprovisioning](#21-admin--kalender--deprovisioning)
22. [Admin – Pentest-Tools & Tests](#22-admin--pentest-tools--tests)
23. [Admin – DSGVO-Löschanträge](#23-admin--dsgvo-löschanträge)
24. [Admin – System-Status](#24-admin--system-status)
25. [Externes Deprovisioning](#25-externes-deprovisioning)
26. [Fehlercodes](#26-fehlercodes)
27. [Rate Limiting – Übersicht](#27-rate-limiting--übersicht)
28. [Passwort-Anforderungen](#28-passwort-anforderungen)

---

## 1. Authentifizierung

**Basis-Pfad:** `/api/v1/auth/`

Die API unterstützt zwei Authentifizierungsmethoden:
- **Cookie-Session**: Web-Browser. Cookie-Name: `polly.sid`. HttpOnly, SameSite=Lax, Secure=auto. Gültig 24 Stunden.
- **Bearer-Token**: Mobile Apps. Keycloak Access-Token im `Authorization: Bearer <token>` Header.

Session wird bei Login und Registrierung regeneriert (Session-Fixation-Schutz).

---

### `POST /api/v1/auth/login`

Lokale Anmeldung.

**Rate Limiting:** 5 Versuche pro 15 Min. (IP + Account). Danach 15 Min. Sperre.

**Request Body:**
```json
{
  "usernameOrEmail": "admin@example.com",
  "password": "MyPassword1!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "organization": null,
    "themePreference": "system",
    "languagePreference": "de"
  }
}
```

**Response (401):**
```json
{ "error": "Ungültige Anmeldedaten", "remainingAttempts": 3 }
```

**Response (429):**
```json
{ "error": "Zu viele Anmeldeversuche...", "retryAfter": 900 }
```

---

### `POST /api/v1/auth/logout`

Beendet die aktive Session.

**Auth:** Erforderlich

**Response (200 OK):**
```json
{ "success": true }
```

---

### `POST /api/v1/auth/register`

Neuen Benutzer registrieren.

**Rate Limiting:** 5 Registrierungen pro Stunde.

**Request Body:**
```json
{
  "username": "maxmuster",
  "email": "max@example.com",
  "name": "Max Mustermann",
  "password": "SecurePass1!"
}
```

| Feld | Typ | Pflicht | Validierung |
|---|---|---|---|
| `username` | String | Ja | 3-30 Zeichen, alphanumerisch + Unterstrich |
| `email` | String | Ja | Gültige E-Mail-Adresse |
| `name` | String | Ja | 1-100 Zeichen |
| `password` | String | Ja | [Passwort-Anforderungen](#28-passwort-anforderungen) |

**Response (200 OK):**
```json
{ "user": { ... } }
```

**Response (403):** `{ "error": "Registrierung ist deaktiviert" }`

---

### `GET /api/v1/auth/me`

Gibt den aktuell eingeloggten Benutzer zurück.

**Auth:** Erforderlich

**Response (200 OK):** Benutzer-Objekt (wie Login-Response)

**Response (401):** `{ "error": "Not authenticated" }`

---

### `GET /api/v1/auth/methods`

Verfügbare Authentifizierungsmethoden abfragen.

**Auth:** Keine

**Response (200 OK):**
```json
{
  "local": true,
  "oidc": false,
  "hideLoginForm": false
}
```

---

### `POST /api/v1/auth/check-email`

Prüft ob eine E-Mail bereits registriert ist.

**Rate Limiting:** 10 Anfragen pro Minute.

**Request Body:**
```json
{ "email": "max@example.com" }
```

---

### `GET /api/v1/auth/verify-email/:token`

E-Mail-Adresse über Verifizierungs-Token bestätigen.

**Response (200 OK):**
```json
{ "success": true, "message": "E-Mail wurde verifiziert" }
```

---

### `POST /api/v1/auth/resend-verification`

Verifizierungs-E-Mail erneut senden.

**Auth:** Erforderlich

---

### `POST /api/v1/auth/request-password-reset`

Passwort-Reset anfordern.

**Rate Limiting:** 3 Anfragen pro 15 Minuten.

**Request Body:**
```json
{ "email": "max@example.com" }
```

**Response (200 OK):** Immer erfolgreich (E-Mail-Enumeration-Schutz):
```json
{ "success": true, "message": "Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet." }
```

---

### `POST /api/v1/auth/reset-password`

Passwort mit Reset-Token zurücksetzen.

**Request Body:**
```json
{
  "token": "abc123...",
  "newPassword": "NewSecure1!"
}
```

---

### `POST /api/v1/auth/change-password`

Passwort ändern (eingeloggt).

**Auth:** Erforderlich

**Request Body:**
```json
{
  "currentPassword": "OldPassword1!",
  "newPassword": "NewPassword1!"
}
```

---

### `POST /api/v1/auth/request-email-change`

E-Mail-Änderung anfordern.

**Auth:** Erforderlich

**Request Body:**
```json
{
  "newEmail": "neuemail@example.com",
  "password": "CurrentPassword1!"
}
```

---

### `POST /api/v1/auth/confirm-email-change`

E-Mail-Änderung bestätigen.

**Request Body:**
```json
{ "token": "abc123..." }
```

---

### `POST /api/v1/auth/request-deletion`

DSGVO-Kontolöschung beantragen (Art. 17).

**Auth:** Erforderlich

---

### `DELETE /api/v1/auth/request-deletion`

Löschantrag zurückziehen.

**Auth:** Erforderlich

---

### `GET /api/v1/auth/keycloak`

Keycloak OIDC Login initiieren (Redirect).

---

### `GET /api/v1/auth/keycloak/callback`

OIDC Callback (automatisch nach Keycloak-Login).

---

## 2. Polls – Umfragen

**Basis-Pfad:** `/api/v1/polls/`

Polls werden über Token adressiert, nicht über IDs:
- **publicToken**: Für öffentlichen/Teilnehmer-Zugriff
- **adminToken**: Für Ersteller/Admin-Zugriff

### Poll-Typen

| Typ | Beschreibung | Optionsfelder | Abstimmungsantworten |
|---|---|---|---|
| `schedule` | Terminumfrage | `startTime`, `endTime` | `yes`, `maybe`, `no` |
| `survey` | Klassische Umfrage | `isFreeText` | `yes`, `maybe`, `no`, `freetext` |
| `organization` | Orga-Liste/Buchung | `maxCapacity` | `signup` (intern → `yes`) |

---

### `POST /api/v1/polls`

Neue Umfrage erstellen.

**Auth:** Optional (anonym möglich; `creatorEmail` für Admin-Link-Zustellung)

**Request Body:**
```json
{
  "title": "Dienstbesprechung März",
  "description": "Terminabstimmung für das Team",
  "type": "schedule",
  "creatorEmail": "admin@example.com",
  "expiresAt": "2025-04-01T23:59:59Z",
  "enableExpiryReminder": true,
  "expiryReminderHours": 24,
  "allowMultipleSlots": true,
  "allowVoteEdit": false,
  "allowVoteWithdrawal": false,
  "resultsPublic": true,
  "options": [
    {
      "text": "Montag Vormittag",
      "startTime": "2025-03-15T09:00:00Z",
      "endTime": "2025-03-15T10:00:00Z",
      "order": 0
    },
    {
      "text": "Dienstag Nachmittag",
      "startTime": "2025-03-16T14:00:00Z",
      "endTime": "2025-03-16T15:00:00Z",
      "order": 1
    }
  ]
}
```

| Feld | Typ | Pflicht | Validierung |
|---|---|---|---|
| `title` | String | Ja | 1-200 Zeichen |
| `description` | String | Nein | Max. 5000 Zeichen |
| `type` | String | Ja | `schedule`, `survey`, `organization` |
| `creatorEmail` | String | Nein | Gültige E-Mail |
| `expiresAt` | String | Nein | ISO 8601 |
| `enableExpiryReminder` | Boolean | Nein | Standard: `false` |
| `expiryReminderHours` | Number | Nein | 1-168, Standard: 24 |
| `allowMultipleSlots` | Boolean | Nein | Standard: `true` |
| `allowVoteEdit` | Boolean | Nein | Standard: `false` |
| `allowVoteWithdrawal` | Boolean | Nein | Standard: `false` |
| `resultsPublic` | Boolean | Nein | Standard: `true` |
| `options` | Array | Ja | Min. 1 Element |
| `options[].text` | String | Ja | 1-500 Zeichen |
| `options[].imageUrl` | String | Nein | URL |
| `options[].altText` | String | Nein | |
| `options[].startTime` | String | Nein | ISO 8601 (Schedule) |
| `options[].endTime` | String | Nein | ISO 8601 (Schedule) |
| `options[].maxCapacity` | Number | Nein | Min. 1 (Organisation) |
| `options[].isFreeText` | Boolean | Nein | Standard: `false` (Survey) |
| `options[].order` | Number | Nein | Standard: 0 |

**Response (201 Created):**
```json
{
  "poll": {
    "id": 42,
    "title": "Dienstbesprechung März",
    "type": "schedule",
    "isActive": true,
    "options": [...]
  },
  "publicToken": "a1b2c3d4e5f6...",
  "adminToken": "f6e5d4c3b2a1..."
}
```

---

### `GET /api/v1/polls/public/:token`

Öffentliche Umfrage abrufen (Teilnehmer-Ansicht).

**Auth:** Keine (optional: eingeloggter Owner bekommt `adminToken`)

**Parameter:** `token` – publicToken (Hex-String)

**Response (200 OK):**
```json
{
  "id": 42,
  "title": "Dienstbesprechung März",
  "description": "...",
  "type": "schedule",
  "isActive": true,
  "expiresAt": "2025-04-01T23:59:59Z",
  "resultsPublic": true,
  "allowVoteEdit": false,
  "allowVoteWithdrawal": false,
  "allowMaybe": true,
  "allowMultipleSlots": true,
  "createdAt": "2025-03-01T10:00:00Z",
  "userId": 1,
  "adminToken": "f6e5d4c3b2a1...",
  "options": [
    {
      "id": 1,
      "text": "Montag Vormittag",
      "startTime": "2025-03-15T09:00:00Z",
      "endTime": "2025-03-15T10:00:00Z",
      "order": 0,
      "maxCapacity": null,
      "currentCount": 3
    }
  ],
  "votes": [
    {
      "id": 100,
      "optionId": 1,
      "voterName": "Max",
      "response": "yes",
      "createdAt": "2025-03-02T08:00:00Z"
    }
  ]
}
```

> **Hinweis:** `adminToken` wird nur zurückgegeben, wenn der eingeloggte Benutzer der Ersteller ist.

---

### `GET /api/v1/polls/admin/:token`

Admin-Ansicht der Umfrage (Ersteller/Admin).

**Auth:** Erforderlich (Ersteller oder Admin-Rolle)

**Parameter:** `token` – adminToken (Hex-String)

**Response (200 OK):** Wie öffentliche Ansicht, aber mit `adminToken` und erweiterten Informationen.

---

### `PATCH /api/v1/polls/admin/:token`

Umfrage bearbeiten.

**Auth:** Erforderlich (Ersteller oder Admin)

**Request Body (alle Felder optional):**
```json
{
  "isActive": true,
  "title": "Neuer Titel",
  "description": "Neue Beschreibung",
  "expiresAt": "2025-05-01T00:00:00Z",
  "resultsPublic": true,
  "allowVoteEdit": true,
  "allowVoteWithdrawal": true,
  "allowMaybe": true,
  "allowMultipleSlots": false
}
```

**Response (200 OK):** Aktualisiertes Poll-Objekt.

---

### `DELETE /api/v1/polls/admin/:token`

Umfrage dauerhaft löschen.

**Auth:** Erforderlich (Ersteller oder Admin)

**Response (200 OK):**
```json
{ "success": true, "message": "Umfrage gelöscht" }
```

---

### `POST /api/v1/polls/admin/:token/finalize`

Ergebnis einer Umfrage bestätigen/finalisieren.

**Auth:** Erforderlich (Ersteller oder Admin)

**Request Body:**
```json
{
  "selectedOptionId": 1,
  "closePoll": true
}
```

---

### `POST /api/v1/polls/admin/:token/options`

Neue Option hinzufügen.

**Auth:** Erforderlich (Ersteller oder Admin)

**Request Body:**
```json
{
  "text": "Mittwoch Abend",
  "startTime": "2025-03-17T18:00:00Z",
  "endTime": "2025-03-17T19:00:00Z"
}
```

---

### `PATCH /api/v1/polls/admin/:token/options/:optionId`

Option bearbeiten.

**Auth:** Erforderlich (Ersteller oder Admin)

---

### `DELETE /api/v1/polls/admin/:token/options/:optionId`

Option löschen.

**Auth:** Erforderlich (Ersteller oder Admin)

---

### `POST /api/v1/polls/admin/:token/invite`

E-Mail-Einladungen an Teilnehmer senden.

**Auth:** Erforderlich (Ersteller oder Admin)

**Request Body:**
```json
{
  "emails": ["teilnehmer1@example.com", "teilnehmer2@example.com"],
  "message": "Bitte an der Umfrage teilnehmen."
}
```

---

### `POST /api/v1/polls/admin/:token/remind`

Erinnerungen an eingeladene Teilnehmer senden.

**Auth:** Erforderlich (Ersteller oder Admin)

---

### `GET /api/v1/polls/admin/:token/vote-count`

Stimmenzahl für eine Umfrage abfragen.

**Auth:** Erforderlich (Ersteller oder Admin)

---

### `GET /api/v1/polls/:token/results`

Ergebnisse einer Umfrage abrufen.

**Auth:** Keine (wenn `resultsPublic = true`)

---

### `GET /api/v1/polls/my-polls`

Eigene erstellte Umfragen abrufen.

**Auth:** Erforderlich

---

### `GET /api/v1/polls/shared-polls`

Umfragen, an denen der Benutzer teilgenommen hat.

**Auth:** Erforderlich

---

### `GET /api/v1/polls/:token/reminder-status`

Status der Erinnerungen für eine Umfrage.

**Auth:** Erforderlich

---

### `POST /api/v1/polls/:id/send-reminder`

Erinnerung für eine Umfrage senden (per Poll-ID).

**Auth:** Erforderlich

---

### `POST /api/v1/polls/:token/invite`

Teilnehmer über Token einladen.

**Auth:** Erforderlich

---

### `POST /api/v1/polls/:token/invite/matrix`

Matrix-Benutzer zu einer Umfrage einladen.

**Auth:** Erforderlich

---

## 3. Voting – Abstimmungen

**Basis-Pfad:** `/api/v1/polls/`

### `POST /api/v1/polls/:token/vote`

Einzelne Stimme abgeben.

**Auth:** Keine (anonyme Teilnahme möglich)

**Parameter:** `token` – publicToken

**Request Body:**
```json
{
  "voterName": "Max Mustermann",
  "voterEmail": "max@example.com",
  "votes": [
    { "optionId": 1, "response": "yes" },
    { "optionId": 2, "response": "maybe", "comment": "Nur nachmittags" },
    { "optionId": 3, "response": "no" }
  ]
}
```

| Feld | Typ | Pflicht | Validierung |
|---|---|---|---|
| `voterName` | String | Ja | 1-100 Zeichen |
| `voterEmail` | String | Ja | Gültige E-Mail, max. 254 Zeichen |
| `votes` | Array | Ja | Min. 1 Element |
| `votes[].optionId` | Number | Ja | Gültige Options-ID |
| `votes[].response` | String | Ja | `yes`, `maybe`, `no`, `freetext`, `signup` |
| `votes[].comment` | String | Nein | |
| `votes[].freeTextAnswer` | String | Nein | Max. 2000 Zeichen (Survey-Freitext) |

**Validierungsregeln:**
- Inaktive Umfrage → `400 POLL_INACTIVE`
- Abgelaufene Umfrage → `400 POLL_EXPIRED`
- Bereits abgestimmt (ohne allowVoteEdit) → `400 ALREADY_VOTED`
- Eingeloggt mit fremder E-Mail → `403 EMAIL_BELONGS_TO_ANOTHER_USER`
- Anonym mit registrierter E-Mail → `409 REQUIRES_LOGIN`

**Response (200 OK):**
```json
{
  "success": true,
  "votes": [...],
  "voterEditToken": "edit_abc123..."
}
```

---

### `POST /api/v1/polls/:token/vote-bulk`

Mehrere Stimmen gleichzeitig abgeben. Gleiches Schema wie `/vote`.

---

### `DELETE /api/v1/polls/:token/vote`

Stimme zurückziehen.

**Auth:** Keine (Token-basiert)

---

### `GET /api/v1/polls/:token/my-votes`

Eigene Stimmen für eine Umfrage abrufen.

**Auth:** Erforderlich

---

### `POST /api/v1/polls/:token/resend-email`

Bestätigungs-E-Mail erneut senden.

---

### `POST /api/v1/polls/:token/votes-by-email`

Stimmen per E-Mail-Adresse suchen.

**Request Body:**
```json
{ "email": "max@example.com" }
```

---

## 4. Vote-Bearbeitung

**Basis-Pfad:** `/api/v1/votes/`

Token-basierte Bearbeitung ohne Anmeldung.

### `GET /api/v1/votes/edit/:editToken`

Stimme zum Bearbeiten abrufen.

**Auth:** Keine (Token-basiert)

**Response (200 OK):**
```json
{
  "poll": {
    "id": 42,
    "title": "...",
    "type": "schedule",
    "isActive": true,
    "options": [...]
  },
  "votes": [...],
  "voterName": "Max",
  "voterEmail": "max@example.com",
  "allowVoteWithdrawal": true
}
```

---

### `PUT /api/v1/votes/edit/:editToken`

Bestehende Stimme bearbeiten.

**Request Body:**
```json
{
  "votes": [
    { "optionId": 1, "response": "no" },
    { "optionId": 2, "response": "yes" }
  ]
}
```

**Response (200 OK):**
```json
{ "success": true, "votes": [...] }
```

---

### `DELETE /api/v1/votes/edit/:editToken`

Stimme komplett zurückziehen.

**Response (200 OK):**
```json
{ "success": true, "message": "...", "withdrawnCount": 3 }
```

**Fehler:**
- `403`: Rückzug nicht erlaubt (`allowVoteWithdrawal = false`)
- `400`: Umfrage inaktiv

---

## 5. Benutzer-Profil

**Basis-Pfad:** `/api/v1/user/` und `/api/v1/users/`

### `GET /api/v1/user/profile`

Eigenes Profil abrufen.

**Auth:** Erforderlich

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "maxmuster",
  "email": "max@example.com",
  "name": "Max Mustermann",
  "organization": "Kita Sonnenschein",
  "role": "user",
  "provider": "local",
  "themePreference": "system",
  "languagePreference": "de",
  "createdAt": "2025-01-01T00:00:00Z",
  "lastLoginAt": "2025-03-25T08:00:00Z",
  "deletionRequestedAt": null
}
```

---

### `PUT /api/v1/user/profile`

Profil aktualisieren.

**Auth:** Erforderlich

**Request Body (alle Felder optional):**
```json
{
  "name": "Max Mustermann",
  "organization": "Kita Sonnenschein",
  "themePreference": "dark",
  "languagePreference": "en"
}
```

| Feld | Typ | Werte |
|---|---|---|
| `name` | String | |
| `organization` | String | |
| `themePreference` | String | `light`, `dark`, `system` |
| `languagePreference` | String | `de`, `en` |

---

### `PATCH /api/v1/users/me/language`

Sprachpräferenz ändern.

**Auth:** Erforderlich

**Request Body:**
```json
{ "language": "de" }
```

---

### `PUT /api/v1/user/theme`

Theme-Präferenz ändern.

**Auth:** Erforderlich

**Request Body:**
```json
{ "themePreference": "dark" }
```

---

### `GET /api/v1/user/polls`

Eigene erstellte Umfragen.

**Auth:** Erforderlich

---

### `GET /api/v1/user/participations`

Umfragen, an denen teilgenommen wurde.

**Auth:** Erforderlich

---

### `POST /api/v1/users/me/device-tokens`

Push-Notification Device-Token registrieren.

**Auth:** Erforderlich

---

### `DELETE /api/v1/users/me/device-tokens`

Device-Token entfernen.

**Auth:** Erforderlich

---

## 6. Export

**Basis-Pfad:** `/api/v1/polls/`

### `GET /api/v1/polls/:token/qr`

QR-Code für eine Umfrage generieren.

**Auth:** Keine

**Query-Parameter:**

| Parameter | Typ | Standard | Beschreibung |
|---|---|---|---|
| `format` | String | `png` | `svg` oder `png` |

**Response (200 OK):**
```json
{
  "qrCode": "data:image/png;base64,...",
  "format": "png",
  "pollUrl": "https://example.com/poll/abc123..."
}
```

---

### `GET /api/v1/polls/:token/qr/download`

QR-Code als Bilddatei herunterladen.

**Content-Type:** `image/png` oder `image/svg+xml`

---

### `GET /api/v1/polls/:token/export/pdf`

Umfrage-Ergebnisse als PDF exportieren.

**Auth:** Öffentlich wenn `resultsPublic = true`, sonst Ersteller/Admin erforderlich.

**Content-Type:** `application/pdf`

---

### `GET /api/v1/polls/:token/export/csv`

Umfrage-Ergebnisse als CSV exportieren.

**Auth:** Wie PDF.

**Query-Parameter:**

| Parameter | Typ | Beschreibung |
|---|---|---|
| `lang` | String | `de` oder `en` |

**Content-Type:** `text/csv; charset=utf-8`

---

### `GET /api/v1/polls/:token/export/ics`

Umfrage-Optionen als ICS-Kalender exportieren.

**Query-Parameter:**

| Parameter | Typ | Beschreibung |
|---|---|---|
| `lang` | String | `de` oder `en` |
| `email` | String | Optional: nur Termine für diesen Teilnehmer |

**Content-Type:** `text/calendar; charset=utf-8`

---

## 7. Kalender-Integration

### `GET /api/v1/calendar/token`

Persönlichen Kalender-Feed-Token abrufen.

**Auth:** Erforderlich

---

### `POST /api/v1/calendar/token/regenerate`

Kalender-Token erneuern (alter Token wird ungültig).

**Auth:** Erforderlich

---

### `GET /api/v1/calendar/:calendarToken/feed.ics`

Öffentlicher ICS-Feed mit allen Umfragen des Benutzers.

**Auth:** Keine (Token-basiert)

**Content-Type:** `text/calendar; charset=utf-8`

Unterstützt `webcal://` Subscription.

---

## 8. KI-Funktionen

**Basis-Pfad:** `/api/v1/ai/`

> Automatisch aktiviert wenn `AI_API_KEY` gesetzt ist.

### `GET /api/v1/ai/status`

KI-Service-Status und Benutzerkontingent.

**Auth:** Erforderlich

---

### `POST /api/v1/ai/transcribe`

Audio-Datei transkribieren (Whisper API).

**Auth:** Erforderlich

**Content-Type:** `multipart/form-data`

---

### `POST /api/v1/ai/create-poll`

KI-gestützte Umfrageerstellung / -verfeinerung.

**Auth:** Erforderlich

**Rate Limiting:** Ja

---

### `POST /api/v1/ai/apply`

KI-Vorschlag als Umfrage übernehmen.

**Auth:** Erforderlich

---

### `GET /api/v1/ai/admin/settings`

KI-Einstellungen abrufen.

**Auth:** Admin

---

### `PUT /api/v1/ai/admin/settings`

KI-Einstellungen aktualisieren.

**Auth:** Admin

---

### `GET /api/v1/ai/admin/usage`

KI-Nutzungsstatistiken.

**Auth:** Admin

---

## 9. System-Endpunkte (öffentlich)

**Basis-Pfad:** `/api/v1/`

### `GET /api/v1/health`

Service Health-Check.

**Auth:** Keine

**Response (200 OK):**
```json
{ "status": "ok" }
```

---

### `GET /api/v1/email-status`

Prüft ob SMTP konfiguriert ist.

**Auth:** Keine

---

### `GET /api/v1/customization`

Öffentliche Branding/Theme-Einstellungen.

**Auth:** Keine

---

### `GET /api/v1/system/language`

System-Standardsprache.

**Auth:** Keine

**Response (200 OK):**
```json
{ "language": "de" }
```

---

### `GET /api/v1/settings/accessibility`

WCAG-Barrierefreiheits-Erzwingungsstatus.

**Auth:** Keine

---

### `GET /api/v1/customization/mobile`

Mobile-optimierte Branding/Theme-Daten (für KH App).

**Auth:** Keine

---

### `GET /api/v1/theme`

Aktuelle Theme-Präferenz (Benutzer > Cookie > System-Standard).

**Auth:** Keine

---

### `POST /api/v1/theme`

Theme-Präferenz als Cookie setzen.

**Auth:** Keine

---

### `GET /api/v1/matrix/status`

Matrix-Chat-Integration aktiviert?

**Auth:** Keine

---

### `GET /api/v1/matrix/users/search`

Matrix-Benutzer suchen.

**Auth:** Erforderlich

---

## 10. Datei-Upload

### `POST /api/v1/upload/image`

Bild hochladen (mit optionalem Antivirus-Scan via ClamAV).

**Auth:** Keine

**Content-Type:** `multipart/form-data`

**Feld:** `image` (Datei)

**Response (200 OK):**
```json
{ "imageUrl": "/uploads/abc123.jpg" }
```

**Fehler:**
- `422`: Virus erkannt
- `503`: Scanner nicht verfügbar

---

## 11. Admin – Übersicht

**Basis-Pfad:** `/api/v1/admin/`

**Auth:** Alle Admin-Endpunkte erfordern die Rolle `admin`.

**Rollen:**

| Rolle | Beschreibung |
|---|---|
| `user` | Standard-Benutzer |
| `manager` | Erweiterte Rechte |
| `admin` | Vollzugriff |

---

## 12. Admin – Benutzerverwaltung

### `GET /api/v1/admin/users`

Alle Benutzer auflisten.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "username": "maxmuster",
    "email": "max@example.com",
    "name": "Max Mustermann",
    "role": "user",
    "organization": "Kita Sonnenschein",
    "emailVerified": true,
    "provider": "local",
    "createdAt": "2025-01-01T00:00:00Z",
    "lastLoginAt": "2025-03-25T08:00:00Z"
  }
]
```

---

### `POST /api/v1/admin/users`

Benutzer manuell anlegen.

**Request Body:**
```json
{
  "name": "Erika Musterfrau",
  "email": "erika@example.com",
  "username": "erikam",
  "password": "SecurePass1!",
  "role": "user"
}
```

| Feld | Typ | Pflicht | Validierung |
|---|---|---|---|
| `name` | String | Ja | |
| `email` | String | Ja | Gültige E-Mail, eindeutig |
| `username` | String | Ja | 3-30 Zeichen, alphanumerisch + `_`, eindeutig |
| `password` | String | Ja | [Passwort-Anforderungen](#28-passwort-anforderungen) |
| `role` | String | Nein | `user`, `manager`, `admin` (Standard: `user`) |

---

### `PATCH /api/v1/admin/users/:id`

Benutzer bearbeiten.

**Request Body (alle Felder optional):**
```json
{
  "role": "manager",
  "name": "Neuer Name",
  "email": "neu@example.com",
  "organization": "Neue Organisation",
  "emailVerified": true
}
```

---

### `DELETE /api/v1/admin/users/:id`

Benutzer löschen.

> Gesperrt wenn externes Deprovisioning aktiv ist. Eigenes Konto kann nicht gelöscht werden.

**Response (200 OK):**
```json
{ "success": true, "message": "Benutzer gelöscht" }
```

---

## 13. Admin – Umfragenverwaltung

### `GET /api/v1/admin/polls`

Alle Umfragen im System auflisten.

---

### `PATCH /api/v1/admin/polls/:id`

Beliebige Umfrage bearbeiten/moderieren.

**Request Body (optional):**
```json
{
  "isActive": false,
  "title": "...",
  "description": "...",
  "expiresAt": "2025-05-01T00:00:00Z",
  "resultsPublic": true
}
```

---

### `DELETE /api/v1/admin/polls/:id`

Umfrage dauerhaft löschen.

---

## 14. Admin – Systemeinstellungen

### `GET /api/v1/admin/settings`

Alle Systemeinstellungen auflisten.

**Response (200 OK):**
```json
[
  { "key": "registration_enabled", "value": true, "description": "..." }
]
```

---

### `POST /api/v1/admin/settings`

Einstellung erstellen oder aktualisieren.

**Request Body:**
```json
{
  "key": "registration_enabled",
  "value": true,
  "description": "Registrierung aktivieren/deaktivieren"
}
```

---

### `DELETE /api/v1/admin/settings/:key`

Einstellung löschen.

---

## 15. Admin – Sicherheit & Rate Limiting

### Login-Rate-Limiting

#### `GET /api/v1/admin/security`

Aktuelle Sicherheitseinstellungen und Login-Statistiken.

**Response (200 OK):**
```json
{
  "settings": {
    "maxAttempts": 5,
    "windowSeconds": 900,
    "cooldownSeconds": 900
  },
  "stats": { ... }
}
```

---

#### `PUT /api/v1/admin/security`

Sicherheitseinstellungen aktualisieren.

| Feld | Typ | Bereich |
|---|---|---|
| `maxAttempts` | Number | 1-100 |
| `windowSeconds` | Number | 60-86400 |
| `cooldownSeconds` | Number | 60-86400 |

---

#### `POST /api/v1/admin/security/clear-rate-limits`

Alle Login-Rate-Limit-Sperren aufheben.

---

### API-Rate-Limiting

#### `GET /api/v1/admin/api-rate-limits`

API-Rate-Limit-Einstellungen und Statistiken.

---

#### `PUT /api/v1/admin/api-rate-limits`

API-Rate-Limits konfigurieren.

| Feld je Limiter | Typ | Bereich |
|---|---|---|
| `maxRequests` | Number | 1-1000 |
| `windowSeconds` | Number | 1-86400 |

---

#### `POST /api/v1/admin/api-rate-limits/clear`

Spezifische API-Rate-Limiter zurücksetzen.

---

## 16. Admin – Customization & Branding

### `GET /api/v1/admin/customization`

Vollständige Branding- und Theme-Einstellungen.

**Response (200 OK):**
```json
{
  "theme": {
    "primaryColor": "#4f46e5",
    "secondaryColor": "#6366f1",
    "borderRadius": "8px"
  },
  "branding": {
    "logoUrl": "/uploads/logo.png",
    "faviconUrl": "/uploads/favicon.ico",
    "siteName": "Polly",
    "siteNameAccent": ""
  },
  "footer": {
    "description": "...",
    "copyrightText": "...",
    "supportLinks": [
      { "label": "Datenschutz", "url": "/datenschutz" }
    ]
  },
  "matrix": {
    "enabled": false,
    "homeserverUrl": "",
    "botUserId": "",
    "botAccessToken": "",
    "searchEnabled": false
  }
}
```

---

### `PUT /api/v1/admin/customization`

Branding/Theme aktualisieren (partielle Updates möglich).

---

### `POST /api/v1/admin/customization/logo`

Logo hochladen.

**Content-Type:** `multipart/form-data`

---

### `DELETE /api/v1/admin/customization/logo`

Logo entfernen.

---

### `POST /api/v1/admin/branding/reset`

Alle Branding-Einstellungen auf Systemstandard zurücksetzen.

---

## 17. Admin – E-Mail-Templates

**Template-Typen:** `poll_created`, `invitation`, `vote_confirmation`, `reminder`, `password_reset`, `email_change`, `password_changed`, `welcome`, `test_report`, `poll_finalized`

### `GET /api/v1/admin/email-templates`

Alle Templates auflisten.

---

### `GET /api/v1/admin/email-templates/:type`

Einzelnes Template abrufen.

---

### `PUT /api/v1/admin/email-templates/:type`

Template bearbeiten.

**Request Body:**
```json
{
  "subject": "Einladung: {{pollTitle}}",
  "jsonContent": { ... },
  "textContent": "..."
}
```

---

### `POST /api/v1/admin/email-templates/:type/reset`

Template auf Systemstandard zurücksetzen.

---

### `POST /api/v1/admin/email-templates/:type/preview`

Vorschau mit Beispieldaten rendern.

**Response (200 OK):**
```json
{
  "html": "<html>...</html>",
  "text": "..."
}
```

---

### `POST /api/v1/admin/email-templates/:type/test`

Test-E-Mail für ein Template versenden.

---

### `GET /api/v1/admin/email-templates/:type/variables`

Verfügbare Template-Variablen auflisten.

---

### `GET /api/v1/admin/email-footer`

Globalen E-Mail-Footer abrufen.

---

### `PUT /api/v1/admin/email-footer`

Globalen E-Mail-Footer aktualisieren.

---

### `GET /api/v1/admin/email-theme`

E-Mail-Theme-Einstellungen.

---

### `PUT /api/v1/admin/email-theme`

E-Mail-Theme aktualisieren.

---

### `POST /api/v1/admin/email-theme/reset`

E-Mail-Theme auf Standard zurücksetzen.

---

### `POST /api/v1/admin/email-theme/import`

Theme aus JSON importieren (Vorschau).

---

### `POST /api/v1/admin/email-theme/import/confirm`

Importiertes Theme speichern.

---

## 18. Admin – WCAG Barrierefreiheit

### `POST /api/v1/admin/wcag/audit`

Automatischen Farbkontrast-Audit durchführen (WCAG 2.1 AA, 4.5:1 Kontrastverhältnis).

**Response:** Audit-Ergebnis mit `suggestedValue` für nicht-konforme Farben.

---

### `POST /api/v1/admin/wcag/apply-corrections`

Vorgeschlagene Barrierefreiheits-Korrekturen automatisch anwenden.

---

### `PUT /api/v1/admin/wcag/settings`

WCAG-Erzwingung ein-/ausschalten.

---

## 19. Admin – Benachrichtigungen & Session

### `GET /api/v1/admin/notifications`

Globale Benachrichtigungseinstellungen.

---

### `PUT /api/v1/admin/notifications`

Benachrichtigungsverhalten aktualisieren.

---

### `GET /api/v1/admin/session-timeout`

Session-Timeout-Einstellungen (rollenbasiert).

---

### `PUT /api/v1/admin/session-timeout`

Session-Timeout konfigurieren.

---

## 20. Admin – Antivirus (ClamAV)

### `GET /api/v1/admin/clamav`

ClamAV-Scanner-Konfiguration.

---

### `PUT /api/v1/admin/clamav`

ClamAV-Einstellungen aktualisieren.

---

### `POST /api/v1/admin/clamav/test`

Verbindung zum ClamAV-Service testen.

---

### `POST /api/v1/admin/clamav/test-config`

Spezifische ClamAV-Konfiguration testen.

---

### `GET /api/v1/admin/clamav/scan-logs`

Antivirus-Scan-Protokoll abrufen.

---

### `GET /api/v1/admin/clamav/scan-logs/:id`

Details zu einem bestimmten Scan.

---

### `GET /api/v1/admin/clamav/scan-stats`

Antivirus-Statistiken.

---

## 21. Admin – Kalender & Deprovisioning

### `GET /api/v1/admin/calendar`

System-Kalendereinstellungen (ICS/Exports).

---

### `PUT /api/v1/admin/calendar`

Kalendereinstellungen aktualisieren.

---

### `GET /api/v1/admin/deprovision-settings`

Konfiguration für externes Benutzer-Deprovisioning.

---

### `PUT /api/v1/admin/deprovision-settings`

Deprovisioning-Konfiguration aktualisieren.

---

## 22. Admin – Pentest-Tools & Tests

### `GET /api/v1/admin/pentest-tools/status`

Verbindungsstatus zu Pentest-Tools.com.

---

### `GET /api/v1/admin/pentest-tools/config`

Pentest-Tools-Konfiguration.

---

### `POST /api/v1/admin/pentest-tools/config`

Pentest-Tools API-Token aktualisieren.

---

### `GET /api/v1/admin/tests/data-stats`

Statistiken über E2E-Testdaten.

---

### `DELETE /api/v1/admin/tests/purge-data`

Alle als Testdaten markierten Einträge löschen.

---

### `GET /api/v1/admin/test-runs`

History der System-Testläufe.

---

### `GET /api/v1/admin/test-runs/current`

Status des aktuell laufenden Tests.

---

### `POST /api/v1/admin/test-runs`

Neuen System-Testlauf starten.

---

### `POST /api/v1/admin/test-runs/stop`

Laufenden Testlauf stoppen.

---

## 23. Admin – DSGVO-Löschanträge

### `GET /api/v1/admin/deletion-requests`

Offene Kontolöschanträge auflisten (Art. 17 DSGVO).

---

### `POST /api/v1/admin/deletion-requests/:id/confirm`

Löschantrag bestätigen und ausführen.

---

### `POST /api/v1/admin/deletion-requests/:id/reject`

Löschantrag ablehnen.

---

## 24. Admin – System-Status

### `GET /api/v1/admin/stats`

Basis-Systemstatistiken.

---

### `GET /api/v1/admin/extended-stats`

Detaillierte Statistiken (gecached).

---

### `GET /api/v1/admin/system-status`

Echtzeit-Systemstatus (CPU, RAM, Festplatte).

---

### `GET /api/v1/admin/vulnerabilities`

npm-Audit für Sicherheitslücken.

---

### `GET /api/v1/admin/system-packages`

Installierte Systempakete und Updates.

---

### SMTP & OIDC (Admin)

#### `GET /api/v1/smtp-config`

SMTP-Verbindungsdetails anzeigen.

**Auth:** Admin

---

#### `POST /api/v1/smtp-test`

SMTP-Verbindung testen.

**Auth:** Admin

---

#### `GET /api/v1/oidc-config`

OpenID Connect Konfiguration anzeigen.

**Auth:** Admin

---

#### `POST /api/v1/oidc-test`

OIDC-Provider-Verbindung testen.

**Auth:** Admin

---

#### `POST /api/v1/matrix/test`

Matrix-Bot-Verbindung testen.

**Auth:** Admin

---

## 25. Externes Deprovisioning

### `DELETE /api/v1/deprovision/user`

Benutzer extern löschen/anonymisieren (für Kafka/Keycloak-Integration).

**Auth:** Basic Auth (Credentials in System-Settings `deprovision_config` konfiguriert)

**Request Body:**
```json
{
  "email": "user@example.com",
  "action": "delete"
}
```

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `email` | String | Eines von dreien | E-Mail des Benutzers |
| `keycloakId` | String | Eines von dreien | Keycloak-ID |
| `userId` | Number | Eines von dreien | Interne Benutzer-ID |
| `action` | String | Nein | `delete` (Standard) oder `anonymize` |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Benutzer gelöscht",
  "userId": 1,
  "action": "deleted"
}
```

**Fehler:**
- `401`: Nicht autorisiert
- `404`: Benutzer nicht gefunden
- `503`: Deprovisioning deaktiviert

---

## 26. Fehlercodes

| HTTP-Status | Bedeutung |
|---|---|
| 200 | Erfolg |
| 201 | Erstellt |
| 204 | Kein Inhalt (Löschen) |
| 400 | Ungültige Anfrage / Validierungsfehler |
| 401 | Nicht authentifiziert (keine/abgelaufene Session) |
| 403 | Keine Berechtigung (falsche Rolle / nicht verifiziert) |
| 404 | Ressource nicht gefunden |
| 409 | Konflikt (z.B. E-Mail bereits vergeben, Login erforderlich) |
| 422 | Unverarbeitbar (z.B. Virus erkannt) |
| 429 | Zu viele Anfragen (Rate Limit) |
| 500 | Interner Serverfehler |
| 503 | Service nicht verfügbar (z.B. ClamAV offline) |

---

## 27. Rate Limiting – Übersicht

| Endpunkt | Max. Versuche | Zeitfenster | Sperre |
|---|---|---|---|
| Login | 5 | 15 Min. | 15 Min. |
| Registrierung | 5 | 1 Stunde | – |
| Passwort-Reset | 3 | 15 Min. | – |
| E-Mail-Check | 10 | 1 Min. | – |

> Rate-Limit-Einstellungen können über die Admin-API dynamisch angepasst werden.

---

## 28. Passwort-Anforderungen

Passwörter müssen folgende Kriterien erfüllen:

- Mindestens 8 Zeichen
- Mindestens 1 Großbuchstabe (`A-Z`)
- Mindestens 1 Kleinbuchstabe (`a-z`)
- Mindestens 1 Ziffer (`0-9`)
- Mindestens 1 Sonderzeichen (`!@#$%^&*()_+-=[]{};\':\"\\|,.<>/?`~`)

---

## Testaccounts (Pentest)

| Rolle | E-Mail | Passwort |
|---|---|---|
| Admin | pentest01@kita.bayern.de | ⚠️ [REDACTED] |
| Admin | pentest02@kita.bayern.de | ⚠️ [REDACTED] |
| User | pentest03@kita.bayern.de | ⚠️ [REDACTED] |
| User | pentest04@kita.bayern.de | ⚠️ [REDACTED] |

> ⚠️ Passwörter vor Einreichung eintragen und sicher übermitteln.

---

## Änderungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 2026-03-25 | 2.0 | Vollständige Neufassung basierend auf tatsächlichem Codestand |
