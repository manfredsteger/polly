import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminCacheService } from '../../services/adminCacheService';
import { storage } from '../../storage';

export const testMeta = {
  category: 'services' as const,
  name: 'Admin-Statistik-Cache',
  description: 'Das Admin-Dashboard liest Statistiken aus einem Cache, der periodisch vorgewärmt und bei Fehlern nicht beschädigt wird',
  severity: 'medium' as const,
};

const stats = { totalParticipations: 3 } as any;

describe('admin stats cache', () => {
  afterEach(() => {
    adminCacheService.stopPeriodicWarmup();
    adminCacheService.invalidateCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('serves cached stats until a refresh is forced', async () => {
    const load = vi.spyOn(storage, 'getExtendedStats').mockResolvedValue(stats);
    adminCacheService.invalidateCache();
    expect(adminCacheService.getCacheStatus().statsCache).toEqual({ cached: false, lastChecked: null, expiresAt: null });

    const first = await adminCacheService.getExtendedStats();
    const second = await adminCacheService.getExtendedStats();
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);

    await adminCacheService.getExtendedStats(true);
    expect(load).toHaveBeenCalledTimes(2);
    const status = adminCacheService.getCacheStatus().statsCache;
    expect(status.cached).toBe(true);
    expect(status.expiresAt!.getTime()).toBeGreaterThan(status.lastChecked!.getTime());
  });

  it('warms the cache on start and on every interval, and survives a failing warmup', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.spyOn(storage, 'getExtendedStats')
      .mockResolvedValueOnce(stats)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(stats);

    adminCacheService.startPeriodicWarmup();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledWith('[AdminCache] Failed to warm up cache:', expect.any(Error));
    // The previous good data stays available after a failed warmup.
    expect(adminCacheService.getCacheStatus().statsCache.cached).toBe(true);

    adminCacheService.stopPeriodicWarmup();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
