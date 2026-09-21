# Polly - Testing Guide

## Automated tests and database isolation

Database-backed Vitest tests require an explicitly configured, separate database.
They must not run against the application database: setup creates test accounts,
resets the test administrator credentials/MFA, and tests modify users, polls,
votes, and settings.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Normal application connection; leave unchanged. |
| `TEST_DATABASE_URL` | Disposable PostgreSQL database for tests. Required for database-backed tests. |
| `TEST_DATABASE_SSL` | Set to `true` when the test connection requires the application's SSL option; defaults to `false`. |

The test database must have a different database name, even if its host or login
is different. Missing, invalid, or unsafe configuration blocks tests before setup.
Only the test process receives the test URL as its `DATABASE_URL`. The application
continues using its own connection, including to store test-run history.

### Create and initialize the test database

A PostgreSQL login is different from a Polly account. Create the database login
once; tests create their own Polly accounts inside the test database.

Connect to PostgreSQL as a database administrator and run:

```sql
CREATE ROLE polly_test_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
```

Set its password interactively in `psql`, then create the database:

```text
\password polly_test_user
```

```sql
CREATE DATABASE polly_test OWNER polly_test_user;
```

If either already exists, inspect it rather than recreating it. Have the database
administrator verify that the test role cannot read or modify application data;
new roles can inherit permissions granted to `PUBLIC`.

Configure the test connection in your shell or deployment Secret:

```text
TEST_DATABASE_URL=postgresql://polly_test_user:URL_ENCODED_PASSWORD@POSTGRES_HOST:5432/polly_test
```

Use your actual host and password (URL-encode special characters). An `.env` file
alone does not guarantee the variable is available to a shell command or container.

In the application directory, with `TEST_DATABASE_URL` available in the shell:

```sh
node -e 'console.log(new URL(process.env.TEST_DATABASE_URL).pathname)'
ls -l shared/schema.ts drizzle.config.ts
```

Verify that the first command prints `/polly_test`, never the application database.
Then create the tables:

```sh
DATABASE_URL="${TEST_DATABASE_URL:?TEST_DATABASE_URL is missing}" npm run db:push
```

The override applies only to this command. It uses `shared/schema.ts` and
`drizzle.config.ts`, creates the table structure, and copies no production data.
Repeat the schema setup against the test database when the application schema
changes. The container/job used for this step must include the schema files and
`drizzle-kit`. Verify with `\c polly_test` then `\dt public.*` in `psql`.

### Run tests

```sh
# Requires the initialized test database and TEST_DATABASE_URL in the environment
npx vitest run

# Isolated regression tests: no database or database setup required
npx vitest run --config vitest.privacy.config.ts
```

For **Admin → Tests → Run Tests**, configure `TEST_DATABASE_URL` on the application
workload. The image must include Vitest, test source files, and test fixtures such
as `CHANGELOG.md`. Reports use a unique directory under the OS temporary directory
(which must be writable). Test-database cleanup runs after the suite, including
admin-panel runs. Existing application test-data counts are not counts from the
separate test database.

Tests still share application-pod CPU and memory when launched in-app. Prefer CI
or a dedicated testing deployment for heavy suites. Do not assume database
isolation also isolates SMTP or other external services; configure test-safe
service settings in the testing deployment.

### Docker Compose and local Make commands

Add the test connection to your local `.env`, then explicitly pass it through to
`app` in the Compose file or an override:

```yaml
services:
  app:
    environment:
      TEST_DATABASE_URL: ${TEST_DATABASE_URL:-}
      TEST_DATABASE_SSL: ${TEST_DATABASE_SSL:-false}
```

For bundled PostgreSQL, use the Service name `postgres`, not `localhost`, in the
app container's test URL. Recreate the app using the same Compose files used to
start it (`make dev` uses both `docker-compose.yml` and `docker-compose.dev.yml`).
Creating the environment variable does not create the database or its tables.

**`make complete` deletes Compose volumes with `down -v`.** It removes local
application and test databases stored in those volumes. Use it only for a
deliberate fresh local setup; provision and initialize the test database again
afterward. Do not use it as a routine upgrade command.

