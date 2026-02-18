import { Router } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { requireAdmin, loginRateLimiter } from "./common";
import { authService } from "../services/authService";
import { clamavService } from "../services/clamavService";
import { emailService } from "../services/emailService";
import { emailTemplateService } from "../services/emailTemplateService";
import { matrixService } from "../services/matrixService";
import { pentestToolsService, TOOL_IDS, SCAN_TYPES } from "../services/pentestToolsService";
import { apiRateLimiter } from "../services/apiRateLimiterService";
import { adminCacheService } from "../services/adminCacheService";
import { imageService } from "../services/imageService";
import type { User } from "@shared/schema";
import { apiRateLimitsSettingsSchema } from "@shared/schema";
import { db } from "../db";
import { testRuns } from "@shared/schema";
import { eq, ne, or, and, desc } from "drizzle-orm";

const router = Router();

// ============== ADMIN STATS ==============

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await storage.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/extended-stats', requireAdmin, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const cached = await adminCacheService.getExtendedStats(forceRefresh);
    res.json({
      ...cached.data,
      lastChecked: cached.lastChecked,
      cacheExpiresAt: cached.cacheExpiresAt,
    });
  } catch (error) {
    console.error('Error fetching extended stats:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== SYSTEM STATUS ==============

router.get('/system-status', requireAdmin, async (req, res) => {
  try {
    const { getSystemStatus } = await import("../system-status");
    const forceRefresh = req.query.refresh === 'true';
    const status = await getSystemStatus(forceRefresh);
    res.json(status);
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ error: 'Interner Fehler beim Abrufen des Systemstatus' });
  }
});

