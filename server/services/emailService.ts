import nodemailer from 'nodemailer';
import { qrService } from './qrService';
import { emailTemplateService } from './emailTemplateService';
import type { EmailTemplateType } from '@shared/schema';
import { getBaseUrl, validateEmailUrl, warnIfLocalhostInProduction } from '../utils/baseUrl';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    variables: Record<string, string | undefined>
  ): Promise<{ subject: string; html: string; text: string }> {
    return emailTemplateService.renderEmail(type, variables);
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
    isRegisteredUser: boolean = false
  ): Promise<void> {
    try {
      const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : pollType === 'organization' ? 'Orga-Liste' : 'Umfrage';

      const rendered = await this.renderTemplate('poll_created', {
        pollTitle,
        pollType: pollTypeText,
        publicLink: validateEmailUrl(publicLink),
        adminLink: validateEmailUrl(adminLink),
        isRegisteredUser: isRegisteredUser ? 'true' : '',
      });

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

      const rendered = await this.renderTemplate('invitation', {
        pollTitle,
        inviterName,
        publicLink: validatedLink,
        message: customMessage || '',
        qrCodeUrl: qrCodeDataUrl,
      });

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
    pollType: 'schedule' | 'survey',
    publicLink: string,
    resultsLink: string
  ): Promise<void> {
    if (!voterEmail) return;

    try {
      const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : 'Umfrage';

      const rendered = await this.renderTemplate('vote_confirmation', {
        voterName,
        pollTitle,
        pollType: pollTypeText,
        publicLink: validateEmailUrl(publicLink),
        resultsLink: validateEmailUrl(resultsLink),
      });

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

  async sendReminderEmail(
    recipientEmail: string,
    senderName: string,
    pollTitle: string,
    pollLink: string,
    expiresAt?: Date | null
  ): Promise<void> {
    try {
      const validatedLink = validateEmailUrl(pollLink);

      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await qrService.generateQRCode(validatedLink, 'png');
      } catch (qrError) {
        console.error('Failed to generate QR code for reminder email:', qrError);
      }

      const expiryText = expiresAt
        ? `Die Umfrage endet am ${new Date(expiresAt).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr.`
        : '';

      const rendered = await this.renderTemplate('reminder', {
        senderName,
        pollTitle,
        pollLink: validatedLink,
        expiresAt: expiryText,
        qrCodeUrl: qrCodeDataUrl,
      });

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

  async sendPasswordResetEmail(email: string, resetLink: string, userName?: string): Promise<void> {
    try {
      const rendered = await this.renderTemplate('password_reset', {
        userName: userName || '',
        resetLink: validateEmailUrl(resetLink),
      });

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

  async sendEmailChangeConfirmation(oldEmail: string, newEmail: string, confirmLink: string): Promise<void> {
    try {
      const rendered = await this.renderTemplate('email_change', {
        oldEmail,
        newEmail,
        confirmLink: validateEmailUrl(confirmLink),
      });

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

  async sendPasswordChangedEmail(email: string, userName?: string): Promise<void> {
    try {
      const rendered = await this.renderTemplate('password_changed', {
        userName: userName || '',
      });

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
    pdfBuffer?: Buffer
  ): Promise<void> {
    try {
      const isSuccess = testRun.status === 'completed' && testRun.failed === 0;
      const statusEmoji = isSuccess ? '✅' : '❌';
      const statusText = isSuccess ? 'Alle Tests bestanden' : `${testRun.failed} Test(s) fehlgeschlagen`;

      const durationText = testRun.duration 
        ? `${Math.round(testRun.duration / 1000)} Sekunden`
        : 'Unbekannt';
      
      const startedAtText = testRun.startedAt.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const rendered = await this.renderTemplate('test_report', {
        testRunId: String(testRun.id),
        status: `${statusEmoji} ${statusText}`,
        totalTests: String(testRun.totalTests),
        passed: String(testRun.passed),
        failed: String(testRun.failed),
        skipped: String(testRun.skipped),
        duration: durationText,
        startedAt: startedAtText,
      });

      const attachments: nodemailer.SendMailOptions['attachments'] = pdfBuffer
        ? [{ filename: `testbericht-${testRun.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        : undefined;

      await this.sendMail({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
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
    confirmedDate: string,
    confirmedTime: string,
    pollLink: string,
    icsBuffer: Buffer,
    videoConferenceUrl?: string | null
  ): Promise<{ sent: number; failed: number }> {
    if (participantEmails.length === 0) {
      console.log('[Email] No participant emails for finalization notification');
      return { sent: 0, failed: 0 };
    }

    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const videoConfHtml = videoConferenceUrl
      ? `<strong>Videokonferenz:</strong> <a href="${escapeHtml(videoConferenceUrl)}" style="color:#7A3800;text-decoration:underline;">${escapeHtml(videoConferenceUrl)}</a>`
      : '';

    const rendered = await this.renderTemplate('poll_finalized', {
      pollType: 'schedule',
      statusLabel: 'Termin bestätigt',
      pollTitle,
      confirmedDate,
      confirmedTime: confirmedTime ? `<strong>Uhrzeit:</strong> ${confirmedTime}` : '',
      pollLink,
      buttonLink: pollLink,
      buttonLabel: 'Zur Umfrage \u2192',
      videoConferenceUrl: videoConferenceUrl || '',
      videoConferenceHtml: videoConfHtml,
      resultsPublic: 'true',
    });

    const attachments: nodemailer.SendMailOptions['attachments'] = [
      {
        filename: 'termin.ics',
        content: icsBuffer,
        contentType: 'text/calendar; method=PUBLISH',
      },
    ];

    let sent = 0;
    let failed = 0;

    for (const email of participantEmails) {
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

    console.log(`[Email] Finalization notifications: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  async sendPollEndedEmails(
    recipientEmails: string[],
    pollTitle: string,
    pollLink: string,
    resultsPublic: boolean,
    pollType: 'survey' | 'organization' = 'survey'
  ): Promise<{ sent: number; failed: number }> {
    if (recipientEmails.length === 0) {
      console.log('[Email] No recipient emails for poll-ended notification');
      return { sent: 0, failed: 0 };
    }

    const buttonLabel = resultsPublic ? 'Ergebnisse anzeigen \u2192' : 'Zur Umfrage \u2192';
    const buttonLink = resultsPublic ? `${pollLink}#results` : pollLink;

    const rendered = await this.renderTemplate('poll_finalized', {
      pollType,
      statusLabel: 'Umfrage beendet',
      pollTitle,
      pollLink,
      buttonLink,
      buttonLabel,
      resultsPublic: String(resultsPublic),
      confirmedDate: '',
      confirmedTime: '',
      videoConferenceUrl: '',
      videoConferenceHtml: '',
    });

    let sent = 0;
    let failed = 0;

    for (const email of recipientEmails) {
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

    console.log(`[Email] Poll-ended notifications: ${sent} sent, ${failed} failed`);
    return { sent, failed };
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

    const fileSizeFormatted = details.fileSize < 1024 
      ? `${details.fileSize} Bytes` 
      : details.fileSize < 1024 * 1024 
        ? `${(details.fileSize / 1024).toFixed(2)} KB`
        : `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`;

    const subject = `[Polly Security Alert] Virus erkannt: ${escapeHtml(details.virusName)}`;
    const bodyHtml = `
      <div style="padding: 16px 24px;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 class="email-heading" style="margin: 0; font-size: 24px; color: white;">⚠️ Sicherheitswarnung: Virus erkannt</h2>
        </div>
        
        <div style="background-color: #fff5f5; border: 1px solid #dc3545; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p class="email-text" style="font-size: 16px; margin-bottom: 20px;">
            ClamAV hat einen Virus in einer hochgeladenen Datei erkannt. <strong>Die Datei wurde automatisch blockiert und nicht gespeichert.</strong>
          </p>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24; width: 140px;">Erkannter Virus:</td>
              <td style="padding: 10px 0; color: #dc3545; font-weight: bold;">${escapeHtml(details.virusName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">Dateiname:</td>
              <td style="padding: 10px 0;">${escapeHtml(details.filename)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">Dateigröße:</td>
              <td style="padding: 10px 0;">${fileSizeFormatted}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">Uploader:</td>
              <td style="padding: 10px 0;">${details.uploaderEmail ? escapeHtml(details.uploaderEmail) : 'Anonym / Unbekannt'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f5c6cb;">
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">IP-Adresse:</td>
              <td style="padding: 10px 0;">${details.requestIp || 'Nicht verfügbar'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #721c24;">Zeitpunkt:</td>
              <td style="padding: 10px 0;">${details.scannedAt.toLocaleString('de-DE')}</td>
            </tr>
          </table>
          
          <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="margin: 0; color: #155724;">
              <strong>✓ Automatische Maßnahme:</strong> Die infizierte Datei wurde abgelehnt und nicht im System gespeichert.
            </p>
          </div>
        </div>
      </div>
    `;

    const plainText = `POLLY SECURITY ALERT - Virus erkannt!\n\nClamAV hat einen Virus in einer hochgeladenen Datei erkannt.\nDie Datei wurde automatisch blockiert und nicht gespeichert.\n\nErkannter Virus: ${details.virusName}\nDateiname: ${details.filename}\nDateigröße: ${fileSizeFormatted}\nUploader: ${details.uploaderEmail || 'Anonym / Unbekannt'}\nIP-Adresse: ${details.requestIp || 'Nicht verfügbar'}\nZeitpunkt: ${details.scannedAt.toLocaleString('de-DE')}\n\nDie infizierte Datei wurde abgelehnt und nicht im System gespeichert.`;

    try {
      const rendered = await emailTemplateService.wrapWithEmailTheme(subject, bodyHtml, plainText);

      for (const adminEmail of adminEmails) {
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
    } catch (error) {
      console.error('Failed to send virus detection alert:', error);
    }
  }

  async sendWelcomeEmail(email: string, userName: string, verificationLink: string): Promise<void> {
    try {
      const rendered = await this.renderTemplate('welcome', {
        userName,
        userEmail: email,
        verificationLink: validateEmailUrl(verificationLink),
      });

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
      const requestDate = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
      const subject = '[Polly] Neuer Löschantrag eingegangen';
      const validatedUrl = validateEmailUrl(adminPanelUrl);
      const bodyHtml = `
        <div style="padding: 16px 24px;">
          <h2 class="email-heading" style="margin: 0 0 16px 0;">Neuer Löschantrag</h2>
          <p class="email-text" style="margin-bottom: 16px;">
            Ein Benutzer hat die Löschung seines Kontos beantragt:
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">Benutzer:</td>
              <td style="padding: 8px 0;">${escapeHtml(userName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: bold;">E-Mail:</td>
              <td style="padding: 8px 0;">${escapeHtml(userEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Datum:</td>
              <td style="padding: 8px 0;">${requestDate}</td>
            </tr>
          </table>
          <p class="email-text" style="margin-top: 16px;">
            <a href="${escapeHtml(validatedUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 6px;">Löschanträge verwalten</a>
          </p>
        </div>
      `;

      const plainText = `Neuer Löschantrag\n\nEin Benutzer hat die Löschung seines Kontos beantragt:\n\nBenutzer: ${userName}\nE-Mail: ${userEmail}\nDatum: ${requestDate}\n\nLöschanträge verwalten: ${validatedUrl}`;

      const rendered = await emailTemplateService.wrapWithEmailTheme(subject, bodyHtml, plainText);

      for (const adminEmail of adminEmails) {
        await this.sendMail({
          to: adminEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          priority: 'high',
        });
        console.log(`[Email] Deletion request notification sent to ${adminEmail}`);
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
}

export const emailService = new EmailService();
