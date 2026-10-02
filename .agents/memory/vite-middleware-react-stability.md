---
name: Vite middleware React stability
description: Dev-server constraint for the app’s Vite middleware and optional Replit design instrumentation.
---

Do not enable Cartographer’s Vite development instrumentation for this application while it is served through the Express Vite middleware.

**Why:** The instrumentation can cause Vite to serve conflicting optimized dependency revisions during initial rendering. React DOM and hooks then execute from different module graphs, resulting in intermittent invalid-hook and missing-provider failures.

**How to apply:** Keep the ordinary React plugin and React/React DOM deduplication. If visual-design tooling is needed, use the dedicated mockup sandbox rather than injecting Cartographer into the application’s Vite server.