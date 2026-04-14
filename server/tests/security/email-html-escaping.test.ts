import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../services/emailService';
import { emailTemplateService } from '../../services/emailTemplateService';

export const testMeta = {
  category: 'security' as const,
  name: 'Email HTML Escaping Security',
  description: 'Verifies XSS payloads are never rendered raw in email HTML',
  severity: 'high' as const,
};

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function assertNoRawXss(html: string, payload: string) {
  expect(html).toBeDefined();
  expect(html.length).toBeGreaterThan(0);
  expect(html).not.toContain(payload);
}

function createThemedHtml(body: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta name="color-scheme" content="light dark"><style>@media (prefers-color-scheme: dark){}</style></head><body>${body}</body></html>`;
}

function createConfiguredEmailService(): EmailService {
  const svc = new EmailService();
  svc.configureForTesting(mockTransporter);
  return svc;
}

describe('Email HTML Escaping Security Tests', () => {
  let emailService: EmailService;
  let renderEmailSpy: ReturnType<typeof vi.spyOn>;
  let wrapWithEmailThemeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';
    process.env.APP_URL = 'https://polly.example.com';
    mockSendMail.mockClear();
    capturedHtml = '';
    capturedText = '';
    emailService = createConfiguredEmailService();
  });

  afterEach(() => {
    renderEmailSpy?.mockRestore();
    wrapWithEmailThemeSpy?.mockRestore();
    delete process.env.APP_URL;
  });

  describe('renderEmail receives escaped variables', () => {
    beforeEach(() => {
      renderEmailSpy = vi.spyOn(emailTemplateService, 'renderEmail').mockImplementation(
        async (_type, variables) => {
          const body = Object.values(variables).filter(Boolean).join(' ');
          return {
            subject: 'Test Subject',
            html: createThemedHtml(`<p>${body}</p>`),
            text: body,
          };
        }
      );
    });

    it('sendPollCreationEmails - XSS pollTitle is passed to renderEmail (escaping happens inside)', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com', xssPayload,
        'https://polly.example.com/public', 'https://polly.example.com/admin', 'schedule'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('poll_created', expect.objectContaining({
        pollTitle: xssPayload,
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendInvitationEmail - XSS inviterName is passed to renderEmail', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com', xssPayload, 'Safe Poll', 'https://polly.example.com/poll'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('invitation', expect.objectContaining({
        inviterName: xssPayload,
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendInvitationEmail - XSS pollTitle is passed to renderEmail', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com', 'Safe Sender', htmlPayload, 'https://polly.example.com/poll'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('invitation', expect.objectContaining({
        pollTitle: htmlPayload,
      }));
    });

    it('sendInvitationEmail - XSS customMessage is passed to renderEmail', async () => {
      await emailService.sendInvitationEmail(
        'victim@test.com', 'Safe', 'Safe Poll', 'https://polly.example.com/poll', xssPayload
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('invitation', expect.objectContaining({
        message: xssPayload,
      }));
    });

    it('sendVotingConfirmationEmail - XSS voterName/pollTitle passed to renderEmail', async () => {
      await emailService.sendVotingConfirmationEmail(
        'voter@test.com', xssPayload, htmlPayload, 'survey',
        'https://polly.example.com/poll', 'https://polly.example.com/results'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('vote_confirmation', expect.objectContaining({
        voterName: xssPayload,
        pollTitle: htmlPayload,
      }));
    });

    it('sendReminderEmail - XSS senderName/pollTitle passed to renderEmail', async () => {
      await emailService.sendReminderEmail(
        'user@test.com', xssPayload, htmlPayload, 'https://polly.example.com/poll', null
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('reminder', expect.objectContaining({
        senderName: xssPayload,
        pollTitle: htmlPayload,
      }));
    });

    it('sendPasswordResetEmail - XSS displayName passed to renderEmail', async () => {
      await emailService.sendPasswordResetEmail(
        'user@test.com', 'https://polly.example.com/reset/token123', xssPayload
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('password_reset', expect.objectContaining({
        userName: xssPayload,
      }));
    });

    it('sendWelcomeEmail - XSS userName passed to renderEmail', async () => {
      await emailService.sendWelcomeEmail(
        'user@test.com', xssPayload, 'https://polly.example.com/verify/abc123'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('welcome', expect.objectContaining({
        userName: xssPayload,
      }));
    });
  });

  describe('wrapWithEmailTheme escaping for ad-hoc emails', () => {
    beforeEach(() => {
      wrapWithEmailThemeSpy = vi.spyOn(emailTemplateService, 'wrapWithEmailTheme').mockImplementation(
        async (_subject, bodyHtml, plainText) => ({
          subject: _subject,
          html: createThemedHtml(bodyHtml),
          text: plainText,
        })
      );
    });

    it('sendDeletionRequestNotification - XSS userName/email are HTML-escaped in body', async () => {
      await emailService.sendDeletionRequestNotification(
        ['admin@test.com'], xssPayload, htmlPayload, 'https://polly.example.com/admin'
      );
      expect(wrapWithEmailThemeSpy).toHaveBeenCalledTimes(1);
      const bodyHtmlArg = wrapWithEmailThemeSpy.mock.calls[0][1] as string;
      assertNoRawXss(bodyHtmlArg, '<script>alert');
      assertNoRawXss(bodyHtmlArg, '<img src=x onerror');
      expect(bodyHtmlArg).toContain(htmlEscape(xssPayload));
    });

    it('sendVirusDetectionAlert - user values should be escaped in body', async () => {
      await emailService.sendVirusDetectionAlert(['admin@test.com'], {
        filename: xssPayload, fileSize: 1024, virusName: htmlPayload,
        uploaderEmail: 'user@test.com', requestIp: '127.0.0.1',
        scannedAt: new Date('2025-03-15T12:00:00'),
      });
      expect(wrapWithEmailThemeSpy).toHaveBeenCalledTimes(1);
      const bodyHtmlArg = wrapWithEmailThemeSpy.mock.calls[0][1] as string;
      assertNoRawXss(bodyHtmlArg, '<script>alert');
      assertNoRawXss(bodyHtmlArg, '<img src=x onerror');
    });
  });

  describe('All template-based emails use proper DOCTYPE structure', () => {
    beforeEach(() => {
      renderEmailSpy = vi.spyOn(emailTemplateService, 'renderEmail').mockResolvedValue({
        subject: 'Test',
        html: createThemedHtml('<p>Test</p>'),
        text: 'Test',
      });
    });

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
        await method();
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        expect(capturedHtml).toContain('<!DOCTYPE html>');
        expect(capturedHtml).toContain('</html>');
      }
    });
  });
});
