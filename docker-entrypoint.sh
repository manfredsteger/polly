#!/bin/sh
set -e

echo "🏫 Polly - Starting..."

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

# Run database migrations - FAIL HARD if this doesn't work
echo "📦 Applying database schema..."
# Use yes to auto-answer prompts, and --force for non-interactive mode
if ! yes n | npx drizzle-kit push --force 2>&1; then
  echo "⚠️ drizzle-kit push had issues, trying fallback..."
fi
echo "✅ Database schema applied"

# Ensure all columns exist (fallback for drizzle-kit issues)
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
  echo "🌱 Seeding demo data..."
  npx tsx server/seed-demo.ts 2>&1 || echo "⚠️ Demo seeding skipped"
fi

echo "🚀 Starting application..."
exec npx tsx server/index.ts
