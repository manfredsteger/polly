---
name: React component render tests
description: Why client render tests stay *.test.ts and use real locale files.
---

Client render tests in the main vitest suite stay `*.test.ts` (using `createElement`, not JSX) and load the real locale JSON instead of mocking `t`.

**Why:** the in-app admin test runner only discovers `*.test.ts`; a `t` mock would hide missing or swapped translations, which is what these tests exist to catch.

**How to apply:** any new UI render test goes under server/tests with a per-file jsdom environment docblock; jsdom in the shared single fork did not disturb node-environment tests.
