# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please report security vulnerabilities to:** polly@kita.bayern

**Do NOT open public issues for security vulnerabilities.**

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Initial response | 48 hours |
| Status update | 5 business days |
| Resolution target | 30 days (critical), 90 days (non-critical) |

## Security Features

Polly implements the following security measures:

- **Session-based authentication** with PostgreSQL-backed session store
- **Bcrypt password hashing** with salt rounds
- **CSRF protection** via SameSite=Lax cookies
- **Rate limiting** on login, registration, and API endpoints
- **Server-side validation** with Zod schemas
- **HTTP-only secure session cookies**
- **Role-based access control** (User, Admin, Manager)

## Security Best Practices for Self-Hosting

1. **Change default admin credentials** immediately after installation
2. **Use HTTPS** in production (configure reverse proxy with TLS)
3. **Keep dependencies updated** regularly
4. **Restrict database access** to application server only
5. **Configure firewall rules** appropriately
6. **Enable audit logging** for compliance requirements

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with permission) in our release notes.
