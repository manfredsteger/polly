---
name: Quality and test expectations
description: Project-level expectations for automated coverage and regression alerts.
---

For this project, the user expects broad code coverage and unit tests so regressions are caught and signaled promptly by automation.

**Why:** the user explicitly said that broad coverage, unit tests, and immediate alerts are needed to prevent repeat regressions.

**How to apply:** add focused regression or scenario tests with each fix or feature, ensure the relevant CI job runs them on the active branch, and make failures visible rather than silently ignored. The coverage gate is blocking in CI since Oct 2026.

**Coverage ratchet rule:** thresholds in vitest.config.ts sit about one point below the last full measured run. Raise them after adding tests; never lower them to get CI green — add tests instead.
**Why:** the user wanted coverage failures visible as CI failures without the pipeline staying permanently red; a one-point margin absorbs run-to-run noise.
**How to apply:** after a meaningful batch of tests, run `npx vitest run --coverage --coverage.reporter=json --coverage.reporter=text-summary` (~90 s) and bump the thresholds. Coverage only counts what the suite imports, so a single-file coverage run always fails the global thresholds — that is expected.
