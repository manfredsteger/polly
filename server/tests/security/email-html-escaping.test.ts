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

function assertNoRawXss(html: string, payload: string) {
  expect(html).toBeDefined();
  expect(html.length).toBeGreaterThan(0);
  expect(html).not.toContain(payload);
}

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
    it('should not contain raw XSS in poll title', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com',
        xssPayload,
        'http://example.com/public',
        'http://example.com/admin',
        'schedule'
      );

      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendInvitationEmail - all user fields escaping', () => {
    it('should not contain raw XSS from inviterName', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        xssPayload,
        'Safe Poll',
        'http://example.com/poll',
      );

      assertNoRawXss(capturedHtml, '<script>alert("XSS")</script>');
    });

    it('should not contain raw XSS from pollTitle', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        'Safe Sender',
        htmlPayload,
        'http://example.com/poll',
      );

      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });

    it('should not contain raw XSS from customMessage', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        'Safe Sender',
        'Safe Poll',
        'http://example.com/poll',
        xssPayload,
      );

      assertNoRawXss(capturedHtml, '<script>alert("XSS")</script>');
    });

    it('should not contain unescaped angle brackets from user input', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com',
        ampPayload,
        'Safe Poll',
        'http://example.com/poll',
      );

      assertNoRawXss(capturedHtml, 'Tom & Jerry <friends>');
    });
  });

  describe('sendVotingConfirmationEmail - voterName/pollTitle escaping', () => {
    it('should not contain raw XSS from voterName or pollTitle', async () => {
      await emailService.sendVotingConfirmationEmail(
        'voter@test.com',
        xssPayload,
        htmlPayload,
        'survey',
        'http://example.com/public',
        'http://example.com/results',
      );

      assertNoRawXss(capturedHtml, '<script>');
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });
  });

  describe('sendReminderEmail - senderName/pollTitle escaping', () => {
    it('should not contain raw XSS from senderName or pollTitle', async () => {
      await emailService.sendReminderEmail(
        'recipient@test.com',
        xssPayload,
        htmlPayload,
        'http://example.com/poll',
        null
      );

      assertNoRawXss(capturedHtml, '<script>');
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });
  });

  describe('sendPasswordResetEmail - userName escaping', () => {
    it('should not contain raw XSS from display name', async () => {
      await emailService.sendPasswordResetEmail(
        'user@test.com',
        'http://example.com/reset/abc123',
        xssPayload
      );

      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendEmailChangeConfirmation - email escaping', () => {
    it('should not contain raw XSS from email addresses', async () => {
      await emailService.sendEmailChangeConfirmation(
        htmlPayload,
        xssPayload,
        'http://example.com/confirm/abc123'
      );

      assertNoRawXss(capturedHtml, '<img src=x onerror');
      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendWelcomeEmail - userName escaping', () => {
    it('should not contain raw XSS from user name', async () => {
      await emailService.sendWelcomeEmail(
        'user@test.com',
        xssPayload,
        'http://example.com/verify/abc123'
      );

      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendDeletionRequestNotification - userName/email escaping', () => {
    it('should not contain raw XSS from user name or email', async () => {
      await emailService.sendDeletionRequestNotification(
        ['admin@test.com'],
        xssPayload,
        htmlPayload,
        'http://example.com/admin'
      );

      assertNoRawXss(capturedHtml, '<script>alert');
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });
  });

  describe('All template-based emails use proper structure', () => {
    it('should have DOCTYPE declaration in all template-rendered emails', async () => {
      const templateMethods: Array<() => Promise<void>> = [
        () => emailService.sendPollCreationEmails('a@b.com', 'T', 'https://e.com/p', 'https://e.com/a', 'schedule'),
        () => emailService.sendVotingConfirmationEmail('a@b.com', 'N', 'T', 'survey', 'https://e.com/p', 'https://e.com/r'),
        () => emailService.sendPasswordResetEmail('a@b.com', 'https://e.com/r'),
        () => emailService.sendEmailChangeConfirmation('a@b.com', 'b@c.com', 'https://e.com/c'),
        () => emailService.sendPasswordChangedEmail('a@b.com'),
        () => emailService.sendWelcomeEmail('a@b.com', 'N', 'https://e.com/v'),
      ];

      for (const method of templateMethods) {
        await method();
        expect(capturedHtml).toContain('<!DOCTYPE html>');
        expect(capturedHtml).toContain('</html>');
      }
    });
  });
});
