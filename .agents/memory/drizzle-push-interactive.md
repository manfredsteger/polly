---
name: Drizzle push is interactive
description: Safety and headless setup behavior of Drizzle schema pushes.
---

Do not use `drizzle-kit push --force` in automatic post-merge setup. It can approve data-loss changes, and Drizzle still prompts for a choice when adding a unique constraint to a populated table, even with `--force`.

**Why:** a headless post-merge run timed out at that prompt; the alternative in the prompt could truncate a populated verification-token table.

**How to apply:** apply checked-in SQL migrations non-interactively. If schema source changes without a migration, fail with an actionable message rather than force-pushing or deleting data.
