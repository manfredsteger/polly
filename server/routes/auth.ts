import { Router } from "express";
import { storage } from "../storage";
import { authService } from "../services/authService";
import { tokenService } from "../services/tokenService";
import { emailService } from "../services/emailService";
import { z } from "zod";
import {
  extractUserId,
  requireAuth,
  loginSchema,
  registerSchema,
  loginRateLimiter,
  emailCheckRateLimits,
  EMAIL_CHECK_LIMIT,
  EMAIL_CHECK_WINDOW,
} from "./common";

const router = Router();

// Initialize Keycloak and Token validation (optional)
authService.initializeKeycloak().catch(console.error);
tokenService.initializeOIDC().catch(console.error);

// Get current user (supports both Cookie-Session and Bearer Token)
router.get('/me', async (req, res) => {
  try {
    const userId = await extractUserId(req);
    
    if (!userId) {
      return res.json({ user: null });
    }
    
    const user = req.tokenUser || await storage.getUser(userId);
    if (!user) {
      if (req.session?.userId) {
        req.session.destroy(() => {});
      }
      return res.json({ user: null });
    }
    res.json({ user: authService.sanitizeUser(user) });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Request account deletion (GDPR Art. 17)
router.post('/request-deletion', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Check if already requested
    if (user.deletionRequestedAt) {
      return res.status(400).json({ 
        error: 'Löschung wurde bereits beantragt',
        deletionRequestedAt: user.deletionRequestedAt 
      });
    }

    const updatedUser = await storage.requestDeletion(userId);
    console.log(`[GDPR] User ${user.email} requested account deletion`);
    
    res.json({ 
      success: true, 
      message: 'Ihr Löschantrag wurde erfolgreich übermittelt. Ein Administrator wird Ihren Antrag bearbeiten.',
      deletionRequestedAt: updatedUser.deletionRequestedAt
    });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Cancel deletion request
router.delete('/request-deletion', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (!user.deletionRequestedAt) {
      return res.status(400).json({ error: 'Kein Löschantrag vorhanden' });
    }

    const updatedUser = await storage.cancelDeletionRequest(userId);
    console.log(`[GDPR] User ${user.email} cancelled deletion request`);
    
    res.json({ 
      success: true, 
      message: 'Ihr Löschantrag wurde zurückgezogen.',
      user: authService.sanitizeUser(updatedUser)
    });
  } catch (error) {
    console.error('Error cancelling deletion request:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Check auth methods available
router.get('/methods', async (req, res) => {
  try {
    const registrationSetting = await storage.getSetting('registration_enabled');
    const registrationEnabled = registrationSetting?.value !== false;
    
    // Build Keycloak account URL if configured
    let keycloakAccountUrl: string | undefined;
    if (authService.isKeycloakEnabled() && process.env.KEYCLOAK_ISSUER_URL) {
      keycloakAccountUrl = `${process.env.KEYCLOAK_ISSUER_URL}/account`;
    }
    
    res.json({
      local: true,
      keycloak: authService.isKeycloakEnabled(),
      bearerToken: tokenService.isOIDCEnabled(),
      registrationEnabled,
      keycloakAccountUrl,
    });
  } catch (error) {
    console.error('Error getting auth methods:', error);
    res.json({
      local: true,
      keycloak: authService.isKeycloakEnabled(),
      bearerToken: tokenService.isOIDCEnabled(),
      registrationEnabled: true,
    });
  }
});

// Check if email belongs to a registered user (for voting security)
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'E-Mail ist erforderlich' });
    }

    // Validate email format
    const emailSchema = z.string().email();
    try {
      emailSchema.parse(email);
    } catch {
      return res.status(400).json({ error: 'Ungültiges E-Mail-Format' });
    }

    // Rate limiting by IP
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rateLimit = emailCheckRateLimits.get(clientIP);
    
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= EMAIL_CHECK_LIMIT) {
          return res.status(429).json({ 
            error: 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
            retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000)
          });
        }
        rateLimit.count++;
      } else {
        rateLimit.count = 1;
        rateLimit.resetTime = now + EMAIL_CHECK_WINDOW;
      }
    } else {
      emailCheckRateLimits.set(clientIP, { count: 1, resetTime: now + EMAIL_CHECK_WINDOW });
    }

    // Clean up old rate limit entries periodically
    if (Math.random() < 0.1) {
      const keysToDelete: string[] = [];
      emailCheckRateLimits.forEach((value, key) => {
        if (now > value.resetTime + EMAIL_CHECK_WINDOW) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => emailCheckRateLimits.delete(key));
    }

    // Add small constant delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));

    // Check if email is registered (case-insensitive lookup in storage)
    const existingUser = await storage.getUserByEmail(email.trim());
    
    // If user is currently logged in, check if it's their email
    let isOwnEmail = false;
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase().trim()) {
        isOwnEmail = true;
      }
    }

    res.json({
      registered: !!existingUser,
      requiresLogin: !!existingUser && !isOwnEmail,
      isOwnEmail
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Local login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    
    const rateLimitCheck = await loginRateLimiter.checkRateLimit(data.usernameOrEmail, clientIp);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: rateLimitCheck.message || 'Zu viele Anmeldeversuche',
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    const user = await authService.localLogin(data.usernameOrEmail, data.password, req.isTestMode || false);
    
    if (!user) {
      const result = await loginRateLimiter.recordFailedAttempt(data.usernameOrEmail, clientIp);
      
      if (result.locked) {
        return res.status(429).json({ 
          error: `Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie ${Math.ceil(result.retryAfter! / 60)} Minute${result.retryAfter! > 60 ? 'n' : ''}.`,
          retryAfter: result.retryAfter
        });
      }
      
      return res.status(401).json({ 
        error: 'Ungültige Anmeldedaten',
        remainingAttempts: result.remainingAttempts
      });
    }

    await loginRateLimiter.recordSuccessfulLogin(data.usernameOrEmail, clientIp);
    req.session.userId = user.id;
    
    // Explicitly save session before responding to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Interner Fehler' });
      }
      res.json({ user: authService.sanitizeUser(user) });
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ungültige Eingabe', details: error.errors });
    } else {
      res.status(500).json({ error: 'Interner Fehler' });
    }
  }
});

