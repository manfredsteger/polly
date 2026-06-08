import { describe, it, expect, beforeEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../services/emailService';
import { emailTemplateService } from '../../services/emailTemplateService';

export const testMeta = {
  category: 'services' as const,
  name: 'Orga-Listen Bestätigungs-E-Mails',
  description: 'Prüft personalisierte Teilnehmer-E-Mails und Organisator-Übersicht bei Orga-Listen-Bestätigung',
  severity: 'high' as const,
};

interface CapturedMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const allMails: CapturedMail[] = [];

const mockSendMail = vi.fn(async (options: CapturedMail) => {
  allMails.push(options);
  return { messageId: 'test-id' };
});

const mockTransporter = { sendMail: mockSendMail } as unknown as nodemailer.Transporter;

function createService(): EmailService {
  const svc = new EmailService();
  svc.configureForTesting(mockTransporter);
  return svc;
}

const TEST_OPTIONS = [
  { id: 1, text: 'Montag 09:00' },
  { id: 2, text: 'Dienstag 14:00' },
  { id: 3, text: 'Mittwoch 10:00' },
];

const TEST_VOTES = [
  // alice signed up for Montag + Dienstag
  { optionId: 1, voterEmail: 'alice@example.com', voterName: 'Alice', response: 'yes' },
  { optionId: 2, voterEmail: 'alice@example.com', voterName: 'Alice', response: 'yes' },
  // bob signed up for Montag only
  { optionId: 1, voterEmail: 'bob@example.com', voterName: 'Bob', response: 'yes' },
  // charlie has no email → should be excluded
  { optionId: 3, voterEmail: '', voterName: 'Charlie (anonym)', response: 'yes' },
  // dave said 'no' → not a signup
  { optionId: 2, voterEmail: 'dave@example.com', voterName: 'Dave', response: 'no' },
];

describe('sendOrgConfirmationEmails', () => {
  let emailService: EmailService;
  let renderSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASSWORD = 'test';
    process.env.FROM_EMAIL = 'noreply@polly.test';
    process.env.APP_URL = 'https://polly.example.com';

    allMails.length = 0;
    mockSendMail.mockClear();
    emailService = createService();

    renderSpy = vi.spyOn(emailTemplateService, 'renderEmail').mockImplementation(async (_type, vars) => {
      const slotSummaryHtml = (vars?.slotSummaryHtml as string) ?? '';
      return {
        subject: `[Polly] ${vars?.statusLabel ?? ''}: Test Poll`,
        html: `<p>${slotSummaryHtml}</p>`,
        text: slotSummaryHtml,
      };
    });
  });

  afterEach(() => {
    renderSpy.mockRestore();
    delete process.env.APP_URL;
    delete process.env.FROM_EMAIL;
  });

  it('sends personalized email to each participant with yes response', async () => {
    await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      null
    );

    const aliceMail = allMails.find(m => m.to === 'alice@example.com');
    const bobMail = allMails.find(m => m.to === 'bob@example.com');

    expect(aliceMail).toBeDefined();
    expect(bobMail).toBeDefined();
  });

  it('each participant only receives their own booked slots', async () => {
    await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      null
    );

    const aliceMail = allMails.find(m => m.to === 'alice@example.com');
    const bobMail = allMails.find(m => m.to === 'bob@example.com');

    // Alice has Montag + Dienstag
    expect(aliceMail?.html).toContain('Montag 09:00');
    expect(aliceMail?.html).toContain('Dienstag 14:00');
    // Alice does NOT see Mittwoch (only Bob signed up, and only Charlie whose response is yes there)
    expect(aliceMail?.html).not.toContain('Mittwoch 10:00');

    // Bob has only Montag
    expect(bobMail?.html).toContain('Montag 09:00');
    expect(bobMail?.html).not.toContain('Dienstag 14:00');
    expect(bobMail?.html).not.toContain('Mittwoch 10:00');
  });

  it('excludes participants without a valid email address', async () => {
    await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      null
    );

    // Charlie has no email, Dave said 'no' → neither should receive email
    const charlieMail = allMails.find(m => m.to === '' || m.to.includes('Charlie'));
    const daveMail = allMails.find(m => m.to === 'dave@example.com');
    expect(charlieMail).toBeUndefined();
    expect(daveMail).toBeUndefined();
  });

  it('organizer always receives a full participant-list summary', async () => {
    await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      'organizer@example.com'
    );

    const organizerMail = allMails.find(m => m.to === 'organizer@example.com');
    expect(organizerMail).toBeDefined();
    // Organizer summary should contain slot→names info (Alice and Bob's entries)
    expect(organizerMail?.html).toContain('Montag 09:00');
    expect(organizerMail?.html).toContain('Alice');
    expect(organizerMail?.html).toContain('Bob');
  });

  it('organizer who also signed up still receives the full summary', async () => {
    const organizerEmail = 'alice@example.com'; // alice is both participant and organizer

    await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      organizerEmail
    );

    // alice gets her personalized participant email
    const personalMails = allMails.filter(m => m.to === 'alice@example.com');
    // Should receive at least 2 emails: personalized + organizer summary
    expect(personalMails.length).toBeGreaterThanOrEqual(2);
  });

  it('returns correct sent/failed counts', async () => {
    const result = await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      TEST_VOTES,
      'organizer@example.com'
    );

    // alice + bob as participants + organizer = 3 emails
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('counts failures when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const result = await emailService.sendOrgConfirmationEmails(
      'Test Poll',
      'https://polly.example.com/poll/abc',
      TEST_OPTIONS,
      [{ optionId: 1, voterEmail: 'fail@example.com', voterName: 'Fail', response: 'yes' }],
      null
    );

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });
});
