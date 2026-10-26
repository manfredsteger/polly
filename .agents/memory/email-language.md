---
name: Email language resolution
description: How Polly picks German vs English per email recipient, and the compatibility constraints around it.
---
Recipient language order: account languagePreference → requester UI language (X-Polly-Language header, only for mails addressed to the requester; Accept-Language deliberately ignored) → admin default email language → de.

**Why:** the user wants registered users to get their own language, admins to control the default, and German installations to see zero change. Accept-Language was rejected because a German browser using the English UI should still get English mail.

**How to apply:**
- German output must stay byte-identical to the pre-i18n version; any new German string change is a regression unless intended.
- Pre-existing template customizations are German; a missing custom template falls back to the built-in default of the same language, never to the other language's customization.
- Mails to third parties (organizer notices, bulk sends) must not use the requester's hint; resolve per recipient and render once per language group.
- User-written content (poll titles, messages) is never translated.
