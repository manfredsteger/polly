# Polly Roadmap

This document outlines the development journey and future direction of Polly.

---

## 🚀 Alpha Phase (2024 - Q1 2025)

The initial development phase focused on building a solid foundation for a self-hosted polling platform.

### Completed
- [x] Three poll types: Schedule (Terminumfrage), Survey (Umfrage), Organization (Orga-Liste)
- [x] Real-time voting with WebSocket support and fullscreen presentation mode
- [x] Multi-language support (German/English) with automatic detection
- [x] Email notifications with customizable templates
- [x] Export functionality: CSV, PDF, QR codes, ICS calendar
- [x] Matrix results view with color-coded responses
- [x] Dark mode with admin-configurable defaults
- [x] Admin dashboard with branding customization
- [x] Docker zero-config deployment
- [x] PostgreSQL with Drizzle ORM
- [x] Comprehensive test suite (200+ tests)
- [x] CI/CD pipelines (GitHub Actions, GitLab CI)
- [x] WCAG 2.1 AA accessibility compliance

---

## 🧪 Beta Phase (Q1 2025 – Q2 2026)

The beta phase focuses on enterprise readiness, AI integration, and community feedback.

### Core Goals

#### 1. Single Sign-On (SSO) with Keycloak OIDC
- [x] Keycloak OIDC integration (basic)
- [x] Automatic role mapping (User, Admin, Manager)
- [ ] Full Keycloak end-to-end integration testing
- [ ] Session synchronization with identity provider
- [ ] Documentation for enterprise SSO setup

#### 2. AI-Powered Poll Creation & Voice Control (GWDG KISSKI Integration) ✅ *Released in beta.2*
- [x] Integration with [GWDG KISSKI](https://kisski.gwdg.de) AI services
- [x] **Free Tier included** for all Polly installations
- [x] Voice-controlled poll creation with speech-to-text (GWDG Whisper API)
- [x] AI agent-guided form completion (no manual input required)
- [x] Natural language commands: "Erstelle eine Terminumfrage für nächste Woche"
- [x] Drag-and-drop reordering of AI-suggested slots
- [x] Follow-up refinement via chat ("Füge noch Montag Abend hinzu")
- [x] AI rate limiting (configurable guest/user limits via admin panel)
- [x] OpenAI-compatible provider support for custom deployments

#### 3. Schedule Poll Enhancements ✅ *Released in beta.2*
- [x] Video conference URL field (optional, shown in emails and ICS)
- [x] Chronological date sorting in finalization view
- [x] Finalize button visible on best-voted option
- [x] Labeled voting links in calendar event descriptions
- [x] CANCELLED events removed from ICS exports

#### 4. Notification Improvements ✅ *Released in beta.2*
- [x] End Poll notifications for all poll types (not just Schedule)
- [x] Survey finalization email shows winning option text
- [x] Organization poll "End Poll" email shows slot summary
- [x] Creator always included in finalization email recipients
- [x] Frontend "End Poll" notify toggle wired to backend

#### 5. Community & Stability
- [ ] Community feedback collection and issue tracking
- [ ] Performance optimization for large-scale deployments
- [ ] Extended documentation for self-hosting

#### 6. Additional Integrations
- [ ] Additional language packs (community contributions welcome)
- [ ] Webhook support for external automation
- [ ] Enhanced calendar integrations

---

## 🎯 Version 1.0 (Target: H2 2026)

The 1.0 release will focus on meeting the needs of European data centers and simplifying enterprise deployment.

### Planned Features

#### European Data Center Focus
- [ ] Optimized deployment guides for European cloud providers
- [ ] GDPR-compliant data handling documentation
- [ ] Helm charts for Kubernetes deployment
- [ ] One-click deployment templates for common platforms
- [ ] Multi-tenancy support for SaaS scenarios

#### Enterprise Features
- [ ] Advanced analytics dashboard
- [ ] Audit logging for compliance
- [ ] Backup and restore utilities

#### Mobile & Integrations
- [ ] Mobile app (React Native or Flutter) — see `docs/FLUTTER_INTEGRATION.md`
- [ ] 🚧 **Matrix / Element Chatbot** *(Coming Soon)* - Create and manage polls via Matrix messenger
  - [ ] Bot account for self-hosted Matrix/Synapse servers
  - [ ] Poll creation via chat commands (e.g. `!poll create Terminumfrage ...`)
  - [ ] Vote notifications and reminders in Matrix rooms
  - [ ] Results summary posted back to the channel
- [ ] Slack integration
- [ ] Microsoft Teams integration
- [ ] Webhook-based automation

---

## 🔮 Future Considerations

Based on community feedback, these features may be considered for future releases:

- Advanced scheduling algorithms with conflict detection
- AI-powered meeting time suggestions based on participant availability
- Direct export to Google Calendar / Outlook
- Plugin/extension system for custom poll types
- Self-service tenant management for SaaS deployments
- End-to-end encryption for sensitive polls

---

## 🤝 Contributing to the Roadmap

We welcome community input! If you have feature requests or suggestions:

1. Open a [GitHub Issue](https://github.com/manfredsteger/polly/issues) with the "feature request" label
2. Join the discussion on existing roadmap items
3. Submit pull requests for community-driven features

---

## 📅 Release Timeline

| Phase | Released | Focus |
|-------|----------|-------|
| **Alpha** | 2024 – Q1 2025 | Core functionality, foundation |
| **Beta 0.1.0-beta.1** | 2025-02-24 | Initial public beta — all poll types, auth, Docker |
| **Beta 0.1.0-beta.2** | 2026-04-10 | AI integration, schedule improvements, notification fixes |
| **Version 1.0** | Target: H2 2026 | European DC support, enterprise features |

---

*Last updated: April 2026*
