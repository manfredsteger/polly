---
name: Email language resolution
description: How Polly picks German vs English per email recipient, and the product decisions/compatibility constraints around it.
---
Recipient language order: account languagePreference → requester UI language (X-Polly-Language header, only for mails addressed to the requester; Accept-Language deliberately ignored) → guest's last remembered UI language (stored when creating a poll / voting) → site default language (Admin → Customize → Language).

**Why:** the user (2026-10) rejected a separate admin "email default language": there must be ONE site default (they set it to English, the main language), and every person gets the language they chose. Accept-Language was rejected because a German browser using the English UI should still get English mail.

**How to apply:**
- Never add a second, email-specific default language setting.
- New accounts (registration, SSO, admin-created) start with their creation UI language, else the site default — not the users column's historic 'de' default. Existing accounts are not migrated.
- German output must stay byte-identical to the pre-i18n version; any new German string change is a regression unless intended.
- Pre-existing template customizations are German; a missing custom template falls back to the built-in default of the same language, never to the other language's customization.
- Mails to third parties (organizer notices, bulk sends) must not use the requester's hint; resolve per recipient and render once per language group.
- User-written content (poll titles, messages) is never translated.
- Every mail must be correct in every language; the user wants this enforced by tests (completeness + no foreign-language remnants).
- The admin template UI must not show server-side German texts (template names, variable descriptions); it translates per template type / variable key on the client. A tester once found a card stuck in German because a new type lacked a label — new template types or variables need UI translations in every locale (a test enforces it).
