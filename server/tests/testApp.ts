import express, { type Express, type Request, Response, NextFunction } from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import { registerRoutes } from '../routes/index';
import { apiRateLimiter } from '../services/apiRateLimiterService';
import { type Server } from 'http';

const MemoryStore = createMemoryStore(session);

let testApp: Express | null = null;
let testServer: Server | null = null;

// Extend Express Request to include test mode flag
declare global {
  namespace Express {
    interface Request {
      isTestMode?: boolean;
    }
  }
}

export async function createTestApp(): Promise<Express> {
  if (testApp) {
    return testApp;
  }
  
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Mark all requests as test mode - data created will be flagged as test data
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.isTestMode = true;
    next();
  });

  app.use(session({
    secret: 'test-secret-key',
    resave: false,
    saveUninitialized: false,
    name: 'polly.sid',
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/',
    },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  }));

  testServer = await registerRoutes(app);

  // Disable rate limiting for tests
  apiRateLimiter.updateConfig({
    registration: { windowSeconds: 3600, maxRequests: 10000, enabled: false },
    passwordReset: { windowSeconds: 900, maxRequests: 10000, enabled: false },
    pollCreation: { windowSeconds: 60, maxRequests: 10000, enabled: false },
    voting: { windowSeconds: 10, maxRequests: 10000, enabled: false },
    email: { windowSeconds: 60, maxRequests: 10000, enabled: false },
    apiGeneral: { windowSeconds: 60, maxRequests: 10000, enabled: false },
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ message });
  });

  testApp = app;
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (testServer) {
    await new Promise<void>((resolve) => {
      testServer!.close(() => resolve());
    });
    testServer = null;
  }
  testApp = null;
}

export function getTestApp(): Express | null {
  return testApp;
}
