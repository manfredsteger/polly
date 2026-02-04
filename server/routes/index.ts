import type { Express } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";
import express from "express";
import path from "path";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import type { User } from "@shared/schema";
import { API_VERSION, API_BASE, requireAuth, testModeMiddleware } from "./common";

import authRouter from "./auth";
import pollsRouter from "./polls";
import votesRouter from "./votes";
import adminRouter from "./admin";
import usersRouter from "./users";
import exportRouter from "./export";
import systemRouter from "./system";

export function registerRoutes(app: Express): Server {
  // Serve uploaded images (unversioned static files) - MUST be before API routes
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));

  const v1Router = Router();

  // Test mode middleware - allows E2E tests to mark data as test data
  v1Router.use(testModeMiddleware);

  // Mount all route modules
  
  // Auth routes: /api/v1/auth/*
  v1Router.use('/auth', authRouter);
  
  // Export routes (QR, PDF, CSV, ICS, calendar) - mounted on v1Router root for proper paths
  v1Router.use('/', exportRouter);
  
  // Votes routes - mounted on v1Router root for proper paths like /polls/:token/vote
  v1Router.use('/', votesRouter);
  
  // Poll routes: /api/v1/polls/*
  v1Router.use('/polls', pollsRouter);
  
  // Admin routes: /api/v1/admin/*
  v1Router.use('/admin', adminRouter);
  
  // User routes - mounted on v1Router root for proper paths
  v1Router.use('/', usersRouter);
  
  // System routes - mounted on v1Router root for health, customization, matrix, etc.
  v1Router.use('/', systemRouter);

  // ============== DEPROVISION API (External Kafka/Keycloak Integration) ==============
  // Note: User dashboard routes (user/polls, user/participations) are now in users.ts
  
  // External Deprovisioning Endpoint (Basic Auth protected, not admin)
  v1Router.delete('/deprovision/user', async (req, res) => {
    try {
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
      
      const { email, keycloakId, userId, action = 'delete' } = req.body;
      
      if (!email && !keycloakId && !userId) {
        return res.status(400).json({ 
          error: 'email, keycloakId oder userId erforderlich',
          code: 'MISSING_USER_IDENTIFIER'
        });
      }
      
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

  // Mount the versioned API router at /api/v1
  app.use(API_BASE, v1Router);
  
  // Backward compatibility: Redirect /api/* to /api/v1/* (except /api/health)
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith(`/${API_VERSION}/`) || req.path === '/health') {
      return next();
    }
    
    const newPath = `${API_BASE}${req.path}`;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    
    console.log(`[API Redirect] ${req.method} /api${req.path} -> ${newPath}`);
    
    res.redirect(308, `${newPath}${queryString}`);
  });

  const httpServer = createServer(app);
  return httpServer;
}
