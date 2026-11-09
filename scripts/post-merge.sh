#!/usr/bin/env bash
set -euo pipefail

# Use the committed lockfile for reproducible, non-interactive dependency setup.
npm ci --no-audit --no-fund

if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "No parent commit found; skipping database migration detection."
  exit 0
fi

base_commit="$(git rev-parse HEAD^)"

# Apply only checked-in SQL migrations. `drizzle-kit push --force` is unsafe
# here: it can approve destructive changes, and still prompts for some unique
# constraints even when --force is supplied.
if ! git diff --quiet "$base_commit" HEAD -- migrations; then
  echo "Migration files changed in the merged commit; applying reviewed migrations."
  npx drizzle-kit migrate
elif ! git diff --quiet "$base_commit" HEAD -- shared/schema.ts server/scripts/ensureSchema.ts; then
  echo "Database schema changed without a checked-in migration." >&2
  echo "Add and review a SQL migration before applying this merge." >&2
  exit 1
else
  echo "No database schema or migration changes in the merged commit; skipping database setup."
fi
