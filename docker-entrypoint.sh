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
echo "[DB] Waiting for PostgreSQL..."
MAX_RETRIES=60
RETRY_COUNT=0
until pg_isready -h postgres -U ${POSTGRES_USER:-polly} -d ${POSTGRES_DB:-polly} 2>/dev/null; do
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
# Admin seeding, demo data seeding, branding, and ClamAV
# are ALL handled inside the app process (server/index.ts).
# This is more reliable because it uses the established
# Drizzle ORM connection and module resolution.
# =========================================
echo "[App] Starting Polly..."
exec npx tsx server/index.ts
