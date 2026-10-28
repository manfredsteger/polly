---
name: npm lockfile registry URLs
description: npm installs in this workspace write an internal mirror host into package-lock.json, which breaks GitHub CI.
---

After adding npm packages here, check package-lock.json for `package-firewall.replit.internal` in `resolved` URLs and rewrite them to `https://registry.npmjs.org/`.

**Why:** GitHub Actions runs `npm ci` and cannot reach the internal mirror; a completion review rejected a change for this.

**How to apply:** after every npm install, grep the lockfile for the internal host before committing; integrity hashes stay valid after the rewrite.

Public lockfile URLs do not bypass Replit's configured package firewall: downloads are still routed through it. A security-policy denial requires updating the blocked dependency (and, when needed, its parent or a compatible override), not changing registries.

**Why:** a clean install exposed blocked versions previously present in node_modules; normalizing lockfile URLs alone does not resolve a security-policy block.
