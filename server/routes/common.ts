import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { type User } from "@shared/schema";
import { tokenService } from "../services/tokenService";
import { loginRateLimiter } from "../services/rateLimiterService";
import { deviceTokenService } from "../services/deviceTokenService";
import { z } from "zod";
import "express-session";
import { AuthenticationError, AuthorizationError } from "../lib/errors";
export { asyncHandler } from "../lib/errorHandler";
export * from "../lib/errors";

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
      isTestMode?: boolean;
    }
  }
}

export function testModeMiddleware(req: Request, res: Response, next: NextFunction) {
  const testModeHeader = req.headers['x-test-mode'];
  const testModeSecret = process.env.TEST_MODE_SECRET || 'polly-e2e-test-mode';
  
  if (testModeHeader === testModeSecret) {
    req.isTestMode = true;
  }
  next();
}

// Validation schemas
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

export const voteSchema = z.object({
  optionId: z.number(),
  voterName: z.string().min(1),
  voterEmail: z.string().email(),
  response: z.enum(['yes', 'maybe', 'no']),
  comment: z.string().optional(),
});

export const inviteSchema = z.object({
  emails: z.array(z.string().email()),
  customMessage: z.string().optional(),
});

export const bulkVoteSchema = z.object({
  voterName: z.string().min(1),
  voterEmail: z.string().email(),
  votes: z.array(z.object({
    optionId: z.number(),
    response: z.enum(['yes', 'maybe', 'no']),
    comment: z.string().optional(),
  })).min(1),
});

export { loginSchema };

// Extract user ID from session or bearer token
export const extractUserId = async (req: Request): Promise<number | null> => {
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

// Middleware: require authentication
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      throw new AuthenticationError('Nicht angemeldet');
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware: require admin role
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      throw new AuthenticationError('Nicht angemeldet');
    }
    
    const user = req.tokenUser || await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError('Administratorberechtigung erforderlich');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Email cooldown tracking to prevent spam
export const recentEmailSends = new Map<string, number>();
export const EMAIL_COOLDOWN = 30000; // 30 seconds

// Rate limiting for email check (prevents enumeration attacks)
export const emailCheckRateLimits = new Map<string, { count: number; resetTime: number }>();
export const EMAIL_CHECK_LIMIT = 10; // max attempts per window
export const EMAIL_CHECK_WINDOW = 60000; // 1 minute window

// Re-export services for convenience
export { loginRateLimiter, deviceTokenService, storage };
