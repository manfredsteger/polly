import type { Express, Request, Response, NextFunction, Router } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { votes, type Vote, type User } from "@shared/schema";
import { randomBytes } from "crypto";
import { emailService } from "./services/emailService";
import { pdfService } from "./services/pdfService";
import { qrService } from "./services/qrService";
import { imageService } from "./services/imageService";
import { authService } from "./services/authService";
import { tokenService } from "./services/tokenService";
import { loginRateLimiter } from "./services/rateLimiterService";
import { clamavService } from "./services/clamavService";
import { deviceTokenService } from "./services/deviceTokenService";
import { pentestToolsService, TOOL_IDS, TOOL_NAMES, SCAN_TYPES } from "./services/pentestToolsService";
import { emailTemplateService } from "./services/emailTemplateService";
import * as icsService from "./services/icsService";
import * as matrixService from "./matrix";
import { liveVotingService } from "./services/liveVotingService";
import { z } from "zod";
import path from "path";
import express from "express";
import bcrypt from "bcryptjs";
import "express-session";

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

declare module "express-session" {
  interface SessionData {
    userId?: number;
    keycloakCodeVerifier?: string;
    keycloakState?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      tokenUserId?: number;
      tokenUser?: User;
    }
  }
}

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

export const passwordSchema = z.string()
  .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
  .refine(pw => /[A-Z]/.test(pw), 'Passwort muss mindestens einen Großbuchstaben enthalten')
  .refine(pw => /[a-z]/.test(pw), 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
  .refine(pw => /[0-9]/.test(pw), 'Passwort muss mindestens eine Zahl enthalten')
  .refine(pw => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw), 'Passwort muss mindestens ein Sonderzeichen enthalten');

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: passwordSchema,
});

const extractUserId = async (req: Request): Promise<number | null> => {
  if (req.session?.userId) {
    return req.session.userId;
  }
  
  if (req.tokenUserId) {
    return req.tokenUserId;
  }
  
  const authHeader = req.headers.authorization;
  const bearerToken = tokenService.extractBearerToken(authHeader);
  
  if (bearerToken) {
    const result = await tokenService.validateToken(bearerToken);
    if (result.valid && result.userId) {
      req.tokenUserId = result.userId;
      req.tokenUser = result.user;
      return result.userId;
    }
  }
  
  return null;
};

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const userId = await extractUserId(req);
  if (!userId) {
    return res.status(401).json({ 
      error: 'Nicht angemeldet',
      errorCode: 'UNAUTHORIZED'
    });
  }
  next();
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = await extractUserId(req);
  if (!userId) {
    return res.status(401).json({ 
      error: 'Nicht angemeldet',
      errorCode: 'UNAUTHORIZED'
    });
  }
  
  const user = req.tokenUser || await storage.getUser(userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Administratorberechtigung erforderlich',
      errorCode: 'FORBIDDEN'
    });
  }
  
  next();
};

// Validation schemas
export const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['schedule', 'survey', 'organization']),
  creatorEmail: z.string().email().optional(),
  userId: z.number().optional(),
  expiresAt: z.string().datetime().optional(),
  enableExpiryReminder: z.boolean().optional().default(false),
  expiryReminderHours: z.number().min(1).max(168).optional().default(24),
  allowMultipleSlots: z.boolean().optional().default(true),
  allowVoteEdit: z.boolean().optional().default(false),
  allowVoteWithdrawal: z.boolean().optional().default(false),
  resultsPublic: z.boolean().optional().default(true),
  options: z.array(z.object({
    text: z.string().min(1),
    imageUrl: z.string().optional(),
    altText: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    maxCapacity: z.number().min(1).optional(),
    order: z.number().default(0),
  })).min(1),
});

const voteSchema = z.object({
  optionId: z.number(),
  voterName: z.string().min(1),
  voterEmail: z.string().email(),
  response: z.enum(['yes', 'maybe', 'no']),
  comment: z.string().optional(),
});

