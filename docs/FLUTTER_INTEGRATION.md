# KITA Poll (Polly) - Flutter/KH App Integration Guide

Diese Dokumentation beschreibt die API-Integration für die native Flutter-Anbindung der KITA Poll Anwendung in die KH App (KITA Hub).

## Übersicht

Die Polly-API ermöglicht es der KH App, alle Polling-Funktionen nativ in Flutter zu implementieren:
- Umfragen erstellen (Termin, Umfrage, Orga-Liste)
- Abstimmen mit Ja/Vielleicht/Nein
- Ergebnisse anzeigen
- Teilnehmer einladen (E-Mail & Matrix)
- Corporate Design übernehmen

## Authentifizierung

### Unterstützte Methoden

Die API unterstützt zwei Authentifizierungsmethoden:

1. **Cookie-Session** (Web-App) - Standard für Browser
2. **Bearer-Token** (Mobile) - Für Flutter/native Apps

### Keycloak SSO Integration

Die KH App nutzt bereits Keycloak für SSO. Die Polly-API validiert Keycloak Access-Tokens:

```dart
// Flutter: API-Request mit Keycloak Token
final response = await http.get(
  Uri.parse('$baseUrl/api/v1/user/polls'),
  headers: {
    'Authorization': 'Bearer $keycloakAccessToken',
    'Content-Type': 'application/json',
  },
);
```

### Token-Validierung

Der Server validiert das Token via:
- JWKS-Endpoint des Keycloak-Servers
- Prüfung von `exp`, `aud`, `iss` Claims
- Extraktion von `sub` (User-ID) und `email`

## API-Endpunkte

### Base URL

```
Production: https://polly.kita.bayern/api/v1
Development: http://localhost:3080/api/v1

Legacy URLs (auto-redirect):
https://polly.kita.bayern/api  -> 308 Redirect to /api/v1
```

**Hinweis:** Die API ist versioniert. Alle Endpunkte sollten unter `/api/v1/` aufgerufen werden. 
Legacy-Aufrufe an `/api/` werden automatisch mit HTTP 308 auf `/api/v1/` weitergeleitet.

---

## 1. Authentifizierung

### GET /api/v1/auth/me
Prüft die aktuelle Session/Token und gibt User-Daten zurück.

**Response (authenticated):**
```json
{
  "user": {
    "id": 1,
    "email": "max@kita-beispiel.de",
    "displayName": "Max Mustermann",
    "role": "user"
  }
}
```

**Response (not authenticated):**
```json
{
  "user": null
}
```

### GET /api/v1/auth/methods
Verfügbare Login-Methoden.

**Response:**
```json
{
  "local": true,
  "keycloak": true,
  "registrationEnabled": true
}
```

---

## 2. Benutzer-Dashboard

### GET /api/v1/user/polls
Alle vom Benutzer erstellten Umfragen.

**Response:**
```json
{
  "polls": [
    {
      "id": "uuid-123",
      "title": "Sommerfest Termin",
      "type": "schedule",
      "isActive": true,
      "createdAt": "2024-12-01T10:00:00Z",
      "expiresAt": "2024-12-15T23:59:59Z",
      "publicToken": "abc123",
      "adminToken": "xyz789",
      "voteCount": 12
    }
  ]
}
```

### GET /api/v1/user/participations
Umfragen, an denen der Benutzer teilgenommen hat.

**Response:**
```json
{
  "participations": [
    {
      "pollId": "uuid-456",
      "pollTitle": "Elternabend",
      "pollType": "schedule",
      "votedAt": "2024-12-05T14:30:00Z",
      "publicToken": "def456",
      "editToken": "edit-abc123"
    }
  ]
}
```

### GET /api/v1/user/profile
Benutzerprofil abrufen.

**Response:**
```json
{
  "id": 1,
  "email": "max@kita-beispiel.de",
  "displayName": "Max Mustermann",
  "role": "user",
  "themePreference": "system"
}
```

### PUT /api/v1/user/profile
Profil aktualisieren.

**Request:**
```json
{
  "displayName": "Max Mustermann"
}
```

---

## 3. Umfragen

### POST /api/v1/polls
Neue Umfrage erstellen.

