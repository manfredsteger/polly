---
name: PDF render hardening
description: Rules for the server-side Chromium PDF templates and how to test that page scripts/network are blocked.
---
Every dynamic value in a PDF template must be HTML-escaped; URLs must be http(s), images inline data: (or the one allow-listed https logo). The render page has JavaScript disabled and aborts all non-data: requests. Chromium's sandbox is disabled by default for Docker compatibility, but self-hosters can opt in when host user namespaces and container seccomp settings support it.

**Why:** Chromium renders the template on the server; unescaped poll titles/options/names allowed script and SSRF-style resource loads from public PDF exports (reported vulnerability, fixed Nov 2026).

For Docker, keep the sandbox opt-in and retain Docker's default syscall allowlist. A custom seccomp profile must preserve ordinary `clone` calls and narrowly permit Chromium's user, PID, and network namespace creation plus its user-namespace probe; allowlisting only `CLONE_NEWUSER` is not enough for PDF rendering.

**Why:** Chromium launches its sandbox helper in user/PID/network namespaces and probes user-namespace creation with `unshare`; Docker's default profile blocks those operations unless specifically allowed.

**How to apply:** When Docker's default seccomp profile changes, rebase the custom profile on the new upstream default and re-run a real headless PDF export with the sandbox enabled. Never replace Docker's syscall filtering with `seccomp:unconfined` as the production fix.

**How to apply:**
- New template fields: escape them; new external resources must be inlined or explicitly allow-listed, never just referenced.
- Uploaded logos (`/uploads/...`) never loaded under `about:blank` anyway — they must be inlined from disk.
- Test oracle: the PDF `/Title (...)` metadata reflects `document.title`, so a script setting `document.title` shows whether scripts ran (verified it flips to the script value when JS is enabled). Use a local HTTP server and count hits to prove network blocking.
- Keep the default Docker setup functional; changes to Chromium sandbox configuration must remain opt-in and document the required host/container permissions.
- This Replit environment's nested Docker runtime denies Chromium namespace creation even with Debian's setuid sandbox helper. Run the opt-in sandbox PDF smoke test only in a dedicated Linux runner/container that explicitly supports user namespaces; do not treat local nested-Docker failure as a PDF regression.
- Known gap (Nov 2026): the participant table clips columns horizontally once a poll has many options (~16+ fit on A4); vertical pagination of rows is fine.
## Asserting PDF text content
Tests read the rendered PDF's text layer with pdfjs-dist (legacy build) via a test fixture helper. Quirks of Chromium-rendered text:
- Ligatures split words ("Öffentlich" extracts as "Ö ff entlich") — pick assertion strings without ff/fi/fl.
- CSS `text-transform: uppercase` labels extract uppercased; vote labels with `text-shadow` extract several times, so count occurrences only for option/title text, not vote labels.
- For position/order checks use the per-item extractor: each wrapped line or table cell is its own item, so assert on short single-token labels (narrow participant-table columns wrap names). Opacity elements are drawn at the end of their page, out of DOM order.
## Simulating "no Chromium" locally
Chromium is reachable both via its nix store bin dir and a `/repl/tools/bin/chromium` wrapper. To check that PDF tests skip cleanly, strip both from PATH (and leave PUPPETEER_EXECUTABLE_PATH empty); removing only the nix dir still finds Chromium.
