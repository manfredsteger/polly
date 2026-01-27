import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import pg from "pg";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";
import { liveVotingService } from "./services/liveVotingService";
import { bootstrapBranding } from "./scripts/applyBranding";
import { errorHandler } from "./lib/errorHandler";

const MemoryStore = createMemoryStore(session);
const PgSession = connectPgSimple(session);

const app = express();

// Disable X-Powered-By header to hide server technology (Pentest finding: Server software exposure)
app.disable('x-powered-by');

// Trust proxy - required for secure cookies behind reverse proxy (Replit, Heroku, etc.)
// Enable always when running behind a proxy (detected via common proxy headers or explicit config)
const isProxied = process.env.NODE_ENV === 'production' || 
                  process.env.BASE_URL?.includes('replit') ||
                  process.env.REPLIT_DEV_DOMAIN ||
                  process.env.REPL_ID;
if (isProxied) {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Security Headers Middleware - Required for Pentest compliance
app.use((req, res, next) => {
  // Content-Security-Policy (CSP) - Prevents XSS attacks (CWE-693)
  // Production: Stricter policy without unsafe-eval
  // Development: Allows unsafe-eval for Vite HMR
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Check if app is actually running over HTTPS
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || 
    (process.env.BASE_URL && process.env.BASE_URL.startsWith('https://'));
  
  const cspDirectives = [
    "default-src 'self'",
    // In production: no unsafe-eval (Vite bundles everything)
    // In development: unsafe-eval needed for Vite HMR
    isDev 
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" 
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'", // Required for Tailwind CSS - cannot be avoided
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:", // WebSocket for live voting
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  
  // Only add upgrade-insecure-requests when actually behind HTTPS
  // This prevents Safari from trying to upgrade HTTP to HTTPS on local dev
  if (isHttps) {
    cspDirectives.push("upgrade-insecure-requests");
  }
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // X-Frame-Options - Prevents clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // X-Content-Type-Options - Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer-Policy - Controls information sent in Referer header
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy - Restricts browser features
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
  ].join(', '));
  
  // Strict-Transport-Security (HSTS) - Forces HTTPS
  // Only enable when actually behind HTTPS to avoid issues with local HTTP development
  // max-age=31536000 (1 year) meets the 7776000 (90 days) minimum requirement
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // X-XSS-Protection - Legacy XSS protection (deprecated but still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});

// Session cookie configuration
// On Replit and other proxied environments, cookies must be secure (HTTPS only)
// When not proxied (local dev), allow non-secure cookies for HTTP testing

// Use PostgreSQL session store for production persistence
// Falls back to MemoryStore only if DATABASE_URL is not configured
const createSessionStore = () => {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    console.log('Session store: PostgreSQL (persistent)');
    return new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // Prune every 15 minutes
    });
  }
  console.log('Session store: MemoryStore (non-persistent - sessions lost on restart)');
  return new MemoryStore({
    checkPeriod: 86400000,
  });
};

app.use(session({
  secret: process.env.SESSION_SECRET || 'polly-dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'polly.sid',
  cookie: {
    secure: 'auto',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/',
  },
  store: createSessionStore(),
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Bootstrap branding: DB first, then branding.local.json, then branding.default.json
  // Only applies file-based config if database is empty (fresh install or after reset)
  try {
    const { storage } = await import('./storage');
    await bootstrapBranding(storage);
  } catch (error) {
    console.error('[Branding] Failed to bootstrap branding on startup:', error);
  }

  // Initialize ClamAV from environment variables (for Docker deployments)
  try {
    const { clamavService } = await import('./services/clamavService');
    await clamavService.initFromEnv();
  } catch (error) {
    console.error('[ClamAV] Failed to initialize from environment:', error);
  }
  
  // Initialize API rate limiter from database settings
  try {
    const { storage } = await import('./storage');
    const { apiRateLimiter } = await import('./services/apiRateLimiterService');
    const securitySettings = await storage.getSecuritySettings();
    if (securitySettings.apiRateLimits) {
      apiRateLimiter.updateConfig(securitySettings.apiRateLimits);
      console.log('[API Rate Limits] Loaded configuration from database');
    }
  } catch (error) {
    console.error('[API Rate Limits] Failed to load from database:', error);
  }

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Initialize live voting WebSocket after Vite to avoid conflicts with HMR
  // Must use noServer mode and handle upgrade manually to not interfere with Vite's WebSocket
  liveVotingService.initializeWithUpgrade(server);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Warm up slow caches in background after server starts
    setTimeout(async () => {
      try {
        const { getSystemPackages } = await import("./services/systemPackageService");
        const { runNpmAudit } = await import("./services/npmAuditService");
        const { adminCacheService } = await import("./services/adminCacheService");
        
        // Run in parallel for faster warmup
        await Promise.all([
          adminCacheService.getExtendedStats().then(() => console.log('[Cache] Admin stats warmed up')),
          getSystemPackages().then(() => console.log('[Cache] System packages warmed up')),
          runNpmAudit().then(() => console.log('[Cache] npm audit warmed up'))
        ]);
        
        // Start daily warmup scheduler for admin cache
        adminCacheService.startDailyWarmup();
      } catch (e) {
        console.log('[Cache] Warmup completed with some errors (non-critical)');
      }
    }, 1000); // Delay 1s to not slow down initial page loads
  });
})();
