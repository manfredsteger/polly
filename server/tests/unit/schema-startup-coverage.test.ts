/**
 * Regression guard for the self-hosted Docker upgrade path (beta.7 bug:
 * `column "response_mode" does not exist`).
 *
 * Docker deployments never run `drizzle-kit push` — the container startup
 * script (server/scripts/ensureSchema.ts) is the only schema mechanism.
 * It applies every migration file listed in migrations/meta/_journal.json
 * plus the COLUMN_UPDATES fallback list.
 *
 * These tests fail whenever shared/schema.ts gains a column that the
 * startup mechanism would NOT create on an existing self-hosted database.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getTableColumns } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../../../shared/schema';
import { loadMigrationJournal, COLUMN_UPDATES } from '../../scripts/ensureSchema';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

function readJournalSql(): string {
  return loadMigrationJournal()
    .map((tag) => fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), 'utf-8'))
    .join('\n');
}

describe('startup schema coverage (Docker upgrade path)', () => {
  it('journal lists at least the known migrations, in order', () => {
    const tags = loadMigrationJournal();
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags[0]).toBe('0000_old_vance_astro');
    expect(tags).toContain('0002_simple_choice_mode');
  });

  it('every migration tag in the journal has an existing .sql file', () => {
    for (const tag of loadMigrationJournal()) {
      expect(fs.existsSync(path.join(MIGRATIONS_DIR, `${tag}.sql`)), `missing migrations/${tag}.sql`).toBe(true);
    }
  });

  it('ensureSchema applies all journal migration files (not just 0000)', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/scripts/ensureSchema.ts'),
      'utf-8'
    );
    expect(source).toContain('loadMigrationJournal()');
    // The old buggy version hardcoded only the initial migration:
    expect(source).not.toMatch(/migrationPath\s*=.*'0000_old_vance_astro\.sql'/);
  });

  it('every column in shared/schema.ts is created by startup (migrations ∪ COLUMN_UPDATES ∪ ensureSchema inline DDL)', () => {
    const journalSql = readJournalSql();
    const fallbackColumns = new Set(COLUMN_UPDATES.map((c) => `${c.table}.${c.column}`));
    const ensureSchemaSource = fs.readFileSync(
      path.resolve(process.cwd(), 'server/scripts/ensureSchema.ts'),
      'utf-8'
    );

    const missing: string[] = [];
    for (const exported of Object.values(schema)) {
      if (!(exported instanceof PgTable)) continue;
      const tableName = getTableConfig(exported).name;
      for (const column of Object.values(getTableColumns(exported))) {
        const colName = (column as { name: string }).name;
        const inMigrations =
          journalSql.includes(`"${colName}"`) &&
          // require the table itself to exist in migrations too
          journalSql.includes(`"${tableName}"`);
        const inFallback = fallbackColumns.has(`${tableName}.${colName}`);
        // Tables created directly by ensureSchema via CREATE TABLE IF NOT EXISTS
        // (e.g. ai_usage_logs) count as covered when the column appears in its DDL.
        const inInlineDdl =
          ensureSchemaSource.includes(`CREATE TABLE IF NOT EXISTS "${tableName}"`) &&
          ensureSchemaSource.includes(`"${colName}"`);
        if (!inMigrations && !inFallback && !inInlineDdl) {
          missing.push(`${tableName}.${colName}`);
        }
      }
    }

    expect(
      missing,
      `Columns missing from the Docker startup schema mechanism. ` +
        `Add a migration file (drizzle-kit generate) or a COLUMN_UPDATES entry in ` +
        `server/scripts/ensureSchema.ts for: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('the beta.7 regression columns are covered by COLUMN_UPDATES as well', () => {
    const fallback = new Set(COLUMN_UPDATES.map((c) => `${c.table}.${c.column}`));
    expect(fallback.has('polls.response_mode')).toBe(true);
    expect(fallback.has('polls.max_selections')).toBe(true);
  });
});
