# KITA Poll - Self-Hosting Guide

This guide covers deploying KITA Poll on your own infrastructure, including universities, government organizations, and private data centers.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [Configuration](#configuration)
5. [Security Hardening](#security-hardening)
6. [Reverse Proxy Setup](#reverse-proxy-setup)
7. [Backup & Recovery](#backup--recovery)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/kita-poll.git
cd kita-poll

# Start with zero configuration
docker compose up -d

# Open http://localhost:3080
```

That's it! The application auto-configures PostgreSQL and applies the database schema on first start.

---

## Prerequisites

### Docker Deployment (Recommended)

- Docker 20.10+
- Docker Compose V2+ (included with Docker Desktop)
- 2 GB RAM minimum
- 10 GB disk space

### Manual Deployment

- Node.js 20 LTS or higher
- PostgreSQL 15 or higher
- npm 10+

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

Best for: Small to medium deployments, quick evaluation

```bash
# Production with custom settings
cp .env.example .env
nano .env  # Configure your settings

docker compose up -d
```

### Option 2: Docker with External Database

Best for: Organizations with existing PostgreSQL infrastructure

```bash
# Use external database
docker run -d \
  --name kita-poll \
  -p 3080:5000 \
  -e DATABASE_URL=postgresql://user:pass@your-db-host:5432/kitapoll \
  -e SESSION_SECRET=your-secure-secret \
  -v kita-uploads:/app/uploads \
  kita-poll:latest
```

### Option 3: Kubernetes / Helm

Best for: Large-scale enterprise deployments

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kita-poll
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kita-poll
  template:
    metadata:
      labels:
        app: kita-poll
    spec:
      containers:
      - name: kita-poll
        image: kita-poll:latest
        ports:
        - containerPort: 5000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: kita-poll-secrets
              key: database-url
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: kita-poll-secrets
              key: session-secret
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: kita-poll-uploads
```

### Option 4: Manual Deployment

Best for: Development, special requirements

```bash
# Install dependencies
npm ci --production

# Build frontend
npm run build

# Push database schema
npm run db:push

# Start server
npm start
```

---

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Session encryption key (min 32 chars) | `your-secure-random-string` |

### Application URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Public URL of your application | `https://poll.example.com` |
| `VITE_APP_URL` | Same as APP_URL (for frontend) | `https://poll.example.com` |

### Email Configuration (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.example.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS | `false` |
| `SMTP_USER` | SMTP username | `user@example.com` |
| `SMTP_PASSWORD` | SMTP password | `password` |
| `EMAIL_FROM` | From address | `noreply@example.com` |

### Keycloak OIDC (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `KEYCLOAK_REALM` | Keycloak realm name | `university` |
| `KEYCLOAK_CLIENT_ID` | Client ID | `kita-poll` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret | `secret-uuid` |
| `KEYCLOAK_AUTH_SERVER_URL` | Keycloak base URL | `https://keycloak.example.com` |

### ClamAV Virus Scanning (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAMAV_HOST` | ClamAV daemon host | `clamav` |
| `CLAMAV_PORT` | ClamAV daemon port | `3310` |
| `CLAMAV_ENABLED` | Enable scanning | `true` |

---

## Security Hardening

### 1. Session Secret

Generate a secure session secret:

```bash
openssl rand -base64 32
```

### 2. Database Security

- Use a dedicated database user with limited permissions
- Enable SSL connections to PostgreSQL
- Use strong passwords (min 16 characters)

```sql
-- Create dedicated user
CREATE USER kitapoll WITH PASSWORD 'secure-password';
CREATE DATABASE kitapoll OWNER kitapoll;
GRANT ALL PRIVILEGES ON DATABASE kitapoll TO kitapoll;
```

### 3. Network Security

- Deploy behind a reverse proxy (nginx, Traefik)
- Use HTTPS with valid TLS certificates
- Restrict database access to internal network

### 4. File Upload Security

- Configure ClamAV for virus scanning
- Limit upload file sizes
- Store uploads outside web root

---

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name poll.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name poll.example.com;

    ssl_certificate /etc/letsencrypt/live/poll.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/poll.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for live voting
    location /ws/ {
        proxy_pass http://localhost:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Larger body size for file uploads
    client_max_body_size 10M;
}
```

### Traefik (Docker Labels)

```yaml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.kita-poll.rule=Host(`poll.example.com`)"
      - "traefik.http.routers.kita-poll.entrypoints=websecure"
      - "traefik.http.routers.kita-poll.tls.certresolver=letsencrypt"
      - "traefik.http.services.kita-poll.loadbalancer.server.port=5000"
```

---

## Backup & Recovery

### Database Backup

```bash
# Backup
docker compose exec postgres pg_dump -U kitapoll kitapoll > backup.sql

# Restore
docker compose exec -T postgres psql -U kitapoll kitapoll < backup.sql
```

### Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * docker compose -f /path/to/docker-compose.yml exec -T postgres pg_dump -U kitapoll kitapoll | gzip > /backups/kitapoll-$(date +\%Y\%m\%d).sql.gz
```

### File Backup

```bash
# Backup uploads
tar -czf uploads-backup.tar.gz uploads/
```

---

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3080/api/health
# Returns: {"status":"ok","timestamp":"..."}
```

### Docker Health Status

```bash
docker compose ps
docker inspect --format='{{.State.Health.Status}}' kita-poll-app
```

### Prometheus Metrics (Optional)

Configure your monitoring stack to scrape the health endpoint.

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs app

# Common issues:
# - DATABASE_URL incorrect
# - PostgreSQL not ready yet
# - Port 5000 already in use
```

### Database Connection Issues

```bash
# Test connection from app container
docker compose exec app sh -c "pg_isready -h postgres -U kitapoll"

# Check environment variable
docker compose exec app sh -c "echo \$DATABASE_URL"
```

### Email Not Sending

1. Check SMTP settings in admin panel
2. Verify SMTP credentials
3. Check server logs for SMTP errors
4. Test with a simple SMTP client

```bash
# Test SMTP connection
docker compose exec app sh -c "nc -zv smtp.example.com 587"
```

### Performance Issues

1. Check container resource limits
2. Monitor PostgreSQL connections
3. Consider PostgreSQL connection pooling (PgBouncer)
4. Increase container memory if needed

### Reset Admin Password

```bash
# Connect to database
docker compose exec postgres psql -U kitapoll kitapoll

# Reset password (use bcrypt hash)
UPDATE users SET password = '$2b$10$...' WHERE role = 'admin';
```

---

## University-Specific Notes

### LDAP/Active Directory

Use Keycloak as an OIDC bridge to integrate with your existing LDAP/AD infrastructure:

1. Set up Keycloak with User Federation pointing to your LDAP
2. Configure KITA Poll with Keycloak OIDC settings
3. Users can then log in with their university credentials

### Network Restrictions

If deploying in a restricted network:

- Ensure internal DNS resolves correctly
- Configure proxy settings if needed
- Whitelist the application in your firewall

### Data Privacy (GDPR)

- All data is stored in your PostgreSQL database
- No external analytics or tracking
- Configure data retention policies in admin panel
- Export/delete user data as needed

---

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check the `/docs` folder for additional guides
- Community: Join discussions on GitHub

---

## License

KITA Poll is open source software licensed under the MIT License.
