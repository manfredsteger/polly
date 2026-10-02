---
name: SAST false positives (analyzed)
description: Recurring SAST findings that were manually verified as false positives — skip re-analysis
---

## Verified false positives (July 2026 audit)

- **Path traversal HIGH in `server/services/imageService.ts`**: file writes use server-generated names (`poll-image-${uniqueSuffix}`), deletes use `path.basename()` on the URL — no user-controlled path segments reach the filesystem.
- **Path traversal HIGH in `server/services/whisperService.ts`**: temp file extensions come from `getExtensionFromMimeType()`, a hardcoded whitelist map (webm/mp3/wav/ogg/flac/m4a/mp4); unknown MIME types get a fixed default. Filenames are timestamp-based. The ffmpeg shell command only interpolates these safe paths.
- **Weak crypto (SHA-1) in `server/lib/totpService.ts`**: TOTP per RFC 6238 mandates HMAC-SHA1 — standard-compliant, not a weakness.
- **Session fixation in `server/routes/system.ts`**: only a `theme_preference` cookie read/write, no session material.
- **Hardcoded postgres strings in `.gitlab-ci.yml` / `docker-compose.yml` / `docker-entrypoint.sh`**: CI/dev-container defaults, documented in SELF-HOSTING guide; not production secrets.

**How to apply:** When a security scanner re-flags these locations with the same rule, verify the code hasn't changed materially (quick grep), then classify as known false positive instead of re-auditing from scratch.
