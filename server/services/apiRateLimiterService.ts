import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../lib/errors';
import type { ApiRateLimitsSettings } from '@shared/schema';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enabled?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface DynamicLimiterConfig {
  name: string;
  getConfig: () => RateLimitConfig;
  message: string;
}

class ApiRateLimiterService {
  private limiters: Map<string, Map<string, RateLimitEntry>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private dynamicConfigs: Map<string, RateLimitConfig> = new Map();
  private configLoaded: boolean = false;

  constructor() {
    this.startCleanupInterval();
    this.initDefaultConfigs();
  }

  private initDefaultConfigs(): void {
    this.dynamicConfigs.set('registration', { windowMs: 3600 * 1000, maxRequests: 5, enabled: true });
    this.dynamicConfigs.set('password-reset', { windowMs: 900 * 1000, maxRequests: 3, enabled: true });
    this.dynamicConfigs.set('poll-creation', { windowMs: 60 * 1000, maxRequests: 10, enabled: true });
    this.dynamicConfigs.set('vote', { windowMs: 10 * 1000, maxRequests: 30, enabled: true });
    this.dynamicConfigs.set('email', { windowMs: 60 * 1000, maxRequests: 5, enabled: true });
    this.dynamicConfigs.set('api-general', { windowMs: 60 * 1000, maxRequests: 100, enabled: true });
  }

  updateConfig(settings: ApiRateLimitsSettings): void {
    if (settings.registration) {
      this.dynamicConfigs.set('registration', {
        windowMs: settings.registration.windowSeconds * 1000,
        maxRequests: settings.registration.maxRequests,
        enabled: settings.registration.enabled,
      });
    }
    if (settings.passwordReset) {
      this.dynamicConfigs.set('password-reset', {
        windowMs: settings.passwordReset.windowSeconds * 1000,
        maxRequests: settings.passwordReset.maxRequests,
        enabled: settings.passwordReset.enabled,
      });
    }
    if (settings.pollCreation) {
      this.dynamicConfigs.set('poll-creation', {
        windowMs: settings.pollCreation.windowSeconds * 1000,
        maxRequests: settings.pollCreation.maxRequests,
        enabled: settings.pollCreation.enabled,
      });
    }
    if (settings.voting) {
      this.dynamicConfigs.set('vote', {
        windowMs: settings.voting.windowSeconds * 1000,
        maxRequests: settings.voting.maxRequests,
        enabled: settings.voting.enabled,
      });
    }
    if (settings.email) {
      this.dynamicConfigs.set('email', {
        windowMs: settings.email.windowSeconds * 1000,
        maxRequests: settings.email.maxRequests,
        enabled: settings.email.enabled,
      });
    }
    if (settings.apiGeneral) {
      this.dynamicConfigs.set('api-general', {
        windowMs: settings.apiGeneral.windowSeconds * 1000,
        maxRequests: settings.apiGeneral.maxRequests,
        enabled: settings.apiGeneral.enabled,
      });
    }
    this.configLoaded = true;
  }

  getConfig(name: string): RateLimitConfig | undefined {
    return this.dynamicConfigs.get(name);
  }

  getAllConfigs(): Record<string, RateLimitConfig> {
    const result: Record<string, RateLimitConfig> = {};
    for (const [name, config] of this.dynamicConfigs.entries()) {
      result[name] = config;
    }
    return result;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [name, entries] of this.limiters.entries()) {
        for (const [key, entry] of entries.entries()) {
          if (entry.resetTime < now) {
            entries.delete(key);
          }
        }
        if (entries.size === 0) {
          this.limiters.delete(name);
        }
      }
    }, 60000);
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private defaultKeyGenerator(req: Request): string {
    return this.getClientIp(req);
  }

  createMiddleware(name: string, staticConfig: RateLimitConfig) {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new Map());
    }

    return (req: Request, res: Response, next: NextFunction): void => {
      const dynamicConfig = this.dynamicConfigs.get(name);
      
      const config: RateLimitConfig = {
        ...staticConfig,
        ...(dynamicConfig && {
          windowMs: dynamicConfig.windowMs,
          maxRequests: dynamicConfig.maxRequests,
          enabled: dynamicConfig.enabled,
        }),
      };
      
      if (config.enabled === false) {
        next();
        return;
      }

      const entries = this.limiters.get(name)!;
      const keyGenerator = config.keyGenerator || ((r: Request) => this.defaultKeyGenerator(r));
      const key = keyGenerator(req);
      const now = Date.now();

      let entry = entries.get(key);

      if (!entry || entry.resetTime < now) {
        entry = {
          count: 1,
          resetTime: now + config.windowMs,
        };
        entries.set(key, entry);
      } else {
        entry.count++;
      }

      const remaining = Math.max(0, config.maxRequests - entry.count);
      const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

      if (entry.count > config.maxRequests) {
        res.setHeader('Retry-After', resetSeconds.toString());
        const message = staticConfig.message || `Zu viele Anfragen. Bitte warten Sie ${resetSeconds} Sekunden.`;
        next(new RateLimitError(message));
        return;
      }

      next();
    };
  }

  getStats(name: string): { totalTracked: number; blockedClients: number } {
    const entries = this.limiters.get(name);
    if (!entries) {
      return { totalTracked: 0, blockedClients: 0 };
    }

    const now = Date.now();
    let blockedClients = 0;

    for (const [, entry] of entries.entries()) {
      if (entry.resetTime > now && entry.count > 0) {
        blockedClients++;
      }
    }

    return {
      totalTracked: entries.size,
      blockedClients,
    };
  }

  clearAll(name?: string): void {
    if (name) {
      this.limiters.delete(name);
    } else {
      this.limiters.clear();
    }
  }
}

export const apiRateLimiter = new ApiRateLimiterService();

export const emailRateLimiter = apiRateLimiter.createMiddleware('email', {
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Zu viele E-Mail-Anfragen. Bitte warten Sie eine Minute.',
});

export const pollCreationRateLimiter = apiRateLimiter.createMiddleware('poll-creation', {
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Zu viele Umfragen erstellt. Bitte warten Sie eine Minute.',
});

export const voteRateLimiter = apiRateLimiter.createMiddleware('vote', {
  windowMs: 10 * 1000,
  maxRequests: 30,
  message: 'Zu viele Abstimmungen. Bitte warten Sie einige Sekunden.',
});

export const registrationRateLimiter = apiRateLimiter.createMiddleware('registration', {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut.',
});

export const passwordResetRateLimiter = apiRateLimiter.createMiddleware('password-reset', {
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
  message: 'Zu viele Passwort-Zurücksetzen-Anfragen. Bitte warten Sie 15 Minuten.',
});

export const apiGeneralRateLimiter = apiRateLimiter.createMiddleware('api-general', {
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'Zu viele API-Anfragen. Bitte reduzieren Sie die Anfragehäufigkeit.',
});
