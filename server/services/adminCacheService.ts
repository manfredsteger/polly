/**
 * Admin Cache Service
 * Caches all admin dashboard data with 24-hour expiry
 * Automatic daily warmup + manual refresh buttons
 */

import { storage } from "../storage";

interface ExtendedStats {
  totalUsers: number;
  activePolls: number;
  inactivePolls: number;
  totalPolls: number;
  totalVotes: number;
  monthlyPolls: number;
  weeklyPolls: number;
  todayPolls: number;
  schedulePolls: number;
  surveyPolls: number;
  organizationPolls: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: Date;
    actor?: string;
    pollToken?: string;
  }>;
}

interface CacheEntry<T> {
  data: T;
  lastChecked: Date;
  cacheExpiresAt: Date;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

class AdminCacheService {
  private statsCache: CacheEntry<ExtendedStats> | null = null;
  private warmupInterval: NodeJS.Timeout | null = null;

  async getExtendedStats(forceRefresh = false): Promise<CacheEntry<ExtendedStats>> {
    if (!forceRefresh && this.statsCache && new Date() < this.statsCache.cacheExpiresAt) {
      return this.statsCache;
    }

    const data = await storage.getExtendedStats();
    const now = new Date();
    
    this.statsCache = {
      data,
      lastChecked: now,
      cacheExpiresAt: new Date(now.getTime() + CACHE_DURATION_MS),
    };

    return this.statsCache;
  }

  async warmupCache(): Promise<void> {
    console.log('[AdminCache] Warming up admin stats cache...');
    const start = Date.now();
    
    try {
      await this.getExtendedStats(true);
      console.log(`[AdminCache] Stats cache warmed up in ${Date.now() - start}ms`);
    } catch (error) {
      console.error('[AdminCache] Failed to warm up cache:', error);
    }
  }

  startDailyWarmup(): void {
    this.warmupInterval = setInterval(() => {
      this.warmupCache();
    }, CACHE_DURATION_MS);

    this.warmupCache();
    console.log('[AdminCache] Daily warmup scheduler started (24h interval)');
  }

  stopDailyWarmup(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
  }

  getCacheStatus(): { 
    statsCache: { cached: boolean; lastChecked: Date | null; expiresAt: Date | null } 
  } {
    return {
      statsCache: {
        cached: !!this.statsCache,
        lastChecked: this.statsCache?.lastChecked || null,
        expiresAt: this.statsCache?.cacheExpiresAt || null,
      },
    };
  }

  invalidateCache(): void {
    this.statsCache = null;
    console.log('[AdminCache] Cache invalidated');
  }
}

export const adminCacheService = new AdminCacheService();
