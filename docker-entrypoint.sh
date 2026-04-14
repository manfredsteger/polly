#!/bin/sh
set -e

echo "========================================="
echo " Polly - Docker Startup"
echo "========================================="

# Show current BASE_URL configuration
if [ -n "$BASE_URL" ]; then
  echo "[Config] BASE_URL: $BASE_URL"
  if echo "$BASE_URL" | grep -qE "(localhost|127\.0\.0\.1)"; then
    echo "[Config] Note: localhost detected - QR codes won't work from mobile devices"
  fi
fi

# =========================================
# Step 1: Wait for PostgreSQL
# =========================================

# Extract host and port from DATABASE_URL using Node.js URL parser
# This safely handles special characters in passwords (: @ # etc.)
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(node -e "try { console.log(new URL(process.env.DATABASE_URL).hostname) } catch(e) { console.error('[DB] ERROR: Invalid DATABASE_URL format'); process.exit(1) }")
  DB_PORT=$(node -e "try { console.log(new URL(process.env.DATABASE_URL).port || '5432') } catch(e) { process.exit(1) }")
  if [ -z "$DB_HOST" ]; then
    echo "[DB] ERROR: Could not parse DATABASE_URL — check the format (postgresql://user:pass@host:port/dbname)"
    exit 1
  fi
else
  DB_HOST=${POSTGRES_HOST:-postgres}
  DB_PORT=${POSTGRES_PORT:-5432}
fi

echo "[DB] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
MAX_RETRIES=60
RETRY_COUNT=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "[DB] ERROR: Connection timeout after ${MAX_RETRIES} seconds"
    exit 1
  fi
  sleep 1
done
echo "[DB] PostgreSQL is ready"

# =========================================
# Step 2: Apply database schema (raw SQL, no Drizzle ORM)
# Uses direct pg Pool connection - reliable in Docker
# =========================================
echo "[Schema] Ensuring database schema..."
if ! npx tsx server/scripts/ensureSchema.ts 2>&1; then
  echo "[Schema] ERROR: Schema setup failed!"
  exit 1
fi

echo "[Schema] Verifying schema integrity..."
if ! npx tsx server/scripts/dbHealthCheck.ts 2>&1; then
  echo "[Schema] ERROR: Schema verification failed!"
  exit 1
fi
echo "[Schema] Database schema OK"

# =========================================
# Step 3: Start application
# The following are handled inside the app process (server/index.ts):
#   - seed-admin: Creates/updates initial admin user (configurable via ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD)
#   - seed-demo: Creates demo polls (only on first run / empty database)
#   - Branding/customization bootstrap
#   - ClamAV initialization
# This is more reliable because it uses the established
# Drizzle ORM connection and module resolution.
# =========================================
echo "[App] Starting Polly..."
exec npx tsx server/index.ts
