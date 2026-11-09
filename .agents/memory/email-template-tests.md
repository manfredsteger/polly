---
name: Email template test isolation
description: How to test email template rendering without touching the shared test DB, and placeholder behavior to expect.
---

Email template/theme/footer tests should use the in-memory storage fixture (`server/tests/fixtures/inMemoryEmailStorage.ts`) instead of saving to the shared test DB and restoring afterwards. It spies on the storage methods and, after the file, asserts the real DB email state is unchanged.
**Why:** older email tests that wrote real templates/themes needed crash-recovery backup keys, and a killed run could leave a corrupted theme for later runs.
**How to apply:** new email-rendering tests: call the fixture at describe level, `memory.reset()` in beforeEach, use `storeTemplate()` for custom templates.

Rendering behavior worth knowing when asserting "no placeholders": unfilled variables stay as `{{key}}` in subject, plain text and the HTML `<title>` (which mirrors the subject); the V3 HTML body itself always falls back (links `#`, default poll type, name-less greeting). Raw sample data for poll_finalized lacks `videoConferenceHtml`; the admin preview routes pass it as ''.
