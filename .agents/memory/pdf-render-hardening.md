---
name: PDF render hardening
description: Rules for the server-side Chromium PDF templates and how to test that page scripts/network are blocked.
---
Every dynamic value in a PDF template must be HTML-escaped; URLs must be http(s), images inline data: (or the one allow-listed https logo). The render page has JavaScript disabled and aborts all non-data: requests.

**Why:** Chromium renders the template on the server; unescaped poll titles/options/names allowed script and SSRF-style resource loads from public PDF exports (reported vulnerability, fixed Nov 2026).

**How to apply:**
- New template fields: escape them; new external resources must be inlined or explicitly allow-listed, never just referenced.
- Uploaded logos (`/uploads/...`) never loaded under `about:blank` anyway — they must be inlined from disk.
- Test oracle: the PDF `/Title (...)` metadata reflects `document.title`, so a script setting `document.title` shows whether scripts ran (verified it flips to the script value when JS is enabled). Use a local HTTP server and count hits to prove network blocking.
- `--no-sandbox` is kept deliberately (Docker non-root + default seccomp); don't remove it without a Docker-compatible alternative.
