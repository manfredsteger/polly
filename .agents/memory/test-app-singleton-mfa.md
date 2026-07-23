---
name: Test app singleton + MFA test session setup
description: createTestApp() is a module-level singleton; login BEFORE enabling MFA in storage to avoid TOTP challenge during test session setup
---

## Rule
`createTestApp()` in `server/tests/testApp.ts` is a **module-level singleton** — all `describe` blocks in a test file share the exact same Express app instance and the same in-memory MemoryStore session store.

**Why:** This is intentional for test performance (one app startup per worker). Sessions created in one describe block persist in the shared MemoryStore and are accessible to agents in subsequent describe blocks.

## MFA test pattern: login BEFORE enabling MFA
When a test needs an authenticated admin session AND the admin must have MFA enabled:

1. Call `loginAsAdmin(app)` **first** — while the admin has `totpEnabled = false`
2. **Then** call `storage.updateUser(adminId, { totpSecret, totpEnabled: true })` directly
3. Set policy (`adminMfaRequired = true`) after login

**Why:** If you enable MFA first and then try to log in, the login endpoint returns `{ requiresMfa: true }` with `pendingMfaUserId` in session (not `userId`). The subsequent protected endpoint calls will then fail with 401 because `requireAuth` checks `req.session.userId` not `pendingMfaUserId`.

## How to apply
- Any test that calls `storage.updateUser(id, { totpEnabled: true })` to set up test state must establish the session (login) BEFORE making that storage call.
- Use `loginAsAdmin(app)` for admin-role scenarios; it is reliable because it goes through the normal login endpoint which sets `req.session.userId`.
- After the test, restore MFA state: `storage.updateUser(adminId, { totpSecret: orig, totpEnabled: origEnabled, lastUsedTotpToken: null })`.
- Reference: `server/tests/auth/mfa.test.ts` — "Admin policy blocks self-disable" describe block.
