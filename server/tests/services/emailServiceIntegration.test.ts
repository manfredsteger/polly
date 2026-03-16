import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../services/emailService';
import { emailTemplateService } from '../../services/emailTemplateService';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Service Integration',
  description: 'Prüft dass EmailService die neuen Templates nutzt',
  severity: 'high' as const,
};

interface CapturedMailOptions {
  html: string;
  text: string;
  subject: string;
  attachments?: Array<{ filename: string; contentType: string; content: Buffer }>;
}

const THEMED_HTML = '<!DOCTYPE html><html lang="de"><head><meta name="color-scheme" content="light dark"><style>@media (prefers-color-scheme: dark){}</style></head><body>{{BODY}}</body></html>';

function themedHtml(body: string): string {
  return THEMED_HTML.replace('{{BODY}}', body);
}

let capturedHtml: string;
let capturedText: string;
let capturedSubject: string;

const mockSendMail = vi.fn(async (options: CapturedMailOptions) => {
  capturedHtml = options.html;
  capturedText = options.text;
  capturedSubject = options.subject;
  return { messageId: 'test-id' };
});

const mockTransporter = { sendMail: mockSendMail } as unknown as nodemailer.Transporter;

function createConfiguredEmailService(): EmailService {
  const svc = new EmailService();
  svc.configureForTesting(mockTransporter);
  return svc;
}

