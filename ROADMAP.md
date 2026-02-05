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

## 🧪 Beta Phase (Q1-Q2 2025)

The beta phase focuses on enterprise readiness, AI integration, and community feedback.

### Core Goals

#### 1. Single Sign-On (SSO) with Keycloak OIDC
- [ ] Full Keycloak OIDC integration testing
- [ ] Automatic role mapping (User, Admin, Manager)
- [ ] Session synchronization with identity provider
- [ ] Documentation for enterprise SSO setup

#### 2. AI-Powered Voice Control (GWDG Kiski Integration)
- [ ] Integration with [GWDG Kiski](https://gwdg.de) AI services
- [ ] **Free Tier included** for all Polly installations
- [ ] Voice-controlled poll creation with speech-to-text
- [ ] AI agent-guided form completion (no manual input required)
- [ ] Natural language commands: "Erstelle eine Terminumfrage für nächste Woche"
- [ ] OpenAI-compatible provider support for custom deployments

> **Partner:** GWDG (Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen) is the primary AI integration partner, providing free AI capabilities to all Polly users.

#### 3. Community & Stability
- [ ] Community feedback collection and issue tracking
- [ ] Bug fixes and stability improvements
- [ ] Performance optimization for large-scale deployments
- [ ] Extended documentation for self-hosting

#### 4. Additional Integrations
- [ ] Additional language packs (community contributions welcome)
- [ ] Webhook support for external automation
- [ ] Enhanced calendar integrations

---

## 🎯 Version 1.0 (Target: H2 2025)

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
- [ ] API rate limiting (admin-configurable)
- [ ] Audit logging for compliance
- [ ] Backup and restore utilities

#### Mobile & Integrations
- [ ] Mobile app (React Native or Flutter)
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

| Phase | Target | Focus |
|-------|--------|-------|
| **Alpha** | 2024 - Q1 2025 | Core functionality, foundation |
| **Beta 0.1.0** | Q1-Q2 2025 | SSO, AI integration, stability |
| **Version 1.0** | H2 2025 | European DC support, enterprise features |

---

*Last updated: February 2025*
