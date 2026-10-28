---
name: Quality and test expectations
description: Project-level expectations for automated coverage and regression alerts.
---

For this project, the user expects broad code coverage and unit tests so regressions are caught and signaled promptly by automation.

**Why:** the user explicitly said that broad coverage, unit tests, and immediate alerts are needed to prevent repeat regressions.

**How to apply:** add focused regression or scenario tests with each fix or feature, ensure the relevant CI job runs them on the active branch, and make failures visible rather than silently ignored. The coverage gate is blocking in CI since Oct 2026.

**Coverage ratchet rule:** thresholds in vitest.config.ts sit about one point below the last full measured run. Raise them after adding tests; never lower them to get CI green — add tests instead.
**Why:** the user wanted coverage failures visible as CI failures without the pipeline staying permanently red; a one-point margin absorbs run-to-run noise.
**How to apply:** after a meaningful batch of tests, run `./node_modules/.bin/vitest run --coverage --coverage.reporter=json --coverage.reporter=text-summary` (~90 s) and bump the thresholds. Coverage only counts what the suite imports, so a single-file coverage run always fails the global thresholds — that is expected.

**Testing paths the shared test app hides:** the shared test app marks every request as test traffic, which skips all voter/creator emails. To test real email decisions, mount the router on a bare express app (no test-mode flag) and mock only the email sender. Admin test-run tests must mock the PDF report renderer (it launches Chromium) and `child_process.spawn` (no nested Vitest runs).
**Why:** these paths were untested for a long time because the default test setup never reaches them; real PDF rendering hangs or fails in CI.
