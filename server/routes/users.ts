import { Router } from "express";
import { storage } from "../storage";
import { extractUserId, requireAuth } from "./common";
import { deviceTokenService } from "../services/deviceTokenService";

const router = Router();

// Get user dashboard data
router.get('/users/:userId/dashboard', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userPolls = await storage.getUserPolls(userId);
    const sharedPolls = await storage.getSharedPolls(userId);
    
    res.json({
      userPolls,
      sharedPolls,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
router.get('/user/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      organization: user.organization,
      role: user.role,
      provider: user.provider,
      themePreference: user.themePreference || 'system',
      languagePreference: user.languagePreference || 'de',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      deletionRequestedAt: user.deletionRequestedAt,
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Update user profile
router.put('/user/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    
    const { name, organization, themePreference, languagePreference } = req.body;
    const updates: Record<string, any> = {};
    
    if (name) updates.name = name;
    if (organization !== undefined) updates.organization = organization;
    if (themePreference && ['light', 'dark', 'system'].includes(themePreference)) {
      updates.themePreference = themePreference;
    }
    if (languagePreference && ['de', 'en'].includes(languagePreference)) {
      updates.languagePreference = languagePreference;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Updates angegeben' });
    }
    
    const user = await storage.updateUser(req.session.userId, updates);
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      organization: user.organization,
      role: user.role,
      provider: user.provider,
      themePreference: user.themePreference || 'system',
      languagePreference: user.languagePreference || 'de',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Update user language preference (dedicated endpoint)
router.patch('/users/me/language', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    
    const { language } = req.body;
    if (!language || !['de', 'en'].includes(language)) {
      return res.status(400).json({ error: 'Ungültige Sprache. Erlaubt: de, en' });
    }
    
    const user = await storage.updateUser(req.session.userId, { languagePreference: language });
    res.json({
      languagePreference: user.languagePreference || 'de',
    });
  } catch (error) {
    console.error('Error updating language preference:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Register device token for push notifications
router.post('/users/me/device-tokens', requireAuth, async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    const { token, platform } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ error: 'Token und Plattform erforderlich' });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'Ungültige Plattform' });
    }

    await deviceTokenService.registerToken(userId, token);
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

// Remove device token
router.delete('/users/me/device-tokens', requireAuth, async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token erforderlich' });
    }

    await deviceTokenService.removeToken(userId, token);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing device token:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

export default router;
