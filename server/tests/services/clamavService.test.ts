import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { storage } from '../../storage';

export const testMeta = {
  category: 'security' as const,
  name: 'ClamAV Virenscanner',
  description: 'Prüft Fail-Secure-Verhalten, Scan-Logging und Kontextübergabe des Virenscanners',
  severity: 'critical' as const,
};

describe('ClamAV Security - Fail-Secure Behavior', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Fail-Secure: Scanner enabled but unreachable', () => {
    let originalConfig: any;

    beforeEach(async () => {
      const setting = await storage.getSetting('clamav_config');
      originalConfig = setting?.value || null;
    });

    afterAll(async () => {
      if (originalConfig) {
        await storage.setSetting({ key: 'clamav_config', value: originalConfig });
      } else {
        await storage.setSetting({ key: 'clamav_config', value: { enabled: false, host: 'localhost', port: 3310, timeout: 5000, maxFileSize: 25 * 1024 * 1024 } });
      }
    });

    it('should BLOCK uploads when ClamAV is enabled but daemon is unreachable (ECONNREFUSED)', async () => {
      await storage.setSetting({
        key: 'clamav_config',
        value: {
          enabled: true,
          host: '127.0.0.1',
          port: 19999,
          timeout: 3000,
          maxFileSize: 25 * 1024 * 1024,
        },
      });

      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();
      (testService as any).configCache = null;
      (testService as any).configCacheTime = 0;

      const testBuffer = Buffer.from('test file content for security check');
      const result = await testService.scanBuffer(testBuffer, 'test-file.jpg');

      expect(result.isClean).toBe(false);
      expect(result.scannerUnavailable).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('blockiert');
    });

    it('should ALLOW uploads when ClamAV is disabled', async () => {
      await storage.setSetting({
        key: 'clamav_config',
        value: {
          enabled: false,
          host: 'localhost',
          port: 3310,
          timeout: 5000,
          maxFileSize: 25 * 1024 * 1024,
        },
      });

      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();
      (testService as any).configCache = null;
      (testService as any).configCacheTime = 0;

      const testBuffer = Buffer.from('test file content');
      const result = await testService.scanBuffer(testBuffer, 'test-file.jpg');

      expect(result.isClean).toBe(true);
      expect(result.scannerUnavailable).toBeUndefined();
    });

    it('should reject files exceeding maxFileSize', async () => {
      await storage.setSetting({
        key: 'clamav_config',
        value: {
          enabled: true,
          host: 'localhost',
          port: 3310,
          timeout: 5000,
          maxFileSize: 100,
        },
      });

      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();
      (testService as any).configCache = null;
      (testService as any).configCacheTime = 0;

      const largeBuffer = Buffer.alloc(200, 'x');
      const result = await testService.scanBuffer(largeBuffer, 'large-file.jpg');

      expect(result.isClean).toBe(false);
      expect(result.error).toContain('maximale Größe');
    });

    it('testConnection should report failure when scanner is unreachable', async () => {
      await storage.setSetting({
        key: 'clamav_config',
        value: {
          enabled: true,
          host: '127.0.0.1',
          port: 19999,
          timeout: 3000,
          maxFileSize: 25 * 1024 * 1024,
        },
      });

      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();
      (testService as any).configCache = null;
      (testService as any).configCacheTime = 0;

      const result = await testService.testConnection();

      expect(result.success).toBe(false);
      expect(result.unavailable).toBe(true);
    });
  });

  describe('Scan Logging', () => {
    it('getScanLogs should return data from database (not empty stubs)', async () => {
      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();

      const result = await testService.getScanLogs({ limit: 10 });

      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.logs)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('getScanStats should return data from database (not zero stubs)', async () => {
      const { ClamAVService } = await import('../../services/clamavService');
      const testService = new ClamAVService();

      const result = await testService.getScanStats();

      expect(result).toHaveProperty('totalScans');
      expect(result).toHaveProperty('cleanScans');
      expect(result).toHaveProperty('infectedScans');
      expect(result).toHaveProperty('errorScans');
      expect(result).toHaveProperty('lastScanAt');
      expect(typeof result.totalScans).toBe('number');
    });

    it('imageService should log scan attempts to database', async () => {
      await storage.setSetting({
        key: 'clamav_config',
        value: {
          enabled: true,
          host: '127.0.0.1',
          port: 19999,
          timeout: 2000,
          maxFileSize: 25 * 1024 * 1024,
        },
      });

      const { clamavService } = await import('../../services/clamavService');
      clamavService.clearConfigCache();

      const { imageService } = await import('../../services/imageService');

      const mockFile = {
        originalname: 'clamav-test-log-verify.jpg',
        buffer: Buffer.from('test content for logging'),
        size: 24,
        mimetype: 'image/jpeg',
        fieldname: 'image',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await imageService.processUpload(mockFile as Express.Multer.File, {
        userId: 9999,
        email: 'test-clamav@test.example.com',
        requestIp: '127.0.0.1',
      });

      expect(result.success).toBe(false);

      const logs = await storage.getClamavScanLogs({ limit: 5 });
      const recentLog = logs.logs.find(
        (log: any) => log.filename === 'clamav-test-log-verify.jpg'
      );
      expect(recentLog).toBeDefined();
      expect(recentLog?.scanStatus).toBe('error');
      expect(recentLog?.actionTaken).toBe('blocked');
    });
  });

  describe('Admin API Endpoints', () => {
    it('should reject ClamAV scan-logs without auth', async () => {
      const response = await request(app).get('/api/v1/admin/clamav/scan-logs');
      expect(response.status).toBe(401);
    });

    it('should reject ClamAV connection test without auth', async () => {
      const response = await request(app).post('/api/v1/admin/clamav/test');
      expect(response.status).toBe(401);
    });
  });
});
