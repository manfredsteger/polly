#!/bin/sh
set -e

echo "🏫 Polly - Starting..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for database..."
until pg_isready -h postgres -U ${POSTGRES_USER:-polly} -d ${POSTGRES_DB:-polly} 2>/dev/null; do
  sleep 1
done
echo "✅ Database is ready"

# Run database migrations on first start
echo "📦 Applying database schema..."
npx drizzle-kit push --force 2>&1 || true

# Create initial admin if not exists
echo "👤 Checking initial admin..."
npx tsx server/seed-admin.ts 2>&1 || echo "⚠️ Admin seeding skipped"

# Seed demo data if requested
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "🌱 Seeding demo data..."
  npx tsx server/seed-demo.ts 2>&1 || echo "⚠️ Demo seeding skipped"
fi

echo "🚀 Starting application..."
exec npx tsx server/index.ts
