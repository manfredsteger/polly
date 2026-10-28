---
name: npm lockfile registry URLs
description: npm installs in this workspace write an internal mirror host into package-lock.json, which breaks GitHub CI.
---

After adding npm packages here, check package-lock.json for `package-firewall.replit.internal` in `resolved` URLs and rewrite them to `https://registry.npmjs.org/`.

**Why:** GitHub Actions runs `npm ci` and cannot reach the internal mirror; a completion review rejected a change for this.

**How to apply:** after every npm install, grep the lockfile for the internal host before committing; integrity hashes stay valid after the rewrite.

Public lockfile URLs do not bypass Replit's configured package firewall: downloads are still routed through it. When installation is rejected for a vulnerable locked version, check the registry metadata for a compatible patched release before treating the security policy as an external blocker. Inspect all rejected packages in the installation log, not just npm's final error.

**Why:** a clean install exposed blocked versions previously present in node_modules, and a failed restore left the app without its startup dependencies even though compatible patch releases were available; normalizing lockfile URLs alone does not resolve a security-policy block.

**How to apply:** update the affected direct dependency (or its parent) or use a narrowly scoped transitive override, refresh the lockfile through the normal installation path, and verify startup and tests. Do not bypass the security policy, change registries, or leave the app stopped merely because the initial installation failed.
