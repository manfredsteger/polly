import { Router } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { z } from "zod";
import {
  extractUserId,
  createPollSchema,
  requireEmailVerified,
} from "./common";
import { pollCreationRateLimiter } from "../services/apiRateLimiterService";

const router = Router();

// Create poll (anonymous or authenticated, with rate limiting)
// For logged-in users, email must be verified
router.post('/', pollCreationRateLimiter, requireEmailVerified, async (req, res) => {
  try {
    const data = createPollSchema.parse(req.body);
    
    // SECURITY: Derive userId and creatorEmail from session, not from client input
    let userId: number | null = null;
    let creatorEmail: string | null = null;
    
    if (req.session?.userId) {
      const sessionUser = await storage.getUser(req.session.userId);
      if (sessionUser) {
        userId = sessionUser.id;
        creatorEmail = sessionUser.email;
      } else {
        return res.status(401).json({ error: 'Invalid session' });
      }
      if (data.creatorEmail && data.creatorEmail !== creatorEmail) {
        console.warn(`Authenticated user ${userId} tried to set different creatorEmail: ${data.creatorEmail}`);
      }
    } else {
      creatorEmail = data.creatorEmail || null;
      
      if (creatorEmail) {
        const registeredUser = await storage.getUserByEmail(creatorEmail.toLowerCase().trim());
        if (registeredUser) {
          return res.status(409).json({
            error: 'Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an, um eine Umfrage zu erstellen.',
            errorCode: 'REQUIRES_LOGIN'
          });
        }
      }
    }
    
    // Smart notification validation
    let enableExpiryReminder = data.enableExpiryReminder ?? false;
    let expiryReminderHours = data.expiryReminderHours ?? 24;
    
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      
      if (hoursUntilExpiry < 6) {
        enableExpiryReminder = false;
        console.log(`[Notification] Poll expires in ${hoursUntilExpiry.toFixed(1)}h - reminder disabled (too short)`);
      } else if (enableExpiryReminder && expiryReminderHours >= hoursUntilExpiry) {
        const cappedHours = Math.max(1, Math.floor(hoursUntilExpiry * 0.5));
        if (cappedHours < 1) {
          enableExpiryReminder = false;
        } else {
          expiryReminderHours = cappedHours;
        }
      }
    } else {
      enableExpiryReminder = false;
    }
    
    const pollData = {
      title: data.title,
      description: data.description,
      type: data.type,
      userId: userId,
      creatorEmail: creatorEmail,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      enableExpiryReminder,
      expiryReminderHours,
      allowMultipleSlots: data.allowMultipleSlots,
      allowVoteEdit: data.allowVoteEdit,
      allowVoteWithdrawal: data.allowVoteWithdrawal,
      resultsPublic: data.resultsPublic,
      isTestData: req.isTestMode === true,
    };

    const options = data.options.map((opt, index) => ({
      text: opt.text,
      imageUrl: opt.imageUrl === "" ? null : opt.imageUrl || null,
      altText: opt.altText === "" ? null : opt.altText || null,
      startTime: opt.startTime ? new Date(opt.startTime) : null,
      endTime: opt.endTime ? new Date(opt.endTime) : null,
      maxCapacity: opt.maxCapacity || null,
      order: index,
      pollId: "",
    }));

    const result = await storage.createPoll(pollData, options);
    
    if (creatorEmail) {
      const { getBaseUrl } = await import('../utils/baseUrl');
      const baseUrl = getBaseUrl();
      const publicLink = `${baseUrl}/poll/${result.poll.publicToken}`;
      const adminLink = `${baseUrl}/admin/${result.poll.adminToken}`;
      
      await emailService.sendPollCreationEmails(
        creatorEmail,
        data.title,
        publicLink,
        adminLink,
        data.type
      );
    }

    res.json({
      poll: { ...result.poll, options: result.options },
      publicToken: result.publicToken,
      adminToken: result.adminToken,
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get poll by public token
router.get('/public/:token', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    const { adminToken, ...pollData } = poll;
    res.json(pollData);
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get poll by admin token (full access)
router.get('/admin/:token', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ 
          error: 'Anmeldung erforderlich',
          message: 'Diese Umfrage wurde von einem registrierten Benutzer erstellt. Bitte melden Sie sich an, um die Administrationsseite aufzurufen.',
          requiresAuth: true
        });
      }
      
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ 
          error: 'Keine Berechtigung',
          message: 'Sie können nur Ihre eigenen Umfragen verwalten.'
        });
      }
    }
    
    res.json(poll);
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update poll by admin token
router.patch('/admin/:token', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ 
          error: 'Anmeldung erforderlich',
          requiresAuth: true
        });
      }
      
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const { isActive, title, description, expiresAt, resultsPublic, allowVoteEdit, allowVoteWithdrawal, allowMaybe, allowMultipleSlots } = req.body;
    
    const updates: Record<string, any> = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (resultsPublic !== undefined) updates.resultsPublic = resultsPublic;
    if (allowVoteEdit !== undefined) updates.allowVoteEdit = allowVoteEdit;
    if (allowVoteWithdrawal !== undefined) updates.allowVoteWithdrawal = allowVoteWithdrawal;
    if (allowMaybe !== undefined) updates.allowMaybe = allowMaybe;
    if (allowMultipleSlots !== undefined) updates.allowMultipleSlots = allowMultipleSlots;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Updates angegeben' });
    }
    
    const updatedPoll = await storage.updatePoll(poll.id, updates);
    res.json(updatedPoll);
  } catch (error) {
    console.error('Error updating poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete poll by admin token
router.delete('/admin/:token', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    await storage.deletePoll(poll.id);
    res.json({ success: true, message: 'Umfrage gelöscht' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Finalize poll schema
const finalizeSchema = z.object({
  optionId: z.number().int().nonnegative(),
}).strict();

// Finalize poll (set final option)
router.post('/admin/:token/finalize', async (req, res) => {
  try {
    const parseResult = finalizeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Ungültige Anfrage',
        details: parseResult.error.errors 
      });
    }
    
    const { optionId } = parseResult.data;
    
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ 
          error: 'Anmeldung erforderlich',
          requiresAuth: true
        });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    if (optionId !== 0) {
      const optionExists = poll.options.some((o: { id: number }) => o.id === optionId);
      if (!optionExists) {
        return res.status(400).json({ error: 'Option nicht gefunden' });
      }
    }
    
    const finalOptionId = optionId === 0 ? null : optionId;
    const updatedPoll = await storage.updatePoll(poll.id, { finalOptionId });
    
    res.json({ 
      success: true, 
      poll: updatedPoll,
      message: finalOptionId ? 'Finaler Termin wurde festgelegt' : 'Finalisierung wurde aufgehoben'
    });
  } catch (error) {
    console.error('Error finalizing poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add option to poll
router.post('/admin/:token/options', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const { text, startTime, endTime, maxCapacity, imageUrl, altText, order } = req.body;
    
    if (!text && !startTime) {
      return res.status(400).json({ error: 'Text oder Startzeit erforderlich' });
    }
    
    const newOption = await storage.addPollOption({
      pollId: poll.id,
      text: text || '',
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      maxCapacity: maxCapacity,
      imageUrl: imageUrl,
      altText: altText,
      order: order,
    });
    
    res.status(201).json(newOption);
  } catch (error) {
    console.error('Error adding poll option:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update option in poll
router.patch('/admin/:token/options/:optionId', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const optionId = parseInt(req.params.optionId);
    const existingOption = poll.options?.find(o => o.id === optionId);
    if (!existingOption) {
      return res.status(404).json({ error: 'Option nicht gefunden' });
    }
    
    const { text, startTime, endTime, maxCapacity, imageUrl, altText, order } = req.body;
    
    const updates: Record<string, any> = {};
    if (text !== undefined) updates.text = text;
    if (startTime !== undefined) updates.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) updates.endTime = endTime ? new Date(endTime) : null;
    if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (altText !== undefined) updates.altText = altText;
    if (order !== undefined) updates.order = order;
    
    const updatedOption = await storage.updatePollOption(optionId, updates);
    res.json(updatedOption);
  } catch (error) {
    console.error('Error updating poll option:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete option from poll
router.delete('/admin/:token/options/:optionId', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const optionId = parseInt(req.params.optionId);
    const existingOption = poll.options?.find(o => o.id === optionId);
    if (!existingOption) {
      return res.status(404).json({ error: 'Option nicht gefunden' });
    }
    
    await storage.deletePollOption(optionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting poll option:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send invitations
router.post('/admin/:token/invite', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const { emails, customMessage } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'E-Mail-Adressen erforderlich' });
    }
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
    
    // Get sender name
    let senderName = 'Jemand';
    if (poll.userId) {
      const user = await storage.getUser(poll.userId);
      if (user) {
        senderName = user.name || user.username || 'Jemand';
      }
    }
    
    const results = await emailService.sendBulkInvitations(
      emails,
      poll.title,
      senderName,
      publicLink,
      customMessage
    );
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send reminders
router.post('/admin/:token/remind', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const { emails, customMessage } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'E-Mail-Adressen erforderlich' });
    }
    
    // Check reminder limits
    const reminderCount = await storage.getManualReminderCount(poll.id);
    const lastReminder = await storage.getLastManualReminderTime(poll.id);
    const now = new Date();
    
    // Max 3 manual reminders per poll
    if (reminderCount >= 3) {
      return res.status(429).json({ 
        error: 'Maximale Anzahl an Erinnerungen (3) erreicht',
        errorCode: 'REMINDER_LIMIT_REACHED'
      });
    }
    
    // Minimum 4 hours between reminders
    if (lastReminder) {
      const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 4) {
        return res.status(429).json({ 
          error: 'Bitte warten Sie mindestens 4 Stunden zwischen Erinnerungen',
          errorCode: 'REMINDER_TOO_SOON',
          waitMinutes: Math.ceil((4 - hoursSinceLastReminder) * 60)
        });
      }
    }
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const pollLink = `${baseUrl}/poll/${poll.publicToken}`;
    
    // Get sender name
    let senderName = 'Jemand';
    if (poll.userId) {
      const user = await storage.getUser(poll.userId);
      if (user) {
        senderName = user.name || user.username || 'Jemand';
      }
    }
    
    const expiresAt = poll.expiresAt 
      ? `Die Umfrage endet am ${new Date(poll.expiresAt).toLocaleDateString('de-DE')} um ${new Date(poll.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
      : undefined;
    
    const results = await emailService.sendBulkReminders(
      emails,
      poll.title,
      senderName,
      pollLink,
      expiresAt,
      customMessage
    );
    
    // Log each reminder
    for (const email of emails) {
      await storage.logNotification({
        pollId: poll.id,
        type: 'manual_reminder',
        recipientEmail: email,
      });
    }
    
    res.json({ 
      success: true, 
      results,
      remainingReminders: 3 - reminderCount - 1
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get poll results
router.get('/:token/results', async (req, res) => {
  try {
    let poll;
    let isAdmin = false;
    
    poll = await storage.getPollByAdminToken(req.params.token);
    if (poll) {
      isAdmin = true;
    } else {
      poll = await storage.getPollByPublicToken(req.params.token);
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.resultsPublic && !isAdmin) {
      const userId = await extractUserId(req);
      const isCreator = userId && poll.userId === userId;
      
      if (!isCreator) {
        return res.status(403).json({ 
          error: 'Ergebnisse sind nur für den Ersteller sichtbar',
          resultsPrivate: true 
        });
      }
    }

    const results = await storage.getPollResults(poll.id);
    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's polls (mounted at /polls, so full path is /polls/my-polls)
router.get('/my-polls', async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    
    const polls = await storage.getUserPolls(userId);
    res.json(polls);
  } catch (error) {
    console.error('Error fetching user polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get shared polls (polls user participated in, mounted at /polls, so full path is /polls/shared-polls)
router.get('/shared-polls', async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const participations = await storage.getUserParticipations(userId, user.email);
    res.json(participations);
  } catch (error) {
    console.error('Error fetching shared polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get vote count for admin
router.get('/admin/:token/vote-count', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ 
          error: 'Anmeldung erforderlich',
          requiresAuth: true
        });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const totalVotes = poll.votes?.length || 0;
    const uniqueVoters = new Set(poll.votes?.map(v => v.voterEmail)).size;
    
    res.json({ totalVotes, uniqueVoters });
  } catch (error) {
    console.error('Error getting vote count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy compatibility route: /:token/invite -> /admin/:token/invite
// The frontend still uses /polls/${token}/invite
router.post('/:token/invite', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (poll.userId) {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Anmeldung erforderlich', requiresAuth: true });
      }
      if (req.session.userId !== poll.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }
    
    const { emails, customMessage } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'E-Mail-Adressen erforderlich' });
    }
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
    
    // Get sender name
    let senderName = 'Jemand';
    if (poll.userId) {
      const user = await storage.getUser(poll.userId);
      if (user) {
        senderName = user.name || user.username || 'Jemand';
      }
    }
    
    const results = await emailService.sendBulkInvitations(
      emails,
      poll.title,
      senderName,
      publicLink,
      customMessage
    );
    
    res.json({ 
      success: true, 
      sent: results.sent,
      failed: results.failed.length,
      results 
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reminder status for a poll
router.get('/:token/reminder-status', async (req, res) => {
  try {
    const poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }

    const notificationSettings = await storage.getNotificationSettings();
    const reminderCount = await storage.getManualReminderCount(poll.id);
    const lastReminder = await storage.getLastManualReminderTime(poll.id);
    const isGuest = !req.session.userId || !poll.userId;

    const maxReminders = isGuest 
      ? notificationSettings.guestReminderLimitPerPoll 
      : notificationSettings.userReminderLimitPerPoll;

    let canSendReminder = notificationSettings.enabled && notificationSettings.manualRemindersEnabled;
    let reason = '';

    if (!canSendReminder) {
      reason = 'Erinnerungen sind systemweit deaktiviert';
    } else if (isGuest && !notificationSettings.guestsCanSendReminders) {
      canSendReminder = false;
      reason = 'Gäste können keine Erinnerungen senden';
    } else if (reminderCount >= maxReminders) {
      canSendReminder = false;
      reason = `Maximale Anzahl (${maxReminders}) erreicht`;
    } else if (lastReminder) {
      const cooldownMs = notificationSettings.reminderCooldownMinutes * 60 * 1000;
      const timeSinceLastReminder = Date.now() - lastReminder.getTime();
      if (timeSinceLastReminder < cooldownMs) {
        canSendReminder = false;
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastReminder) / 60000);
        reason = `Bitte warten Sie noch ${remainingMinutes} Minuten`;
      }
    }

    res.json({
      canSendReminder,
      reason,
      remindersSent: reminderCount,
      maxReminders,
      lastReminderAt: lastReminder,
      cooldownMinutes: notificationSettings.reminderCooldownMinutes,
      isGuest,
    });
  } catch (error) {
    console.error('Error fetching reminder status:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

export default router;
