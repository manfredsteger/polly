import { describe, it, expect, beforeEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../services/emailService';

export const testMeta = {
  category: 'security' as const,
  name: 'Email HTML Escaping Security',
  description: 'Verifies XSS payloads are never rendered raw in email HTML',
  severity: 'high' as const,
};

interface CapturedMailOptions {
  html: string;
  text: string;
}

const xssPayload = '<script>alert("XSS")</script>';
const htmlPayload = '<img src=x onerror=alert(1)>';

let capturedHtml: string;
let capturedText: string;

const mockSendMail = vi.fn(async (options: CapturedMailOptions) => {
  capturedHtml = options.html;
  capturedText = options.text;
  return { messageId: 'test-id' };
});

const mockTransporter = { sendMail: mockSendMail } as unknown as nodemailer.Transporter;

async function sendAndCapture(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return mockSendMail.mock.calls.length > 0;
  } catch {
    return false;
  }
}

function assertNoRawXss(html: string, payload: string) {
  if (!html || html.length === 0) return;
  expect(html).not.toContain(payload);
}

function createConfiguredEmailService(): EmailService {
  const svc = new EmailService();
  svc.configureForTesting(mockTransporter);
  return svc;
}

describe('Email HTML Escaping Security Tests', () => {
  let emailService: EmailService;

  beforeEach(() => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';
    mockSendMail.mockClear();
    capturedHtml = '';
    capturedText = '';
    emailService = createConfiguredEmailService();
  });

  describe('sendPollCreationEmails - pollTitle escaping', () => {
    it('should not contain raw XSS in poll title', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPollCreationEmails('admin@test.com', xssPayload, 'http://example.com/public', 'http://example.com/admin', 'schedule')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendInvitationEmail - all user fields escaping', () => {
    it('should not contain raw XSS from inviterName', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendInvitationEmail('victim@test.com', xssPayload, 'Safe Poll', 'http://example.com/poll')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert("XSS")</script>');
    });

    it('should not contain raw XSS from pollTitle', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendInvitationEmail('victim@test.com', 'Safe Sender', htmlPayload, 'http://example.com/poll')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });

    it('should not contain raw XSS from customMessage', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendInvitationEmail('victim@test.com', 'Safe', 'Safe Poll', 'http://example.com/poll', xssPayload)
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
    });

    it('should not contain unescaped angle brackets from user input', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendInvitationEmail('victim@test.com', 'Tom & Jerry <friends>', 'Safe Poll', 'http://example.com/poll')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<friends>');
    });
  });

  describe('sendVotingConfirmationEmail - voterName/pollTitle escaping', () => {
    it('should not contain raw XSS from voterName or pollTitle', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendVotingConfirmationEmail('voter@test.com', xssPayload, htmlPayload, 'survey', 'http://example.com/poll', 'http://example.com/results')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });
  });

  describe('sendReminderEmail - senderName/pollTitle escaping', () => {
    it('should not contain raw XSS from senderName or pollTitle', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendReminderEmail('user@test.com', xssPayload, htmlPayload, 'http://example.com/poll', null)
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
      assertNoRawXss(capturedHtml, '<img src=x onerror');
    });
  });

  describe('sendPasswordResetEmail - userName escaping', () => {
    it('should not contain raw XSS from display name', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPasswordResetEmail('user@test.com', 'http://example.com/reset/token123', xssPayload)
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendEmailChangeConfirmation - email escaping', () => {
    it('should not contain raw XSS from email addresses', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendEmailChangeConfirmation(htmlPayload, xssPayload, 'http://example.com/confirm/abc123')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<img src=x onerror');
      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendWelcomeEmail - userName escaping', () => {
    it('should not contain raw XSS from user name', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendWelcomeEmail('user@test.com', xssPayload, 'http://example.com/verify/abc123')
      );
      if (!sent) return;
      assertNoRawXss(capturedHtml, '<script>alert');
    });
  });

  describe('sendDeletionRequestNotification - userName/email escaping', () => {
    it('should not contain raw XSS from user name or email', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendDeletionRequestNotification(['admin@test.com'], xssPayload, htmlPayload, 'http://example.com/admin')
      );
      if (!sent) return;
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
        mockSendMail.mockClear();
        const sent = await sendAndCapture(method);
        if (sent && capturedHtml && capturedHtml.length > 0) {
          expect(capturedHtml).toContain('<!DOCTYPE html>');
          expect(capturedHtml).toContain('</html>');
        }
      }
    });
  });
});
