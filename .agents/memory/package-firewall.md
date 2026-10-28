---
name: Dependency installation security boundary
description: Fresh checkouts may be unable to install the existing dependency baseline.
---

An existing lockfile is not evidence that its dependencies remain permitted by the package firewall. Do not bypass the firewall to make validation pass.

**Why:** A fresh checkout could not install the project's dependency baseline because the firewall rejected proxy-addr for a critical CVE; trying a newer Express 4 release did not remove the block.

**How to apply:** If installation is rejected, report validation as blocked, preserve the security boundary, and treat dependency remediation as separate work rather than silently making a major framework upgrade during a narrow bugfix.
