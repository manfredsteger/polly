import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { liveVotingService } from "./services/liveVotingService";

const MemoryStore = createMemoryStore(session);

const app = express();

// Disable X-Powered-By header to hide server technology (Pentest finding: Server software exposure)
app.disable('x-powered-by');

// Trust proxy in production - required for secure cookies behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security Headers Middleware - Required for Pentest compliance
app.use((req, res, next) => {
  // Content-Security-Policy (CSP) - Prevents XSS attacks (CWE-693)
  // Production: Stricter policy without unsafe-eval
  // Development: Allows unsafe-eval for Vite HMR
  const isDev = process.env.NODE_ENV !== 'production';
  
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
    "upgrade-insecure-requests", // Force HTTPS for all resources
  ];
  
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
  // Enable for all HTTPS connections (Replit uses HTTPS even in development)
  // max-age=31536000 (1 year) meets the 7776000 (90 days) minimum requirement
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // X-XSS-Protection - Legacy XSS protection (deprecated but still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});

// Determine if cookies should be secure based on BASE_URL (not just NODE_ENV)
// This allows production deployments over HTTP (e.g., localhost, internal networks)
const isSecureConnection = (process.env.BASE_URL || '').startsWith('https://');

app.use(session({
  secret: process.env.SESSION_SECRET || 'kita-poll-dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isSecureConnection,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
  });
})();
