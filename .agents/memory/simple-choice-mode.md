---
name: Simple choice response mode
description: Design decisions for polls' responseMode classic/simple (ballot-style single/multiple choice)
---

- `responseMode: 'classic' | 'simple'` on polls applies only to survey/schedule; organization and free-text options must reject simple mode. `maxSelections` (default 1) only meaningful in simple mode.
- **Why:** simple mode is backwards-compatible ballot voting (only 'yes' votes exist); results scoring/emails work unchanged because they count yes votes.
- **How to apply:** all simple-mode write paths (bulk vote and edit-token replacement) must go through `storage.replaceSimpleModeVotes` — a transaction with a per-voter advisory lock that re-reads and re-checks maxSelections. Sequential route-level validation alone is race-prone (code review caught concurrent submits exceeding the limit).
- Client reuses the existing `votes` record with only 'yes' entries in simple mode, so prefill/change-detection/cancel logic works without parallel state.
