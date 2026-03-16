import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EmailService } from '../../services/emailService';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Service Integration',
  description: 'Prüft dass EmailService die neuen Templates nutzt und Links korrekt sind',
  severity: 'high' as const,
};

let capturedHtml: string;
let capturedText: string;
let capturedSubject: string;

const mockTransporter = {
  sendMail: vi.fn(async (options: any) => {
    capturedHtml = options.html;
    capturedText = options.text;
    capturedSubject = options.subject;
    return { messageId: 'test-id' };
  }),
};

describe('EmailService Integration — Template System', () => {
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

  describe('All template-based emails render properly', () => {
    it('sendPollCreationEmails renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendPollCreationEmails(
        'admin@test.com',
        'Teammeeting',
        'https://polly.example.com/poll/abc',
        'https://polly.example.com/admin/xyz',
        'schedule'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedHtml).toContain('prefers-color-scheme: dark');
    });

    it('sendInvitationEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendInvitationEmail(
        'user@test.com',
        'Max Mustermann',
        'Sommerfeier',
        'https://polly.example.com/poll/summer',
        'Bitte abstimmen!'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendVotingConfirmationEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendVotingConfirmationEmail(
        'voter@test.com',
        'Anna',
        'Weihnachtsfeier',
        'schedule',
        'https://polly.example.com/poll/xmas',
        'https://polly.example.com/poll/xmas#results'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendReminderEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      const expiryDate = new Date('2025-12-31T23:59:00');
      await emailService.sendReminderEmail(
        'user@test.com',
        'Chef',
        'Wichtige Umfrage',
        'https://polly.example.com/poll/urgent',
        expiryDate
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendPasswordResetEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendPasswordResetEmail(
        'user@test.com',
        'https://polly.example.com/reset/token123',
        'Max'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedText).toBeDefined();
    });

    it('sendEmailChangeConfirmation renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendEmailChangeConfirmation(
        'old@test.com',
        'new@test.com',
        'https://polly.example.com/confirm/abc'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendPasswordChangedEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendPasswordChangedEmail(
        'user@test.com',
        'Max Mustermann'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendPasswordChangedNotification delegates to sendPasswordChangedEmail', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendPasswordChangedNotification('user@test.com');

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendTestReportEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendTestReportEmail(
        'admin@test.com',
        {
          id: 42,
          status: 'completed',
          triggeredBy: 'manual',
          totalTests: 25,
          passed: 24,
          failed: 1,
          skipped: 0,
          duration: 12500,
          startedAt: new Date('2025-03-15T14:30:00'),
          completedAt: new Date('2025-03-15T14:30:12'),
        }
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendTestReportEmail attaches PDF when provided', async () => {
      const pdfBuffer = Buffer.from('fake-pdf');
      await emailService.sendTestReportEmail(
        'admin@test.com',
        {
          id: 1,
          status: 'completed',
          triggeredBy: 'manual',
          totalTests: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          duration: 5000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        pdfBuffer
      );

      const lastCall = mockTransporter.sendMail.mock.lastCall?.[0];
      expect(lastCall.attachments).toBeDefined();
      expect(lastCall.attachments[0].filename).toContain('testbericht');
      expect(lastCall.attachments[0].contentType).toBe('application/pdf');
    });

    it('sendWelcomeEmail renders with template system', async () => {
      mockTransporter.sendMail.mockClear();
      await emailService.sendWelcomeEmail(
        'new@test.com',
        'Neuer User',
        'https://polly.example.com/verify/abc123'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });
  });

  describe('Email structure and safety', () => {
    it('should not contain x-webdoc:// protocol in any email', async () => {
      await emailService.sendPollCreationEmails(
        'admin@test.com',
        'Test',
        'https://polly.example.com/poll/abc',
        'https://polly.example.com/admin/xyz',
        'schedule'
      );
      expect(capturedHtml).not.toContain('x-webdoc://');
    });

    it('all template emails have proper HTML structure', async () => {
      const methods: Array<() => Promise<void>> = [
        () => emailService.sendPollCreationEmails('a@b.com', 'T', 'https://e.com/p', 'https://e.com/a', 'schedule'),
        () => emailService.sendVotingConfirmationEmail('a@b.com', 'N', 'T', 'survey', 'https://e.com/p', 'https://e.com/r'),
        () => emailService.sendPasswordResetEmail('a@b.com', 'https://e.com/r'),
        () => emailService.sendEmailChangeConfirmation('a@b.com', 'b@c.com', 'https://e.com/c'),
        () => emailService.sendPasswordChangedEmail('a@b.com'),
        () => emailService.sendWelcomeEmail('a@b.com', 'N', 'https://e.com/v'),
      ];

      for (const method of methods) {
        await method();
        expect(capturedHtml).toContain('<!DOCTYPE html>');
        expect(capturedHtml).toContain('<html');
        expect(capturedHtml).toContain('</html>');
        expect(capturedText).toBeDefined();
        expect(capturedText.length).toBeGreaterThan(0);
      }
    });
  });
});
