import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "./common";
import { matrixService } from "../services/matrixService";
import { imageService } from "../services/imageService";
import { emailService } from "../services/emailService";

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/email-status', (req, res) => {
  res.json({ smtpConfigured: emailService.smtpConfigured });
});

// Public endpoint for theme/branding (for frontend to apply without auth)
router.get('/customization', async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching public customization settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Public endpoint for accessibility settings (for E2E tests and frontend)
router.get('/settings/accessibility', async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    const wcagOverrideEnv = process.env.POLLY_WCAG_OVERRIDE === 'true';
    
    const enforceDefaultTheme = wcagOverrideEnv ? false : (settings.wcag?.enforceDefaultTheme ?? true);
    
    res.json({
      enforceDefaultTheme,
      wcagOverrideEnv,
      message: enforceDefaultTheme 
        ? 'Using default WCAG 2.1 AA compliant theme'
        : 'Custom theme active - admin has taken responsibility for accessibility compliance',
    });
  } catch (error) {
    console.error('Error fetching accessibility settings:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Mobile-optimized theming endpoint for Flutter/KH App integration
router.get('/customization/mobile', async (req, res) => {
  try {
    const settings = await storage.getCustomizationSettings();
    const baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || `https://${req.get('host')}`;
    
    const siteName = settings.branding?.siteName || 'Polly';
    const siteNameAccent = settings.branding?.siteNameAccent || 'y';
    const siteNameFirst = siteName.replace(siteNameAccent, '').trim();
    
    const mobileTheme = {
      branding: {
        siteName: siteName,
        siteNameFirst: siteNameFirst,
        siteNameAccent: siteNameAccent,
        logoUrl: settings.branding?.logoUrl 
          ? (settings.branding.logoUrl.startsWith('http') 
              ? settings.branding.logoUrl 
              : `${baseUrl}${settings.branding.logoUrl}`)
          : null,
        faviconUrl: settings.branding?.faviconUrl
          ? (settings.branding.faviconUrl.startsWith('http')
              ? settings.branding.faviconUrl
              : `${baseUrl}${settings.branding.faviconUrl}`)
          : null,
      },
      theme: {
        primaryColor: settings.theme?.primaryColor || '#4f46e5',
        primaryColorRGB: hexToRgb(settings.theme?.primaryColor || '#4f46e5'),
        scheduleColor: settings.theme?.scheduleColor || '#10b981',
        surveyColor: settings.theme?.surveyColor || '#6366f1',
        organizationColor: settings.theme?.organizationColor || '#f59e0b',
        borderRadius: settings.theme?.borderRadius || 8,
      },
      matrix: {
        enabled: matrixService.isMatrixEnabled(),
        searchEnabled: matrixService.getMatrixConfig().searchEnabled,
      },
    };
    
    res.json(mobileTheme);
  } catch (error) {
    console.error('Error fetching mobile customization:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Matrix chat routes
router.get('/matrix/status', async (req, res) => {
  try {
    res.json({
      enabled: matrixService.isMatrixEnabled(),
      searchEnabled: matrixService.getMatrixConfig().searchEnabled,
    });
  } catch (error) {
    res.json({ enabled: false, searchEnabled: false });
  }
});

router.get('/matrix/users/search', requireAuth, async (req, res) => {
  try {
    if (!matrixService.isMatrixEnabled()) {
      return res.status(400).json({ error: 'Matrix ist nicht konfiguriert' });
    }

    const searchTerm = req.query.q as string;
    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ results: [], limited: false });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const result = await matrixService.searchMatrixUsers(searchTerm, limit);
    res.json(result);
  } catch (error: any) {
    console.error('Matrix user search error:', error);
    res.status(500).json({ error: error.message || 'Suche fehlgeschlagen' });
  }
});

router.post('/polls/:token/invite/matrix', requireAuth, async (req, res) => {
  try {
    if (!matrixService.isMatrixEnabled()) {
      return res.status(400).json({ error: 'Matrix ist nicht konfiguriert' });
    }

    const { token } = req.params;
    const { userIds, customMessage } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Keine Matrix-Benutzer ausgewählt' });
    }

    const poll = await storage.getPollByAdminToken(token);
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }

    if (poll.userId !== req.session.userId) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || `https://${req.get('host')}`;
    const pollUrl = `${baseUrl}/poll/${poll.publicToken}`;

    const result = await matrixService.sendPollInvitation(
      userIds,
      poll.title,
      pollUrl,
      customMessage
    );

    res.json({
      success: true,
      sent: result.sent.length,
      failed: result.failed.length,
      details: result,
    });
  } catch (error: any) {
    console.error('Matrix invitation error:', error);
    res.status(500).json({ error: error.message || 'Einladung fehlgeschlagen' });
  }
});

// Legacy compatibility route: /matrix/test -> /admin/matrix/test
// The primary endpoint is now at /admin/matrix/test
router.post('/matrix/test', requireAdmin, async (req, res) => {
  try {
    const result = await matrixService.testMatrixConnection();
    res.json(result);
  } catch (error: any) {
    console.error('Matrix connection test error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Get theme preference (returns user's preference, cookie, or system default)
router.get('/theme', async (req, res) => {
  try {
    // First check if user is authenticated
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        return res.json({ 
          themePreference: user.themePreference || 'system',
          source: 'user'
        });
      }
    }
    
    // Check for cookie
    const cookieTheme = req.cookies?.theme_preference;
    if (cookieTheme && ['light', 'dark', 'system'].includes(cookieTheme)) {
      return res.json({ 
        themePreference: cookieTheme,
        source: 'cookie'
      });
    }
    
    // Get system default from customization settings
    const settings = await storage.getCustomizationSettings();
    return res.json({ 
      themePreference: settings.theme?.defaultThemeMode || 'system',
      source: 'default'
    });
  } catch (error) {
    console.error('Error getting theme preference:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Set theme cookie for guests
router.post('/theme', async (req, res) => {
  try {
    const { themePreference } = req.body;
    if (!themePreference || !['light', 'dark', 'system'].includes(themePreference)) {
      return res.status(400).json({ error: 'Ungültige Theme-Einstellung' });
    }
    
    // Set HTTP-only cookie for theme preference
    res.cookie('theme_preference', themePreference, {
      httpOnly: false, // Frontend needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    });
    
    res.json({ success: true, themePreference });
  } catch (error) {
    console.error('Error setting theme cookie:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Upload image
router.post('/upload/image', imageService.getUploadMiddleware().single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  
  const scanContext = {
    userId: (req as any).session?.userId || undefined,
    email: (req as any).session?.email || undefined,
    requestIp: req.ip || req.socket.remoteAddress || undefined,
  };
  
  const result = await imageService.processUpload(req.file, scanContext);
  
  if (!result.success) {
    let statusCode = 500;
    if (result.virusName) statusCode = 422;
    else if (result.scannerUnavailable) statusCode = 503;
    return res.status(statusCode).json({ 
      error: result.error,
      virusName: result.virusName,
      scannerUnavailable: result.scannerUnavailable,
    });
  }
  
  res.json({ imageUrl: result.imageUrl });
});

export default router;
