import nodemailer from 'nodemailer';
import { qrService } from './qrService';

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

  constructor() {
    // Check if SMTP is properly configured
    const hasSmtpConfig = process.env.SMTP_HOST && 
                         process.env.SMTP_USER && 
                         process.env.SMTP_PASS;

    if (hasSmtpConfig) {
      const config: EmailConfig = {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      };

      // Additional anti-spam configuration with reduced timeouts
      const transporterOptions = {
        ...config,
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
        rateDelta: 20000, // 20 seconds between messages
        rateLimit: 3, // max 3 messages per rateDelta
        dnsTimeout: 10000, // 10 seconds
        connectionTimeout: 15000, // 15 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 15000, // 15 seconds
      };

      this.transporter = nodemailer.createTransport(transporterOptions);
      this.isConfigured = true;
    } else {
      console.warn('SMTP not configured. Email notifications will be disabled.');
      this.isConfigured = false;
    }
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
      return; // Skip sending email if not configured
    }

    try {
    const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : pollType === 'organization' ? 'Orga' : 'Umfrage';
    
    // Admin email
    const adminSubject = `[KITA Poll] Ihre ${pollTypeText} wurde erstellt: ${pollTitle}`;
    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF6B35;">Ihre ${pollTypeText} wurde erfolgreich erstellt!</h2>
        
        <p>Hallo,</p>
        
        <p>Ihre ${pollTypeText} "<strong>${pollTitle}</strong>" wurde erfolgreich erstellt.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #212529; margin-top: 0;">Administratorlink (nur für Sie):</h3>
          <p>Mit diesem Link können Sie Ihre Umfrage verwalten, bearbeiten und löschen:</p>
          <a href="${adminLink}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Umfrage verwalten</a>
        </div>
        
        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #212529; margin-top: 0;">Öffentlicher Link zum Teilen:</h3>
          <p>Teilen Sie diesen Link mit den Teilnehmern:</p>
          <a href="${publicLink}" style="background-color: #4A90A4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Zur Abstimmung</a>
        </div>
        
        <p><strong>Wichtig:</strong> Bewahren Sie den Administratorlink sicher auf. Nur damit können Sie Ihre Umfrage verwalten.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
        <p style="color: #6c757d; font-size: 14px;">
          Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
          Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
      to: creatorEmail,
      subject: adminSubject,
      html: adminHtml,
      text: adminHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      headers: {
        'X-Mailer': 'KITA Poll System',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Reply-To': process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de',
      },
    });
    } catch (error) {
      console.error('Failed to send poll creation email:', error);
      // Don't throw error - just log it so poll creation continues
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
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await qrService.generateQRCode(pollLink, 'png');
    } catch (qrError) {
      console.error('Failed to generate QR code for email:', qrError);
    }
    
    const subject = `Einladung zur Abstimmung: ${pollTitle}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF6B35;">Sie wurden zur Abstimmung eingeladen</h2>
        
        <p>Hallo,</p>
        
        <p><strong>${inviterName}</strong> hat Sie zur Teilnahme an der Umfrage "<strong>${pollTitle}</strong>" eingeladen.</p>
        
        ${customMessage ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #FF6B35;">
            <p style="margin: 0; font-style: italic;">"${customMessage}"</p>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${pollLink}" style="background-color: #FF6B35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Jetzt abstimmen</a>
        </div>
        
        ${qrCodeDataUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 15px 0; font-weight: bold; color: #495057;">Oder scannen Sie den QR-Code:</p>
          <img src="${qrCodeDataUrl}" alt="QR-Code zur Umfrage" style="width: 180px; height: 180px; border: 1px solid #dee2e6; border-radius: 4px;" />
        </div>
        ` : ''}
        
        <div style="background-color: #e8f4f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 5px 0; font-weight: bold; color: #495057;">Direkter Link:</p>
          <p style="word-break: break-all; margin: 0;"><a href="${pollLink}" style="color: #4A90A4;">${pollLink}</a></p>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
        <p style="color: #6c757d; font-size: 14px;">
          Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
          Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
      to: inviteeEmail,
      subject,
      html,
      text: `Sie wurden zur Abstimmung "${pollTitle}" eingeladen.\n\nLink: ${pollLink}\n\n${customMessage ? 'Nachricht: ' + customMessage + '\n\n' : ''}Diese E-Mail wurde automatisch von KITA Poll erstellt.`,
      headers: {
        'X-Mailer': 'KITA Poll System',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Reply-To': process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de',
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
      const subject = `KITA Poll - ${pollTitle}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #FF6B35;">Vielen Dank für Ihre Teilnahme!</h2>
          
          <p>Hallo ${voterName},</p>
          
          <p>vielen Dank für Ihre Teilnahme an der ${pollTypeText} "<strong>${pollTitle}</strong>".</p>
          <p>Ihre Stimme wurde erfolgreich gespeichert.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">Ihr persönlicher Link:</h3>
            <p>Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren:</p>
            <a href="${publicLink}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Zur Umfrage</a>
          </div>
          
          <div style="background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">Ergebnisse ansehen:</h3>
            <p>Hier können Sie die aktuellen Ergebnisse einsehen:</p>
            <a href="${resultsLink}" style="background-color: #4A90A4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ergebnisse anzeigen</a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: voterEmail,
        subject,
        html,
        text: `Hallo ${voterName},

vielen Dank für Ihre Teilnahme an der ${pollTypeText} "${pollTitle}".
Ihre Stimme wurde erfolgreich gespeichert.

IHR PERSÖNLICHER LINK:
${publicLink}

ERGEBNISSE ANSEHEN:
${resultsLink}

Diese E-Mail wurde automatisch von KITA Poll erstellt.
Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)`,
        headers: {
          'Reply-To': process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de',
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
      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await qrService.generateQRCode(pollLink, 'png');
      } catch (qrError) {
        console.error('Failed to generate QR code for reminder email:', qrError);
      }

      const expiryText = expiresAt 
        ? `<p style="color: #dc3545; font-weight: bold;">⏰ Die Umfrage endet am ${new Date(expiresAt).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr!</p>`
        : '';

      const subject = `Erinnerung: Ihre Teilnahme wird benötigt - ${pollTitle}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">📣 Erinnerung zur Abstimmung</h2>
          
          <p>Hallo,</p>
          
          <p><strong>${senderName}</strong> erinnert Sie freundlich an die Teilnahme an der Umfrage "<strong>${pollTitle}</strong>".</p>
          
          <p>Ihre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.</p>
          
          ${expiryText}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${pollLink}" style="background-color: #FF6B35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Jetzt abstimmen</a>
          </div>
          
          ${qrCodeDataUrl ? `
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #495057;">Oder scannen Sie den QR-Code:</p>
            <img src="${qrCodeDataUrl}" alt="QR-Code zur Umfrage" style="width: 150px; height: 150px; border: 1px solid #dee2e6; border-radius: 4px;" />
          </div>
          ` : ''}
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #495057;">Direkter Link:</p>
            <p style="word-break: break-all; margin: 0;"><a href="${pollLink}" style="color: #4A90A4;">${pollLink}</a></p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: recipientEmail,
        subject,
        html,
        text: `Erinnerung: Ihre Teilnahme wird benötigt\n\n${senderName} erinnert Sie an die Umfrage "${pollTitle}".\n\n${expiresAt ? 'Die Umfrage endet am ' + new Date(expiresAt).toLocaleDateString('de-DE') + '!\n\n' : ''}Link: ${pollLink}\n\nDiese E-Mail wurde automatisch von KITA Poll erstellt.`,
        headers: {
          'X-Mailer': 'KITA Poll System',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Reply-To': process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de',
        },
      });
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }
    
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Password reset would be sent to ${email}`);
      console.log(`[Email] Reset link: ${resetLink}`);
      return;
    }

    try {
      const subject = '[KITA Poll] Passwort zurücksetzen';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Passwort zurücksetzen</h2>
          
          <p>Hallo,</p>
          
          <p>Sie haben angefordert, Ihr Passwort für Ihren KITA Poll Account zurückzusetzen.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben:</p>
            <a href="${resetLink}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Passwort zurücksetzen</a>
          </div>
          
          <p><strong>Dieser Link ist 1 Stunde gültig.</strong></p>
          
          <p style="color: #6c757d;">Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: email,
        subject,
        html,
        text: `Passwort zurücksetzen\n\nSie haben angefordert, Ihr Passwort zurückzusetzen.\n\nKlicken Sie auf den folgenden Link:\n${resetLink}\n\nDieser Link ist 1 Stunde gültig.\n\nFalls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.`,
        headers: {
          'X-Mailer': 'KITA Poll System',
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
      const subject = '[KITA Poll] E-Mail-Adresse bestätigen';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">E-Mail-Adresse bestätigen</h2>
          
          <p>Hallo,</p>
          
          <p>Sie haben angefordert, Ihre E-Mail-Adresse für Ihren KITA Poll Account zu ändern.</p>
          
          <p><strong>Alte E-Mail:</strong> ${oldEmail}<br>
          <strong>Neue E-Mail:</strong> ${newEmail}</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Klicken Sie auf den folgenden Button, um Ihre neue E-Mail-Adresse zu bestätigen:</p>
            <a href="${confirmLink}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">E-Mail bestätigen</a>
          </div>
          
          <p><strong>Dieser Link ist 24 Stunden gültig.</strong></p>
          
          <p style="color: #6c757d;">Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihre E-Mail-Adresse bleibt unverändert.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: newEmail,
        subject,
        html,
        text: `E-Mail-Adresse bestätigen\n\nSie haben angefordert, Ihre E-Mail-Adresse zu ändern.\n\nAlte E-Mail: ${oldEmail}\nNeue E-Mail: ${newEmail}\n\nKlicken Sie auf den folgenden Link:\n${confirmLink}\n\nDieser Link ist 24 Stunden gültig.\n\nFalls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.`,
        headers: {
          'X-Mailer': 'KITA Poll System',
          'X-Priority': '3',
        },
      });
    } catch (error) {
      console.error('Failed to send email change confirmation:', error);
      throw error;
    }
  }

  async sendPasswordChangedNotification(email: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Password changed notification would be sent to ${email}`);
      return;
    }

    try {
      const subject = '[KITA Poll] Ihr Passwort wurde geändert';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Passwort wurde geändert</h2>
          
          <p>Hallo,</p>
          
          <p>Ihr Passwort für Ihren KITA Poll Account wurde erfolgreich geändert.</p>
          
          <p style="color: #6c757d;">Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie bitte umgehend den Support.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch von KITA Poll erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"KITA Poll" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: email,
        subject,
        html,
        text: `Passwort wurde geändert\n\nIhr Passwort für Ihren KITA Poll Account wurde erfolgreich geändert.\n\nFalls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie bitte umgehend den Support.`,
        headers: {
          'X-Mailer': 'KITA Poll System',
          'X-Priority': '3',
        },
      });
    } catch (error) {
      console.error('Failed to send password changed notification:', error);
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
    if (!this.isConfigured || !this.transporter) {
      console.log(`[Email] Test report would be sent to ${recipientEmail}`);
      console.log(`[Email] Test run #${testRun.id}: ${testRun.passed}/${testRun.totalTests} passed`);
      return;
    }

    try {
      const isSuccess = testRun.status === 'completed' && testRun.failed === 0;
      const statusEmoji = isSuccess ? '✅' : '❌';
      const statusText = isSuccess ? 'Alle Tests bestanden' : `${testRun.failed} Test(s) fehlgeschlagen`;
      const statusColor = isSuccess ? '#28a745' : '#dc3545';
      
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

      const subject = `${statusEmoji} [KITA Poll] Testbericht #${testRun.id}: ${statusText}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">${statusEmoji} Automatischer Testbericht</h2>
          
          <p>Hallo,</p>
          
          <p>Der automatische Testlauf <strong>#${testRun.id}</strong> wurde abgeschlossen.</p>
          
          <div style="background-color: ${isSuccess ? '#d4edda' : '#f8d7da'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <h3 style="color: ${statusColor}; margin-top: 0;">${statusText}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Gesamte Tests:</td>
                <td style="padding: 5px 0; font-weight: bold;">${testRun.totalTests}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Bestanden:</td>
                <td style="padding: 5px 0; font-weight: bold; color: #28a745;">${testRun.passed}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Fehlgeschlagen:</td>
                <td style="padding: 5px 0; font-weight: bold; color: ${testRun.failed > 0 ? '#dc3545' : '#495057'};">${testRun.failed}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Übersprungen:</td>
                <td style="padding: 5px 0; font-weight: bold; color: #ffc107;">${testRun.skipped}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Dauer:</td>
                <td style="padding: 5px 0;">${durationText}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Gestartet:</td>
                <td style="padding: 5px 0;">${startedAtText}</td>
              </tr>
              <tr>
                <td style="padding: 5px 10px 5px 0; color: #495057;">Ausgelöst durch:</td>
                <td style="padding: 5px 0;">${testRun.triggeredBy === 'scheduled' ? 'Zeitplan' : 'Manuell'}</td>
              </tr>
            </table>
          </div>
          
          ${pdfBuffer ? `
          <p style="background-color: #e8f4f8; padding: 15px; border-radius: 6px;">
            📎 Der vollständige Testbericht ist als PDF angehängt.
          </p>
          ` : ''}
          
          ${testRun.failed > 0 ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Achtung:</strong> Es sind Tests fehlgeschlagen. 
              Bitte überprüfen Sie die Details im Admin-Dashboard oder im angehängten PDF-Bericht.
            </p>
          </div>
          ` : ''}
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 14px;">
            Diese E-Mail wurde automatisch vom KITA Poll Testsystem erstellt.<br>
            Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP)
          </p>
        </div>
      `;

      const textContent = `Automatischer Testbericht #${testRun.id}

Status: ${statusText}
Gesamte Tests: ${testRun.totalTests}
Bestanden: ${testRun.passed}
Fehlgeschlagen: ${testRun.failed}
Übersprungen: ${testRun.skipped}
Dauer: ${durationText}
Gestartet: ${startedAtText}
Ausgelöst durch: ${testRun.triggeredBy === 'scheduled' ? 'Zeitplan' : 'Manuell'}

${pdfBuffer ? 'Der vollständige Testbericht ist als PDF angehängt.' : ''}

Diese E-Mail wurde automatisch vom KITA Poll Testsystem erstellt.`;

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"KITA Poll Tests" <${process.env.FROM_EMAIL || 'noreply@kita-poll.bayern.de'}>`,
        to: recipientEmail,
        subject,
        html,
        text: textContent,
        headers: {
          'X-Mailer': 'KITA Poll Test System',
          'X-Priority': testRun.failed > 0 ? '1' : '3',
          'X-MSMail-Priority': testRun.failed > 0 ? 'High' : 'Normal',
        },
      };

      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `testbericht-${testRun.id}-${new Date().toISOString().split('T')[0]}.pdf`,
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
}

export const emailService = new EmailService();
