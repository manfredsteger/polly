import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EmailService } from '../../services/emailService';

const xssPayload = '<script>alert("XSS")</script>';
const htmlPayload = '<img src=x onerror=alert(1)>';
const ampPayload = 'Tom & Jerry <friends>';

let capturedHtml: string;
let capturedText: string;

const mockTransporter = {
  sendMail: vi.fn(async (options: any) => {
    capturedHtml = options.html;
    capturedText = options.text;
    return { messageId: 'test-id' };
  }),
};

describe('Email HTML Escaping Security Tests', () => {
  let emailService: EmailService;

  beforeAll(() => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';

    emailService = new EmailService();
    (emailService as any).isConfigured = true;
    (emailService as any).transporter = mockTransporter;
  });

  describe('sendPollCreationEmails - pollTitle escaping', () => {
    it('should escape HTML in poll title', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com',
        xssPayload,
        'http://example.com/public',
        'http://example.com/admin',
        'schedule'
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('sendInvitationEmail - all user fields escaping', () => {
    it('should escape HTML in inviterName', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        xssPayload,
        'Safe Poll',
        'http://example.com/poll',
      );

      expect(capturedHtml).not.toContain('<script>alert("XSS")</script>');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });

    it('should escape HTML in pollTitle', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        'Safe Sender',
        htmlPayload,
        'http://example.com/poll',
      );

      expect(capturedHtml).not.toContain('<img src=x');
      expect(capturedHtml).toContain('&lt;img src=x');
    });

    it('should escape HTML in customMessage', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        'Safe Sender',
        'Safe Poll',
        'http://example.com/poll',
        xssPayload,
      );

      expect(capturedHtml).not.toContain('<script>alert("XSS")</script>');
      const customMessageSection = capturedHtml.match(/font-style: italic.*?"(.*?)"/s);
      expect(capturedHtml).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands and angle brackets', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        ampPayload,
        'Safe Poll',
        'http://example.com/poll',
      );

      expect(capturedHtml).toContain('Tom &amp; Jerry &lt;friends&gt;');
      expect(capturedHtml).not.toContain('Tom & Jerry <friends>');
    });
  });

  describe('sendVotingConfirmationEmail - voterName/pollTitle escaping', () => {
    it('should escape HTML in voterName and pollTitle', async () => {
      await emailService.sendVotingConfirmationEmail(
        'voter@test.com',
        xssPayload,
        htmlPayload,
        'http://example.com/public',
        'http://example.com/results',
        'survey'
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).not.toContain('<img src=x');
      expect(capturedHtml).toContain('&lt;script&gt;');
      expect(capturedHtml).toContain('&lt;img src=x');
    });
  });

  describe('sendReminderEmail - senderName/pollTitle escaping', () => {
    it('should escape HTML in senderName and pollTitle', async () => {
      await emailService.sendReminderEmail(
        'recipient@test.com',
        xssPayload,
        htmlPayload,
        'http://example.com/poll',
        null
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).not.toContain('<img src=x');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('sendPasswordResetEmail - userName escaping', () => {
    it('should escape HTML in display name', async () => {
      await emailService.sendPasswordResetEmail(
        'user@test.com',
        'http://example.com/reset/abc123',
        xssPayload
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('sendEmailChangeConfirmation - email escaping', () => {
    it('should escape HTML in old and new email addresses', async () => {
      await emailService.sendEmailChangeConfirmation(
        htmlPayload,
        xssPayload,
        'http://example.com/confirm/abc123'
      );

      expect(capturedHtml).not.toContain('<img src=x');
      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).toContain('&lt;img src=x');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('sendWelcomeEmail - userName escaping', () => {
    it('should escape HTML in user name', async () => {
      await emailService.sendWelcomeEmail(
        'user@test.com',
        xssPayload,
        'http://example.com/verify/abc123'
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('sendDeletionRequestNotification - userName/email escaping', () => {
    it('should escape HTML in user name and email', async () => {
      await emailService.sendDeletionRequestNotification(
        ['admin@test.com'],
        xssPayload,
        htmlPayload,
        'http://example.com/admin'
      );

      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).not.toContain('<img src=x');
      expect(capturedHtml).toContain('&lt;script&gt;');
      expect(capturedHtml).toContain('&lt;img src=x');
    });
  });
});
