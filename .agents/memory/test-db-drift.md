---
name: Test vs dev database drift
description: Schema changes must reach both the vitest DB (DATABASE_URL) and the dev DB; drizzle push is interactive
---

- The vitest suite connects via `DATABASE_URL` (server/db.ts); it can be a different database than the one the dev workflow uses. A schema change applied to one DB still 500s in the other ("column ... does not exist").
- **Why:** hit when adding poll columns — dev API worked while tests failed with a Drizzle insert error.
- **How to apply:** after editing shared/schema.ts, apply the ALTER to both DBs (a small node/pg script is reliable) and add a numbered SQL file in `migrations/` plus a `migrations/meta/_journal.json` entry for self-hosters. `npm run db:push` can hang on interactive rename prompts (there is pre-existing drift like a `show_winner` column not in schema), so prefer explicit SQL.