const inviteSchema = z.object({
  emails: z.array(z.string().email()),
  customMessage: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Matrix from stored settings
  try {
    const customization = await storage.getCustomizationSettings();
    if (customization.matrix && customization.matrix.enabled) {
      matrixService.updateMatrixConfig({
        enabled: customization.matrix.enabled,
        homeserverUrl: customization.matrix.homeserverUrl,
        botUserId: customization.matrix.botUserId,
        botAccessToken: customization.matrix.botAccessToken,
        searchEnabled: customization.matrix.searchEnabled,
      });
      console.log('[Matrix] Initialized from stored settings');
    }
  } catch (error) {
    console.log('[Matrix] No stored settings found, integration disabled');
  }

  // Create versioned API router
  const v1Router = express.Router();

  // Health check endpoint for Docker/monitoring (unversioned - stays at /api/health)
  app.get("/api/health", async (req, res) => {
    try {
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        apiVersion: API_VERSION
      });
    } catch (error) {
      res.status(503).json({ status: "unhealthy", error: String(error) });
    }
  });

  // Serve uploaded images (unversioned static files)
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));
  
  // Upload image endpoint - with ClamAV virus scan before persistence
  v1Router.post('/upload/image', imageService.getUploadMiddleware().single('image'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const result = await imageService.processUpload(req.file);
    
    if (!result.success) {
      const statusCode = result.virusName ? 422 : 500;
      return res.status(statusCode).json({ 
        error: result.error,
        virusName: result.virusName,
      });
    }
    
    res.json({ imageUrl: result.imageUrl });
  });
  // Create poll (anonymous or authenticated)
  v1Router.post('/polls', async (req, res) => {
    try {
      const data = createPollSchema.parse(req.body);
      
      // SECURITY: Derive userId and creatorEmail from session, not from client input
      // Never trust client-provided userId or creatorEmail when user is logged in
      let userId: number | null = null;
      let creatorEmail: string | null = null;
      
      if (req.session?.userId) {
        // Authenticated user - always get info from database, ignore any client-provided values
        const sessionUser = await storage.getUser(req.session.userId);
        if (sessionUser) {
          userId = sessionUser.id;
          creatorEmail = sessionUser.email;
        } else {
          // Session references non-existent user - this shouldn't happen
          return res.status(401).json({ error: 'Invalid session' });
        }
        // SECURITY: Ignore any client-provided creatorEmail for authenticated users
        if (data.creatorEmail && data.creatorEmail !== creatorEmail) {
          console.warn(`Authenticated user ${userId} tried to set different creatorEmail: ${data.creatorEmail}`);
          // Silently ignore - we use session email only
        }
      } else {
        // Guest user - use provided email (no userId)
        creatorEmail = data.creatorEmail || null;
        
        // SECURITY: Check if the provided email belongs to a registered user
        // If so, require them to log in first
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
      
      // Smart notification validation - prefer fewer emails over too many
      let enableExpiryReminder = data.enableExpiryReminder ?? false;
      let expiryReminderHours = data.expiryReminderHours ?? 24;
      
      if (data.expiresAt) {
        const expiresAt = new Date(data.expiresAt);
        const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        
        // If poll expires in less than 6 hours, disable reminders entirely
        if (hoursUntilExpiry < 6) {
          enableExpiryReminder = false;
          console.log(`[Notification] Poll expires in ${hoursUntilExpiry.toFixed(1)}h - reminder disabled (too short)`);
        }
        // If reminder hours exceed remaining time, cap or disable
        else if (enableExpiryReminder && expiryReminderHours >= hoursUntilExpiry) {
          // Cap to 50% of remaining time (minimum 1 hour)
          const cappedHours = Math.max(1, Math.floor(hoursUntilExpiry * 0.5));
          if (cappedHours < 1) {
            enableExpiryReminder = false;
            console.log(`[Notification] Reminder disabled - poll too short for meaningful reminder`);
          } else {
            expiryReminderHours = cappedHours;
            console.log(`[Notification] Reminder hours capped to ${cappedHours}h (poll expires in ${hoursUntilExpiry.toFixed(1)}h)`);
          }
        }
      } else {
        // No expiry date = no expiry reminder possible
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
        isTestData: req.isTestMode === true, // Mark as test data if in test mode
      };

      const options = data.options.map((opt, index) => ({
        text: opt.text,
        imageUrl: opt.imageUrl === "" ? null : opt.imageUrl || null,
        altText: opt.altText === "" ? null : opt.altText || null,
        startTime: opt.startTime ? new Date(opt.startTime) : null,
        endTime: opt.endTime ? new Date(opt.endTime) : null,
        maxCapacity: opt.maxCapacity || null,
        order: index,
        pollId: "", // This will be set in the storage layer
      }));

      const result = await storage.createPoll(pollData, options);
      
      // Send emails using the session-derived creatorEmail (secure)
      if (creatorEmail) {
        const { getBaseUrl } = await import('./utils/baseUrl');
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
  v1Router.get('/polls/public/:token', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      // Don't expose admin token for public access
      const { adminToken, ...pollData } = poll;
      res.json(pollData);
    } catch (error) {
      console.error('Error fetching poll:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get poll by admin token (full access)
  // If poll was created by a registered user, require authentication
  v1Router.get('/polls/admin/:token', async (req, res) => {
    try {
      const poll = await storage.getPollByAdminToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      // Security check: If poll was created by a registered user, require login
      if (poll.userId) {
        if (!req.session.userId) {
          return res.status(401).json({ 
            error: 'Anmeldung erforderlich',
            message: 'Diese Umfrage wurde von einem registrierten Benutzer erstellt. Bitte melden Sie sich an, um die Administrationsseite aufzurufen.',
            requiresAuth: true
          });
        }
        
        // Check if the logged-in user is the poll creator
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
  
  // Update poll by admin token (owner access)
  // If poll was created by a registered user, require authentication
  v1Router.patch('/polls/admin/:token', async (req, res) => {
    try {
      const poll = await storage.getPollByAdminToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      // Security check: If poll was created by a registered user, require login
      if (poll.userId) {
        if (!req.session.userId) {
          return res.status(401).json({ 
            error: 'Anmeldung erforderlich',
            message: 'Diese Umfrage wurde von einem registrierten Benutzer erstellt. Bitte melden Sie sich an.',
            requiresAuth: true
          });
        }
        
        // Check if the logged-in user is the poll creator
        if (req.session.userId !== poll.userId) {
          return res.status(403).json({ 
            error: 'Keine Berechtigung',
            message: 'Sie können nur Ihre eigenen Umfragen verwalten.'
          });
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

  // Add option to poll (admin access)
  v1Router.post('/polls/admin/:token/options', async (req, res) => {
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

  // Update option in poll (admin access)
  v1Router.patch('/polls/admin/:token/options/:optionId', async (req, res) => {
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

  // Delete option from poll (admin access)
  v1Router.delete('/polls/admin/:token/options/:optionId', async (req, res) => {
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
      
      const optionId = parseInt(req.params.optionId);
      const existingOption = poll.options?.find(o => o.id === optionId);
      if (!existingOption) {
        return res.status(404).json({ error: 'Option nicht gefunden' });
      }
      
      // Check if option has votes (return count for warning)
      const voteCount = poll.votes?.filter(v => v.optionId === optionId).length || 0;
      
      await storage.deletePollOption(optionId);
      res.json({ success: true, deletedVotes: voteCount });
    } catch (error) {
      console.error('Error deleting poll option:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get vote count for poll (for warnings)
  v1Router.get('/polls/admin/:token/vote-count', async (req, res) => {
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

  // Track recent email sends to prevent duplicates (email -> timestamp)
  const recentEmailSends = new Map<string, number>();
  const EMAIL_COOLDOWN = 60000; // 1 minute cooldown

  // Check if current user/device has already voted on a poll
  v1Router.get('/polls/:token/my-votes', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      // Calculate voterKey from session or device token
      const deviceToken = req.cookies?.deviceToken;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { voterKey, voterSource, newDeviceToken } = deviceTokenService.getVoterKey(
        req.session.userId || null,
        deviceToken,
        userAgent
      );
      
      // Set device token cookie if a new one was generated
      if (newDeviceToken) {
        res.cookie('deviceToken', newDeviceToken, deviceTokenService.getCookieOptions());
      }
      
      // Find existing votes by voterKey
      const existingVotes = await storage.getVotesByVoterKey(poll.id, voterKey);
      
      // Also check by userId if logged in (for backwards compatibility)
      let userVotes: typeof existingVotes = [];
      if (req.session.userId) {
        userVotes = await storage.getVotesByUserId(poll.id, req.session.userId);
      }
      
      // Merge votes (remove duplicates by optionId)
      const allVotes = [...existingVotes];
      for (const userVote of userVotes) {
        if (!allVotes.some(v => v.optionId === userVote.optionId)) {
          allVotes.push(userVote);
        }
      }
      
      res.json({
        hasVoted: allVotes.length > 0,
        votes: allVotes.map(v => ({
          optionId: v.optionId,
          response: v.response,
          voterName: v.voterName,
          voterEmail: v.voterEmail,
          comment: v.comment,
          voterEditToken: v.voterEditToken
        })),
        allowVoteEdit: poll.allowVoteEdit,
        allowVoteWithdrawal: poll.allowVoteWithdrawal,
        voterKey,
        voterSource
      });
    } catch (error) {
      console.error('Error checking votes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vote on poll (single vote - for backward compatibility and schedule polls)
  v1Router.post('/polls/:token/vote', async (req, res) => {
    try {
      const voteData = voteSchema.parse(req.body);
      
      // Verify poll exists and is active
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      if (!poll.isActive) {
        return res.status(400).json({ error: 'Poll is not active' });
      }
      
      if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
        return res.status(400).json({ error: 'Poll has expired' });
      }

      // Security check: If email belongs to a registered user, require login
      const voterEmailLower = voteData.voterEmail.toLowerCase().trim();
      const registeredUser = await storage.getUserByEmail(voterEmailLower);
      
      let currentUserId: number | null = null;
      
      if (registeredUser) {
        // Email belongs to a registered user - check if they are logged in
        if (!req.session.userId) {
          return res.status(409).json({ 
            error: 'Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an.',
            errorCode: 'REQUIRES_LOGIN'
          });
        }
        
        // User is logged in - verify it's their own email
        const currentUser = await storage.getUser(req.session.userId);
        if (!currentUser || currentUser.email.toLowerCase() !== voterEmailLower) {
          return res.status(409).json({ 
            error: 'Sie können nur mit Ihrer eigenen E-Mail-Adresse abstimmen.',
            errorCode: 'EMAIL_MISMATCH'
          });
        }
        
        currentUserId = currentUser.id;
        
        // Check if authenticated user has already voted on this poll
        const hasVoted = await storage.hasUserVoted(poll.id, currentUserId);
        if (hasVoted) {
          // User has already voted - check if editing is allowed
          if (!poll.allowVoteEdit) {
            return res.status(400).json({ 
              error: 'Sie haben bereits abgestimmt. Das Ändern von Stimmen ist bei dieser Umfrage nicht erlaubt.',
              errorCode: 'ALREADY_VOTED'
            });
          }
          // If editing is allowed, we'll let the storage layer handle the update
        }
      }

      // Calculate voterKey for deduplication
      const deviceToken = req.cookies?.deviceToken;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { voterKey, voterSource, newDeviceToken } = deviceTokenService.getVoterKey(
        currentUserId,
        deviceToken,
        userAgent
      );
      
      // Set device token cookie if a new one was generated
      if (newDeviceToken) {
        res.cookie('deviceToken', newDeviceToken, deviceTokenService.getCookieOptions());
      }

      // Add poll ID, userId, and voterKey to vote data
      const voteWithPollId = {
        ...voteData,
        pollId: poll.id,
        userId: currentUserId,
        voterKey,
        voterSource
      };
      
      // For authenticated users with existing votes: allow edit if poll.allowVoteEdit
      const vote = await storage.vote(voteWithPollId, poll.allowVoteEdit);
      
      // For organization polls: Broadcast slot update via WebSocket to all connected clients
      if (poll.type === 'organization') {
        // Fetch fresh poll data with updated votes
        const freshPoll = await storage.getPollByPublicToken(poll.publicToken);
        if (freshPoll) {
          const slotUpdates: Record<number, { currentCount: number; maxCapacity: number | null }> = {};
          for (const option of freshPoll.options) {
            const signupCount = freshPoll.votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
            slotUpdates[option.id] = {
              currentCount: signupCount,
              maxCapacity: option.maxCapacity
            };
          }
          // Broadcast to both public and admin tokens (clients may be connected via either)
          liveVotingService.broadcastSlotUpdate(poll.publicToken, slotUpdates);
          if (poll.adminToken) {
            liveVotingService.broadcastSlotUpdate(poll.adminToken, slotUpdates);
          }
        }
      }
      
      // Vote was successful - now send confirmation email (but only once per session)
      if (voteData.voterEmail) { // voterEmail is now always required
        const emailKey = `${voteData.voterEmail}-${poll.id}`;
        const now = Date.now();
        const lastSent = recentEmailSends.get(emailKey);
        
        // Only send email if we haven't sent one recently for this voter and poll
        if (!lastSent || (now - lastSent) > EMAIL_COOLDOWN) {
          const { getBaseUrl } = await import('./utils/baseUrl');
          const baseUrl = getBaseUrl();
          const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
          const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;
          
          // Send email asynchronously (don't wait for it)
          emailService.sendVotingConfirmationEmail(
            voteData.voterEmail,
            voteData.voterName,
            poll.title,
            poll.type as 'schedule' | 'survey',
            publicLink,  
            resultsLink
          ).catch(error => {
            console.error('Failed to send voting confirmation email:', error);
          });
          
          // Track that we sent an email
          recentEmailSends.set(emailKey, now);
          
          // Clean up old entries (older than 5 minutes)
          const entriesToDelete: string[] = [];
          recentEmailSends.forEach((timestamp, key) => {
            if (now - timestamp > 300000) { // 5 minutes
              entriesToDelete.push(key);
            }
          });
          entriesToDelete.forEach(key => recentEmailSends.delete(key));
        }
      }
      
      res.json(vote);
    } catch (error) {
      console.error('Error voting:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid vote data', details: error.errors });
      } else if (error instanceof Error && error.message === 'DUPLICATE_EMAIL_VOTE') {
        res.status(400).json({ 
          error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
          errorCode: 'DUPLICATE_EMAIL_VOTE'
        });
      } else if (error instanceof Error && error.message === 'SLOT_FULL') {
        res.status(409).json({ 
          error: 'Dieser Platz ist leider schon voll. Es gibt keine freien Plätze mehr.',
          errorCode: 'SLOT_FULL'
        });
      } else if (error instanceof Error && error.message === 'ALREADY_SIGNED_UP') {
        res.status(409).json({ 
          error: 'Sie haben sich bereits für einen Platz in dieser Liste eingetragen.',
          errorCode: 'ALREADY_SIGNED_UP'
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Bulk vote endpoint for surveys (handles multiple votes atomically)
  v1Router.post('/polls/:token/vote-bulk', async (req, res) => {
    try {
      const bulkVoteSchema = z.object({
        voterName: z.string().min(1),
        voterEmail: z.string().email(),
        votes: z.array(z.object({
          optionId: z.number(),
          response: z.enum(['yes', 'maybe', 'no'])
        })).min(1)
      });

      const bulkVoteData = bulkVoteSchema.parse(req.body);
      
      // Verify poll exists and is active
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      if (!poll.isActive) {
        return res.status(400).json({ error: 'Poll is not active' });
      }
      
      if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
        return res.status(400).json({ error: 'Poll has expired' });
      }

      // Security check: If email belongs to a registered user, require login
      const voterEmailLower = bulkVoteData.voterEmail.toLowerCase().trim();
      const registeredUser = await storage.getUserByEmail(voterEmailLower);
      
      let currentUserId: number | null = null;
      
      if (registeredUser) {
        // Email belongs to a registered user - check if they are logged in
        if (!req.session.userId) {
          return res.status(409).json({ 
            error: 'Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an.',
            errorCode: 'REQUIRES_LOGIN'
          });
        }
        
        // User is logged in - verify it's their own email
        const currentUser = await storage.getUser(req.session.userId);
        if (!currentUser || currentUser.email.toLowerCase() !== voterEmailLower) {
          return res.status(409).json({ 
            error: 'Sie können nur mit Ihrer eigenen E-Mail-Adresse abstimmen.',
            errorCode: 'EMAIL_MISMATCH'
          });
        }
        
        currentUserId = currentUser.id;
        
        // Check if authenticated user has already voted on this poll
        const hasVoted = await storage.hasUserVoted(poll.id, currentUserId);
        if (hasVoted) {
          // User has already voted - check if editing is allowed
          if (!poll.allowVoteEdit) {
            return res.status(400).json({ 
              error: 'Sie haben bereits abgestimmt. Das Ändern von Stimmen ist bei dieser Umfrage nicht erlaubt.',
              errorCode: 'ALREADY_VOTED'
            });
          }
          // If editing is allowed, redirect to edit flow (return existing votes)
          const existingVotes = await storage.getVotesByUserId(poll.id, currentUserId);
          return res.status(409).json({
            error: 'Sie haben bereits abgestimmt. Bitte verwenden Sie den Bearbeiten-Link um Ihre Stimmen zu ändern.',
            errorCode: 'USE_EDIT_FLOW',
            existingVotes: existingVotes.map(v => ({ optionId: v.optionId, response: v.response }))
          });
        }
      }

      // For guest voters: Check if email has already voted
      if (!currentUserId) {
        const existingVotes = await storage.getVotesByEmail(poll.id, bulkVoteData.voterEmail);
        if (existingVotes.length > 0) {
          // Guest has already voted
          if (!poll.allowVoteEdit) {
            return res.status(400).json({ 
              error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
              errorCode: 'DUPLICATE_EMAIL_VOTE'
            });
          }
          // If editing allowed, they should use their edit link
          return res.status(400).json({ 
            error: 'Sie haben bereits abgestimmt. Bitte verwenden Sie den Bearbeitungslink aus Ihrer E-Mail.',
            errorCode: 'USE_EDIT_LINK'
          });
        }
      }

      // Generate unique voter edit token ONLY if poll allows vote editing
      const voterEditToken = poll.allowVoteEdit ? `edit-${randomBytes(16).toString('hex')}` : null;
      
      // Calculate voterKey for deduplication
      const deviceToken = req.cookies?.deviceToken;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { voterKey, voterSource, newDeviceToken } = deviceTokenService.getVoterKey(
        currentUserId,
        deviceToken,
        userAgent
      );
      
      // Set device token cookie if a new one was generated
      if (newDeviceToken) {
        res.cookie('deviceToken', newDeviceToken, deviceTokenService.getCookieOptions());
      }
      
      // Submit all votes atomically using transaction-based storage method
      const voteItems = bulkVoteData.votes.map(v => ({
        optionId: v.optionId,
        response: v.response
      }));
      
      const result = await storage.voteBulk(
        poll.id,
        bulkVoteData.voterName,
        bulkVoteData.voterEmail,
        currentUserId,
        voterEditToken,
        voteItems,
        voterKey,
        voterSource
      );
      
      // If votes already existed (race condition caught by transaction), return appropriate error
      if (result.alreadyVoted) {
        if (!poll.allowVoteEdit) {
          return res.status(400).json({ 
            error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
            errorCode: 'DUPLICATE_EMAIL_VOTE'
          });
        }
        return res.status(400).json({ 
          error: 'Sie haben bereits abgestimmt. Bitte verwenden Sie den Bearbeitungslink aus Ihrer E-Mail.',
          errorCode: 'USE_EDIT_LINK'
        });
      }
      
      const createdVotes = result.votes;
      
      // Send confirmation email (but only once per session)
      if (bulkVoteData.voterEmail) {
        const emailKey = `${bulkVoteData.voterEmail}-${poll.id}`;
        const now = Date.now();
        const lastSent = recentEmailSends.get(emailKey);
        
        // Only send email if we haven't sent one recently for this voter and poll
        if (!lastSent || (now - lastSent) > EMAIL_COOLDOWN) {
          const { getBaseUrl } = await import('./utils/baseUrl');
          const baseUrl = getBaseUrl();
          const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
          const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;
          
          // Send email asynchronously (don't wait for it)
          emailService.sendVotingConfirmationEmail(
            bulkVoteData.voterEmail,
            bulkVoteData.voterName,
            poll.title,
            poll.type as 'schedule' | 'survey',
            publicLink,  
            resultsLink
          ).catch(error => {
            console.error('Failed to send voting confirmation email:', error);
          });
          
          // Track that we sent an email
          recentEmailSends.set(emailKey, now);
          
          // Clean up old entries (older than 5 minutes)
          const entriesToDelete: string[] = [];
          recentEmailSends.forEach((timestamp, key) => {
            if (now - timestamp > 300000) { // 5 minutes
              entriesToDelete.push(key);
            }
          });
          entriesToDelete.forEach(key => recentEmailSends.delete(key));
        }
      }
      
      res.json({ 
        success: true, 
        votes: createdVotes,
        voterEditToken: voterEditToken // Return the edit token for frontend use
      });
    } catch (error) {
      console.error('Error bulk voting:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid vote data', 
          details: error.errors 
        });
      }
      if (error instanceof Error && error.message === 'DUPLICATE_EMAIL_VOTE') {
        return res.status(400).json({ 
          error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
          errorCode: 'DUPLICATE_EMAIL_VOTE'
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Withdraw all votes for a poll (delete votes)
  v1Router.delete('/polls/:token/vote', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Umfrage nicht gefunden' });
      }

      // Check if vote withdrawal is allowed for this poll
      if (!poll.allowVoteWithdrawal) {
        return res.status(403).json({ 
          error: 'Das Zurückziehen von Stimmen ist bei dieser Umfrage nicht erlaubt.',
          errorCode: 'WITHDRAWAL_NOT_ALLOWED'
        });
      }

      // Check if poll is still active
      if (!poll.isActive) {
        return res.status(400).json({ 
          error: 'Diese Umfrage ist bereits beendet.',
          errorCode: 'POLL_INACTIVE'
        });
      }

      const { voterEmail, voterEditToken } = req.body;
      
      // Get user session if available
      const currentUserId = await extractUserId(req);
      
      let votesToDelete: any[] = [];
      
      // For authenticated users, find votes by user ID or email
      if (currentUserId) {
        const user = await storage.getUser(currentUserId);
        if (user) {
          // Get votes by the user's email (regardless of userId linkage)
          const votesByEmail = await storage.getVotesByEmail(poll.id, user.email);
          // Include votes that are either linked to this user OR have matching email
          votesToDelete = votesByEmail;
          console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes for user ${user.email} in poll ${poll.id}`);
        }
      }
      
      // For guests with edit token
      if (votesToDelete.length === 0 && voterEditToken) {
        const votesByToken = await storage.getVotesByEditToken(voterEditToken);
        votesToDelete = votesByToken.filter(v => v.pollId === poll.id);
        console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes by edit token in poll ${poll.id}`);
      }
      
      // For guests with email (when not authenticated)
      if (votesToDelete.length === 0 && voterEmail && !currentUserId) {
        const votesByEmail = await storage.getVotesByEmail(poll.id, voterEmail);
        votesToDelete = votesByEmail;
        console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes by email ${voterEmail} in poll ${poll.id}`);
      }
      
      if (votesToDelete.length === 0) {
        return res.status(404).json({ 
          error: 'Keine Stimmen gefunden, die zurückgezogen werden können.',
          errorCode: 'NO_VOTES_FOUND'
        });
      }
      
      // Delete all votes
      for (const vote of votesToDelete) {
        await storage.deleteVote(vote.id);
      }
      
      console.log(`[Vote] Withdrew ${votesToDelete.length} votes from poll ${poll.id}`);
      
      // For organization polls: Broadcast slot update via WebSocket after withdrawal
      if (poll.type === 'organization') {
        const freshPoll = await storage.getPollByPublicToken(poll.publicToken);
        if (freshPoll) {
          const slotUpdates: Record<number, { currentCount: number; maxCapacity: number | null }> = {};
          for (const option of freshPoll.options) {
            const signupCount = freshPoll.votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
            slotUpdates[option.id] = {
              currentCount: signupCount,
              maxCapacity: option.maxCapacity
            };
          }
          liveVotingService.broadcastSlotUpdate(poll.publicToken, slotUpdates);
          if (poll.adminToken) {
            liveVotingService.broadcastSlotUpdate(poll.adminToken, slotUpdates);
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `${votesToDelete.length} Stimme(n) erfolgreich zurückgezogen.`,
        withdrawnCount: votesToDelete.length
      });
    } catch (error) {
      console.error('Error withdrawing votes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Resend voting confirmation email for vote editing
  v1Router.post('/polls/:token/resend-email', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email address is required' });
      }

      // Check if the email has existing votes for this poll
      const existingVotes = await storage.getVotesByEmail(poll.id, email);
      if (existingVotes.length === 0) {
        return res.status(404).json({ error: 'No votes found for this email address' });
      }

      // Get the voter name from the first vote
      const voterName = existingVotes[0].voterName;

      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
      const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;

      // Send the confirmation email
      try {
        console.log('Attempting to send email to:', email);
        await emailService.sendVotingConfirmationEmail(
          email,
          voterName,
          poll.title,
          poll.type as 'schedule' | 'survey',
          publicLink,
          resultsLink
        );
        console.log('Email sent successfully to:', email);
        res.json({ success: true, message: 'Email sent successfully' });
      } catch (emailError: any) {
        console.error('Failed to send resend email:', emailError);
        console.log('Error message contains spam?', emailError.message && emailError.message.includes('Spam message rejected'));
        
        // If it's a spam rejection, don't provide direct links for security
        if (emailError.message && emailError.message.includes('Spam message rejected')) {
          console.log('Responding with spam filter error - no direct links for security');
          res.json({ 
            success: false, 
            message: 'Email delivery blocked by spam filter',
            errorCode: 'EMAIL_BLOCKED_BY_SPAM_FILTER',
            instructions: 'Please contact the poll administrator or try again later. Direct links cannot be provided for security reasons.'
          });
        } else {
          console.log('Responding with general email error');
          res.status(500).json({ error: 'Failed to send email due to server configuration' });
        }
      }
    } catch (error) {
      console.error('Error resending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Get poll results
  v1Router.get('/polls/:token/results', async (req, res) => {
    try {
      let poll;
      let isAdmin = false;
      
      // Try admin token first
      poll = await storage.getPollByAdminToken(req.params.token);
      if (poll) {
        isAdmin = true;
      } else {
        poll = await storage.getPollByPublicToken(req.params.token);
      }
      
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      // Check if results are public or if user has permission
      if (!poll.resultsPublic && !isAdmin) {
        // Check if user is the poll creator
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

  // Generate QR code for poll (returns base64 data URL)
  v1Router.get('/polls/:token/qr', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
      
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const pollUrl = `${baseUrl}/poll/${req.params.token}`;
      
      const qrCode = await qrService.generateQRCode(pollUrl, format);
      res.json({ qrCode, format, pollUrl });
    } catch (error) {
      console.error('Error generating QR code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Download QR code as file (PNG or SVG)
  v1Router.get('/polls/:token/qr/download', async (req, res) => {
    try {
      const poll = await storage.getPollByPublicToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
      
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const pollUrl = `${baseUrl}/poll/${req.params.token}`;
      
      const buffer = await qrService.generateQRCodeBuffer(pollUrl, format);
      
      const sanitizedTitle = poll.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, '_').substring(0, 50);
      const filename = `QR_${sanitizedTitle}.${format}`;
      
      res.setHeader('Content-Type', format === 'svg' ? 'image/svg+xml' : 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Export poll results as PDF
  v1Router.get('/polls/:token/export/pdf', async (req, res) => {
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

      // Check if results are public or if user has permission
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
      
      // Get branding settings for PDF
      const customization = await storage.getCustomizationSettings();
      const pdfOptions = {
        logoUrl: customization.branding?.logoUrl || undefined,
        siteName: customization.branding?.siteName || 'Poll',
        siteNameAccent: customization.branding?.siteNameAccent || 'y',
      };
      
      const pdfBuffer = await pdfService.generatePollResultsPDF(results, pdfOptions);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${poll.title}_results.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Export poll results as CSV
  v1Router.get('/polls/:token/export/csv', async (req, res) => {
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

      // Check if results are public or if user has permission
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
      
      // Generate CSV data
      let csv = 'Option,Text,Start Time,End Time,Yes Votes,Maybe Votes,No Votes,Score\n';
      
      results.stats.forEach(stat => {
        const option = results.options.find(opt => opt.id === stat.optionId);
        if (option) {
          const startTime = option.startTime ? new Date(option.startTime).toLocaleString('de-DE') : '';
          const endTime = option.endTime ? new Date(option.endTime).toLocaleString('de-DE') : '';
          csv += `"${option.text}","${option.text}","${startTime}","${endTime}",${stat.yesCount},${stat.maybeCount},${stat.noCount},${stat.score}\n`;
        }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${poll.title}_results.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Error generating CSV:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Export poll results as ICS (calendar file)
  v1Router.get('/polls/:token/export/ics', async (req, res) => {
    try {
      let poll;
      
      poll = await storage.getPollByAdminToken(req.params.token);
      if (!poll) {
        poll = await storage.getPollByPublicToken(req.params.token);
      }
      
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const results = await storage.getPollResults(poll.id);
      const calendarSettings = await storage.getCalendarSettings();
      
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      
      const language = (req.query.lang as 'de' | 'en') || 'de';
      const voterEmail = req.query.email as string | undefined;
      
      const icsContent = icsService.generatePollIcs(
        poll,
        results.options,
        results.votes,
        baseUrl,
        {
          settings: calendarSettings,
          language,
          voterEmail,
        }
      );
      
      const sanitizedTitle = poll.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, '_').substring(0, 50);
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error('Error generating ICS:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get calendar subscription token for authenticated user
  v1Router.get('/calendar/token', requireAuth, async (req, res) => {
    try {
      const userId = await extractUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Nicht angemeldet' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let calendarToken = user.calendarToken;
      
      // Generate token if not exists
      if (!calendarToken) {
        calendarToken = randomBytes(32).toString('hex');
        await storage.updateUser(userId, { calendarToken });
      }

      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const webcalUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;
      const httpsUrl = `${baseUrl}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;

      res.json({ 
        calendarToken,
        webcalUrl,
        httpsUrl
      });
    } catch (error) {
      console.error('Error getting calendar token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Regenerate calendar subscription token
  v1Router.post('/calendar/token/regenerate', requireAuth, async (req, res) => {
    try {
      const userId = await extractUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Nicht angemeldet' });
      }

      const calendarToken = randomBytes(32).toString('hex');
      await storage.updateUser(userId, { calendarToken });

      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const webcalUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;
      const httpsUrl = `${baseUrl}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;

      res.json({ 
        calendarToken,
        webcalUrl,
        httpsUrl
      });
    } catch (error) {
      console.error('Error regenerating calendar token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Calendar subscription feed (public endpoint with token auth)
  v1Router.get('/calendar/:calendarToken/feed.ics', async (req, res) => {
    try {
      const { calendarToken } = req.params;
      
      // Find user by calendar token
      const user = await storage.getUserByCalendarToken(calendarToken);
      if (!user) {
        return res.status(404).json({ error: 'Invalid calendar token' });
      }

      // Get all participations for this user
      const participations = await storage.getUserParticipations(user.id, user.email);
      const calendarSettings = await storage.getCalendarSettings();
      
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      
      const language = (user.languagePreference as 'de' | 'en') || 'de';
      
      const icsContent = icsService.generateUserCalendarFeed(
        participations,
        user.name,
        baseUrl,
        {
          settings: calendarSettings,
          language,
        }
      );
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(icsContent);
    } catch (error) {
      console.error('Error generating calendar feed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Send invitations
  v1Router.post('/polls/:token/invite', async (req, res) => {
    try {
      const inviteData = inviteSchema.parse(req.body);
      
      const poll = await storage.getPollByAdminToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found or insufficient permissions' });
      }

      // Security check: If poll was created by a registered user, require login
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

      // Use Replit domain in development, or production domain if set
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const pollUrl = `${baseUrl}/poll/${poll.publicToken}`;
      
      const inviterName = poll.user?.name || 'Ein Team-Mitglied';

      // Send emails to all invitees
      const emailPromises = inviteData.emails.map(email => 
        emailService.sendInvitationEmail(
          email,
          inviterName,
          poll.title,
          pollUrl,
          inviteData.customMessage
        )
      );

      await Promise.all(emailPromises);
      
      res.json({ message: `Invitations sent to ${inviteData.emails.length} recipients` });
    } catch (error) {
      console.error('Error sending invitations:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid invitation data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Send reminder to participants who haven't voted yet
  v1Router.post('/polls/:token/remind', async (req, res) => {
    try {
      const poll = await storage.getPollByAdminToken(req.params.token);
      if (!poll) {
        return res.status(404).json({ error: 'Umfrage nicht gefunden' });
      }

      // Check notification settings
      const notificationSettings = await storage.getNotificationSettings();
      
      if (!notificationSettings.enabled || !notificationSettings.manualRemindersEnabled) {
        return res.status(403).json({ error: 'Erinnerungen sind systemweit deaktiviert' });
      }

      // Check if this is a guest (no user session or poll has no userId)
      const isGuest = !req.session.userId || !poll.userId;

      if (isGuest) {
        // Guest restrictions
        if (!notificationSettings.guestsCanSendReminders) {
          return res.status(403).json({ 
            error: 'Gäste können keine Erinnerungen senden. Bitte melden Sie sich an.',
            requiresAuth: true
          });
        }

        // Check guest reminder limit
        const reminderCount = await storage.getManualReminderCount(poll.id);
        if (reminderCount >= notificationSettings.guestReminderLimitPerPoll) {
          return res.status(429).json({ 
            error: `Maximale Anzahl an Erinnerungen (${notificationSettings.guestReminderLimitPerPoll}) erreicht` 
          });
        }
      } else {
        // Registered user restrictions
        if (poll.userId && req.session.userId !== poll.userId) {
          return res.status(403).json({ error: 'Keine Berechtigung' });
        }

        // Check user reminder limit
        const reminderCount = await storage.getManualReminderCount(poll.id);
        if (reminderCount >= notificationSettings.userReminderLimitPerPoll) {
          return res.status(429).json({ 
            error: `Maximale Anzahl an Erinnerungen (${notificationSettings.userReminderLimitPerPoll}) erreicht` 
          });
        }
      }

      // Check cooldown
      const lastReminder = await storage.getLastManualReminderTime(poll.id);
      if (lastReminder) {
        const cooldownMs = notificationSettings.reminderCooldownMinutes * 60 * 1000;
        const timeSinceLastReminder = Date.now() - lastReminder.getTime();
        if (timeSinceLastReminder < cooldownMs) {
          const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastReminder) / 60000);
          return res.status(429).json({ 
            error: `Bitte warten Sie noch ${remainingMinutes} Minuten bis zur nächsten Erinnerung` 
          });
        }
      }

      // Get list of people who have voted
      const votedEmails = new Set(poll.votes.map(v => v.voterEmail.toLowerCase()));
      
      // Get target emails from request body (optional - if not provided, remind creator)
      const { emails } = req.body as { emails?: string[] };
      
      if (!emails || emails.length === 0) {
        return res.status(400).json({ error: 'Keine E-Mail-Adressen angegeben' });
      }

      // Filter to only remind people who haven't voted
      const emailsToRemind = emails.filter(email => !votedEmails.has(email.toLowerCase()));
      
      if (emailsToRemind.length === 0) {
        return res.status(200).json({ 
          message: 'Alle angegebenen Personen haben bereits abgestimmt',
          reminded: 0
        });
      }

      // Build poll URL
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const pollUrl = `${baseUrl}/poll/${poll.publicToken}`;
      
      const senderName = poll.user?.name || poll.creatorEmail || 'Der Umfrage-Ersteller';

      // Send reminder emails
      const emailPromises = emailsToRemind.map(email => 
        emailService.sendReminderEmail(
          email,
          senderName,
          poll.title,
          pollUrl,
          poll.expiresAt
        ).then(() => ({ email, success: true }))
         .catch(err => ({ email, success: false, error: err.message }))
      );

      const results = await Promise.all(emailPromises);
      const successCount = results.filter(r => r.success).length;

      // Log the reminders
      for (const result of results) {
        await storage.logNotification({
          pollId: poll.id,
          type: 'manual_reminder',
          recipientEmail: result.email,
          sentBy: req.session.userId?.toString() || 'guest',
          sentByGuest: isGuest,
          success: result.success,
          errorMessage: result.success ? undefined : (result as any).error,
        });
      }

      res.json({ 
        message: `Erinnerungen gesendet an ${successCount} von ${emailsToRemind.length} Empfänger(n)`,
        reminded: successCount,
        skipped: emails.length - emailsToRemind.length,
        failed: emailsToRemind.length - successCount
      });
    } catch (error) {
      console.error('Error sending reminders:', error);
      res.status(500).json({ error: 'Interner Fehler beim Versenden der Erinnerungen' });
    }
  });

  // Get reminder status for a poll (how many reminders sent, when, etc.)
  v1Router.get('/polls/:token/reminder-status', async (req, res) => {
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

  // User authentication and management routes would go here
  // For now, we'll implement basic user routes

  // Get user dashboard data
  v1Router.get('/users/:userId/dashboard', async (req, res) => {
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

  // ============== ADMIN ROUTES (Protected) ==============

  // Admin basic stats
  v1Router.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Admin extended stats with activity log
  v1Router.get('/admin/extended-stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getExtendedStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching extended stats:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // System component status (EOL check via endoflife.date)
  v1Router.get('/admin/system-status', requireAdmin, async (req, res) => {
    try {
      const { getSystemStatus } = await import("./system-status");
      const forceRefresh = req.query.refresh === 'true';
      const status = await getSystemStatus(forceRefresh);
      res.json(status);
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({ error: 'Interner Fehler beim Abrufen des Systemstatus' });
    }
  });

  // Security vulnerabilities (npm audit)
  v1Router.get('/admin/vulnerabilities', requireAdmin, async (req, res) => {
    try {
      const { runNpmAudit } = await import("./services/npmAuditService");
      const forceRefresh = req.query.refresh === 'true';
      const result = await runNpmAudit(forceRefresh);
      res.json(result);
    } catch (error) {
      console.error('Error running npm audit:', error);
      res.status(500).json({ error: 'Interner Fehler beim Prüfen der Sicherheitslücken' });
    }
  });

  // System packages (Nix dependencies)
  v1Router.get('/admin/system-packages', requireAdmin, async (req, res) => {
    try {
      const { getSystemPackages } = await import("./services/systemPackageService");
      const forceRefresh = req.query.refresh === 'true';
      const result = await getSystemPackages(forceRefresh);
      res.json(result);
    } catch (error) {
      console.error('Error fetching system packages:', error);
      res.status(500).json({ error: 'Interner Fehler beim Abrufen der System-Packages' });
    }
  });

  // List all users
  v1Router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitized = users.map(u => authService.sanitizeUser(u));
      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update user (change role, etc.)
  v1Router.patch('/admin/users/:id', requireAdmin, async (req, res) => {
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

  // Create user manually (admin only)
  v1Router.post('/admin/users', requireAdmin, async (req, res) => {
    try {
      const { name, email, username, password, role } = req.body;
      
      // Validate required fields
      if (!name || !email || !username || !password) {
        return res.status(400).json({ error: 'Name, E-Mail, Benutzername und Passwort sind erforderlich.' });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
      }
      
      // Validate username (min 3 chars, alphanumeric and underscore)
      if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Benutzername muss mindestens 3 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstriche enthalten.' });
      }
      
      // Validate password strength
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
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingEmail) {
        return res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
      }
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(username.toLowerCase().trim());
      if (existingUsername) {
        return res.status(400).json({ error: 'Dieser Benutzername wird bereits verwendet.' });
      }
      
      // Hash password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
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

  // Delete user
  v1Router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if external deprovisioning is enabled
      const deprovisionSetting = await storage.getSetting('deprovision_config');
      const deprovisionConfig = deprovisionSetting?.value as { enabled?: boolean } | null;
      
      if (deprovisionConfig?.enabled) {
        return res.status(403).json({ 
          error: 'Manuelle Benutzer-Löschung ist deaktiviert. Bitte nutzen Sie den externen Deprovisionierungsservice.',
          code: 'MANUAL_DELETE_DISABLED'
        });
      }
      
      // Prevent deleting yourself
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

  // GDPR: Get all users with deletion requests
  v1Router.get('/admin/deletion-requests', requireAdmin, async (req, res) => {
    try {
      const usersWithRequests = await storage.getUsersWithDeletionRequests();
      res.json(usersWithRequests.map(u => authService.sanitizeUser(u)));
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // GDPR: Confirm deletion request (delete the user)
  v1Router.post('/admin/deletion-requests/:id/confirm', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      if (!user.deletionRequestedAt) {
        return res.status(400).json({ error: 'Benutzer hat keine Löschung beantragt' });
      }

      // Prevent deleting yourself
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

  // GDPR: Reject deletion request
  v1Router.post('/admin/deletion-requests/:id/reject', requireAdmin, async (req, res) => {
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

  // List ALL polls (not just active)
  v1Router.get('/admin/polls', requireAdmin, async (req, res) => {
    try {
      const polls = await storage.getAllPolls();
      res.json(polls);
    } catch (error) {
      console.error('Error fetching all polls:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update poll (activate/deactivate, change title, results visibility, etc.)
  v1Router.patch('/admin/polls/:id', requireAdmin, async (req, res) => {
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

  // Delete poll (admin only)
  v1Router.delete('/admin/polls/:id', requireAdmin, async (req, res) => {
    try {
      const pollId = req.params.id;
      await storage.deletePoll(pollId);
      res.json({ success: true, message: 'Umfrage gelöscht' });
    } catch (error) {
      console.error('Error deleting poll:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get system settings
  v1Router.get('/admin/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update system settings
  v1Router.post('/admin/settings', requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      const setting = await storage.setSetting({ key, value, description });
      res.json(setting);
    } catch (error) {
      console.error('Error updating setting:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Delete system setting
  v1Router.delete('/admin/settings/:key', requireAdmin, async (req, res) => {
    try {
      const key = req.params.key;
      // We don't have a delete method, so we'll set it to null
      await storage.setSetting({ key, value: null, description: 'Deleted' });
      res.json({ success: true, message: 'Einstellung gelöscht' });
    } catch (error) {
      console.error('Error deleting setting:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get security settings
  v1Router.get('/admin/security', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSecuritySettings();
      const stats = loginRateLimiter.getStats();
      res.json({ 
        settings, 
        stats,
        ssoNote: 'SSO-Anmeldungen (Keycloak) werden im Identity Provider selbst rate-limitiert. Diese Einstellungen gelten nur für die lokale Anmeldung.'
      });
    } catch (error) {
      console.error('Error fetching security settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update security settings
  v1Router.put('/admin/security', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.setSecuritySettings(req.body);
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error updating security settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Clear rate limit cache (emergency)
  v1Router.post('/admin/security/clear-rate-limits', requireAdmin, async (req, res) => {
    try {
      loginRateLimiter.clearAll();
      res.json({ success: true, message: 'Alle Rate-Limit-Sperren wurden zurückgesetzt' });
    } catch (error) {
      console.error('Error clearing rate limits:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // ============== CLAMAV ANTIVIRUS SETTINGS API ==============

  // Get ClamAV configuration
  v1Router.get('/admin/clamav', requireAdmin, async (req, res) => {
    try {
      const config = await clamavService.getConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching ClamAV config:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update ClamAV configuration
  v1Router.put('/admin/clamav', requireAdmin, async (req, res) => {
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

  // Test ClamAV connection
  v1Router.post('/admin/clamav/test', requireAdmin, async (req, res) => {
    try {
      const result = await clamavService.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Error testing ClamAV connection:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get ClamAV scan logs with filtering
  v1Router.get('/admin/clamav/scan-logs', requireAdmin, async (req, res) => {
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
      
      const result = await storage.getClamavScanLogs(options);
      res.json(result);
    } catch (error) {
      console.error('Error fetching ClamAV scan logs:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get ClamAV scan statistics
  v1Router.get('/admin/clamav/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getClamavScanStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching ClamAV scan stats:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get single ClamAV scan log detail
  v1Router.get('/admin/clamav/scan-logs/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const log = await storage.getClamavScanLog(id);
      
      if (!log) {
        return res.status(404).json({ error: 'Scan-Log nicht gefunden' });
      }
      
      res.json(log);
    } catch (error) {
      console.error('Error fetching ClamAV scan log:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // ============== PENTEST-TOOLS API ==============

  // Get Pentest-Tools configuration (without exposing the token value)
  v1Router.get('/admin/pentest-tools/config', requireAdmin, async (req, res) => {
    try {
      const config = await pentestToolsService.getConfig();
      res.json({
        configured: !!config.apiToken,
        configuredViaEnv: config.configuredViaEnv,
        hasToken: !!config.apiToken,
      });
    } catch (error) {
      console.error('Error getting Pentest-Tools config:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update Pentest-Tools configuration (token)
  v1Router.post('/admin/pentest-tools/config', requireAdmin, async (req, res) => {
    try {
      const { apiToken } = req.body;
      
      // Validate input
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

      // Clear cache so new token is used
      pentestToolsService.clearConfigCache();

      res.json({ success: true, message: 'Token erfolgreich gespeichert' });
    } catch (error) {
      console.error('Error saving Pentest-Tools config:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Check if Pentest-Tools is configured and connection status
  v1Router.get('/admin/pentest-tools/status', requireAdmin, async (req, res) => {
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
      console.error('Error checking Pentest-Tools status:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get available tools
  v1Router.get('/admin/pentest-tools/tools', requireAdmin, async (req, res) => {
    try {
      const tools = pentestToolsService.getAvailableTools();
      const scanTypes = pentestToolsService.getScanTypes();
      res.json({ tools, scanTypes });
    } catch (error) {
      console.error('Error getting Pentest-Tools tools:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get recent scans
  v1Router.get('/admin/pentest-tools/scans', requireAdmin, async (req, res) => {
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

  // Get Polly target info
  v1Router.get('/admin/pentest-tools/target', requireAdmin, async (req, res) => {
    try {
      const requestHost = req.get('host');
      const targetInfo = await pentestToolsService.getPollyTargetInfo(requestHost);
      res.json(targetInfo);
    } catch (error) {
      console.error('Error getting Polly target info:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Sync Polly target with Pentest-Tools
  v1Router.post('/admin/pentest-tools/target/sync', requireAdmin, async (req, res) => {
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

  // Start a new scan for Polly (automatic target)
  v1Router.post('/admin/pentest-tools/scans', requireAdmin, async (req, res) => {
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

  // Get scan status
  v1Router.get('/admin/pentest-tools/scans/:scanId', requireAdmin, async (req, res) => {
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

  // Get scan findings
  v1Router.get('/admin/pentest-tools/scans/:scanId/findings', requireAdmin, async (req, res) => {
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

  // Stop a scan
  v1Router.post('/admin/pentest-tools/scans/:scanId/stop', requireAdmin, async (req, res) => {
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

  // ============== AUTOMATED TESTING API ==============

  // Get test environment info
  v1Router.get('/admin/tests/environment', requireAdmin, async (req, res) => {
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

  // Get available test categories
  v1Router.get('/admin/tests', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const categories = await testRunnerService.getAvailableTests();
      res.json({ categories });
    } catch (error) {
      console.error('Error fetching test categories:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Start a new test run
  v1Router.post('/admin/tests/run', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const runId = await testRunnerService.runAllTests('manual');
      res.json({ runId, message: 'Test-Lauf gestartet' });
    } catch (error) {
      console.error('Error starting test run:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get test run history
  v1Router.get('/admin/tests/runs', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const limit = parseInt(req.query.limit as string) || 20;
      const runs = await testRunnerService.getTestRunHistory(limit);
      res.json({ runs });
    } catch (error) {
      console.error('Error fetching test run history:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get specific test run with results
  v1Router.get('/admin/tests/runs/:id', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
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

  // Get test schedule configuration
  v1Router.get('/admin/tests/schedule', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const config = await testRunnerService.getScheduleConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching test schedule:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update test schedule configuration
  v1Router.put('/admin/tests/schedule', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const config = await testRunnerService.updateScheduleConfig(req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating test schedule:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Export test run as PDF
  v1Router.get('/admin/tests/runs/:id/pdf', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const pdfService = await import('./services/pdfService');
      
      const runId = parseInt(req.params.id);
      const run = await testRunnerService.getTestRun(runId);
      
      if (!run) {
        return res.status(404).json({ error: 'Test-Lauf nicht gefunden' });
      }
      
      const pdfBuffer = await pdfService.generateTestReportPDF(run, run.results || []);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="test-report-${runId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating test PDF:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get test configurations grouped by type
  v1Router.get('/admin/tests/configurations', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const tests = await testRunnerService.getTestConfigurationsByType();
      const mode = await testRunnerService.getTestModeConfig();
      res.json({ tests, mode });
    } catch (error) {
      console.error('Error fetching test configurations:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update test mode (auto/manual)
  v1Router.put('/admin/tests/mode', requireAdmin, async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['auto', 'manual'].includes(mode)) {
        return res.status(400).json({ error: 'Ungültiger Modus' });
      }
      const testRunnerService = await import('./services/testRunnerService');
      const config = await testRunnerService.updateTestModeConfig(mode);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating test mode:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Toggle individual test enabled/disabled
  v1Router.put('/admin/tests/configurations/:testId', requireAdmin, async (req, res) => {
    try {
      const { testId } = req.params;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled muss ein Boolean sein' });
      }
      
      const testRunnerService = await import('./services/testRunnerService');
      await testRunnerService.updateTestEnabled(decodeURIComponent(testId), enabled);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating test configuration:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Sync test configurations (re-scan test files)
  v1Router.post('/admin/tests/sync', requireAdmin, async (req, res) => {
    try {
      const testRunnerService = await import('./services/testRunnerService');
      const tests = await testRunnerService.syncTestConfigurations();
      res.json({ success: true, count: tests.length });
    } catch (error) {
      console.error('Error syncing test configurations:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get test data statistics (counts of test users, polls, votes)
  v1Router.get('/admin/tests/data-stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getTestDataStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching test data stats:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Purge all test data (users, polls, votes marked as test data)
  v1Router.delete('/admin/tests/purge-data', requireAdmin, async (req, res) => {
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

  // ============== NOTIFICATION SETTINGS API ==============

  // Get notification settings
  v1Router.get('/admin/notifications', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getNotificationSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update notification settings
  v1Router.put('/admin/notifications', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.setNotificationSettings(req.body);
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // ============== SESSION TIMEOUT SETTINGS API ==============
  
  // Get session timeout settings (admin only)
  v1Router.get('/admin/session-timeout', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSessionTimeoutSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching session timeout settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });
  
  // Update session timeout settings (admin only)
  v1Router.put('/admin/session-timeout', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.setSessionTimeoutSettings(req.body);
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error updating session timeout settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // ============== CALENDAR SETTINGS API ==============
  
  // Get calendar settings (admin only)
  v1Router.get('/admin/calendar', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCalendarSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching calendar settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });
  
  // Update calendar settings (admin only)
  v1Router.put('/admin/calendar', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.setCalendarSettings(req.body);
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error updating calendar settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // ============== DEPROVISION API (Kafka/Keycloak Integration) ==============
  
  // Get deprovision settings (admin only)
  v1Router.get('/admin/deprovision-settings', requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getSetting('deprovision_config');
      if (setting && setting.value) {
        const config = setting.value as {
          enabled: boolean;
          username: string;
          passwordHash?: string;
          lastUpdated?: string;
        };
        // Don't expose password hash
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

  // Update deprovision settings (admin only)
  v1Router.put('/admin/deprovision-settings', requireAdmin, async (req, res) => {
    try {
      const { enabled, username, password } = req.body;
      
      // Get existing config
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
      
      // Only hash and store new password if provided
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

  // External Deprovisioning Endpoint (Basic Auth protected)
  // Called by Kafka/Keycloak service when a user is deprovisioned
  v1Router.delete('/deprovision/user', async (req, res) => {
    try {
      // Get deprovision config
      const setting = await storage.getSetting('deprovision_config');
      const config = setting?.value as {
        enabled: boolean;
        username: string;
        passwordHash: string;
      } | null;
      
      if (!config || !config.enabled) {
        console.log('[DEPROVISION] Request rejected: service not enabled');
        return res.status(503).json({ 
          error: 'Deprovisionierungsdienst ist nicht aktiviert',
          code: 'SERVICE_DISABLED'
        });
      }
      
      // Verify Basic Auth
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.log('[DEPROVISION] Request rejected: no auth header');
        return res.status(401).json({ 
          error: 'Authentifizierung erforderlich',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const base64Credentials = authHeader.slice(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      if (username !== config.username) {
        console.log(`[DEPROVISION] Request rejected: invalid username "${username}"`);
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      const isValidPassword = await bcrypt.compare(password, config.passwordHash);
      if (!isValidPassword) {
        console.log('[DEPROVISION] Request rejected: invalid password');
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      // Parse user data from request body
      const { email, keycloakId, userId, action = 'delete' } = req.body;
      
      if (!email && !keycloakId && !userId) {
        return res.status(400).json({ 
          error: 'email, keycloakId oder userId erforderlich',
          code: 'MISSING_USER_IDENTIFIER'
        });
      }
      
      // Find the user
      let user: User | undefined;
      
      if (userId) {
        user = await storage.getUser(userId);
      } else if (keycloakId) {
        user = await storage.getUserByKeycloakId(keycloakId);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        console.log(`[DEPROVISION] User not found: email=${email}, keycloakId=${keycloakId}, userId=${userId}`);
        return res.status(404).json({ 
          error: 'Benutzer nicht gefunden',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Perform deprovisioning action
      if (action === 'delete') {
        console.log(`[DEPROVISION] Deleting user: id=${user.id}, email=${user.email}, keycloakId=${user.keycloakId}`);
        await storage.deleteUser(user.id);
        
        res.json({
          success: true,
          message: 'Benutzer erfolgreich deprovisioniert',
          userId: user.id,
          email: user.email,
          action: 'deleted',
        });
      } else if (action === 'anonymize') {
        console.log(`[DEPROVISION] Anonymizing user: id=${user.id}, email=${user.email}`);
        // Anonymize user data instead of deleting
        await storage.updateUser(user.id, {
          email: `deleted-${user.id}@anonymized.local`,
          name: 'Gelöschter Benutzer',
          keycloakId: null,
          passwordHash: null,
        });
        
        res.json({
          success: true,
          message: 'Benutzer erfolgreich anonymisiert',
          userId: user.id,
          action: 'anonymized',
        });
      } else {
        return res.status(400).json({ 
          error: 'Ungültige Aktion. Erlaubt: delete, anonymize',
          code: 'INVALID_ACTION'
        });
      }
    } catch (error) {
      console.error('[DEPROVISION] Error:', error);
      res.status(500).json({ 
        error: 'Interner Fehler bei der Deprovisionierung',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Get customization settings (admin only for full access)
  v1Router.get('/admin/customization', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCustomizationSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching customization settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update customization settings (admin only)
  v1Router.put('/admin/customization', requireAdmin, async (req, res) => {
    try {
      const updates = req.body;
      
      // If theme colors are being customized, auto-set enforceDefaultTheme to false
      // This indicates admin has taken responsibility for WCAG compliance
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
      
      // Persist customizations to branding.local.json for server restart persistence
      const { writeBrandingToLocalFile } = await import('./scripts/applyBranding');
      writeBrandingToLocalFile({
        theme: settings.theme,
        branding: settings.branding,
        footer: settings.footer,
        wcag: settings.wcag,
      });
      
      // Update Matrix config if it was changed
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

  // Reset branding to WCAG-compliant defaults (admin only)
  v1Router.post('/admin/branding/reset', requireAdmin, async (req, res) => {
    try {
      const { resetBrandingToDefaults } = await import('./scripts/applyBranding');
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

  // ============== WCAG ACCESSIBILITY ROUTES ==============

  // Helper function to calculate relative luminance
  function getLuminance(hex: string): number {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map(c => {
      const val = parseInt(c, 16) / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Calculate contrast ratio between two colors
  function getContrastRatio(hex1: string, hex2: string): number {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Darken a hex color to meet WCAG AA contrast with white
  function darkenToWCAG(hex: string, targetRatio: number = 4.5): string {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    if (!rgb) return hex;
    
    let [r, g, b] = rgb.map(c => parseInt(c, 16));
    const white = '#ffffff';
    
    // Iteratively darken until contrast is met
    for (let i = 0; i < 100; i++) {
      const currentHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      if (getContrastRatio(currentHex, white) >= targetRatio) {
        return currentHex;
      }
      r = Math.max(0, Math.floor(r * 0.95));
      g = Math.max(0, Math.floor(g * 0.95));
      b = Math.max(0, Math.floor(b * 0.95));
    }
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Run WCAG color audit
  v1Router.post('/admin/wcag/audit', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCustomizationSettings();
      const theme = settings.theme || {};
      const issues: any[] = [];
      const white = '#ffffff';
      const requiredRatio = 4.5;

      // Define color tokens to check
      // WCAG-compliant default colors (4.5:1 contrast with white background):
      // Schedule: hsl(25, 95%, 25%) = #7A3800 (8.81:1 contrast)
      // Survey: hsl(142, 71%, 22%) = #166534 (7.69:1 contrast)
      // Organization: hsl(199, 89%, 25%) = #075985 (8.18:1 contrast)
      const colorTokens = [
        { token: '--primary', value: theme.primaryColor || '#7A3800', name: 'Primärfarbe' },
        { token: '--color-schedule', value: theme.scheduleColor || '#7A3800', name: 'Terminfarbe' },
        { token: '--color-survey', value: theme.surveyColor || '#166534', name: 'Umfragefarbe' },
        { token: '--color-organization', value: theme.organizationColor || '#075985', name: 'Orga-Farbe' },
      ];

      for (const { token, value, name } of colorTokens) {
        const contrast = getContrastRatio(value, white);
        if (contrast < requiredRatio) {
          issues.push({
            token,
            originalValue: value,
            contrastRatio: Math.round(contrast * 100) / 100,
            requiredRatio,
            suggestedValue: darkenToWCAG(value, requiredRatio),
          });
        }
      }

      const auditResult = {
        runAt: new Date().toISOString(),
        passed: issues.length === 0,
        issues,
      };

      // Store audit result
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

  // Apply WCAG suggested corrections
  v1Router.post('/admin/wcag/apply-corrections', requireAdmin, async (req, res) => {
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

  // Update WCAG enforcement setting
  v1Router.put('/admin/wcag/settings', requireAdmin, async (req, res) => {
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

  // ============== EMAIL TEMPLATE ROUTES ==============

  // Get all email templates (admin only)
  v1Router.get('/admin/email-templates', requireAdmin, async (req, res) => {
    try {
      const templates = await emailTemplateService.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get single email template by type
  v1Router.get('/admin/email-templates/:type', requireAdmin, async (req, res) => {
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

  // Update email template
  v1Router.put('/admin/email-templates/:type', requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const { jsonContent, subject, name, textContent } = req.body;
      const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Ungültiger Template-Typ' });
      }
      
      // Get existing template to use its jsonContent if not provided
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

  // Reset email template to default
  v1Router.post('/admin/email-templates/:type/reset', requireAdmin, async (req, res) => {
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

  // Preview email template with sample data
  v1Router.post('/admin/email-templates/:type/preview', requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const validTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Ungültiger Template-Typ' });
      }
      
      // Sample data for preview
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

  // Send test email (admin only)
  v1Router.post('/admin/email-templates/:type/test', requireAdmin, async (req, res) => {
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
      
      // Get sample variables
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
      
      // Send using emailService
      await emailService.sendCustomEmail(recipientEmail, rendered.subject, rendered.html, rendered.text);
      
      res.json({ success: true, message: 'Test-E-Mail gesendet' });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Senden der Test-E-Mail' });
    }
  });

  // Get available variables for a template type
  v1Router.get('/admin/email-templates/:type/variables', requireAdmin, async (req, res) => {
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

  // ============== EMAIL FOOTER ROUTES ==============

  // Get email footer
  v1Router.get('/admin/email-footer', requireAdmin, async (req, res) => {
    try {
      const footer = await emailTemplateService.getEmailFooter();
      res.json(footer);
    } catch (error) {
      console.error('Error fetching email footer:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update email footer
  v1Router.put('/admin/email-footer', requireAdmin, async (req, res) => {
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

  // ============== EMAIL THEME ROUTES ==============

  // Get email theme settings
  v1Router.get('/admin/email-theme', requireAdmin, async (req, res) => {
    try {
      const theme = await emailTemplateService.getEmailTheme();
      res.json(theme);
    } catch (error) {
      console.error('Error fetching email theme:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update email theme settings (with validation)
  v1Router.put('/admin/email-theme', requireAdmin, async (req, res) => {
    try {
      // Validate and sanitize theme input - only accept known fields
      const validatedTheme: Record<string, unknown> = {};
      const body = req.body;
      
      if (typeof body !== 'object' || body === null) {
        return res.status(400).json({ error: 'Ungültiges Theme-Format' });
      }
      
      // Color fields - validate each with regex
      const colorFields = ['backdropColor', 'canvasColor', 'textColor', 'headingColor', 'linkColor', 'buttonBackgroundColor', 'buttonTextColor'];
      const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|white|black|red|green|blue|yellow|orange|purple|gray|grey|transparent)$/i;
      
      for (const field of colorFields) {
        if (body[field] !== undefined) {
          if (typeof body[field] === 'string' && colorRegex.test(body[field].trim())) {
            validatedTheme[field] = body[field].trim();
          }
        }
      }
      
      // Font family - strict validation
      if (body.fontFamily !== undefined) {
        if (typeof body.fontFamily === 'string' && /^[A-Za-z0-9 ,\-']+$/.test(body.fontFamily.trim()) && body.fontFamily.trim().length <= 200) {
          validatedTheme.fontFamily = body.fontFamily.trim();
        }
      }
      
      // Border radius - number validation
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

  // Reset email theme to default
  v1Router.post('/admin/email-theme/reset', requireAdmin, async (req, res) => {
    try {
      const theme = await emailTemplateService.resetEmailTheme();
      res.json(theme);
    } catch (error) {
      console.error('Error resetting email theme:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Import theme from emailbuilder.js JSON (preview)
  v1Router.post('/admin/email-theme/import', requireAdmin, async (req, res) => {
    try {
      const { jsonContent } = req.body;
      
      if (!jsonContent) {
        return res.status(400).json({ error: 'JSON-Inhalt erforderlich' });
      }
      
      // Extract and preview theme without saving
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

  // Confirm and save imported theme
  v1Router.post('/admin/email-theme/import/confirm', requireAdmin, async (req, res) => {
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

  // ============== MATRIX CHAT ROUTES ==============

  // Test Matrix connection (admin only)
  v1Router.post('/matrix/test', requireAdmin, async (req, res) => {
    try {
      const result = await matrixService.testMatrixConnection();
      res.json(result);
    } catch (error: any) {
      console.error('Matrix connection test error:', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Search Matrix users (authenticated users)
  v1Router.get('/matrix/users/search', requireAuth, async (req, res) => {
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

  // Get Matrix integration status
  v1Router.get('/matrix/status', async (req, res) => {
    try {
      res.json({
        enabled: matrixService.isMatrixEnabled(),
        searchEnabled: matrixService.getMatrixConfig().searchEnabled,
      });
    } catch (error) {
      res.json({ enabled: false, searchEnabled: false });
    }
  });

  // Send Matrix invitations (authenticated users - poll owners only)
  v1Router.post('/polls/:token/invite/matrix', requireAuth, async (req, res) => {
    try {
      if (!matrixService.isMatrixEnabled()) {
        return res.status(400).json({ error: 'Matrix ist nicht konfiguriert' });
      }

      const { token } = req.params;
      const { userIds, customMessage } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Keine Matrix-Benutzer ausgewählt' });
      }

      // Get poll by admin token
      const poll = await storage.getPollByAdminToken(token);
      if (!poll) {
        return res.status(404).json({ error: 'Umfrage nicht gefunden' });
      }

      // Verify ownership
      if (poll.userId !== req.session.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      // Build poll URL
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

  // Public endpoint for theme/branding (for frontend to apply without auth)
  v1Router.get('/customization', async (req, res) => {
    try {
      const settings = await storage.getCustomizationSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching public customization settings:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Public endpoint for accessibility settings (for E2E tests and frontend)
  // Returns whether default WCAG-compliant theme is active
  v1Router.get('/settings/accessibility', async (req, res) => {
    try {
      const settings = await storage.getCustomizationSettings();
      const wcagOverrideEnv = process.env.POLLY_WCAG_OVERRIDE === 'true';
      
      // enforceDefaultTheme is true by default, false if admin customized colors or env override is set
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
  v1Router.get('/customization/mobile', async (req, res) => {
    try {
      const settings = await storage.getCustomizationSettings();
      const baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || `https://${req.get('host')}`;
      
      const siteName = settings.branding?.siteName || 'Polly';
      const siteNameAccent = settings.branding?.siteNameAccent || 'y';
      const siteNameFirst = siteName.replace(siteNameAccent, '').trim();
      
      const mobileTheme = {
        branding: {
          siteName: siteName,
          siteNameFirstPart: siteNameFirst || 'Poll',
          siteNameSecondPart: siteNameAccent,
          logoUrl: settings.branding?.logoUrl ? `${baseUrl}${settings.branding.logoUrl}` : null,
          footerText: settings.footer?.description || '',
          copyrightText: settings.footer?.copyrightText || '',
        },
        colors: {
          // WCAG-compliant default colors (4.5:1 contrast with white background)
          primary: settings.theme?.primaryColor || '#7A3800',
          secondary: settings.theme?.secondaryColor || '#FDE4D2',
          background: '#ffffff',
          backgroundDark: '#1a1a1a',
          surface: '#f5f5f5',
          surfaceDark: '#2a2a2a',
          pollTypes: {
            schedule: {
              color: settings.theme?.scheduleColor || '#7A3800',
              name: 'Terminumfrage',
              icon: 'calendar',
            },
            survey: {
              color: settings.theme?.surveyColor || '#166534',
              name: 'Umfrage',
              icon: 'bar_chart',
            },
            organization: {
              color: settings.theme?.organizationColor || '#075985',
              name: 'Orga-Liste',
              icon: 'list_alt',
            },
          },
        },
        typography: {
          fontFamily: 'Inter, system-ui, sans-serif',
          headingWeight: 700,
          bodyWeight: 400,
        },
        icons: {
          format: 'lucide',
          mapping: {
            calendar: 'Calendar',
            users: 'Users',
            check: 'Check',
            x: 'X',
            plus: 'Plus',
            share: 'Share2',
            qrCode: 'QrCode',
            mail: 'Mail',
            settings: 'Settings',
            logout: 'LogOut',
            login: 'LogIn',
            home: 'Home',
            poll: 'BarChart3',
            vote: 'Vote',
            results: 'PieChart',
          },
        },
        responses: {
          yes: { color: '#22c55e', icon: 'check_circle', label: 'Ja' },
          maybe: { color: '#eab308', icon: 'help', label: 'Vielleicht' },
          no: { color: '#ef4444', icon: 'cancel', label: 'Nein' },
        },
        defaultThemeMode: settings.theme?.defaultThemeMode || 'system',
        apiVersion: '1.0.0',
      };
      
      res.json(mobileTheme);
    } catch (error) {
      console.error('Error fetching mobile customization:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Update user's theme preference (authenticated users)
  v1Router.put('/user/theme', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Nicht angemeldet' });
      }
      
      const { themePreference } = req.body;
      if (!themePreference || !['light', 'dark', 'system'].includes(themePreference)) {
        return res.status(400).json({ error: 'Ungültige Theme-Einstellung' });
      }
      
      const user = await storage.updateUser(req.session.userId, { themePreference });
      res.json({ success: true, themePreference: user.themePreference });
    } catch (error) {
      console.error('Error updating theme preference:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Set theme cookie for guests (also returns default theme)
  v1Router.post('/theme', async (req, res) => {
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

  // Get theme preference (returns user's preference, cookie, or system default)
  v1Router.get('/theme', async (req, res) => {
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

  // Get user profile
  v1Router.get('/user/profile', async (req, res) => {
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
  v1Router.put('/user/profile', async (req, res) => {
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
  v1Router.patch('/users/me/language', async (req, res) => {
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

  // REMOVED: Test endpoint for granting admin role - security risk even in development
  // Admin roles should only be assigned via database or existing admin users

  // Get voter's votes by edit token
  v1Router.get('/votes/edit/:editToken', async (req, res) => {
    try {
      const editToken = req.params.editToken;
      const voterVotes = await storage.getVotesByEditToken(editToken);
      
      if (voterVotes.length === 0) {
        return res.status(404).json({ error: 'No votes found for this edit token' });
      }

      // Get poll information
      const fullPoll = await storage.getPoll(voterVotes[0].pollId);
      if (!fullPoll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      // SECURITY: Only return poll metadata and options, NOT other voters' data
      const securePoll = {
        id: fullPoll.id,
        title: fullPoll.title,
        description: fullPoll.description,
        type: fullPoll.type,
        isActive: fullPoll.isActive,
        expiresAt: fullPoll.expiresAt,
        createdAt: fullPoll.createdAt,
        options: fullPoll.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          imageUrl: opt.imageUrl,
          altText: opt.altText,
          startTime: opt.startTime,
          endTime: opt.endTime,
          order: opt.order
        }))
      };

      res.json({
        poll: securePoll,
        votes: voterVotes,
        voterName: voterVotes[0].voterName,
        voterEmail: voterVotes[0].voterEmail,
        allowVoteWithdrawal: fullPoll.allowVoteWithdrawal
      });
    } catch (error) {
      console.error('Error getting voter votes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update voter's votes by edit token
  v1Router.put('/votes/edit/:editToken', async (req, res) => {
    try {
      const editToken = req.params.editToken;
      const { votes: updatedVotes } = req.body;

      if (!updatedVotes || !Array.isArray(updatedVotes)) {
        return res.status(400).json({ error: 'Invalid votes data' });
      }

      // Get existing votes
      const existingVotes = await storage.getVotesByEditToken(editToken);
      if (existingVotes.length === 0) {
        return res.status(404).json({ error: 'No votes found for this edit token' });
      }

      // Update each vote
      const updatedResults = [];
      for (const updatedVote of updatedVotes) {
        const existingVote = existingVotes.find((v: Vote) => v.optionId === updatedVote.optionId);
        if (existingVote) {
          const updated = await storage.updateVote(existingVote.id, updatedVote.response);
          updatedResults.push(updated);
        }
      }

      res.json({ success: true, votes: updatedResults });
    } catch (error) {
      console.error('Error updating voter votes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============== AUTH ROUTES ==============
  
  // Initialize Keycloak and Token validation (optional)
  authService.initializeKeycloak().catch(console.error);
  tokenService.initializeOIDC().catch(console.error);

  // Get current user (supports both Cookie-Session and Bearer Token)
  v1Router.get('/auth/me', async (req, res) => {
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
  v1Router.post('/auth/request-deletion', requireAuth, async (req, res) => {
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
  v1Router.delete('/auth/request-deletion', requireAuth, async (req, res) => {
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
  v1Router.get('/auth/methods', async (req, res) => {
    try {
      const registrationSetting = await storage.getSetting('registration_enabled');
      const registrationEnabled = registrationSetting?.value !== false;
      
      // Build Keycloak account URL if configured
      let keycloakAccountUrl: string | undefined;
      if (authService.isKeycloakEnabled() && process.env.KEYCLOAK_ISSUER_URL) {
        // Convert issuer URL to account URL: https://keycloak.example.com/realms/myrealm -> https://keycloak.example.com/realms/myrealm/account
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

  // Rate limiting for email check (prevents enumeration attacks)
  const emailCheckRateLimits = new Map<string, { count: number; resetTime: number }>();
  const EMAIL_CHECK_LIMIT = 10; // max attempts per window
  const EMAIL_CHECK_WINDOW = 60000; // 1 minute window

  // Check if email belongs to a registered user (for voting security)
  v1Router.post('/auth/check-email', async (req, res) => {
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
  v1Router.post('/auth/login', async (req, res) => {
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
  v1Router.post('/auth/register', async (req, res) => {
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
  v1Router.post('/auth/logout', (req, res) => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Fehler beim Abmelden' });
      }
      res.json({ success: true });
    });
  });

  // Request password reset (for local accounts)
  v1Router.post('/auth/request-password-reset', async (req, res) => {
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
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const resetLink = `${baseUrl}/passwort-zuruecksetzen/${resetToken.token}`;

      // Send email asynchronously - don't wait for it to complete
      // This ensures the response is immediate regardless of SMTP server speed
      emailService.sendPasswordResetEmail(user.email, resetLink)
        .then(() => console.log(`[Password Reset] Email sent to ${user.email}`))
        .catch((emailError) => console.error(`[Password Reset] Failed to send email to ${user.email}:`, emailError));
      
      res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
    } catch (error) {
      console.error('Password reset request error:', error);
      // Return success anyway to prevent enumeration attacks
      res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
    }
  });

  // Reset password with token
  v1Router.post('/auth/reset-password', async (req, res) => {
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

      // Send confirmation email
      await emailService.sendPasswordChangedNotification(user.email);

      res.json({ success: true, message: 'Passwort wurde erfolgreich geändert.' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Change password (for logged-in local users)
  v1Router.post('/auth/change-password', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
      }

      const user = await storage.getUser(userId!);
      if (!user || user.provider !== 'local') {
        return res.status(400).json({ error: 'Passwortänderung nur für lokale Konten möglich' });
      }

      // Verify current password
      const bcrypt = await import('bcryptjs');
      if (!user.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen lang sein' });
      }

      // Hash and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash: hashedPassword });

      // Send confirmation email
      await emailService.sendPasswordChangedNotification(user.email);

      res.json({ success: true, message: 'Passwort wurde erfolgreich geändert.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Request email change (for logged-in local users)
  v1Router.post('/auth/request-email-change', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { newEmail, password } = req.body;

      if (!newEmail || !password) {
        return res.status(400).json({ error: 'Neue E-Mail und Passwort erforderlich' });
      }

      const user = await storage.getUser(userId!);
      if (!user || user.provider !== 'local') {
        return res.status(400).json({ error: 'E-Mail-Änderung nur für lokale Konten möglich' });
      }

      // Verify password
      const bcrypt = await import('bcryptjs');
      if (!user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) {
        return res.status(400).json({ error: 'Passwort ist falsch' });
      }

      // Check if new email is already in use
      const existingUser = await storage.getUserByEmail(newEmail.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet' });
      }

      // Create email change token
      const changeToken = await storage.createEmailChangeToken(user.id, newEmail.toLowerCase().trim());
      const { getBaseUrl } = await import('./utils/baseUrl');
      const baseUrl = getBaseUrl();
      const confirmLink = `${baseUrl}/email-bestaetigen/${changeToken.token}`;

      // Send email asynchronously - don't wait for it to complete
      emailService.sendEmailChangeConfirmation(user.email, newEmail, confirmLink)
        .then(() => console.log(`[Email Change] Confirmation sent to ${newEmail}`))
        .catch((emailError) => console.error(`[Email Change] Failed to send confirmation to ${newEmail}:`, emailError));

      res.json({ success: true, message: 'Bestätigungslink wurde an die neue E-Mail-Adresse gesendet.' });
    } catch (error) {
      console.error('Email change request error:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Confirm email change with token
  v1Router.post('/auth/confirm-email-change', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token erforderlich' });
      }

      const changeToken = await storage.getEmailChangeToken(token);
      if (!changeToken) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' });
      }

      const user = await storage.getUser(changeToken.userId);
      if (!user) {
        return res.status(400).json({ error: 'Benutzer nicht gefunden' });
      }

      // Update email
      await storage.updateUser(user.id, { email: changeToken.newEmail });

      // Mark token as used
      await storage.markEmailChangeTokenUsed(token);

      res.json({ success: true, message: 'E-Mail-Adresse wurde erfolgreich geändert.' });
    } catch (error) {
      console.error('Email change confirmation error:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Keycloak login initiation
  v1Router.get('/auth/keycloak', (req, res) => {
    if (!authService.isKeycloakEnabled()) {
      return res.status(400).json({ error: 'Keycloak ist nicht konfiguriert' });
    }

    const state = randomBytes(16).toString('hex');
    const result = authService.getKeycloakAuthUrl(state) as any;
    
    if (!result) {
      return res.status(500).json({ error: 'Fehler bei der Keycloak-Initialisierung' });
    }

    req.session.keycloakState = state;
    req.session.keycloakCodeVerifier = result.codeVerifier;
    
    res.redirect(result.url);
  });

  // Keycloak callback
  v1Router.get('/auth/keycloak/callback', async (req, res) => {
    try {
      const { code, state } = req.query;

      if (state !== req.session.keycloakState) {
        console.error('State mismatch');
        return res.redirect('/anmelden?error=state_mismatch');
      }

      const codeVerifier = req.session.keycloakCodeVerifier;
      if (!codeVerifier) {
        return res.redirect('/anmelden?error=missing_verifier');
      }

      const user = await authService.handleKeycloakCallback(
        code as string,
        codeVerifier
      );

      if (!user) {
        return res.redirect('/anmelden?error=auth_failed');
      }

      req.session.userId = user.id;
      delete req.session.keycloakState;
      delete req.session.keycloakCodeVerifier;

      // Explicitly save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/anmelden?error=session_failed');
        }
        res.redirect('/meine-umfragen');
      });
    } catch (error) {
      console.error('Keycloak callback error:', error);
      res.redirect('/anmelden?error=callback_failed');
    }
  });

  // ============== USER DASHBOARD ROUTES ==============

  // Get user's own polls
  v1Router.get('/user/polls', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        console.error('[SECURITY] /user/polls called without userId in session');
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }
      
      const polls = await storage.getUserPolls(userId);
      
      // SECURITY: Log for debugging cross-account data issues
      console.log(`[USER-POLLS] userId=${userId} returned ${polls.length} polls`);
      
      res.json(polls);
    } catch (error) {
      console.error('Error getting user polls:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Get polls user has participated in
  v1Router.get('/user/participations', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        console.error('[SECURITY] /user/participations called without userId in session');
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }
      
      const polls = await storage.getUserParticipatedPolls(userId);
      
      // SECURITY: Log for debugging cross-account data issues
      console.log(`[USER-PARTICIPATIONS] userId=${userId} returned ${polls.length} participations`);
      
      res.json(polls);
    } catch (error) {
      console.error('Error getting user participations:', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // Mount the versioned API router at /api/v1
  app.use(API_BASE, v1Router);
  
  // Backward compatibility: Redirect /api/* to /api/v1/* (except /api/health)
  // Using 308 Permanent Redirect to preserve HTTP method (POST, PUT, PATCH, DELETE)
  app.use('/api', (req, res, next) => {
    // Skip if already at versioned path or health endpoint
    if (req.path.startsWith(`/${API_VERSION}/`) || req.path === '/health') {
      return next();
    }
    
    // Construct the new versioned URL
    const newPath = `${API_BASE}${req.path}`;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    
    console.log(`[API Redirect] ${req.method} /api${req.path} -> ${newPath}`);
    
    // 308 Permanent Redirect preserves the HTTP method
    res.redirect(308, `${newPath}${queryString}`);
  });

  const httpServer = createServer(app);
  return httpServer;
}