For Kubernetes/Rancher configuration, see the
[self-hosting guide](docs/SELF-HOSTING.md#test-database-in-kubernetes-or-rancher).

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Tests blocked with `TEST_DATABASE_UNSAFE` | Test URL exists in the running app pod and uses a different database name. |
| `Invalid URL` with input `undefined` | `TEST_DATABASE_URL` was not passed to that shell/container. |
| `node: command not found` in Rancher | Use the Polly app container for schema commands, not the PostgreSQL container. |
| Missing tables | Initialize the test schema using the command above. |
| Report-file permission error | Deploy the updated runner and ensure its temporary directory is writable. |
| Missing `CHANGELOG.md` | Rebuild the image with the updated Dockerfile and `.dockerignore`. |
| Completed email but GUI still shows Running | Refresh Test History; automatic completion refresh remains a known UI issue. |

To inspect actual database connections during a test run, query PostgreSQL as an
administrator (read-only):

```sql
SELECT datname, usename, state, count(*)
FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY datname, usename, state
ORDER BY datname, usename;
```

Connections to both databases are expected: application/reporting traffic uses
the application database; tests use the test database and test login.

## Permanent Example URLs for Development

Save these URLs as bookmarks for easy testing of all features:

### 📊 Example Survey - "Team Sommerfest Aktivitäten 2025"
A classic survey where users vote for their favorite summer festival activities. **Now with beautiful SVG images!**

- **Public URL (for voting)**: http://localhost:3080/poll/example-survey-public-2HBD_6QRkmWXAFW0C1dE
- **Admin URL (for management)**: http://localhost:3080/admin/example-survey-admin-S3O3K40gXfe3v_xGgl2T
- **Results URL (direct to results)**: http://localhost:3080/poll/example-survey-public-2HBD_6QRkmWXAFW0C1dE#results

**Features to test:**
- Classic survey voting (Ja/Vielleicht/Nein)
- Beautiful, colorful SVG images for each option
- Image lightbox with voting functionality
- Alt text accessibility features
- Results visualization with thumbnails
- PDF/CSV export functionality
- Email notifications

**Survey includes images for:**
- 🏰 Hüpfburg und Spielgeräte (Bounce house with happy children)
- 🎨 Kinderschminken (Face painting with butterfly design)
- ✂️ Bastelstation (Craft station with supplies)
- 🍖 Grillstation mit Würstchen (BBQ grill with sausages)
- 🎵 Musik und Tanz (Children dancing to music)

### 📅 Example Date Poll - "Elternabend Terminplanung"
A scheduling poll for finding the best meeting time.

- **Public URL (for voting)**: http://localhost:3080/poll/example-poll-public-JS_sF-UiedqeIXhFbOfV
- **Admin URL (for management)**: http://localhost:3080/admin/example-poll-admin-0dyW1qaEC7nx_iyPlrVi
- **Results URL (direct to results)**: http://localhost:3080/poll/example-poll-public-JS_sF-UiedqeIXhFbOfV#results

**Features to test:**
- Date/time scheduling interface
- Calendar-based options
- Time slot voting
- Best time recommendations

## Maintenance Scripts

### Create Fresh Examples
```bash
NODE_ENV=development tsx scripts/create-examples.ts
```

### Update Examples with Latest Features
```bash
NODE_ENV=development tsx scripts/update-examples.ts
```

### Add Beautiful Images to Survey
```bash
NODE_ENV=development tsx scripts/add-images-to-examples.ts
```

## Development Workflow

1. **Make code changes** to implement new features
2. **Test with example URLs** - no need to create new polls each time
3. **Update examples** if needed with the update script
4. **Save URLs as bookmarks** for quick access during development

## Sample Data

The examples include:
- **Survey with 5 activity options** - Now with beautiful, colorful SVG images!
  - Professional illustrations for each summer festival activity
  - Detailed alt text for full accessibility testing
  - Lightbox functionality with voting controls
- **Date poll with 4 time slot options** for next week
- **Complete German localization** throughout
- **Polly brand styling** with modern colors
- **Full accessibility features** including screen reader support

**SVG Images Include:**
- Custom-designed illustrations for each survey option
- Bright, child-friendly colors and themes
- Professional quality artwork
- Optimized for web display and accessibility

These permanent examples make development much faster since you don't need to recreate polls every time you test changes!