// Local register
router.post('/register', async (req, res) => {
  try {
    // Check if registration is enabled
    const registrationSetting = await storage.getSetting('registration_enabled');
    if (registrationSetting?.value === false) {
      return res.status(403).json({ error: 'Registrierung ist deaktiviert' });
    }
    
    const data = registerSchema.parse(req.body);
    const user = await authService.localRegister(
      data.username,
      data.email,
      data.name,
      data.password
    );
    
    if (!user) {
      return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
    }

    req.session.userId = user.id;
    
    // Explicitly save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Interner Fehler' });
      }
      res.json({ user: authService.sanitizeUser(user) });
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ungültige Eingabe', details: error.errors });
    } else {
      res.status(500).json({ error: 'Interner Fehler' });
    }
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Fehler beim Abmelden' });
    }
    res.json({ success: true });
  });
});

// Request password reset (for local accounts)
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'E-Mail-Adresse erforderlich' });
    }

    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    
    // Always return success to prevent email enumeration
    if (!user || user.provider !== 'local') {
      console.log(`[Password Reset] Request for non-existent or non-local user: ${email}`);
      return res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
    }

    const resetToken = await storage.createPasswordResetToken(user.id);
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const resetLink = `${baseUrl}/passwort-zuruecksetzen/${resetToken.token}`;

    // Send email asynchronously - don't wait for it to complete
    emailService.sendPasswordResetEmail(user.email, resetLink)
      .then(() => console.log(`[Password Reset] Email sent to ${user.email}`))
      .catch((emailError) => console.error(`[Password Reset] Failed to send email to ${user.email}:`, emailError));
    
    res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token und neues Passwort erforderlich' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' });
    }

    const user = await storage.getUser(resetToken.userId);
    if (!user) {
      return res.status(400).json({ error: 'Benutzer nicht gefunden' });
    }

    // Hash new password and update user
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(user.id, { passwordHash: hashedPassword });

    // Mark token as used
    await storage.markPasswordResetTokenUsed(token);

    // Send notification email
    emailService.sendPasswordChangedEmail(user.email)
      .catch((emailError) => console.error(`[Password Changed] Failed to send notification to ${user.email}:`, emailError));

    res.json({ success: true, message: 'Passwort wurde erfolgreich zurückgesetzt' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Change password (authenticated users)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
    }

    const user = await storage.getUser(userId);
    if (!user || user.provider !== 'local') {
      return res.status(400).json({ error: 'Passwort kann nur für lokale Konten geändert werden' });
    }

    // Verify current password
    const bcrypt = await import('bcryptjs');
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Kein Passwort gesetzt' });
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(user.id, { passwordHash: hashedPassword });

    // Send notification email
    emailService.sendPasswordChangedEmail(user.email)
      .catch((emailError) => console.error(`[Password Changed] Failed to send notification to ${user.email}:`, emailError));

    res.json({ success: true, message: 'Passwort wurde erfolgreich geändert' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Request email change
router.post('/request-email-change', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const { newEmail } = req.body;
    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ error: 'Neue E-Mail-Adresse erforderlich' });
    }

    const emailSchema = z.string().email();
    try {
      emailSchema.parse(newEmail);
    } catch {
      return res.status(400).json({ error: 'Ungültiges E-Mail-Format' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Check if new email is already in use
    const existingUser = await storage.getUserByEmail(newEmail.toLowerCase().trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet' });
    }

    // Create email change token
    const emailChangeToken = await storage.createEmailChangeToken(userId, newEmail.toLowerCase().trim());
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const confirmLink = `${baseUrl}/bestaetigen-email/${emailChangeToken.token}`;

    // Send confirmation email to new address
    await emailService.sendEmailChangeConfirmation(newEmail, user.email, confirmLink);

    res.json({ success: true, message: 'Bestätigungs-E-Mail wurde gesendet' });
  } catch (error) {
    console.error('Email change request error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Confirm email change
router.post('/confirm-email-change', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token erforderlich' });
    }

    const emailChangeToken = await storage.getEmailChangeToken(token);
    if (!emailChangeToken) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' });
    }

    const user = await storage.getUser(emailChangeToken.userId);
    if (!user) {
      return res.status(400).json({ error: 'Benutzer nicht gefunden' });
    }

    // Update email
    await storage.updateUser(user.id, { email: emailChangeToken.newEmail });
    await storage.markEmailChangeTokenUsed(token);

    res.json({ success: true, message: 'E-Mail-Adresse wurde erfolgreich geändert' });
  } catch (error) {
    console.error('Email change confirmation error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Keycloak OAuth flow - initiate
router.get('/keycloak', async (req, res) => {
  try {
    if (!authService.isKeycloakEnabled()) {
      return res.status(404).json({ error: 'Keycloak nicht konfiguriert' });
    }

    const { authUrl, codeVerifier, state } = await authService.initiateKeycloakLogin(req);
    req.session.keycloakCodeVerifier = codeVerifier;
    req.session.keycloakState = state;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Interner Fehler' });
      }
      res.redirect(authUrl);
    });
  } catch (error) {
    console.error('Keycloak auth error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Keycloak OAuth callback
router.get('/keycloak/callback', async (req, res) => {
  try {
    if (!authService.isKeycloakEnabled()) {
      return res.status(404).json({ error: 'Keycloak nicht konfiguriert' });
    }

    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=no_code');
    }

    // Verify state
    if (state !== req.session.keycloakState) {
      return res.redirect('/?error=invalid_state');
    }

    const codeVerifier = req.session.keycloakCodeVerifier;
    if (!codeVerifier) {
      return res.redirect('/?error=no_verifier');
    }

    const user = await authService.handleKeycloakCallback(code, codeVerifier, req);
    if (!user) {
      return res.redirect('/?error=auth_failed');
    }

    // Clear Keycloak session data
    delete req.session.keycloakCodeVerifier;
    delete req.session.keycloakState;

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/?error=session_error');
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Keycloak callback error:', error);
    res.redirect('/?error=auth_error');
  }
});

export default router;
