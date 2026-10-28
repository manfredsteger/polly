---
name: Quality and test expectations
description: Project-level expectations for automated coverage and regression alerts.
---

For this project, the user expects broad code coverage and unit tests so regressions are caught and signaled promptly by automation.

**Why:** the user explicitly said that broad coverage, unit tests, and immediate alerts are needed to prevent repeat regressions.

**How to apply:** add focused regression or scenario tests with each fix or feature, ensure the relevant CI job runs them on the active branch, and make failures visible rather than silently ignored. Do not make a project-wide coverage threshold blocking until the measured baseline supports it.
