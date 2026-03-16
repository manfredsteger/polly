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

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  get smtpConfigured(): boolean {
    return this.isConfigured;
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

    if (hasSmtpConfig) {
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

  async sendPollCreationEmails(
    creatorEmail: string,
    pollTitle: string,
    publicLink: string,
    adminLink: string,
    pollType: 'schedule' | 'survey' | 'organization'
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`Email would be sent to ${creatorEmail} for poll: ${pollTitle}`);
      console.log(`Public link: ${publicLink}`);
      console.log(`Admin link: ${adminLink}`);
      return;
    }

    try {
      const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : pollType === 'organization' ? 'Orga-Liste' : 'Umfrage';

      const rendered = await this.renderTemplate('poll_created', {
        pollTitle,
        pollType: pollTypeText,
        publicLink: validateEmailUrl(publicLink),
        adminLink: validateEmailUrl(adminLink),
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: creatorEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Reply-To': this.getReplyTo(),
        },
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
    if (!this.isConfigured || !this.transporter) {
      console.log(`Invitation email would be sent to ${inviteeEmail} for poll: ${pollTitle}`);
      return;
    }

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

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: inviteeEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Reply-To': this.getReplyTo(),
        },
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
    if (!this.isConfigured || !this.transporter || !voterEmail) {
      console.log(`Voting confirmation email would be sent to ${voterEmail} for poll: ${pollTitle}`);
      return;
    }

    try {
      const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : 'Umfrage';

      const rendered = await this.renderTemplate('vote_confirmation', {
        voterName,
        pollTitle,
        pollType: pollTypeText,
        publicLink: validateEmailUrl(publicLink),
        resultsLink: validateEmailUrl(resultsLink),
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: voterEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'Reply-To': this.getReplyTo(),
        },
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
    if (!this.isConfigured || !this.transporter) {
      console.log(`Reminder email would be sent to ${recipientEmail} for poll: ${pollTitle}`);
      return;
    }

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

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Reply-To': this.getReplyTo(),
        },
      });
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string, userName?: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Password reset would be sent to ${email}`);
      console.log(`[Email] Reset link: ${resetLink}`);
      return;
    }

    try {
      const rendered = await this.renderTemplate('password_reset', {
        userName: userName || '',
        resetLink: validateEmailUrl(resetLink),
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
        },
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  async sendEmailChangeConfirmation(oldEmail: string, newEmail: string, confirmLink: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Email change confirmation would be sent to ${newEmail}`);
      console.log(`[Email] Confirm link: ${confirmLink}`);
      return;
    }

    try {
      const rendered = await this.renderTemplate('email_change', {
        oldEmail,
        newEmail,
        confirmLink: validateEmailUrl(confirmLink),
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: newEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
        },
      });
    } catch (error) {
      console.error('Failed to send email change confirmation:', error);
      throw error;
    }
  }

  async sendPasswordChangedEmail(email: string, userName?: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.warn(`[Email] Cannot send password changed email - SMTP not configured`);
      return;
    }

    try {
      const rendered = await this.renderTemplate('password_changed', {
        userName: userName || '',
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
        },
      });
      console.log(`[Email] Password changed notification sent to ${email}`);
    } catch (error) {
      console.error(`[Password Changed] Failed to send notification to ${email}:`, error);
    }
  }

  async sendPasswordChangedNotification(email: string): Promise<void> {
    return this.sendPasswordChangedEmail(email);
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
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Test report would be sent to ${recipientEmail}`);
      console.log(`[Email] Test run #${testRun.id}: ${testRun.passed}/${testRun.totalTests} passed`);
      return;
    }

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

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.getFromAddress(),
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': isSuccess ? '3' : '1',
        },
      };

      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `testbericht-${testRun.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }];
      }

      await this.transporter.sendMail(mailOptions);
      console.log(`[Email] Test report sent to ${recipientEmail} for run #${testRun.id}`);
    } catch (error) {
      console.error('Failed to send test report email:', error);
      throw error;
    }
  }

  async sendCustomEmail(
    recipientEmail: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Custom email would be sent to ${recipientEmail}`);
      console.log(`[Email] Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipientEmail,
        subject,
        html,
        text,
        headers: {
          'X-Mailer': 'Polly System',
        },
      });
      console.log(`[Email] Custom email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send custom email:', error);
      throw error;
    }
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
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Virus detection alert would be sent to ${adminEmails.join(', ')}`);
      console.log(`[Email] Virus detected: ${details.virusName} in ${details.filename}`);
      return;
    }

    if (adminEmails.length === 0) {
      console.log('[Email] No admin emails configured for virus alerts');
      return;
    }

    const fileSizeFormatted = details.fileSize < 1024 
      ? `${details.fileSize} Bytes` 
      : details.fileSize < 1024 * 1024 
        ? `${(details.fileSize / 1024).toFixed(2)} KB`
        : `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`;

    const subject = `[Polly Security Alert] Virus erkannt: ${details.virusName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">⚠️ Sicherheitswarnung: Virus erkannt</h2>
        </div>
        
        <div style="background-color: #fff5f5; border: 1px solid #dc3545; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
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
          
          <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
            Diese Benachrichtigung können Sie im Admin-Panel unter Sicherheit → ClamAV → Scan-Protokoll einsehen.
          </p>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
        <p style="color: #6c757d; font-size: 12px; text-align: center;">
          Automatische Sicherheitsbenachrichtigung von Polly<br>
          Open-Source Abstimmungsplattform für Teams
        </p>
      </div>
    `;

    const text = `
POLLY SECURITY ALERT - Virus erkannt!

ClamAV hat einen Virus in einer hochgeladenen Datei erkannt.
Die Datei wurde automatisch blockiert und nicht gespeichert.

Erkannter Virus: ${details.virusName}
Dateiname: ${details.filename}
Dateigröße: ${fileSizeFormatted}
Uploader: ${details.uploaderEmail || 'Anonym / Unbekannt'}
IP-Adresse: ${details.requestIp || 'Nicht verfügbar'}
Zeitpunkt: ${details.scannedAt.toLocaleString('de-DE')}

Die infizierte Datei wurde abgelehnt und nicht im System gespeichert.
    `.trim();

    try {
      for (const adminEmail of adminEmails) {
        await this.transporter.sendMail({
          from: this.getFromAddress('Security'),
          to: adminEmail,
          subject,
          html,
          text,
          headers: {
            'X-Mailer': 'Polly System',
            'X-Priority': '1',
            'X-MSMail-Priority': 'High',
            'Importance': 'high',
          },
        });
        console.log(`[Email] Virus detection alert sent to ${adminEmail}`);
      }
    } catch (error) {
      console.error('Failed to send virus detection alert:', error);
    }
  }

  async sendWelcomeEmail(email: string, userName: string, verificationLink: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Welcome email would be sent to ${email}`);
      console.log(`[Email] Verification link: ${verificationLink}`);
      return;
    }

    try {
      const rendered = await this.renderTemplate('welcome', {
        userName,
        userEmail: email,
        verificationLink: validateEmailUrl(verificationLink),
      });

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Mailer': 'Polly System',
          'X-Priority': '3',
        },
      });
      console.log(`[Email] Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendDeletionRequestNotification(adminEmails: string[], userName: string, userEmail: string, adminPanelUrl: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Deletion request notification would be sent to admins for user ${userEmail}`);
      return;
    }

    try {
      const requestDate = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
      const subject = '[Polly] Neuer Löschantrag eingegangen';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Neuer Löschantrag</h2>
          
          <p>Ein Benutzer hat die Löschung seines Kontos beantragt (DSGVO Art. 17).</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Benutzer:</strong> ${escapeHtml(userName || 'Unbekannt')}</p>
            <p><strong>E-Mail:</strong> ${escapeHtml(userEmail)}</p>
            <p><strong>Zeitpunkt:</strong> ${requestDate}</p>
          </div>
          
          <p>Bitte bearbeiten Sie den Löschantrag innerhalb eines Monats gemäß DSGVO.</p>
          
          <div style="margin: 20px 0;">
            <a href="${validateEmailUrl(adminPanelUrl)}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Löschanträge verwalten</a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von Polly erstellt.<br>
            Open-Source Abstimmungsplattform für Teams
          </p>
        </div>
      `;
      const text = `Neuer Löschantrag\n\nEin Benutzer hat die Löschung seines Kontos beantragt.\n\nBenutzer: ${userName || 'Unbekannt'}\nE-Mail: ${userEmail}\nZeitpunkt: ${requestDate}\n\nBitte bearbeiten Sie den Löschantrag: ${validateEmailUrl(adminPanelUrl)}`;

      for (const adminEmail of adminEmails) {
        try {
          await this.transporter.sendMail({
            from: this.getFromAddress(),
            to: adminEmail,
            subject,
            html,
            text,
            headers: {
              'X-Mailer': 'Polly System',
              'X-Priority': '1',
            },
          });
        } catch (error) {
          console.error(`[Email] Failed to send deletion notification to admin ${adminEmail}:`, error);
        }
      }
      console.log(`[GDPR] Deletion request notification sent to ${adminEmails.length} admin(s)`);
    } catch (error) {
      console.error('[Email] Failed to send deletion request notifications:', error);
    }
  }

  async sendBulkInvitations(emails: string[], pollTitle: string, senderName: string, pollUrl: string, customMessage?: string): Promise<{ sent: number; failed: string[]; smtpConfigured: boolean }> {
    const failed: string[] = [];
    let sent = 0;

    if (!this.isConfigured || !this.transporter) {
      console.warn('[Email] SMTP not configured - invitations cannot be sent');
      return { sent: 0, failed: emails, smtpConfigured: false };
    }

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