**Request (Schedule/Terminumfrage):**
```json
{
  "title": "Sommerfest Termin",
  "description": "Wann passt es euch am besten?",
  "type": "schedule",
  "expiresAt": "2024-12-31T23:59:59Z",
  "options": [
    {
      "text": "Montag, 15. Juli",
      "startTime": "2024-07-15T14:00:00Z",
      "endTime": "2024-07-15T18:00:00Z"
    },
    {
      "text": "Dienstag, 16. Juli",
      "startTime": "2024-07-16T14:00:00Z",
      "endTime": "2024-07-16T18:00:00Z"
    }
  ]
}
```

**Request (Survey/Umfrage):**
```json
{
  "title": "Ausflugsziel",
  "description": "Wohin soll der Ausflug gehen?",
  "type": "survey",
  "options": [
    { "text": "Zoo", "imageUrl": null },
    { "text": "Freizeitpark", "imageUrl": null },
    { "text": "Bauernhof", "imageUrl": null }
  ]
}
```

**Request (Organization/Orga-Liste):**
```json
{
  "title": "Kuchenbasar",
  "description": "Wer bringt was mit?",
  "type": "organization",
  "allowMultipleSlots": true,
  "options": [
    { "text": "Schokoladenkuchen", "capacity": 2 },
    { "text": "Obstsalat", "capacity": 3 },
    { "text": "Muffins", "capacity": 4 }
  ]
}
```

**Response:**
```json
{
  "poll": {
    "id": "uuid-123",
    "title": "Sommerfest Termin",
    "type": "schedule",
    "isActive": true,
    "createdAt": "2024-12-01T10:00:00Z"
  },
  "publicToken": "abc123xyz",
  "adminToken": "admin456def"
}
```

### GET /api/v1/polls/public/:token
Umfrage per Public-Token abrufen (für Teilnehmer).

**Response:**
```json
{
  "id": "uuid-123",
  "title": "Sommerfest Termin",
  "description": "Wann passt es euch am besten?",
  "type": "schedule",
  "isActive": true,
  "expiresAt": "2024-12-31T23:59:59Z",
  "allowMultipleSlots": false,
  "options": [
    {
      "id": 1,
      "text": "Montag, 15. Juli",
      "startTime": "2024-07-15T14:00:00Z",
      "endTime": "2024-07-15T18:00:00Z",
      "imageUrl": null,
      "capacity": null,
      "currentBookings": 0
    }
  ]
}
```

### GET /api/v1/polls/admin/:token
Umfrage per Admin-Token abrufen (für Ersteller).

**Zusätzliche Felder:**
- `adminToken` - Der Admin-Token selbst
- `userId` - ID des Erstellers
- `creatorEmail` - E-Mail des Erstellers

### PATCH /api/v1/polls/admin/:token
Umfrage bearbeiten.

**Request:**
```json
{
  "title": "Neuer Titel",
  "description": "Neue Beschreibung",
  "isActive": false,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### GET /api/v1/polls/:token/results
Abstimmungsergebnisse abrufen.

**Response:**
```json
{
  "pollId": "uuid-123",
  "totalVotes": 15,
  "participants": [
    {
      "name": "Anna Schmidt",
      "email": "anna@example.de",
      "votes": [
        { "optionId": 1, "response": "yes" },
        { "optionId": 2, "response": "maybe" }
      ]
    }
  ],
  "optionSummary": [
    {
      "optionId": 1,
      "text": "Montag, 15. Juli",
      "yesCount": 8,
      "maybeCount": 4,
      "noCount": 3,
      "score": 20
    }
  ],
  "bestOption": {
    "optionId": 1,
    "text": "Montag, 15. Juli",
    "score": 20
  }
}
```

### GET /api/v1/polls/:token/qr
QR-Code für Umfrage generieren.

**Response:**
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgo..."
}
```

---

## 4. Abstimmen

### POST /api/v1/polls/:token/vote
Einzelne Stimme abgeben (für Survey).

**Request:**
```json
{
  "voterName": "Anna Schmidt",
  "voterEmail": "anna@example.de",
  "optionId": 1,
  "response": "yes",
  "comment": "Passt mir gut!"
}
```

**Response:**
```json
{
  "success": true,
  "vote": {
    "id": 42,
    "optionId": 1,
    "response": "yes"
  },
  "editToken": "edit-abc123def456"
}
```

### POST /api/v1/polls/:token/vote-bulk
Mehrfach-Abstimmung (für Schedule mit mehreren Optionen).

**Request:**
```json
{
  "voterName": "Anna Schmidt",
  "voterEmail": "anna@example.de",
  "votes": [
    { "optionId": 1, "response": "yes" },
    { "optionId": 2, "response": "maybe" },
    { "optionId": 3, "response": "no" }
  ]
}
```

