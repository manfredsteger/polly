---
name: Immutable release tags and gated artifacts
description: Public tags are immutable and the release workflow gates Docker and release publication on validation.
---

Treat a pushed release tag as permanent, even when its workflow fails; repair the branch and use the next prerelease identifier rather than moving or overwriting the tag.

**Why:** A failed public tag remains visible to users, while the release workflow intentionally prevents Docker and GitHub artifacts from being created until validation succeeds.

**How to apply:** Verify the full validation locally before tagging, then monitor the tag workflow through Docker publication, README sync, GitHub release, and any mirror jobs.