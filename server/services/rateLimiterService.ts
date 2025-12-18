import { storage } from '../storage';
import type { LoginRateLimitSettings } from '@shared/schema';

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

class LoginRateLimiterService {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.attempts.entries());
      for (const [key, entry] of entries) {
        if (entry.lockedUntil && entry.lockedUntil < now) {
          this.attempts.delete(key);
        } else if (now - entry.firstAttempt > 3600000) {
          this.attempts.delete(key);
        }
      }
    }, 60000);
  }

  private getKey(identifier: string, ip: string): string {
    return `${identifier.toLowerCase().trim()}:${ip}`;
  }

  async getSettings(): Promise<LoginRateLimitSettings> {
    try {
      const securitySettings = await storage.getSecuritySettings();
      return securitySettings.loginRateLimit;
    } catch {
      return {
        enabled: true,
        maxAttempts: 5,
        windowSeconds: 900,
        cooldownSeconds: 900,
      };
    }
  }

  async checkRateLimit(identifier: string, ip: string): Promise<{
    allowed: boolean;
    remainingAttempts: number;
    retryAfter: number | null;
    message?: string;
  }> {
    const settings = await this.getSettings();
    
    if (!settings.enabled) {
      return { allowed: true, remainingAttempts: settings.maxAttempts, retryAfter: null };
    }

    const key = this.getKey(identifier, ip);
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (entry?.lockedUntil && entry.lockedUntil > now) {
      const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter,
        message: `Zu viele Anmeldeversuche. Bitte warten Sie ${Math.ceil(retryAfter / 60)} Minute${retryAfter > 60 ? 'n' : ''}.`,
      };
    }

    if (entry) {
      const windowMs = settings.windowSeconds * 1000;
      if (now - entry.firstAttempt > windowMs) {
        this.attempts.delete(key);
        return { allowed: true, remainingAttempts: settings.maxAttempts, retryAfter: null };
      }

      const remainingAttempts = settings.maxAttempts - entry.attempts;
      return { allowed: remainingAttempts > 0, remainingAttempts: Math.max(0, remainingAttempts), retryAfter: null };
    }

    return { allowed: true, remainingAttempts: settings.maxAttempts, retryAfter: null };
  }

  async recordFailedAttempt(identifier: string, ip: string): Promise<{
    locked: boolean;
    retryAfter: number | null;
    remainingAttempts: number;
  }> {
    const settings = await this.getSettings();
    
    if (!settings.enabled) {
      return { locked: false, retryAfter: null, remainingAttempts: settings.maxAttempts };
    }

    const key = this.getKey(identifier, ip);
    const now = Date.now();
    let entry = this.attempts.get(key);

    if (!entry || now - entry.firstAttempt > settings.windowSeconds * 1000) {
      entry = { attempts: 1, firstAttempt: now, lockedUntil: null };
    } else {
      entry.attempts++;
    }

    if (entry.attempts >= settings.maxAttempts) {
      entry.lockedUntil = now + settings.cooldownSeconds * 1000;
      this.attempts.set(key, entry);
      
      console.log(`[RATE LIMIT] Account locked: ${identifier} from IP ${ip} - ${settings.maxAttempts} failed attempts`);
      
      return {
        locked: true,
        retryAfter: settings.cooldownSeconds,
        remainingAttempts: 0,
      };
    }

    this.attempts.set(key, entry);
    return {
      locked: false,
      retryAfter: null,
      remainingAttempts: settings.maxAttempts - entry.attempts,
    };
  }

  async recordSuccessfulLogin(identifier: string, ip: string): Promise<void> {
    const key = this.getKey(identifier, ip);
    this.attempts.delete(key);
  }

  getStats(): { totalTracked: number; lockedAccounts: number } {
    const now = Date.now();
    let lockedAccounts = 0;
    
    const values = Array.from(this.attempts.values());
    for (const entry of values) {
      if (entry.lockedUntil && entry.lockedUntil > now) {
        lockedAccounts++;
      }
    }

    return {
      totalTracked: this.attempts.size,
      lockedAccounts,
    };
  }

  clearAll(): void {
    this.attempts.clear();
  }
}

export const loginRateLimiter = new LoginRateLimiterService();