### GET /api/v1/votes/edit/:editToken
Stimme zum Bearbeiten laden.

**Response:**
```json
{
  "poll": { ... },
  "existingVotes": [
    { "optionId": 1, "response": "yes" },
    { "optionId": 2, "response": "maybe" }
  ],
  "voterName": "Anna Schmidt",
  "voterEmail": "anna@example.de"
}
```

### PUT /api/v1/votes/edit/:editToken
Stimme bearbeiten.

**Request:**
```json
{
  "votes": [
    { "optionId": 1, "response": "no" },
    { "optionId": 2, "response": "yes" }
  ]
}
```

---

## 5. Einladungen

### POST /api/v1/polls/:token/invite
E-Mail-Einladungen versenden.

**Request:**
```json
{
  "emails": ["anna@example.de", "bob@example.de"],
  "customMessage": "Bitte stimmt bis Freitag ab!"
}
```

**Response:**
```json
{
  "sent": 2,
  "failed": 0
}
```

### POST /api/v1/polls/:token/invite/matrix
Matrix-Chat-Einladungen versenden.

**Request:**
```json
{
  "userIds": ["@anna:matrix.kita.bayern", "@bob:matrix.kita.bayern"],
  "customMessage": "Bitte stimmt ab!"
}
```

---

## 6. Theming & Corporate Design

### GET /api/v1/customization
Branding-Konfiguration für Web-Frontend.

### GET /api/v1/customization/mobile ⭐ (Empfohlen für Flutter)
**Mobile-optimierte Theming-API** - speziell für Flutter/native Apps strukturiert.

**Response:**
```json
{
  "branding": {
    "siteName": "KITA Poll",
    "siteNameFirstPart": "KITA",
    "siteNameSecondPart": "Poll",
    "logoUrl": "https://polly.kita.bayern/uploads/logo.png",
    "footerText": "Die professionelle Abstimmungsplattform...",
    "copyrightText": "© 2025 KITA Bayern"
  },
  "colors": {
    "primary": "#f97316",
    "secondary": "#FDE4D2",
    "background": "#ffffff",
    "backgroundDark": "#1a1a1a",
    "surface": "#f5f5f5",
    "surfaceDark": "#2a2a2a",
    "pollTypes": {
      "schedule": {
        "color": "#F97316",
        "name": "Terminumfrage",
        "icon": "calendar"
      },
      "survey": {
        "color": "#7DB942",
        "name": "Umfrage",
        "icon": "bar_chart"
      },
      "organization": {
        "color": "#72BEB7",
        "name": "Orga-Liste",
        "icon": "list_alt"
      }
    }
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "headingWeight": 700,
    "bodyWeight": 400
  },
  "icons": {
    "format": "lucide",
    "mapping": {
      "calendar": "Calendar",
      "users": "Users",
      "check": "Check",
      "...": "..."
    }
  },
  "responses": {
    "yes": { "color": "#22c55e", "icon": "check_circle", "label": "Ja" },
    "maybe": { "color": "#eab308", "icon": "help", "label": "Vielleicht" },
    "no": { "color": "#ef4444", "icon": "cancel", "label": "Nein" }
  },
  "defaultThemeMode": "system",
  "apiVersion": "1.0.0"
}
```

### Farb-Schema für Poll-Typen

| Poll-Typ | Farbe | Hex-Code |
|----------|-------|----------|
| Schedule (Termin) | Orange | `#F97316` |
| Survey (Umfrage) | Grün | `#7DB942` |
| Organization (Orga) | Teal | `#72BEB7` |

Diese Farben können für Badges, Buttons und Akzente verwendet werden.

### GET /api/v1/theme
Aktuelle Theme-Präferenz (light/dark/system).

**Response:**
```json
{
  "themePreference": "system",
  "source": "user"
}
```

### POST /api/v1/theme
Theme-Präferenz setzen.

**Request:**
```json
{
  "themePreference": "dark"
}
```

---

## 7. Matrix Chat (Optional)

### GET /api/v1/matrix/status
Prüft ob Matrix-Integration aktiv ist.

**Response:**
```json
{
  "enabled": true,
  "searchEnabled": true
}
```

### GET /api/v1/matrix/users/search
Matrix-Benutzer suchen.

**Query-Parameter:**
- `q` - Suchbegriff (min. 2 Zeichen)
- `limit` - Max. Ergebnisse (default: 10)

