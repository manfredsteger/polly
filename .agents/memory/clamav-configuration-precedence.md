---
name: ClamAV configuration precedence
description: Runtime, persisted scanner configuration, and fail-secure behavior for upload scanning.
---

An explicit non-empty ClamAV environment value overrides the corresponding persisted Admin scanner setting at runtime. Leave environment values unset when the Admin panel should control scanner configuration.

**Why:** A stale persisted enabled scanner setting can otherwise keep uploads blocked after an operator deliberately sets runtime scanning off. Conversely, an unavailable configuration must never turn an intended scanner off silently.

**How to apply:** Treat explicit `CLAMAV_ENABLED=false` as a deliberate no-scan choice. When scanning is enabled or its Admin-managed state cannot be determined, preserve the last known configuration when possible and block uploads fail-secure until the configuration/scanner is available.