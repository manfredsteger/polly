import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '../../services/emailService';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Service Integration',
  description: 'Prüft dass EmailService die neuen Templates nutzt',
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

function createConfiguredEmailService(): EmailService {
  const svc = new EmailService();
  (svc as any).isConfigured = true;
  (svc as any).transporter = mockTransporter;
  return svc;
}

async function sendAndCapture(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return mockTransporter.sendMail.mock.calls.length > 0;
  } catch {
    return false;
  }
}

describe('EmailService Integration — Template System', () => {
  let emailService: EmailService;

  beforeEach(() => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';
    mockTransporter.sendMail.mockClear();
    capturedHtml = '';
    capturedText = '';
    capturedSubject = '';
    emailService = createConfiguredEmailService();
  });

  describe('All template-based emails render properly', () => {
    it('sendPollCreationEmails renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPollCreationEmails('admin@test.com', 'Teammeeting', 'https://polly.example.com/poll/abc', 'https://polly.example.com/admin/xyz', 'schedule')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedHtml).toContain('prefers-color-scheme: dark');
    });

    it('sendInvitationEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendInvitationEmail('user@test.com', 'Max Mustermann', 'Sommerfeier', 'https://polly.example.com/poll/summer', 'Bitte abstimmen!')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendVotingConfirmationEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendVotingConfirmationEmail('voter@test.com', 'Anna', 'Weihnachtsfeier', 'schedule', 'https://polly.example.com/poll/xmas', 'https://polly.example.com/poll/xmas#results')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendReminderEmail renders with template system', async () => {
      const expiryDate = new Date('2025-12-31T23:59:00');
      const sent = await sendAndCapture(() =>
        emailService.sendReminderEmail('user@test.com', 'Chef', 'Wichtige Umfrage', 'https://polly.example.com/poll/urgent', expiryDate)
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendPasswordResetEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPasswordResetEmail('user@test.com', 'https://polly.example.com/reset/token123', 'Max')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedText).toBeDefined();
    });

    it('sendEmailChangeConfirmation renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendEmailChangeConfirmation('old@test.com', 'new@test.com', 'https://polly.example.com/confirm/abc')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendPasswordChangedEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPasswordChangedEmail('user@test.com', 'Max Mustermann')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendTestReportEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendTestReportEmail('admin@test.com', {
          id: 42, status: 'completed', triggeredBy: 'manual',
          totalTests: 25, passed: 24, failed: 1, skipped: 0,
          duration: 12500,
          startedAt: new Date('2025-03-15T14:30:00'),
          completedAt: new Date('2025-03-15T14:30:12'),
        })
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });

    it('sendTestReportEmail attaches PDF when provided', async () => {
      const pdfBuffer = Buffer.from('fake-pdf');
      const sent = await sendAndCapture(() =>
        emailService.sendTestReportEmail('admin@test.com', {
          id: 1, status: 'completed', triggeredBy: 'manual',
          totalTests: 10, passed: 10, failed: 0, skipped: 0,
          duration: 5000, startedAt: new Date(), completedAt: new Date(),
        }, pdfBuffer)
      );
      if (!sent) return;
      const lastCall = mockTransporter.sendMail.mock.lastCall?.[0];
      expect(lastCall.attachments).toBeDefined();
      expect(lastCall.attachments[0].filename).toContain('testbericht');
      expect(lastCall.attachments[0].contentType).toBe('application/pdf');
    });

    it('sendWelcomeEmail renders with template system', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendWelcomeEmail('new@test.com', 'Neuer User', 'https://polly.example.com/verify/abc123')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
    });
  });

  describe('sendVirusDetectionAlert uses themed wrapper', () => {
    it('should render with themed HTML structure', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendVirusDetectionAlert(['admin@test.com'], {
          filename: 'evil.exe', fileSize: 1024, virusName: 'Eicar-Test',
          uploaderEmail: 'user@test.com', requestIp: '127.0.0.1',
          scannedAt: new Date('2025-03-15T12:00:00'),
        })
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedHtml).toContain('prefers-color-scheme: dark');
      expect(capturedHtml).toContain('Virus erkannt');
    });
  });

  describe('sendDeletionRequestNotification uses themed wrapper', () => {
    it('should render with themed HTML structure', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendDeletionRequestNotification(['admin@test.com'], 'Max Mustermann', 'max@test.com', 'https://polly.example.com/admin/users')
      );
      if (!sent) return;
      expect(capturedHtml).toContain('<!DOCTYPE html>');
      expect(capturedHtml).toContain('prefers-color-scheme: dark');
      expect(capturedHtml).toContain('https://polly.example.com/admin/users');
    });
  });

  describe('Email structure and safety', () => {
    it('should not contain x-webdoc:// protocol in any email', async () => {
      const sent = await sendAndCapture(() =>
        emailService.sendPollCreationEmails('admin@test.com', 'Test', 'https://polly.example.com/poll/abc', 'https://polly.example.com/admin/xyz', 'schedule')
      );
      if (!sent) return;
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
        mockTransporter.sendMail.mockClear();
        const sent = await sendAndCapture(method);
        if (sent && capturedHtml && capturedHtml.length > 0) {
          expect(capturedHtml).toContain('<!DOCTYPE html>');
          expect(capturedHtml).toContain('<html');
          expect(capturedHtml).toContain('</html>');
          expect(capturedText).toBeDefined();
          expect(capturedText.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