**Response:**
```json
{
  "results": [
    {
      "userId": "@anna.schmidt:matrix.kita.bayern",
      "displayName": "Anna Schmidt",
      "avatarUrl": "mxc://matrix.kita.bayern/abc123"
    }
  ]
}
```

---

## 8. Bild-Upload

### POST /api/v1/upload/image
Bild für Umfrage-Optionen hochladen.

**Request:** `multipart/form-data`
- `image` - Die Bilddatei

**Response:**
```json
{
  "imageUrl": "/uploads/images/abc123.jpg"
}
```

---

## Fehler-Codes

Die API verwendet einheitliche Fehler-Codes für Mobile-Handling:

| HTTP | Code | Beschreibung |
|------|------|--------------|
| 400 | `INVALID_INPUT` | Ungültige Eingabedaten |
| 401 | `UNAUTHORIZED` | Nicht authentifiziert |
| 403 | `FORBIDDEN` | Keine Berechtigung |
| 404 | `NOT_FOUND` | Ressource nicht gefunden |
| 409 | `REQUIRES_LOGIN` | E-Mail gehört zu registriertem Konto |
| 409 | `EMAIL_MISMATCH` | E-Mail stimmt nicht mit Session überein |
| 409 | `DUPLICATE_EMAIL_VOTE` | Bereits abgestimmt |
| 410 | `POLL_EXPIRED` | Umfrage abgelaufen |
| 410 | `POLL_INACTIVE` | Umfrage nicht aktiv |
| 429 | `RATE_LIMITED` | Zu viele Anfragen |

**Fehler-Response Format:**
```json
{
  "error": "Beschreibung für den Benutzer",
  "errorCode": "REQUIRES_LOGIN",
  "details": {}
}
```

---

## Flutter Integration Beispiel

### API-Client Klasse

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class PollyApiClient {
  final String baseUrl;
  final String? accessToken;
  
  PollyApiClient({
    required this.baseUrl,
    this.accessToken,
  });
  
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (accessToken != null) 'Authorization': 'Bearer $accessToken',
  };
  
  // Meine Umfragen abrufen
  Future<List<Poll>> getMyPolls() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/user/polls'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['polls'] as List)
          .map((p) => Poll.fromJson(p))
          .toList();
    }
    throw PollyApiException.fromResponse(response);
  }
  
  // Abstimmen
  Future<VoteResult> vote(String token, VoteRequest request) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/polls/$token/vote'),
      headers: _headers,
      body: jsonEncode(request.toJson()),
    );
    
    if (response.statusCode == 200) {
      return VoteResult.fromJson(jsonDecode(response.body));
    }
    throw PollyApiException.fromResponse(response);
  }
  
  // Theming abrufen
  Future<Customization> getCustomization() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/customization'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      return Customization.fromJson(jsonDecode(response.body));
    }
    throw PollyApiException.fromResponse(response);
  }
}

// Error Handling
class PollyApiException implements Exception {
  final int statusCode;
  final String message;
  final String? errorCode;
  
  PollyApiException({
    required this.statusCode,
    required this.message,
    this.errorCode,
  });
  
  factory PollyApiException.fromResponse(http.Response response) {
    final body = jsonDecode(response.body);
    return PollyApiException(
      statusCode: response.statusCode,
      message: body['error'] ?? 'Unbekannter Fehler',
      errorCode: body['errorCode'],
    );
  }
  
  bool get requiresLogin => errorCode == 'REQUIRES_LOGIN';
}
```

### Theme-Integration

```dart
class PollyTheme {
  final Color primary;
  final Color scheduleColor;
  final Color surveyColor;
  final Color organizationColor;
  
  PollyTheme.fromCustomization(Customization c)
      : primary = _parseColor(c.theme.primaryColor),
        scheduleColor = _parseColor(c.theme.scheduleColor),
        surveyColor = _parseColor(c.theme.surveyColor),
        organizationColor = _parseColor(c.theme.organizationColor);
  
  static Color _parseColor(String hex) {
    return Color(int.parse(hex.substring(1), radix: 16) + 0xFF000000);
  }
  
  Color getColorForPollType(String type) {
    switch (type) {
      case 'schedule': return scheduleColor;
      case 'survey': return surveyColor;
      case 'organization': return organizationColor;
      default: return primary;
    }
  }
}
```

---

## Changelog

### Version 1.0.0 (Dezember 2024)
- Initiale API-Dokumentation für Flutter-Integration
- Bearer-Token-Authentifizierung
- Vollständige Endpunkt-Dokumentation
- Fehler-Code-Standardisierung
