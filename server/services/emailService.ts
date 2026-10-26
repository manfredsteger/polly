import nodemailer from 'nodemailer';
import { qrService } from './qrService';
import { emailTemplateService } from './emailTemplateService';
import type { EmailTemplateType, EmailLanguage } from '@shared/schema';
import { emailStrings, emailLocale, pollTypeLabel, formatConfirmedSlot } from './emailI18n';
import { resolveEmailLanguage, groupRecipientsByLanguage } from './emailLanguage';
import { getBaseUrl, validateEmailUrl, warnIfLocalhostInProduction } from '../utils/baseUrl';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const { window: _domWindow } = new JSDOM('');
const _DOMPurify = createDOMPurify(_domWindow as any);

function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';
  const rawHtml = marked.parse(markdown, { breaks: true }) as string;
  return _DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'a', 'code', 'pre'],
    ALLOWED_ATTR: ['href'],
  });
}

function markdownToPlainText(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';
  return markdown
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSelectedOptionsHtml(selectedOptions?: string[]): string {
  return selectedOptions && selectedOptions.length > 0
    ? `<ul style="margin: 0; padding-left: 18px;">${selectedOptions
        .map(
          opt =>
            `<li style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; color: #4b5563; margin: 3px 0;">${escapeHtml(opt)}</li>`
        )
        .join('')}</ul>`
    : '';
}

function summarizeTestError(error: string | null): string {
  if (!error) return '';
  return error
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

type EmailPriority = 'high' | 'normal';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  priority?: EmailPriority;
  fromPrefix?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
  isBulk?: boolean;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  get smtpConfigured(): boolean {
    return this.isConfigured;
  }

  configureForTesting(transporter: nodemailer.Transporter): void {
    this.transporter = transporter;
    this.isConfigured = true;
  }

  getDisplayConfig(): {
    configured: boolean;
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    secure: boolean;
    fromEmail: string;
    fromName: string;
  } {
    const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '';
    const portRaw = parseInt(process.env.SMTP_PORT || '587');
    const port = Number.isNaN(portRaw) ? 587 : portRaw;

    return {
      configured: this.isConfigured,
      host: process.env.SMTP_HOST || '',
      port,
      user: process.env.SMTP_USER || '',
      hasPassword: smtpPassword.length > 0,
      secure: process.env.SMTP_SECURE === 'true',
      fromEmail: process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@polly.example.com',
      fromName: process.env.FROM_NAME || 'Polly',
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: 'SMTP not configured' };
    }
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  constructor() {
    const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    const hasSmtpConfig = process.env.SMTP_HOST && 
                         process.env.SMTP_USER && 
                         smtpPassword;
    const isTestEnv = process.env.NODE_ENV === 'test';

    if (hasSmtpConfig && !isTestEnv) {
      const config: EmailConfig = {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: smtpPassword!,
        },
      };

      const transporterOptions = {
        ...config,
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
        rateDelta: 20000,
        rateLimit: 3,
        dnsTimeout: 10000,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      };

      this.transporter = nodemailer.createTransport(transporterOptions);
      this.isConfigured = true;

      warnIfLocalhostInProduction();
    } else {
      console.warn('SMTP not configured. Email notifications will be disabled.');
      this.isConfigured = false;
    }
  }

  private getFromAddress(prefix?: string): string {
    const fromName = process.env.FROM_NAME || 'Polly';
    const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@polly.example.com';
    const displayName = prefix ? `${fromName} ${prefix}` : fromName;
    return `"${displayName}" <${fromEmail}>`;
  }

  private getReplyTo(): string {
    return process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@polly.example.com';
  }

  private async renderTemplate(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage
  ): Promise<{ subject: string; html: string; text: string }> {
    return emailTemplateService.renderEmail(type, variables, lang);
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Would send to ${options.to}: ${options.subject}`);
      return;
    }

    const priority = options.priority || 'normal';
    const isHigh = priority === 'high';
    const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@polly.example.com';

    const headers: Record<string, string> = {
      'X-Mailer': 'Polly',
      'Reply-To': this.getReplyTo(),
      'Auto-Submitted': 'auto-generated',
    };

    if (isHigh) {
      headers['X-Priority'] = '1';
      headers['X-MSMail-Priority'] = 'High';
      headers['Importance'] = 'high';
    }

    if (options.isBulk) {
      headers['Precedence'] = 'bulk';
      headers['List-Unsubscribe'] = `<mailto:${fromEmail}?subject=Abbestellen>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.getFromAddress(options.fromPrefix),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers,
    };

    if (options.attachments) {
      mailOptions.attachments = options.attachments;
    }

    await this.transporter.sendMail(mailOptions);
  }

  async sendPollCreationEmails(
    creatorEmail: string,
    pollTitle: string,
    publicLink: string,
    adminLink: string,
    pollType: 'schedule' | 'survey' | 'organization',
    isRegisteredUser: boolean = false,
    languageHint?: EmailLanguage
  ): Promise<void> {
    try {
      const lang = await resolveEmailLanguage(creatorEmail, languageHint);
      const rendered = await this.renderTemplate('poll_created', {
        pollTitle,
        pollType: pollTypeLabel(pollType, lang),
        publicLink: validateEmailUrl(publicLink),
        adminLink: validateEmailUrl(adminLink),
        isRegisteredUser: isRegisteredUser ? 'true' : '',
      }, lang);

      await this.sendMail({
        to: creatorEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send poll creation email:', error);
    }
  }

  async sendInvitationEmail(
    inviteeEmail: string,
    inviterName: string,
    pollTitle: string,
    pollLink: string,
    customMessage?: string
  ): Promise<void> {
    try {
      const validatedLink = validateEmailUrl(pollLink);

      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await qrService.generateQRCode(validatedLink, 'png');
      } catch (qrError) {
        console.error('Failed to generate QR code for email:', qrError);
      }

      const lang = await resolveEmailLanguage(inviteeEmail);
      const rendered = await this.renderTemplate('invitation', {
        pollTitle,
        // Callers pass '' when the poll has no named owner.
        inviterName: inviterName || emailStrings(lang).someone,
        publicLink: validatedLink,
        message: customMessage || '',
        qrCodeUrl: qrCodeDataUrl,
      }, lang);

      await this.sendMail({
        to: inviteeEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        isBulk: true,
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }
  }

  async sendVotingConfirmationEmail(
    voterEmail: string,
    voterName: string,
    pollTitle: string,
    pollType: 'schedule' | 'survey' | 'organization',
    publicLink: string,
    resultsLink: string | undefined,
    selectedOptions?: string[],
    editLink?: string,
    withdrawalOnly = false,
    languageHint?: EmailLanguage
  ): Promise<void> {
    if (!voterEmail) return;

    try {
      const lang = await resolveEmailLanguage(voterEmail, languageHint);
      const selectedOptionsHtml = renderSelectedOptionsHtml(selectedOptions);

      const rendered = await this.renderTemplate('vote_confirmation', {
        voterName,
        pollTitle,
        pollType: pollTypeLabel(pollType, lang),
        publicLink: validateEmailUrl(publicLink),
        resultsLink: resultsLink ? validateEmailUrl(resultsLink) : undefined,
        resultsPublic: resultsLink ? 'true' : 'false',
        editLink: editLink ? validateEmailUrl(editLink) : undefined,
        voteManagementAction: withdrawalOnly ? 'withdraw' : 'edit',
        selectedOptionsHtml,
      }, lang);

      await this.sendMail({
        to: voterEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send voting confirmation email:', error);
      throw error;
    }
  }

  async sendVoteUpdatedEmail(
    voterEmail: string,
    voterName: string,
    pollTitle: string,
    pollType: 'schedule' | 'survey' | 'organization',
    publicLink: string,
    resultsLink: string | undefined,
    selectedOptions?: string[],
    editLink?: string,
    languageHint?: EmailLanguage
  ): Promise<void> {
    if (!voterEmail) return;

    try {
      const lang = await resolveEmailLanguage(voterEmail, languageHint);
      const selectedOptionsHtml = renderSelectedOptionsHtml(selectedOptions);

      const rendered = await this.renderTemplate('vote_updated', {
        voterName,
        pollTitle,
        pollType: pollTypeLabel(pollType, lang),
        publicLink: validateEmailUrl(publicLink),
        resultsLink: resultsLink ? validateEmailUrl(resultsLink) : undefined,
        resultsPublic: resultsLink ? 'true' : 'false',
        editLink: editLink ? validateEmailUrl(editLink) : undefined,
        selectedOptionsHtml,
      }, lang);

      await this.sendMail({
        to: voterEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send vote updated email:', error);
      throw error;
    }
  }

  async sendVoteWithdrawalEmail(
    recipientEmail: string, voterName: string, pollTitle: string, link: string, organizer = false,
    languageHint?: EmailLanguage
  ): Promise<void> {
    if (!recipientEmail) return;
    // The requester's UI language only applies to the voter's own receipt.
    const lang = await resolveEmailLanguage(recipientEmail, organizer ? undefined : languageHint);
    const rendered = await emailTemplateService.renderVoteWithdrawalEmail(
      voterName, pollTitle, validateEmailUrl(link), organizer, lang
    );
    await this.sendMail({ to: recipientEmail, ...rendered });
  }

  async sendNewVoteNotificationEmail(
    creatorEmail: string,
    voterName: string,
    pollTitle: string,
    pollType: 'schedule' | 'survey' | 'organization',
    adminLink: string,
    resultsLink: string
  ): Promise<void> {
    if (!creatorEmail) return;

    try {
      const lang = await resolveEmailLanguage(creatorEmail);
      const rendered = await this.renderTemplate('new_vote_notification', {
        voterName,
        pollTitle,
        pollType: pollTypeLabel(pollType, lang),
        adminLink: validateEmailUrl(adminLink),
        resultsLink: validateEmailUrl(resultsLink),
      }, lang);

      await this.sendMail({
        to: creatorEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send new vote notification email:', error);
    }
  }

  async sendReminderEmail(
    recipientEmail: string,
    senderName: string,
    pollTitle: string,
    pollLink: string,
    expiresAt?: Date | null,
    selectedOptions?: string[]
  ): Promise<void> {
    try {
      const validatedLink = validateEmailUrl(pollLink);

      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await qrService.generateQRCode(validatedLink, 'png');
      } catch (qrError) {
        console.error('Failed to generate QR code for reminder email:', qrError);
      }

      const lang = await resolveEmailLanguage(recipientEmail);
      const expiryText = expiresAt
        ? emailStrings(lang).reminder.expiry(new Date(expiresAt).toLocaleDateString(emailLocale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        : '';

      const selectedOptionsHtml = renderSelectedOptionsHtml(selectedOptions);

      const rendered = await this.renderTemplate('reminder', {
        senderName: senderName || emailStrings(lang).someone,
        pollTitle,
        pollLink: validatedLink,
        expiresAt: expiryText,
        qrCodeUrl: qrCodeDataUrl,
        selectedOptionsHtml,
      }, lang);

      await this.sendMail({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        isBulk: true,
      });
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string, userName?: string, languageHint?: EmailLanguage): Promise<void> {
    try {
      const lang = await resolveEmailLanguage(email, languageHint);
      const rendered = await this.renderTemplate('password_reset', {
        userName: userName || '',
        resetLink: validateEmailUrl(resetLink),
      }, lang);

      await this.sendMail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  async sendEmailChangeConfirmation(oldEmail: string, newEmail: string, confirmLink: string, languageHint?: EmailLanguage): Promise<void> {
    try {
      // Only one of the two addresses belongs to an account yet; whichever does
      // decides the language.
      const lang = await resolveEmailLanguage([newEmail, oldEmail], languageHint);
      const rendered = await this.renderTemplate('email_change', {
        oldEmail,
        newEmail,
        confirmLink: validateEmailUrl(confirmLink),
      }, lang);

      await this.sendMail({
        to: newEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error) {
      console.error('Failed to send email change confirmation:', error);
      throw error;
    }
  }

  async sendPasswordChangedEmail(email: string, userName?: string, languageHint?: EmailLanguage): Promise<void> {
    try {
      const lang = await resolveEmailLanguage(email, languageHint);
      const rendered = await this.renderTemplate('password_changed', {
        userName: userName || '',
      }, lang);

      await this.sendMail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      console.log(`[Email] Password changed notification sent to ${email}`);
    } catch (error) {
      console.error(`[Password Changed] Failed to send notification to ${email}:`, error);
    }
  }

  async sendTestReportEmail(
    recipientEmail: string,
    testRun: {
      id: number;
      status: string;
      triggeredBy: string;
      totalTests: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number | null;
      startedAt: Date;
      completedAt: Date | null;
    },
    pdfBufferOrResults?: Buffer | Array<{
      testFile: string;
      testName: string;
      category: string;
      status: 'passed' | 'failed' | 'skipped';
      duration: number | null;
      error: string | null;
      errorStack: string | null;
    }>,
    maybeResults?: Array<{
      testFile: string;
      testName: string;
      category: string;
      status: 'passed' | 'failed' | 'skipped';
      duration: number | null;
      error: string | null;
      errorStack: string | null;
    }>
  ): Promise<void> {
    try {
      const results = Array.isArray(pdfBufferOrResults) ? pdfBufferOrResults : (maybeResults || []);
      const pdfBuffer = Array.isArray(pdfBufferOrResults) ? undefined : pdfBufferOrResults;
      const lang = await resolveEmailLanguage(recipientEmail);
      const T = emailStrings(lang).testReport;
      const isSuccess = testRun.status === 'completed' && testRun.failed === 0;
      const statusEmoji = isSuccess ? '✅' : '❌';
      const statusText = isSuccess ? T.allPassed : T.someFailed(testRun.failed);

      const durationText = testRun.duration 
        ? T.seconds(Math.round(testRun.duration / 1000))
        : T.unknownDuration;
      
      const startedAtText = testRun.startedAt.toLocaleString(emailLocale(lang), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const failedResults = results.filter((result) => result.status === 'failed').slice(0, 10);
      const failedSummaryHtml = failedResults.length > 0
        ? `
          <div style="margin: 6px 0 0;">
            <p style="margin: 0 0 10px; color: #991b1b; font-size: 14px; font-weight: 700;">${T.failedHeading(testRun.failed)}</p>
            <ul style="margin: 0; padding-left: 18px; color: #7f1d1d;">
              ${failedResults.map((result) => {
                const firstErrorLine = summarizeTestError(result.error);
                return `<li style="margin: 6px 0;"><strong>${escapeHtml(result.testName)}</strong>${result.testFile ? ` <span style="color:#7f1d1d;">(${escapeHtml(result.testFile)})</span>` : ''}${firstErrorLine ? `<br/><span style="color:#991b1b;">${escapeHtml(firstErrorLine)}</span>` : ''}</li>`;
              }).join('')}
            </ul>
            <p style="margin: 10px 0 0; color: #6b7280;">${T.pdfHint}</p>
          </div>
        `
        : '';
      const failedSummaryText = failedResults.length > 0
        ? [
            `${T.failedHeading(testRun.failed)}:`,
            ...failedResults.map((result) => {
              const firstErrorLine = summarizeTestError(result.error);
              return `- ${result.testName}${result.testFile ? ` (${result.testFile})` : ''}${firstErrorLine ? `: ${firstErrorLine}` : ''}`;
            }),
            T.pdfHint,
            '',
          ].join('\n')
        : '';

      const rendered = await this.renderTemplate('test_report', {
        testRunId: String(testRun.id),
        status: `${statusEmoji} ${statusText}`,
        totalTests: String(testRun.totalTests),
        passed: String(testRun.passed),
        failed: String(testRun.failed),
        skipped: String(testRun.skipped),
        duration: durationText,
        startedAt: startedAtText,
        failedSummaryHtml,
        failedSummaryText,
      }, lang);

      const attachments: nodemailer.SendMailOptions['attachments'] = pdfBuffer
        ? [{ filename: T.pdfFilename(testRun.id), content: pdfBuffer, contentType: 'application/pdf' }]
        : undefined;

      await this.sendMail({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: failedSummaryText ? `${failedSummaryText}${rendered.text}` : rendered.text,
        priority: isSuccess ? 'normal' : 'high',
        attachments,
      });
      console.log(`[Email] Test report sent to ${recipientEmail} for run #${testRun.id}`);
    } catch (error) {
      console.error('Failed to send test report email:', error);
      throw error;
    }
  }

  async sendPreRenderedEmail(
    recipientEmail: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    try {
      await this.sendMail({
        to: recipientEmail,
        subject,
        html,
        text,
      });
      console.log(`[Email] Pre-rendered email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send pre-rendered email:', error);
      throw error;
    }
  }

  async sendFinalizationEmails(
    participantEmails: string[],
    pollTitle: string,
    confirmedSlot: { startTime: Date | null; endTime: Date | null; text: string },
    pollLink: string,
    icsBuffer: Buffer,
    videoConferenceUrl?: string | null,
    closingMessage?: string
  ): Promise<{ sent: number; failed: number }> {
    if (participantEmails.length === 0) {
      console.log('[Email] No participant emails for finalization notification');
      return { sent: 0, failed: 0 };
    }

    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const closingMessageHtml = closingMessage ? renderMarkdownToSafeHtml(closingMessage) : '';
    const closingMessageText = closingMessage ? markdownToPlainText(closingMessage) : '';

    let sent = 0;
    let failed = 0;

    // Each language group gets its own rendering (date format, labels, ICS name).
    const groups = await groupRecipientsByLanguage(participantEmails, email => email);
    for (const [lang, emails] of groups) {
      const F = emailStrings(lang).finalized;
      const { confirmedDate, confirmedTime } = formatConfirmedSlot(confirmedSlot, lang);
      const videoConfHtml = videoConferenceUrl
        ? `<strong>${F.videoConference}</strong> <a href="${escapeHtml(videoConferenceUrl)}" style="color:#7A3800;text-decoration:underline;">${escapeHtml(videoConferenceUrl)}</a>`
        : '';

      const rendered = await this.renderTemplate('poll_finalized', {
        pollType: 'schedule',
        statusLabel: F.scheduleTag,
        pollTitle,
        confirmedDate,
        confirmedTime,
        pollLink,
        buttonLink: pollLink,
        buttonLabel: F.goToPoll,
        videoConferenceUrl: videoConferenceUrl || '',
        videoConferenceHtml: videoConfHtml,
        resultsPublic: 'true',
        closingMessageHtml,
        closingMessageText,
      }, lang);

      const attachments: nodemailer.SendMailOptions['attachments'] = [
        {
          filename: F.icsFilename,
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ];

      for (const email of emails) {
        try {
          await this.sendMail({
            to: email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            attachments,
            isBulk: true,
          });
          sent++;
          console.log(`[Email] Finalization notification sent to ${email}`);
        } catch (error) {
          failed++;
          console.error(`[Email] Failed to send finalization notification to ${email}:`, error);
        }
      }
    }

    console.log(`[Email] Finalization notifications: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  async sendPollEndedEmails(
    recipientEmails: string[],
    pollTitle: string,
    pollLink: string,
    resultsPublic: boolean,
    pollType: 'survey' | 'organization' = 'survey',
    finalOptionText?: string,
    slotSummary?: Array<{ text: string; filled: number; total: number | null }>,
    closingMessage?: string
  ): Promise<{ sent: number; failed: number }> {
    if (recipientEmails.length === 0) {
      console.log('[Email] No recipient emails for poll-ended notification');
      return { sent: 0, failed: 0 };
    }

    const buttonLink = resultsPublic ? `${pollLink}#results` : pollLink;
    const closingMessageHtml = closingMessage ? renderMarkdownToSafeHtml(closingMessage) : '';
    const closingMessageText = closingMessage ? markdownToPlainText(closingMessage) : '';

    let sent = 0;
    let failed = 0;

    const groups = await groupRecipientsByLanguage(recipientEmails, email => email);
    for (const [lang, emails] of groups) {
      const F = emailStrings(lang).finalized;
      const buttonLabel = resultsPublic ? F.viewResults : F.goToPoll;

      // Build slot summary HTML for orga polls
      let slotSummaryHtml = '';
      if (slotSummary && slotSummary.length > 0) {
        const MAX_SLOTS = 5;
        const displayed = slotSummary.slice(0, MAX_SLOTS);
        const remaining = slotSummary.length - displayed.length;
        const rows = displayed.map((s) => {
          const capacityStr = s.total !== null ? ` / ${s.total}` : '';
          return `<li style="margin:2px 0;">${escapeHtml(s.text)}: <strong>${s.filled}${capacityStr}</strong> ${F.slotFilled}</li>`;
        });
        if (remaining > 0) {
          rows.push(`<li style="margin:2px 0; color:#666;">${F.moreSlots(remaining)}</li>`);
        }
        slotSummaryHtml = `<ul style="margin:8px 0 0 0; padding-left:18px;">${rows.join('')}</ul>`;
      }

      const rendered = await this.renderTemplate('poll_finalized', {
        pollType,
        statusLabel: F.pollEndedStatus,
        pollTitle,
        pollLink,
        buttonLink,
        buttonLabel,
        resultsPublic: String(resultsPublic),
        confirmedDate: '',
        confirmedTime: '',
        videoConferenceUrl: '',
        videoConferenceHtml: '',
        finalOptionText: finalOptionText ? escapeHtml(finalOptionText) : '',
        slotSummaryHtml,
        closingMessageHtml,
        closingMessageText,
      }, lang);

      for (const email of emails) {
        try {
          await this.sendMail({
            to: email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            isBulk: true,
          });
          sent++;
          console.log(`[Email] Poll-ended notification sent to ${email}`);
        } catch (error) {
          failed++;
          console.error(`[Email] Failed to send poll-ended notification to ${email}:`, error);
        }
      }
    }

    console.log(`[Email] Poll-ended notifications: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /** Hand-built security alert (not an editable template), localized per admin. */
  private buildVirusAlert(
    lang: EmailLanguage,
    details: {
      filename: string;
      fileSize: number;
      virusName: string;
      uploaderEmail?: string | null;
      requestIp?: string | null;
      scannedAt: Date;
    }
  ): { subject: string; bodyHtml: string; plainText: string } {
    const V = emailStrings(lang).virus;
    const locale = emailLocale(lang);
    const fileSizeFormatted = details.fileSize < 1024 
      ? `${details.fileSize} ${V.bytes}` 
      : details.fileSize < 1024 * 1024 
        ? `${(details.fileSize / 1024).toFixed(2)} KB`
        : `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`;
    const scannedAtText = details.scannedAt.toLocaleString(locale);

    const subject = V.subject(escapeHtml(details.virusName));
    const bodyHtml = `
      <div style="padding: 16px 24px;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 class="email-heading" style="margin: 0; font-size: 24px; color: white;">${V.heading}</h2>
        </div>
        
        <div style="background-color: #fff5f5; border: 1px solid #dc3545; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p class="email-text" style="font-size: 16px; margin-bottom: 20px;">
            ${V.intro} <strong>${V.blocked}</strong>
          </p>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24; width: 140px;">${V.virusName}</td>
              <td style="padding: 10px 0; color: #dc3545; font-weight: bold;">${escapeHtml(details.virusName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">${V.filename}</td>
              <td style="padding: 10px 0;">${escapeHtml(details.filename)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">${V.fileSize}</td>
              <td style="padding: 10px 0;">${fileSizeFormatted}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">${V.uploader}</td>
              <td style="padding: 10px 0;">${details.uploaderEmail ? escapeHtml(details.uploaderEmail) : V.anonymous}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">${V.ip}</td>
              <td style="padding: 10px 0;">${details.requestIp ? escapeHtml(details.requestIp) : V.notAvailable}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">${V.time}</td>
              <td style="padding: 10px 0;">${scannedAtText}</td>
            </tr>
          </table>
          
          <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="margin: 0; color: #155724;">
              <strong>${V.actionBold}</strong> ${V.action}
            </p>
          </div>
        </div>
      </div>
    `;

    const plainText = `${V.textTitle}\n\n${V.intro}\n${V.blocked}\n\n${V.virusName} ${details.virusName}\n${V.filename} ${details.filename}\n${V.fileSize} ${fileSizeFormatted}\n${V.uploader} ${details.uploaderEmail || V.anonymous}\n${V.ip} ${details.requestIp || V.notAvailable}\n${V.time} ${scannedAtText}\n\n${V.action}`;

    return { subject, bodyHtml, plainText };
  }

  async sendVirusDetectionAlert(
    adminEmails: string[],
    details: {
      filename: string;
      fileSize: number;
      virusName: string;
      uploaderEmail?: string | null;
      requestIp?: string | null;
      scannedAt: Date;
    }
  ): Promise<void> {
    if (adminEmails.length === 0) {
      console.log('[Email] No admin emails configured for virus alerts');
      return;
    }

    try {
      const groups = await groupRecipientsByLanguage(adminEmails, email => email);
      for (const [lang, emails] of groups) {
        const alert = this.buildVirusAlert(lang, details);
        const rendered = await emailTemplateService.wrapWithEmailTheme(alert.subject, alert.bodyHtml, alert.plainText, lang);

        for (const adminEmail of emails) {
          await this.sendMail({
            to: adminEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            priority: 'high',
            fromPrefix: 'Security',
          });
          console.log(`[Email] Virus detection alert sent to ${adminEmail}`);
        }
      }
    } catch (error) {
      console.error('Failed to send virus detection alert:', error);
    }
  }

  async sendWelcomeEmail(email: string, userName: string, verificationLink: string, languageHint?: EmailLanguage): Promise<void> {
    try {
      const lang = await resolveEmailLanguage(email, languageHint);
      const rendered = await this.renderTemplate('welcome', {
        userName,
        userEmail: email,
        verificationLink: validateEmailUrl(verificationLink),
      }, lang);

      await this.sendMail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      console.log(`[Email] Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendDeletionRequestNotification(adminEmails: string[], userName: string, userEmail: string, adminPanelUrl: string): Promise<void> {
    try {
      const validatedUrl = validateEmailUrl(adminPanelUrl);
      const now = new Date();
      const groups = await groupRecipientsByLanguage(adminEmails, email => email);
      for (const [lang, emails] of groups) {
        const D = emailStrings(lang).deletion;
        const requestDate = now.toLocaleString(emailLocale(lang), { dateStyle: 'medium', timeStyle: 'short' });
        const subject = D.subject;
        const bodyHtml = `
        <div style="padding: 16px 24px;">
          <h2 class="email-heading" style="margin: 0 0 16px 0;">${D.heading}</h2>
          <p class="email-text" style="margin-bottom: 16px;">
            ${D.intro}
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">${D.user}</td>
              <td style="padding: 8px 0;">${escapeHtml(userName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: bold;">${D.email}</td>
              <td style="padding: 8px 0;">${escapeHtml(userEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">${D.date}</td>
              <td style="padding: 8px 0;">${requestDate}</td>
            </tr>
          </table>
          <p class="email-text" style="margin-top: 16px;">
            <a href="${escapeHtml(validatedUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 6px;">${D.button}</a>
          </p>
        </div>
      `;

        const plainText = `${D.heading}\n\n${D.intro}\n\n${D.user} ${userName}\n${D.email} ${userEmail}\n${D.date} ${requestDate}\n\n${D.button}: ${validatedUrl}`;

        const rendered = await emailTemplateService.wrapWithEmailTheme(subject, bodyHtml, plainText, lang);

        for (const adminEmail of emails) {
          await this.sendMail({
            to: adminEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            priority: 'high',
          });
          console.log(`[Email] Deletion request notification sent to ${adminEmail}`);
        }
      }
    } catch (error) {
      console.error('Failed to send deletion request notification:', error);
    }
  }

  async sendBulkInvitations(emails: string[], pollTitle: string, senderName: string, pollUrl: string, customMessage?: string): Promise<{ sent: number; failed: string[]; smtpConfigured: boolean }> {
    if (!this.isConfigured || !this.transporter) {
      return { sent: 0, failed: emails, smtpConfigured: false };
    }
    
    const failed: string[] = [];
    let sent = 0;

    for (const email of emails) {
      try {
        await this.sendInvitationEmail(email, senderName, pollTitle, pollUrl, customMessage);
        sent++;
      } catch (error) {
        console.error(`Failed to send invitation to ${email}:`, error);
        failed.push(email);
      }
    }

    return { sent, failed, smtpConfigured: true };
  }

  async sendOrgConfirmationEmails(
    pollTitle: string,
    pollLink: string,
    options: Array<{ id: number; text: string }>,
    votes: Array<{ optionId: number; voterEmail: string; voterName: string; response: string }>,
    organizerEmail: string | null
  ): Promise<{ sent: number; failed: number }> {
    const validatedLink = validateEmailUrl(pollLink);
    const optionMap = new Map<number, string>(options.map(o => [o.id, o.text]));

    // Group yes-votes by voter email → their booked slots (email-gated: for participant notifications only)
    const voterSlots = new Map<string, { name: string; slots: string[] }>();
    // Full slot→names map for organizer summary (includes all yes-votes, even without email)
    const allSlotNamesMap = new Map<string, string[]>();
    for (const vote of votes) {
      if (vote.response !== 'yes') continue;
      const slotName = optionMap.get(vote.optionId);
      // Full summary for organizer (all yes-votes, regardless of email)
      if (slotName) {
        if (!allSlotNamesMap.has(slotName)) allSlotNamesMap.set(slotName, []);
        allSlotNamesMap.get(slotName)!.push(vote.voterName);
      }
      // Participant notification (email-gated)
      if (vote.voterEmail && vote.voterEmail.includes('@')) {
        if (!voterSlots.has(vote.voterEmail)) {
          voterSlots.set(vote.voterEmail, { name: vote.voterName, slots: [] });
        }
        if (slotName) voterSlots.get(vote.voterEmail)!.slots.push(slotName);
      }
    }

    let sent = 0;
    let failed = 0;

    // Personalized email per participant listing only their own booked slots
    for (const [email, { slots }] of voterSlots.entries()) {
      if (slots.length === 0) continue;
      try {
        const lang = await resolveEmailLanguage(email);
        const F = emailStrings(lang).finalized;
        const slotSummaryHtml = `<ul style="margin:8px 0 0 0;padding-left:18px;">${
          slots.map(s => `<li style="margin:2px 0;">${escapeHtml(s)}</li>`).join('')
        }</ul>`;
        const rendered = await this.renderTemplate('poll_finalized', {
          pollType: 'organization',
          statusLabel: F.orgConfirmedStatus,
          pollTitle,
          pollLink: validatedLink,
          buttonLink: validatedLink,
          buttonLabel: F.orgConfirmedButton,
          resultsPublic: 'true',
          slotSummaryHtml,
        }, lang);
        await this.sendMail({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text, isBulk: true });
        sent++;
        console.log(`[Email] Org confirmation sent to ${email}`);
      } catch (err) {
        console.error(`[Email] Org confirmation to ${email} failed:`, err);
        failed++;
      }
    }

    // Organizer always gets the full participant-list summary (all yes-votes, including no-email participants)
    if (organizerEmail && organizerEmail.includes('@')) {
      try {
        const lang = await resolveEmailLanguage(organizerEmail);
        const F = emailStrings(lang).finalized;
        const slotSummaryHtml = allSlotNamesMap.size > 0
          ? `<ul style="margin:8px 0 0 0;padding-left:18px;">${
              [...allSlotNamesMap.entries()].map(([slot, names]) =>
                `<li style="margin:2px 0;"><strong>${escapeHtml(slot)}:</strong> ${names.map(n => escapeHtml(n)).join(', ')}</li>`
              ).join('')
            }</ul>`
          : '';
        const rendered = await this.renderTemplate('poll_finalized', {
          pollType: 'organization',
          statusLabel: F.orgSummaryStatus,
          pollTitle,
          pollLink: validatedLink,
          buttonLink: validatedLink,
          buttonLabel: F.orgSummaryButton,
          resultsPublic: 'true',
          slotSummaryHtml,
        }, lang);
        await this.sendMail({ to: organizerEmail, subject: rendered.subject, html: rendered.html, text: rendered.text, isBulk: true });
        sent++;
        console.log(`[Email] Org summary sent to organizer ${organizerEmail}`);
      } catch (err) {
        console.error(`[Email] Org summary to ${organizerEmail} failed:`, err);
        failed++;
      }
    }

    console.log(`[Email] Org confirmation complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  async sendBulkReminders(emails: string[], pollTitle: string, senderName: string, pollUrl: string, expiresAt?: string, customMessage?: string): Promise<{ sent: number; failed: string[] }> {
    const failed: string[] = [];
    let sent = 0;

    for (const email of emails) {
      try {
        await this.sendReminderEmail(email, senderName, pollTitle, pollUrl, expiresAt ? new Date(expiresAt) : null);
        sent++;
      } catch (error) {
        console.error(`Failed to send reminder to ${email}:`, error);
        failed.push(email);
      }
    }

    return { sent, failed };
  }

  async sendPersonalizedReminders(
    reminders: Array<{ email: string; selectedOptions?: string[] }>,
    pollTitle: string,
    senderName: string,
    pollUrl: string,
    expiresAt?: string
  ): Promise<{ sent: number; failed: string[] }> {
    const failed: string[] = [];
    let sent = 0;

    for (const reminder of reminders) {
      try {
        await this.sendReminderEmail(
          reminder.email,
          senderName,
          pollTitle,
          pollUrl,
          expiresAt ? new Date(expiresAt) : null,
          reminder.selectedOptions
        );
        sent++;
      } catch (error) {
        console.error(`Failed to send personalized reminder to ${reminder.email}:`, error);
        failed.push(reminder.email);
      }
    }

    return { sent, failed };
  }
}

export const emailService = new EmailService();
