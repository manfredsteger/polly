# Polly - Production Deployment Guide

Dieses Dokument beschreibt die Installation und Konfiguration von Polly für den Produktionsbetrieb.

## Inhaltsverzeichnis

1. [Schnellstart mit Docker](#schnellstart-mit-docker)
2. [Manuelle Installation](#manuelle-installation)
3. [Umgebungsvariablen](#umgebungsvariablen)
4. [Systemabhängigkeiten](#systemabhängigkeiten)
5. [Hochsicherheits-Cluster Deployment](#hochsicherheits-cluster-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Schnellstart mit Docker

### Ein-Zeilen-Setup

```bash
docker compose up -d
```

Das startet:
- PostgreSQL 16 Datenbank
- Polly Anwendung auf Port 3080 (extern)

Öffnen Sie http://localhost:3080 im Browser.

### Mit eigener Konfiguration

```bash
# .env Datei erstellen
cat > .env << 'EOF'
BASE_URL=https://poll.ihre-domain.de
SESSION_SECRET=ihr-sicheres-geheimnis-mindestens-32-zeichen
POSTGRES_PASSWORD=ihr-datenbank-passwort
SMTP_HOST=mail.ihre-domain.de
SMTP_USER=noreply@ihre-domain.de
SMTP_PASSWORD=ihr-smtp-passwort
EMAIL_FROM=Polly <noreply@ihre-domain.de>
EOF

docker compose up -d
```

### Demo-Daten laden (optional)

```bash
SEED_DEMO_DATA=true docker compose up -d
```

---

## Manuelle Installation

### Voraussetzungen

- Node.js 22 LTS
- PostgreSQL 16
- Chromium (für PDF-Export)

### Schritt 1: Abhängigkeiten installieren

**Ubuntu/Debian:**
```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16
sudo apt-get install -y postgresql-16

# Chromium und Abhängigkeiten für PDF-Export
sudo apt-get install -y chromium-browser \
    libnss3 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    fonts-liberation
```

**RHEL/CentOS:**
```bash
# Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# PostgreSQL 16
sudo dnf install -y postgresql16-server

# Chromium
sudo dnf install -y chromium
```

### Schritt 2: Anwendung bauen

```bash
# Repository klonen
git clone https://github.com/manfredsteger/polly.git
cd polly

# Dependencies installieren
npm ci

# Anwendung bauen
npm run build
```

### Schritt 3: Datenbank einrichten

```bash
# PostgreSQL Benutzer und Datenbank erstellen
sudo -u postgres psql << 'EOF'
CREATE USER polly WITH PASSWORD 'ihr-sicheres-passwort';
CREATE DATABASE polly OWNER polly;
GRANT ALL PRIVILEGES ON DATABASE polly TO polly;
EOF

# Schema erstellen
DATABASE_URL="postgresql://polly:ihr-passwort@localhost:5432/polly" \
  npx drizzle-kit push
```

### Schritt 4: Anwendung starten

```bash
# Umgebungsvariablen setzen
export DATABASE_URL="postgresql://polly:passwort@localhost:5432/polly"
export BASE_URL="https://polly.ihre-domain.de"
export SESSION_SECRET="$(openssl rand -hex 32)"
export NODE_ENV="production"

# Starten
npm start
```

---

## Umgebungsvariablen

### Pflichtangaben

| Variable | Beschreibung | Beispiel |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL Verbindung | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Geheimer Schlüssel für Sessions (min. 32 Zeichen) | `openssl rand -hex 32` |
| `BASE_URL` | Öffentliche URL der Anwendung | `https://polly.example.com` |

### E-Mail-Konfiguration

| Variable | Beschreibung | Beispiel |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP Server | `mail.ihre-domain.de` |
| `SMTP_PORT` | SMTP Port | `587` |
| `SMTP_SECURE` | TLS verwenden | `false` (STARTTLS) oder `true` (TLS) |
| `SMTP_USER` | SMTP Benutzername | `noreply@ihre-domain.de` |
| `SMTP_PASSWORD` | SMTP Passwort | |
| `EMAIL_FROM` | Absender-Adresse | `Polly <noreply@ihre-domain.de>` |

### Keycloak/OIDC (optional)

| Variable | Beschreibung |
|----------|-------------|
| `KEYCLOAK_URL` | Keycloak Server URL |
| `KEYCLOAK_REALM` | Realm Name |
| `KEYCLOAK_CLIENT_ID` | Client ID |
| `KEYCLOAK_CLIENT_SECRET` | Client Secret |

### Datenbank SSL

| Variable | Beschreibung |
|----------|-------------|
| `DATABASE_SSL` | SSL aktivieren (`true`/`false`) |

---

## Systemabhängigkeiten

Die Anwendung benötigt folgende Systempakete:

### Für PDF-Export (Puppeteer/Chromium)

| Paket | Debian/Ubuntu | RHEL/CentOS | Zweck |
|-------|--------------|-------------|-------|
| Chromium | `chromium-browser` | `chromium` | Headless Browser |
| NSS | `libnss3` | `nss` | Kryptografie |
| ATK | `libatk1.0-0` | `atk` | Barrierefreiheit |
| Cups | `libcups2` | `cups-libs` | Druckdienste |
| X11 | `libx11-6` | `libX11` | Display |
| Fonts | `fonts-liberation` | `liberation-fonts` | Schriftarten |

### Alpine Linux (Docker)

```dockerfile
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ttf-freefont \
    cairo pango jpeg giflib postgresql-client
```

---

## Hochsicherheits-Cluster Deployment

### Kubernetes/OpenShift

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: polly
spec:
  replicas: 2
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: app
        image: ihr-registry/polly:latest
        ports:
        - containerPort: 5000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: polly-secrets
              key: database-url
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: polly-secrets
              key: session-secret
        - name: BASE_URL
          value: "https://poll.ihre-domain.de"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: polly-uploads
      - name: tmp
        emptyDir: {}
```

### Sicherheitshinweise für Behörden-Cluster

1. **Container-Signierung**: Images vor Deployment signieren und verifizieren
2. **Netzwerk-Policies**: Nur notwendige Verbindungen erlauben (DB, SMTP)
3. **Secrets Management**: Vault oder Kubernetes Secrets verwenden
4. **Audit Logging**: Alle API-Zugriffe protokollieren
5. **Read-Only Filesystem**: Container mit ReadOnlyRootFilesystem betreiben
6. **ClamAV**: Virenscanner für Datei-Uploads aktivieren

### Air-Gapped Installation

```bash
# Auf Internet-System: Images exportieren
docker save polly:latest postgres:16-alpine | gzip > polly-bundle.tar.gz

# Auf Air-Gapped System: Images importieren
gunzip -c polly-bundle.tar.gz | docker load
docker compose up -d
```

---

## Troubleshooting

### PDF-Export funktioniert nicht

```bash
# Chromium-Pfad prüfen
which chromium || which chromium-browser

# Umgebungsvariable setzen falls nötig
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)
```

### Datenbankverbindung schlägt fehl

```bash
# Verbindung testen
psql "$DATABASE_URL" -c "SELECT 1"

# Bei SSL-Problemen
export DATABASE_SSL=true
```

### E-Mail-Versand funktioniert nicht

```bash
# SMTP-Verbindung testen
openssl s_client -connect $SMTP_HOST:$SMTP_PORT -starttls smtp

# Logs prüfen
docker compose logs app | grep -i smtp
```

---

## Support

Bei Fragen oder Problemen:
- GitHub Issues: https://github.com/manfredsteger/polly/issues
- E-Mail: support@polly.example.com
