#!/bin/sh
set -e

echo "🏫 Polly - Starting..."

# Show current BASE_URL configuration
if [ -n "$BASE_URL" ]; then
  echo "📱 BASE_URL: $BASE_URL"
  if echo "$BASE_URL" | grep -qE "(localhost|127\.0\.0\.1)"; then
    echo "   ⚠️ localhost detected - QR codes won't work from mobile devices"
    echo "   💡 For mobile testing, use: ./start-mobile.sh"
    echo "      Or set: BASE_URL=http://YOUR_IP:3080 docker compose up -d"
  fi
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0
until pg_isready -h postgres -U ${POSTGRES_USER:-polly} -d ${POSTGRES_DB:-polly} 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database connection timeout after ${MAX_RETRIES} attempts"
    exit 1
  fi
  sleep 1
done
echo "✅ Database is ready"

# Apply database schema using SQL migration (more reliable than interactive drizzle-kit)
echo "📦 Applying database schema..."

# Use ensureSchema.ts as primary migration method for Docker
# This directly applies SQL changes without interactive prompts
echo "🔧 Ensuring schema completeness..."
if ! npx tsx server/scripts/ensureSchema.ts 2>&1; then
  echo "❌ Schema update failed!"
  exit 1
fi

# Verify database schema integrity
echo "🔍 Verifying database schema..."
if ! npx tsx server/scripts/dbHealthCheck.ts 2>&1; then
  echo "❌ Database schema verification failed!"
  echo "   Required tables or columns are missing."
  echo "   Try running: npx drizzle-kit push --force"
  exit 1
fi
echo "✅ Database schema verified"

# Create initial admin if not exists
echo "👤 Checking initial admin..."
if ! npx tsx server/seed-admin.ts 2>&1; then
  echo "⚠️ Admin seeding failed - continuing anyway"
fi

# Seed demo data if requested
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "🧹 Purging old test data before seeding..."
  # Delete all isTestData polls and related data to ensure clean demo data
  # Order matters: delete dependent rows first to avoid FK constraint violations
  PURGE_RESULT=$(psql -h postgres -U ${POSTGRES_USER:-polly} -d ${POSTGRES_DB:-polly} -c "
    DELETE FROM votes WHERE poll_id IN (SELECT id FROM polls WHERE is_test_data = true);
    DELETE FROM notification_logs WHERE poll_id IN (SELECT id FROM polls WHERE is_test_data = true);
    DELETE FROM poll_options WHERE poll_id IN (SELECT id FROM polls WHERE is_test_data = true);
    DELETE FROM polls WHERE is_test_data = true;
  " 2>&1)
  
  if echo "$PURGE_RESULT" | grep -qi "error"; then
    echo "❌ Test data purge failed: $PURGE_RESULT"
    echo "   Continuing anyway - this may cause demo seed to be skipped"
  else
    echo "✅ Old test data purged"
  fi
  
  echo "🌱 Seeding demo data..."
  if ! npx tsx server/seed-demo.ts 2>&1; then
    echo "❌ Demo seeding failed!"
    exit 1
  fi
fi

echo "🚀 Starting application..."
exec npx tsx server/index.ts
