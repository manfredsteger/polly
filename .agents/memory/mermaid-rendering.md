---
name: Mermaid diagram rendering in docs
description: How email-flow (and similar) Mermaid diagrams are turned into committed PNGs, plus a Mermaid 11 parsing gotcha.
---

# Mermaid diagram rendering in docs

## Decision
`docs/email-flows.md` embeds each diagram as a committed PNG (`docs/assets/email-flows/NN-slug.png`) AND keeps the Mermaid source in a collapsible `<details>` block as the editable source of truth. Regenerate with `node scripts/render-mermaid.mjs`.

**Why:** The Replit Markdown preview and simple Markdown viewers only show the raw ```mermaid code, not a rendered diagram. Static images make diagrams visible everywhere (Replit preview + GitHub) without an external viewer.

**How to apply:** The render script reuses Puppeteer + the system Chromium (same path-resolution as `server/services/pdfService.ts`, no Chromium re-download) and the local `mermaid` npm dependency (UMD build at `node_modules/mermaid/dist/mermaid.min.js`). It derives image filenames from the nearest preceding heading (slugified). If you rename/add a section heading, re-run the script AND update the `![...](...)` link(s) — the script does not rewrite the Markdown embeds or delete stale images.

## Mermaid 11 parsing gotcha
A stray **ASCII straight double-quote** (`"`, 0x22) inside an **unquoted** node label (e.g. a stadium `([...])` or rectangle `[...]`) makes Mermaid 11 emit a `STR` token and fail with a parse error. German typographic quotes were the trap here: an opening `„` (U+201E) paired with a straight `"` instead of the closing `“` (U+201C).

**Fix:** use matching typographic quotes (`„…“`), or wrap the whole label in straight double-quotes (`["…"]`). The `[/"…"/]` parallelogram form is already proper quoting and is fine.

**Why it matters:** GitHub's native Mermaid renderer hits the same error, so this is a latent rendering bug, not just a local-script issue.