describe('EmailService Integration — Template System', () => {
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
    capturedSubject = '';
    emailService = createConfiguredEmailService();

    renderEmailSpy = vi.spyOn(emailTemplateService, 'renderEmail').mockResolvedValue({
      subject: 'Mocked Subject',
      html: themedHtml('<p>Mocked body</p>'),
      text: 'Mocked body',
    });

    wrapWithEmailThemeSpy = vi.spyOn(emailTemplateService, 'wrapWithEmailTheme').mockResolvedValue({
      subject: 'Wrapped Subject',
      html: themedHtml('<p>Wrapped body</p>'),
      text: 'Wrapped body',
    });
  });

  afterEach(() => {
    renderEmailSpy.mockRestore();
    wrapWithEmailThemeSpy.mockRestore();
    delete process.env.APP_URL;
  });

  describe('Template-based emails call renderEmail with correct type', () => {
    it('sendPollCreationEmails calls renderEmail with poll_created', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com', 'Teammeeting',
        'https://polly.example.com/poll/abc', 'https://polly.example.com/admin/xyz', 'schedule'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('poll_created', expect.objectContaining({
        pollTitle: 'Teammeeting',
        publicLink: 'https://polly.example.com/poll/abc',
        adminLink: 'https://polly.example.com/admin/xyz',
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedHtml).toContain('prefers-color-scheme: dark');
    });

    it('sendInvitationEmail calls renderEmail with invitation and qrCodeUrl', async () => {
      await emailService.sendInvitationEmail(
        'user@test.com', 'Max Mustermann', 'Sommerfeier',
        'https://polly.example.com/poll/summer', 'Bitte abstimmen!'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('invitation', expect.objectContaining({
        inviterName: 'Max Mustermann',
        pollTitle: 'Sommerfeier',
        publicLink: expect.stringContaining('polly.example.com/poll/summer'),
        qrCodeUrl: expect.any(String),
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendVotingConfirmationEmail calls renderEmail with vote_confirmation', async () => {
      await emailService.sendVotingConfirmationEmail(
        'voter@test.com', 'Anna', 'Weihnachtsfeier', 'schedule',
        'https://polly.example.com/poll/xmas', 'https://polly.example.com/poll/xmas#results'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('vote_confirmation', expect.objectContaining({
        voterName: 'Anna',
        pollTitle: 'Weihnachtsfeier',
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendReminderEmail calls renderEmail with reminder', async () => {
      const expiryDate = new Date('2025-12-31T23:59:00');
      await emailService.sendReminderEmail(
        'user@test.com', 'Chef', 'Wichtige Umfrage',
        'https://polly.example.com/poll/urgent', expiryDate
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('reminder', expect.objectContaining({
        senderName: 'Chef',
        pollTitle: 'Wichtige Umfrage',
        pollLink: 'https://polly.example.com/poll/urgent',
        qrCodeUrl: expect.any(String),
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendPasswordResetEmail calls renderEmail with password_reset', async () => {
      await emailService.sendPasswordResetEmail(
        'user@test.com', 'https://polly.example.com/reset/token123', 'Max'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('password_reset', expect.objectContaining({
        resetLink: 'https://polly.example.com/reset/token123',
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedText).toBeDefined();
      expect(capturedText.length).toBeGreaterThan(0);
    });

    it('sendEmailChangeConfirmation calls renderEmail with email_change', async () => {
      await emailService.sendEmailChangeConfirmation(
        'old@test.com', 'new@test.com', 'https://polly.example.com/confirm/abc'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('email_change', expect.objectContaining({
        confirmLink: 'https://polly.example.com/confirm/abc',
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendPasswordChangedEmail calls renderEmail with password_changed', async () => {
      await emailService.sendPasswordChangedEmail('user@test.com', 'Max Mustermann');
      expect(renderEmailSpy).toHaveBeenCalledWith('password_changed', expect.any(Object));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendTestReportEmail calls renderEmail with test_report', async () => {
      await emailService.sendTestReportEmail('admin@test.com', {
        id: 42, status: 'completed', triggeredBy: 'manual',
        totalTests: 25, passed: 24, failed: 1, skipped: 0,
        duration: 12500,
        startedAt: new Date('2025-03-15T14:30:00'),
        completedAt: new Date('2025-03-15T14:30:12'),
      });
      expect(renderEmailSpy).toHaveBeenCalledWith('test_report', expect.any(Object));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendTestReportEmail attaches PDF when provided', async () => {
      const pdfBuffer = Buffer.from('fake-pdf');
      await emailService.sendTestReportEmail('admin@test.com', {
        id: 1, status: 'completed', triggeredBy: 'manual',
        totalTests: 10, passed: 10, failed: 0, skipped: 0,
        duration: 5000, startedAt: new Date(), completedAt: new Date(),
      }, pdfBuffer);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const lastCall = mockSendMail.mock.lastCall?.[0];
      expect(lastCall).toBeDefined();
      expect(lastCall.attachments).toBeDefined();
      expect(lastCall.attachments[0].filename).toContain('testbericht');
      expect(lastCall.attachments[0].contentType).toBe('application/pdf');
    });

    it('sendWelcomeEmail calls renderEmail with welcome', async () => {
      await emailService.sendWelcomeEmail(
        'new@test.com', 'Neuer User', 'https://polly.example.com/verify/abc123'
      );
      expect(renderEmailSpy).toHaveBeenCalledWith('welcome', expect.objectContaining({
        verificationLink: expect.stringContaining('polly.example.com/verify/abc123'),
      }));
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Themed wrapper methods call wrapWithEmailTheme', () => {
    it('sendCustomEmail calls wrapWithEmailTheme', async () => {
      await emailService.sendCustomEmail(
        'user@test.com', 'Custom Subject', '<p>Custom body</p>', 'Custom body'
      );
      expect(wrapWithEmailThemeSpy).toHaveBeenCalledWith(
        'Custom Subject', '<p>Custom body</p>', 'Custom body'
      );
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendVirusDetectionAlert calls wrapWithEmailTheme', async () => {
      await emailService.sendVirusDetectionAlert(['admin@test.com'], {
        filename: 'evil.exe', fileSize: 1024, virusName: 'Eicar-Test',
        uploaderEmail: 'user@test.com', requestIp: '127.0.0.1',
        scannedAt: new Date('2025-03-15T12:00:00'),
      });
      expect(wrapWithEmailThemeSpy).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendDeletionRequestNotification calls wrapWithEmailTheme', async () => {
      await emailService.sendDeletionRequestNotification(
        ['admin@test.com'], 'Max Mustermann', 'max@test.com',
        'https://polly.example.com/admin/users'
      );
      expect(wrapWithEmailThemeSpy).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });
  });

  describe('Email structure and safety', () => {
    it('should not contain x-webdoc:// protocol in any email', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com', 'Test',
        'https://polly.example.com/poll/abc', 'https://polly.example.com/admin/xyz', 'schedule'
      );
      expect(capturedHtml).not.toContain('x-webdoc://');
    });

    it('all template emails include both HTML and plain text', async () => {
      const methods: Array<{ name: string; fn: () => Promise<void> }> = [
        { name: 'poll_created', fn: () => emailService.sendPollCreationEmails('a@b.com', 'T', 'https://e.com/p', 'https://e.com/a', 'schedule') },
        { name: 'vote_confirmation', fn: () => emailService.sendVotingConfirmationEmail('a@b.com', 'N', 'T', 'survey', 'https://e.com/p', 'https://e.com/r') },
        { name: 'password_reset', fn: () => emailService.sendPasswordResetEmail('a@b.com', 'https://e.com/r') },
        { name: 'email_change', fn: () => emailService.sendEmailChangeConfirmation('a@b.com', 'b@c.com', 'https://e.com/c') },
        { name: 'password_changed', fn: () => emailService.sendPasswordChangedEmail('a@b.com') },
        { name: 'welcome', fn: () => emailService.sendWelcomeEmail('a@b.com', 'N', 'https://e.com/v') },
      ];

      for (const { fn } of methods) {
        mockSendMail.mockClear();
        await fn();
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        expect(capturedHtml).toContain('<!DOCTYPE html>');
        expect(capturedText).toBeDefined();
        expect(capturedText.length).toBeGreaterThan(0);
      }
    });
  });

  describe('URL validation in email context', () => {
    it('renderEmail is called with absolute https URLs for links', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com', 'T',
        'https://polly.example.com/poll/abc', 'https://polly.example.com/admin/xyz', 'schedule'
      );
      const callArgs = renderEmailSpy.mock.calls[0][1] as Record<string, string>;
      expect(callArgs.publicLink).toMatch(/^https?:\/\//);
      expect(callArgs.adminLink).toMatch(/^https?:\/\//);
    });

    it('password reset link is passed as absolute URL', async () => {
      await emailService.sendPasswordResetEmail('a@b.com', 'https://polly.example.com/reset/tok');
      const callArgs = renderEmailSpy.mock.calls[0][1] as Record<string, string>;
      expect(callArgs.resetLink).toMatch(/^https?:\/\//);
    });

    it('email change confirm link is passed as absolute URL', async () => {
      await emailService.sendEmailChangeConfirmation('a@b.com', 'b@c.com', 'https://polly.example.com/confirm/abc');
      const callArgs = renderEmailSpy.mock.calls[0][1] as Record<string, string>;
      expect(callArgs.confirmLink).toMatch(/^https?:\/\//);
    });
  });
});
