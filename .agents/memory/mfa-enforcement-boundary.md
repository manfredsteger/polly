---
name: MFA enforcement boundary
description: Product-security rule for the relationship between enrolled MFA, admin setup policy, and recovery.
---

An account that has enrolled app TOTP must complete it after every browser primary login, regardless of whether the admin-wide MFA setup policy is enabled. This applies consistently to local-password and browser SSO primary authentication.

**Why:** The setup policy answers whether an *unenrolled* administrator must configure MFA. Treating a disabled setup policy as permission to skip an already-enrolled factor silently downgrades the account to password-only authentication.

**How to apply:** Keep the emergency `MFA_ADMIN_REQUIRED=false` break-glass path narrowly limited to enrolled administrators who need recovery. It must not bypass MFA for ordinary users. Treat non-browser bearer-token assurance as an identity-provider concern unless a separate app-issued, post-MFA API credential flow is deliberately designed.