router.get('/vulnerabilities', requireAdmin, async (req, res) => {
  try {
    const { runNpmAudit } = await import("../services/npmAuditService");
    const forceRefresh = req.query.refresh === 'true';
    const result = await runNpmAudit(forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error running npm audit:', error);
    res.status(500).json({ error: 'Interner Fehler beim Prüfen der Sicherheitslücken' });
  }
});

router.get('/system-packages', requireAdmin, async (req, res) => {
  try {
    const { getSystemPackages } = await import("../services/systemPackageService");
    const forceRefresh = req.query.refresh === 'true';
    const result = await getSystemPackages(forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error fetching system packages:', error);
    res.status(500).json({ error: 'Interner Fehler beim Abrufen der System-Packages' });
  }
});

// ============== USER MANAGEMENT ==============

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    const sanitized = users.map(u => authService.sanitizeUser(u));
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { name, email, username, password, role } = req.body;
    
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Name, E-Mail, Benutzername und Passwort sind erforderlich.' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }
    
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Benutzername muss mindestens 3 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstriche enthalten.' });
    }
    
    const passwordValid = password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
    
    if (!passwordValid) {
      return res.status(400).json({ 
        error: 'Passwort muss mindestens 8 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.' 
      });
    }
    
    const existingEmail = await storage.getUserByEmail(email.toLowerCase().trim());
    if (existingEmail) {
      return res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
    }
    
    const existingUsername = await storage.getUserByUsername(username.toLowerCase().trim());
    if (existingUsername) {
      return res.status(400).json({ error: 'Dieser Benutzername wird bereits verwendet.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const newUser = await storage.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      passwordHash,
      provider: 'local',
      role: role && ['user', 'admin', 'manager'].includes(role) ? role : 'user',
    });
    
    console.log(`[Admin] User created manually by admin: ${newUser.email} (ID: ${newUser.id})`);
    
    res.status(201).json(authService.sanitizeUser(newUser));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Interner Fehler beim Erstellen des Benutzers.' });
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, name, email, organization } = req.body;
    
    const updates: Record<string, any> = {};
    if (role && ['user', 'admin', 'manager'].includes(role)) {
      updates.role = role;
    }
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (organization !== undefined) updates.organization = organization;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Updates angegeben' });
    }
    
    const user = await storage.updateUser(userId, updates);
    res.json(authService.sanitizeUser(user));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const deprovisionSetting = await storage.getSetting('deprovision_config');
    const deprovisionConfig = deprovisionSetting?.value as { enabled?: boolean } | null;
    
    if (deprovisionConfig?.enabled) {
      return res.status(403).json({ 
        error: 'Manuelle Benutzer-Löschung ist deaktiviert. Bitte nutzen Sie den externen Deprovisionierungsservice.',
        code: 'MANUAL_DELETE_DISABLED'
      });
    }
    
    if (req.session.userId === userId) {
      return res.status(400).json({ error: 'Sie können sich selbst nicht löschen' });
    }
    
    await storage.deleteUser(userId);
    res.json({ success: true, message: 'Benutzer gelöscht' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== GDPR DELETION REQUESTS ==============

router.get('/deletion-requests', requireAdmin, async (req, res) => {
  try {
    const usersWithRequests = await storage.getUsersWithDeletionRequests();
    res.json(usersWithRequests.map(u => authService.sanitizeUser(u)));
  } catch (error) {
    console.error('Error fetching deletion requests:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/deletion-requests/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (!user.deletionRequestedAt) {
      return res.status(400).json({ error: 'Benutzer hat keine Löschung beantragt' });
    }

    if (req.session.userId === userId) {
      return res.status(400).json({ error: 'Sie können sich selbst nicht löschen' });
    }

    await storage.confirmDeletion(userId);
    console.log(`[GDPR] Admin ${req.session.userId} confirmed deletion of user ${user.email} (ID: ${userId})`);
    
    res.json({ success: true, message: 'Benutzer wurde gemäß DSGVO Art. 17 gelöscht.' });
  } catch (error) {
    console.error('Error confirming deletion:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/deletion-requests/:id/reject', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (!user.deletionRequestedAt) {
      return res.status(400).json({ error: 'Benutzer hat keine Löschung beantragt' });
    }

    const updatedUser = await storage.cancelDeletionRequest(userId);
    console.log(`[GDPR] Admin ${req.session.userId} rejected deletion request of user ${user.email} (ID: ${userId})`);
    
    res.json({ 
      success: true, 
      message: 'Löschantrag wurde abgelehnt.',
      user: authService.sanitizeUser(updatedUser)
    });
  } catch (error) {
    console.error('Error rejecting deletion request:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== POLL MANAGEMENT ==============

router.get('/polls', requireAdmin, async (req, res) => {
  try {
    const polls = await storage.getAllPolls();
    res.json(polls);
  } catch (error) {
    console.error('Error fetching all polls:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.patch('/polls/:id', requireAdmin, async (req, res) => {
  try {
    const pollId = req.params.id;
    const { isActive, title, description, expiresAt, resultsPublic } = req.body;
    
    const updates: Record<string, any> = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (resultsPublic !== undefined) updates.resultsPublic = resultsPublic;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Updates angegeben' });
    }
    
    const poll = await storage.updatePoll(pollId, updates);
    res.json(poll);
  } catch (error) {
    console.error('Error updating poll:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.delete('/polls/:id', requireAdmin, async (req, res) => {
  try {
    const pollId = req.params.id;
    await storage.deletePoll(pollId);
    res.json({ success: true, message: 'Umfrage gelöscht' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== SETTINGS ==============

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const { key, value, description } = req.body;
    const setting = await storage.setSetting({ key, value, description });
    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.delete('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const key = req.params.key;
    await storage.setSetting({ key, value: null, description: 'Deleted' });
    res.json({ success: true, message: 'Einstellung gelöscht' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== SECURITY ==============

router.get('/security', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getSecuritySettings();
    const stats = loginRateLimiter.getStats();
    res.json({ 
      settings, 
      stats,
      ssoNote: 'SSO-Anmeldungen (Keycloak) werden im Identity Provider selbst rate-limitiert.'
    });
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/security', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.setSecuritySettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/security/clear-rate-limits', requireAdmin, async (req, res) => {
  try {
    loginRateLimiter.clearAll();
    res.json({ success: true, message: 'Alle Rate-Limit-Sperren wurden zurückgesetzt' });
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== API RATE LIMITS ==============

router.get('/api-rate-limits', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getSecuritySettings();
    const apiRateLimits = settings.apiRateLimits || apiRateLimitsSettingsSchema.parse({});
    
    const stats: Record<string, { totalTracked: number; blockedClients: number }> = {};
    const limiterNames = ['registration', 'password-reset', 'poll-creation', 'vote', 'email', 'api-general'];
    for (const name of limiterNames) {
      stats[name] = apiRateLimiter.getStats(name);
    }
    
    res.json({ settings: apiRateLimits, stats });
  } catch (error) {
    console.error('Error fetching API rate limits:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/api-rate-limits', requireAdmin, async (req, res) => {
  try {
    const validatedSettings = apiRateLimitsSettingsSchema.parse(req.body);
    
    const currentSettings = await storage.getSecuritySettings();
    const updatedSettings = {
      ...currentSettings,
      apiRateLimits: validatedSettings,
    };
    
    await storage.setSecuritySettings(updatedSettings);
    
    apiRateLimiter.updateConfig(validatedSettings);
    
    console.log('[API Rate Limits] Configuration updated');
    res.json({ success: true, settings: validatedSettings });
  } catch (error) {
    console.error('Error updating API rate limits:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/api-rate-limits/clear', requireAdmin, async (req, res) => {
  try {
    const { limiter } = req.body;
    if (limiter) {
      apiRateLimiter.clearAll(limiter);
    } else {
      apiRateLimiter.clearAll();
    }
    res.json({ success: true, message: 'API Rate-Limit-Sperren wurden zurückgesetzt' });
  } catch (error) {
    console.error('Error clearing API rate limits:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== CLAMAV ANTIVIRUS ==============

router.get('/clamav', requireAdmin, async (req, res) => {
  try {
    const config = await clamavService.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching ClamAV config:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/clamav', requireAdmin, async (req, res) => {
  try {
    const { enabled, host, port, timeout, maxFileSize } = req.body;
    
    const configUpdate: Record<string, unknown> = {};
    if (typeof enabled === 'boolean') configUpdate.enabled = enabled;
    if (typeof host === 'string') configUpdate.host = host;
    if (typeof port === 'number') configUpdate.port = port;
    if (typeof timeout === 'number') configUpdate.timeout = timeout;
    if (typeof maxFileSize === 'number') configUpdate.maxFileSize = maxFileSize;

    const currentConfig = await clamavService.getConfig();
    const newConfig = { ...currentConfig, ...configUpdate };

    await storage.setSetting({
      key: 'clamav_config',
      value: newConfig,
      description: 'ClamAV antivirus scanner configuration',
    });

    clamavService.clearConfigCache();
    
    console.log(`[ClamAV] Configuration updated: enabled=${newConfig.enabled}, host=${newConfig.host}:${newConfig.port}`);
    
    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error updating ClamAV config:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/clamav/test', requireAdmin, async (req, res) => {
  try {
    const result = await clamavService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing ClamAV connection:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/clamav/scan-logs', requireAdmin, async (req, res) => {
  try {
    const { limit, offset, status, startDate, endDate } = req.query;
    
    const options: {
      limit?: number;
      offset?: number;
      status?: 'clean' | 'infected' | 'error';
      startDate?: Date;
      endDate?: Date;
    } = {};
    
    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);
    if (status && ['clean', 'infected', 'error'].includes(status as string)) {
      options.status = status as 'clean' | 'infected' | 'error';
    }
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const result = await clamavService.getScanLogs(options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching ClamAV scan logs:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/clamav/scan-logs/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const log = await clamavService.getScanLog(id);
    
    if (!log) {
      return res.status(404).json({ error: 'Scan-Log nicht gefunden' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error fetching ClamAV scan log:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/clamav/scan-stats', requireAdmin, async (req, res) => {
  try {
    const stats = await clamavService.getScanStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching ClamAV stats:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== PENTEST TOOLS ==============

router.get('/pentest-tools/status', requireAdmin, async (req, res) => {
  try {
    const config = await pentestToolsService.getConfig();
    const configured = await pentestToolsService.isConfigured();
    if (!configured) {
      return res.json({ 
        configured: false,
        configuredViaEnv: config.configuredViaEnv,
        message: 'API Token nicht konfiguriert' 
      });
    }

    const connectionTest = await pentestToolsService.testConnection();
    res.json({
      configured: true,
      configuredViaEnv: config.configuredViaEnv,
      connected: connectionTest.success,
      message: connectionTest.message,
      account: connectionTest.account,
    });
  } catch (error) {
    console.error('Error fetching Pentest-Tools status:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/config', requireAdmin, async (req, res) => {
  try {
    const config = await pentestToolsService.getConfig();
    res.json({ 
      configured: !!config.apiToken,
      configuredViaEnv: config.configuredViaEnv,
    });
  } catch (error) {
    console.error('Error getting Pentest-Tools config:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/pentest-tools/config', requireAdmin, async (req, res) => {
  try {
    const { apiToken } = req.body;
    
    if (typeof apiToken !== 'string') {
      return res.status(400).json({ error: 'API-Token muss ein Text sein' });
    }
    
    const trimmedToken = apiToken.trim();
    if (!trimmedToken) {
      return res.status(400).json({ error: 'API-Token darf nicht leer sein' });
    }
    
    // Check if ENV variable is set - don't allow override
    const envToken = process.env.PENTEST_TOOLS_API_TOKEN || '';
    if (envToken) {
      return res.status(400).json({ 
        error: 'Token ist via Umgebungsvariable konfiguriert und kann hier nicht geändert werden' 
      });
    }
    
    // Save to database
    await storage.setSetting({
      key: 'pentest_tools_config',
      value: { apiToken: trimmedToken },
      description: 'Pentest-Tools.com API configuration',
    });
    
    res.json({ success: true, message: 'API Token gespeichert' });
  } catch (error) {
    console.error('Error saving Pentest-Tools config:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/tools', requireAdmin, async (req, res) => {
  try {
    const tools = pentestToolsService.getAvailableTools();
    const scanTypes = pentestToolsService.getScanTypes();
    res.json({ tools, scanTypes });
  } catch (error) {
    console.error('Error getting Pentest-Tools tools:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/target', requireAdmin, async (req, res) => {
  try {
    const requestHost = req.get('host');
    const targetInfo = await pentestToolsService.getPollyTargetInfo(requestHost);
    res.json(targetInfo);
  } catch (error) {
    console.error('Error getting Pentest-Tools target info:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/pentest-tools/target/sync', requireAdmin, async (req, res) => {
  try {
    const requestHost = req.get('host');
    const result = await pentestToolsService.syncPollyTarget(requestHost);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      targetInfo: result.targetInfo,
      message: 'Polly-Target synchronisiert'
    });
  } catch (error) {
    console.error('Error syncing Polly target:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/scans', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await pentestToolsService.getScans(limit);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ scans: result.data });
  } catch (error) {
    console.error('Error getting Pentest-Tools scans:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/recent-scans', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await pentestToolsService.getRecentScans(limit);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ scans: result.data });
  } catch (error) {
    console.error('Error fetching Pentest-Tools recent scans:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/pentest-tools/scans', requireAdmin, async (req, res) => {
  try {
    const { toolId, scanType } = req.body;
    const requestHost = req.get('host');
    
    const result = await pentestToolsService.startPollyScan(
      toolId || TOOL_IDS.WEBSITE_SCANNER,
      scanType || SCAN_TYPES.LIGHT,
      requestHost
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      scan_id: result.scan_id,
      message: 'Scan für Polly gestartet'
    });
  } catch (error) {
    console.error('Error starting Pentest-Tools scan:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/scans/:scanId', requireAdmin, async (req, res) => {
  try {
    const { scanId } = req.params;
    const result = await pentestToolsService.getScanStatus(scanId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ scan: result.data });
  } catch (error) {
    console.error('Error getting Pentest-Tools scan status:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/pentest-tools/scans/:scanId/findings', requireAdmin, async (req, res) => {
  try {
    const { scanId } = req.params;
    const result = await pentestToolsService.getFindings(scanId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ findings: result.data });
  } catch (error) {
    console.error('Error getting Pentest-Tools findings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/pentest-tools/scans/:scanId/stop', requireAdmin, async (req, res) => {
  try {
    const { scanId } = req.params;
    const result = await pentestToolsService.stopScan(scanId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Scan gestoppt' });
  } catch (error) {
    console.error('Error stopping Pentest-Tools scan:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== AUTOMATED TESTING ==============

router.get('/tests/environment', requireAdmin, async (req, res) => {
  try {
    const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);
    const isDocker = !!(process.env.DOCKER_CONTAINER || process.env.container);
    const isCI = !!(process.env.CI || process.env.GITLAB_CI || process.env.GITHUB_ACTIONS);
    
    let environment: 'replit' | 'docker' | 'ci' | 'local' = 'local';
    if (isCI) {
      environment = 'ci';
    } else if (isReplit) {
      environment = 'replit';
    } else if (isDocker) {
      environment = 'docker';
    }
    
    const capabilities = {
      unit: true,
      integration: true,
      data: true,
      accessibility: environment === 'ci',
      e2e: environment === 'ci',
    };
    
    res.json({
      environment,
      capabilities,
      playwrightAvailable: environment === 'ci',
    });
  } catch (error) {
    console.error('Error getting test environment:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const categories = await testRunnerService.getAvailableTests();
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching test categories:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/tests/run', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const runId = await testRunnerService.runAllTests('manual');
    res.json({ runId, message: 'Test-Lauf gestartet' });
  } catch (error) {
    console.error('Error starting test run:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/runs', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await testRunnerService.getTestRunHistory(limit);
    res.json({ runs });
  } catch (error) {
    console.error('Error fetching test run history:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/runs/:id', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const runId = parseInt(req.params.id);
    const run = await testRunnerService.getTestRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Test-Lauf nicht gefunden' });
    }
    
    res.json(run);
  } catch (error) {
    console.error('Error fetching test run:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/runs/:id/pdf', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const pdfServiceModule = await import('../services/pdfService');
    
    const runId = parseInt(req.params.id);
    const run = await testRunnerService.getTestRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Test-Lauf nicht gefunden' });
    }
    
    const pdfBuffer = await pdfServiceModule.generateTestReportPDF(run, run.results || []);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-report-${runId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating test PDF:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/schedule', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const config = await testRunnerService.getScheduleConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching test schedule:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/tests/schedule', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const config = await testRunnerService.updateScheduleConfig(req.body);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating test schedule:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/configurations', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const tests = await testRunnerService.getTestConfigurationsByType();
    const mode = await testRunnerService.getTestModeConfig();
    res.json({ tests, mode });
  } catch (error) {
    console.error('Error fetching test configurations:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/tests/mode', requireAdmin, async (req, res) => {
  try {
    const { mode } = req.body;
    if (!mode || !['auto', 'manual'].includes(mode)) {
      return res.status(400).json({ error: 'Ungültiger Modus' });
    }
    const testRunnerService = await import('../services/testRunnerService');
    const config = await testRunnerService.updateTestModeConfig(mode);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating test mode:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/tests/configurations/:testId', requireAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled muss ein Boolean sein' });
    }
    
    const testRunnerService = await import('../services/testRunnerService');
    await testRunnerService.updateTestEnabled(decodeURIComponent(testId), enabled);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating test configuration:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/tests/sync', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const tests = await testRunnerService.syncTestConfigurations();
    res.json({ success: true, count: tests.length });
  } catch (error) {
    console.error('Error syncing test configurations:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/tests/data-stats', requireAdmin, async (req, res) => {
  try {
    const stats = await storage.getTestDataStats();
    res.json({
      ...stats,
      polls: stats.testPolls,
      users: stats.testUsers,
      votes: stats.testVotes,
      options: stats.testOptions,
      total: stats.testPolls + stats.testUsers + stats.testVotes + stats.testOptions,
    });
  } catch (error) {
    console.error('Error fetching test data stats:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.delete('/tests/purge-data', requireAdmin, async (req, res) => {
  try {
    const result = await storage.purgeTestData();
    console.log(`[TestData] Purged test data: ${result.deletedPolls} polls, ${result.deletedUsers} users, ${result.deletedVotes} votes`);
    res.json({ 
      success: true, 
      message: 'Testdaten erfolgreich gelöscht',
      ...result 
    });
  } catch (error) {
    console.error('Error purging test data:', error);
    res.status(500).json({ error: 'Interner Fehler beim Löschen der Testdaten' });
  }
});

// ============== NOTIFICATIONS ==============

router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getNotificationSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/notifications', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.setNotificationSettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== SESSION TIMEOUT ==============

router.get('/session-timeout', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getSessionTimeoutSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching session timeout settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/session-timeout', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.setSessionTimeoutSettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating session timeout settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== CALENDAR ==============

router.get('/calendar', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getCalendarSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching calendar settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/calendar', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.setCalendarSettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating calendar settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== DEPROVISION ==============

router.get('/deprovision-settings', requireAdmin, async (req, res) => {
  try {
    const setting = await storage.getSetting('deprovision_config');
    if (setting && setting.value) {
      const config = setting.value as {
        enabled: boolean;
        username: string;
        passwordHash?: string;
        lastUpdated?: string;
      };
      res.json({
        enabled: config.enabled || false,
        username: config.username || '',
        hasPassword: !!config.passwordHash,
        lastUpdated: config.lastUpdated || null,
      });
    } else {
      res.json({
        enabled: false,
        username: '',
        hasPassword: false,
        lastUpdated: null,
      });
    }
  } catch (error) {
    console.error('Error fetching deprovision settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/deprovision-settings', requireAdmin, async (req, res) => {
  try {
    const { enabled, username, password } = req.body;
    
    const existingSetting = await storage.getSetting('deprovision_config');
    const existingConfig = (existingSetting?.value || {}) as {
      enabled?: boolean;
      username?: string;
      passwordHash?: string;
    };
    
    const newConfig: {
      enabled: boolean;
      username: string;
      passwordHash?: string;
      lastUpdated: string;
    } = {
      enabled: enabled ?? existingConfig.enabled ?? false,
      username: username ?? existingConfig.username ?? '',
      lastUpdated: new Date().toISOString(),
    };
    
    if (password) {
      newConfig.passwordHash = await bcrypt.hash(password, 10);
    } else if (existingConfig.passwordHash) {
      newConfig.passwordHash = existingConfig.passwordHash;
    }
    
    await storage.setSetting({
      key: 'deprovision_config',
      value: newConfig,
      description: 'External Deprovisioning Service Configuration (Kafka/Keycloak)',
    });
    
    console.log(`[DEPROVISION] Settings updated: enabled=${newConfig.enabled}, username=${newConfig.username}`);
    
    res.json({
      enabled: newConfig.enabled,
      username: newConfig.username,
      hasPassword: !!newConfig.passwordHash,
      lastUpdated: newConfig.lastUpdated,
    });
  } catch (error) {
    console.error('Error updating deprovision settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== CUSTOMIZATION ==============

router.get('/customization', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching customization settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/customization', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    
    if (updates.theme && (
      updates.theme.primaryColor ||
      updates.theme.secondaryColor ||
      updates.theme.scheduleColor ||
      updates.theme.surveyColor ||
      updates.theme.organizationColor
    )) {
      updates.wcag = {
        ...(updates.wcag || {}),
        enforceDefaultTheme: false,
      };
      console.log('[WCAG] Theme colors customized - enforceDefaultTheme set to false');
    }
    
    const settings = await storage.setCustomizationSettings(updates);
    
    const { writeBrandingToLocalFile } = await import('../scripts/applyBranding');
    writeBrandingToLocalFile({
      theme: settings.theme,
      branding: settings.branding,
      footer: settings.footer,
      wcag: settings.wcag,
    });
    
    if (updates.matrix) {
      const matrixConfig = settings.matrix;
      if (matrixConfig) {
        matrixService.updateMatrixConfig({
          enabled: matrixConfig.enabled,
          homeserverUrl: matrixConfig.homeserverUrl,
          botUserId: matrixConfig.botUserId,
          botAccessToken: matrixConfig.botAccessToken || matrixService.getMatrixConfig().botAccessToken,
          searchEnabled: matrixConfig.searchEnabled,
        });
      }
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating customization settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== WCAG ==============

router.post('/wcag/audit', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    const theme = settings.theme || {};
    
    const issues: Array<{
      token: string;
      originalValue: string;
      contrastRatio: number;
      requiredRatio: number;
      suggestedValue: string;
    }> = [];
    
    const checkContrast = (fg: string, bg: string): number => {
      const luminance = (hex: string): number => {
        const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => {
          const v = parseInt(x, 16) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        }) || [0, 0, 0];
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      };
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    
    const whiteBg = '#ffffff';
    const colorsToCheck = [
      { token: '--primary', value: theme.primaryColor || '#4f46e5' },
      { token: '--color-schedule', value: theme.scheduleColor || '#10b981' },
      { token: '--color-survey', value: theme.surveyColor || '#6366f1' },
      { token: '--color-organization', value: theme.organizationColor || '#f59e0b' },
    ];
    
    for (const color of colorsToCheck) {
      const contrast = checkContrast(color.value, whiteBg);
      if (contrast < 4.5) {
        issues.push({
          token: color.token,
          originalValue: color.value,
          contrastRatio: Math.round(contrast * 100) / 100,
          requiredRatio: 4.5,
          suggestedValue: color.value,
        });
      }
    }

    const auditResult = {
      runAt: new Date().toISOString(),
      passed: issues.length === 0,
      issues,
    };

    const currentWcag = settings.wcag || { enforcementEnabled: false };
    await storage.setCustomizationSettings({
      ...settings,
      wcag: { ...currentWcag, lastAudit: auditResult },
    });

    res.json(auditResult);
  } catch (error) {
    console.error('Error running WCAG audit:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/wcag/apply-corrections', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    const lastAudit = settings.wcag?.lastAudit;

    if (!lastAudit || lastAudit.issues.length === 0) {
      return res.status(400).json({ error: 'Keine Korrekturen verfügbar' });
    }

    const theme = { ...(settings.theme || {}) };
    const appliedCorrections: Record<string, string> = {};

    for (const issue of lastAudit.issues) {
      if (issue.token === '--primary') {
        theme.primaryColor = issue.suggestedValue;
        appliedCorrections[issue.token] = issue.suggestedValue;
      } else if (issue.token === '--color-schedule') {
        theme.scheduleColor = issue.suggestedValue;
        appliedCorrections[issue.token] = issue.suggestedValue;
      } else if (issue.token === '--color-survey') {
        theme.surveyColor = issue.suggestedValue;
        appliedCorrections[issue.token] = issue.suggestedValue;
      } else if (issue.token === '--color-organization') {
        theme.organizationColor = issue.suggestedValue;
        appliedCorrections[issue.token] = issue.suggestedValue;
      }
    }

    const updatedSettings = await storage.setCustomizationSettings({
      ...settings,
      theme,
      wcag: {
        ...settings.wcag,
        lastAudit: { ...lastAudit, appliedCorrections },
      },
    });

    res.json({ success: true, settings: updatedSettings, appliedCorrections });
  } catch (error) {
    console.error('Error applying WCAG corrections:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/wcag/settings', requireAdmin, async (req, res) => {
  try {
    const { enforcementEnabled } = req.body;
    const settings = await storage.getCustomizationSettings();
    
    const updatedSettings = await storage.setCustomizationSettings({
      ...settings,
      wcag: {
        ...settings.wcag,
        enforcementEnabled: Boolean(enforcementEnabled),
      },
    });

    res.json(updatedSettings.wcag);
  } catch (error) {
    console.error('Error updating WCAG settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== EMAIL TEMPLATES ==============

router.get('/email-templates', requireAdmin, async (req, res) => {
  try {
    const templates = await emailTemplateService.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/email-templates/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    const template = await emailTemplateService.getTemplate(type as any);
    res.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/email-templates/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { jsonContent, subject, name, textContent } = req.body;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    const existingTemplate = await emailTemplateService.getTemplate(type as any);
    const finalJsonContent = jsonContent || existingTemplate.jsonContent;
    
    if (!finalJsonContent) {
      return res.status(400).json({ error: 'Template-Inhalt erforderlich' });
    }
    
    const template = await emailTemplateService.saveTemplate(
      type as any, 
      finalJsonContent, 
      subject, 
      name,
      textContent
    );
    res.json(template);
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/email-templates/:type/reset', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    const template = await emailTemplateService.resetTemplate(type as any);
    res.json(template);
  } catch (error) {
    console.error('Error resetting email template:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/email-templates/:type/preview', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    const sampleVariables: Record<string, Record<string, string>> = {
      poll_created: {
        pollTitle: 'Beispiel-Umfrage',
        pollType: 'Terminumfrage',
        publicLink: 'https://example.com/poll/abc123',
        adminLink: 'https://example.com/admin/poll/xyz789',
        qrCodeUrl: 'https://example.com/qr/abc123.png',
      },
      invitation: {
        pollTitle: 'Team-Meeting Terminabstimmung',
        inviterName: 'Max Mustermann',
        publicLink: 'https://example.com/poll/abc123',
        message: 'Bitte stimmen Sie bis Freitag ab!',
        qrCodeUrl: 'https://example.com/qr/abc123.png',
      },
      vote_confirmation: {
        voterName: 'Anna Schmidt',
        pollTitle: 'Sommerfeier Termin',
        pollType: 'Terminumfrage',
        publicLink: 'https://example.com/poll/abc123',
        resultsLink: 'https://example.com/poll/abc123/results',
      },
      reminder: {
        senderName: 'Max Mustermann',
        pollTitle: 'Wichtige Abstimmung',
        pollLink: 'https://example.com/poll/abc123',
        expiresAt: 'Die Umfrage endet am 31.12.2025 um 23:59 Uhr',
        qrCodeUrl: 'https://example.com/qr/abc123.png',
      },
      password_reset: {
        resetLink: 'https://example.com/reset-password?token=abc123xyz',
      },
      email_change: {
        oldEmail: 'alt@example.com',
        newEmail: 'neu@example.com',
        confirmLink: 'https://example.com/confirm-email?token=abc123xyz',
      },
      password_changed: {},
      test_report: {
        testRunId: '42',
        status: '✅ Alle Tests bestanden',
        totalTests: '25',
        passed: '24',
        failed: '0',
        skipped: '1',
        duration: '45 Sekunden',
        startedAt: '23.12.2025, 14:30 Uhr',
      },
    };
    
    const rendered = await emailTemplateService.renderEmail(type as any, sampleVariables[type] || {});
    res.json(rendered);
  } catch (error) {
    console.error('Error previewing email template:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/email-templates/:type/test', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { recipientEmail } = req.body;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    if (!recipientEmail) {
      return res.status(400).json({ error: 'E-Mail-Adresse erforderlich' });
    }
    
    const sampleVariables: Record<string, Record<string, string>> = {
      poll_created: {
        pollTitle: 'Test-Umfrage',
        pollType: 'Terminumfrage',
        publicLink: 'https://example.com/poll/test',
        adminLink: 'https://example.com/admin/poll/test',
      },
      invitation: {
        pollTitle: 'Test-Einladung',
        inviterName: 'Test Admin',
        publicLink: 'https://example.com/poll/test',
        message: 'Dies ist eine Test-E-Mail.',
      },
      vote_confirmation: {
        voterName: 'Test Nutzer',
        pollTitle: 'Test-Umfrage',
        pollType: 'Umfrage',
        publicLink: 'https://example.com/poll/test',
        resultsLink: 'https://example.com/poll/test/results',
      },
      reminder: {
        senderName: 'Test Admin',
        pollTitle: 'Test-Erinnerung',
        pollLink: 'https://example.com/poll/test',
        expiresAt: 'Die Umfrage endet am 31.12.2025',
      },
      password_reset: {
        resetLink: 'https://example.com/reset-password?token=test',
      },
      email_change: {
        oldEmail: 'alt@test.com',
        newEmail: 'neu@test.com',
        confirmLink: 'https://example.com/confirm-email?token=test',
      },
      password_changed: {},
      test_report: {
        testRunId: '0',
        status: '✅ Test-Bericht',
        totalTests: '10',
        passed: '10',
        failed: '0',
        skipped: '0',
        duration: '5 Sekunden',
        startedAt: new Date().toLocaleString('de-DE'),
      },
    };
    
    const rendered = await emailTemplateService.renderEmail(type as any, sampleVariables[type] || {});
    await emailService.sendCustomEmail(recipientEmail, rendered.subject, rendered.html, rendered.text);
    
    res.json({ success: true, message: 'Test-E-Mail gesendet' });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Senden der Test-E-Mail' });
  }
});

router.get('/email-templates/:type/variables', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Ungültiger Template-Typ' });
    }
    
    const variables = emailTemplateService.getVariables(type as any);
    res.json(variables);
  } catch (error) {
    console.error('Error fetching template variables:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== EMAIL FOOTER ==============

router.get('/email-footer', requireAdmin, async (req, res) => {
  try {
    const footer = await emailTemplateService.getEmailFooter();
    res.json(footer);
  } catch (error) {
    console.error('Error fetching email footer:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/email-footer', requireAdmin, async (req, res) => {
  try {
    const { html, text } = req.body;
    
    if (!html && !text) {
      return res.status(400).json({ error: 'Fußzeilen-Text erforderlich' });
    }
    
    const footer = await emailTemplateService.setEmailFooter({
      html: html || text || '',
      text: text || html || ''
    });
    res.json(footer);
  } catch (error) {
    console.error('Error updating email footer:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// ============== EMAIL THEME ==============

router.get('/email-theme', requireAdmin, async (req, res) => {
  try {
    const theme = await emailTemplateService.getEmailTheme();
    res.json(theme);
  } catch (error) {
    console.error('Error fetching email theme:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.put('/email-theme', requireAdmin, async (req, res) => {
  try {
    const validatedTheme: Record<string, unknown> = {};
    const body = req.body;
    
    if (typeof body !== 'object' || body === null) {
      return res.status(400).json({ error: 'Ungültiges Theme-Format' });
    }
    
    const colorFields = ['backdropColor', 'canvasColor', 'textColor', 'headingColor', 'linkColor', 'buttonBackgroundColor', 'buttonTextColor'];
    const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|white|black|red|green|blue|yellow|orange|purple|gray|grey|transparent)$/i;
    
    for (const field of colorFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string' && colorRegex.test(body[field].trim())) {
          validatedTheme[field] = body[field].trim();
        }
      }
    }
    
    if (body.fontFamily !== undefined) {
      if (typeof body.fontFamily === 'string' && /^[A-Za-z0-9 ,\-']+$/.test(body.fontFamily.trim()) && body.fontFamily.trim().length <= 200) {
        validatedTheme.fontFamily = body.fontFamily.trim();
      }
    }
    
    if (body.buttonBorderRadius !== undefined) {
      const radius = Number(body.buttonBorderRadius);
      if (!isNaN(radius) && radius >= 0 && radius <= 100) {
        validatedTheme.buttonBorderRadius = Math.round(radius);
      }
    }
    
    const theme = await emailTemplateService.setEmailTheme(validatedTheme);
    res.json(theme);
  } catch (error) {
    console.error('Error updating email theme:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/email-theme/reset', requireAdmin, async (req, res) => {
  try {
    const theme = await emailTemplateService.resetEmailTheme();
    res.json(theme);
  } catch (error) {
    console.error('Error resetting email theme:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/email-theme/import', requireAdmin, async (req, res) => {
  try {
    const { jsonContent } = req.body;
    
    if (!jsonContent) {
      return res.status(400).json({ error: 'JSON-Inhalt erforderlich' });
    }
    
    const extractedTheme = emailTemplateService.extractThemeFromEmailBuilder(jsonContent);
    
    if (Object.keys(extractedTheme).length === 0) {
      return res.status(400).json({ 
        error: 'Keine Theme-Eigenschaften im JSON gefunden',
        message: 'Das JSON enthält keine gültigen Farb- oder Schriftart-Einstellungen.'
      });
    }
    
    res.json({ 
      preview: extractedTheme,
      message: 'Theme-Vorschau erstellt.'
    });
  } catch (error) {
    console.error('Error extracting email theme:', error);
    res.status(500).json({ error: 'Fehler beim Extrahieren des Themes' });
  }
});

router.post('/email-theme/import/confirm', requireAdmin, async (req, res) => {
  try {
    const { jsonContent } = req.body;
    
    if (!jsonContent) {
      return res.status(400).json({ error: 'JSON-Inhalt erforderlich' });
    }
    
    const theme = await emailTemplateService.importThemeFromEmailBuilder(jsonContent);
    res.json({ 
      theme,
      message: 'Theme erfolgreich importiert und gespeichert.'
    });
  } catch (error) {
    console.error('Error importing email theme:', error);
    res.status(500).json({ error: 'Fehler beim Importieren des Themes' });
  }
});

// ============== MATRIX (admin) ==============

router.post('/matrix/test', requireAdmin, async (req, res) => {
  try {
    const result = await matrixService.testMatrixConnection();
    res.json(result);
  } catch (error: any) {
    console.error('Matrix connection test error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ============== TEST RUNS (admin) ==============

router.get('/test-runs', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await testRunnerService.getTestRunHistory(limit);
    
    // Transform to match frontend expected structure
    const transformedRuns = await Promise.all(runs.map(async (run) => {
      const results = await testRunnerService.getTestResultsForRun(run.id);
      return {
        id: String(run.id),
        status: run.status as 'running' | 'completed' | 'failed',
        startedAt: run.startedAt?.toISOString() || new Date().toISOString(),
        completedAt: run.completedAt?.toISOString(),
        results: results.map(r => ({
          id: String(r.id),
          name: r.testName,
          status: r.status as 'passed' | 'failed' | 'skipped' | 'running',
          duration: r.duration,
          error: r.error || undefined
        })),
        summary: {
          total: run.totalTests || 0,
          passed: run.passed || 0,
          failed: run.failed || 0,
          skipped: run.skipped || 0
        }
      };
    }));
    
    res.json(transformedRuns);
  } catch (error) {
    console.error('Error fetching test runs:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.get('/test-runs/current', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const currentRun = await testRunnerService.getCurrentTestRun();
    
    if (!currentRun) {
      return res.json(null);
    }
    
    // Transform to match frontend expected structure
    const results = await testRunnerService.getTestResultsForRun(currentRun.id);
    
    // For running tests, get live progress
    const liveProgress = testRunnerService.getLiveProgress();
    
    // For running tests, use estimated total from last completed run if no results yet
    let estimatedTotal = currentRun.totalTests || 0;
    if (currentRun.status === 'running' && estimatedTotal === 0) {
      // Get last completed test run's total as estimate
      const [lastRun] = await db
        .select({ totalTests: testRuns.totalTests })
        .from(testRuns)
        .where(and(
          ne(testRuns.id, currentRun.id),
          or(eq(testRuns.status, 'completed'), eq(testRuns.status, 'failed'))
        ))
        .orderBy(desc(testRuns.id))
        .limit(1);
      estimatedTotal = lastRun?.totalTests || 320; // fallback estimate
    }
    
    // Use live progress if test is running
    const passed = liveProgress ? liveProgress.passed : (currentRun.passed || 0);
    const failed = liveProgress ? liveProgress.failed : (currentRun.failed || 0);
    const skipped = liveProgress ? liveProgress.skipped : (currentRun.skipped || 0);
    
    const transformed = {
      id: String(currentRun.id),
      status: currentRun.status as 'running' | 'completed' | 'failed',
      startedAt: currentRun.startedAt?.toISOString() || new Date().toISOString(),
      completedAt: currentRun.completedAt?.toISOString(),
      results: results.map(r => ({
        id: String(r.id),
        name: r.testName,
        status: r.status as 'passed' | 'failed' | 'skipped' | 'running',
        duration: r.duration,
        error: r.error || undefined
      })),
      summary: {
        total: estimatedTotal,
        passed,
        failed,
        skipped
      },
      isEstimated: currentRun.status === 'running' && (currentRun.totalTests || 0) === 0,
      liveProgress: liveProgress ? {
        currentTest: liveProgress.currentTest,
        currentFile: liveProgress.currentFile
      } : null
    };
    
    res.json(transformed);
  } catch (error) {
    console.error('Error fetching current test run:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

router.post('/test-runs', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    const runId = await testRunnerService.runAllTests('manual');
    res.json({ runId, message: 'Test-Lauf gestartet' });
  } catch (error) {
    console.error('Error starting test run:', error);
    res.status(500).json({ error: 'Tests konnten nicht gestartet werden' });
  }
});

router.post('/test-runs/stop', requireAdmin, async (req, res) => {
  try {
    const testRunnerService = await import('../services/testRunnerService');
    await testRunnerService.stopCurrentTest();
    res.json({ success: true, message: 'Test-Lauf gestoppt' });
  } catch (error) {
    console.error('Error stopping test run:', error);
    res.status(500).json({ error: 'Test-Lauf konnte nicht gestoppt werden' });
  }
});

// ============== LOGO UPLOAD (admin) ==============

router.post('/customization/logo', requireAdmin, imageService.getUploadMiddleware().single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    const result = await imageService.processUpload(req.file, {
      userId: (req as any).user?.id,
      email: (req as any).user?.email,
    });

    if (!result.success) {
      const statusCode = result.virusName ? 422 : 500;
      return res.status(statusCode).json({
        error: result.error,
        virusName: result.virusName,
      });
    }

    const settings = await storage.getCustomizationSettings();
    const updatedBranding = {
      ...settings.branding,
      logoUrl: result.imageUrl || null,
    };
    await storage.setCustomizationSettings({ branding: updatedBranding });

    res.json({ logoUrl: result.imageUrl });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Logo upload failed' });
  }
});

// ============== LOGO DELETE (admin) ==============

router.delete('/customization/logo', requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    const updatedBranding = {
      ...settings.branding,
      logoUrl: null,
    };
    await storage.setCustomizationSettings({ branding: updatedBranding });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({ error: 'Logo deletion failed' });
  }
});

// ============== BRANDING RESET (admin) ==============

router.post('/branding/reset', requireAdmin, async (req, res) => {
  try {
    const { resetBrandingToDefaults } = await import('../scripts/applyBranding');
    const result = await resetBrandingToDefaults(storage);
    
    if (result.success) {
      const settings = await storage.getCustomizationSettings();
      res.json({ 
        success: true, 
        message: result.message,
        settings 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.message 
      });
    }
  } catch (error) {
    console.error('Error resetting branding:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

export default router;
