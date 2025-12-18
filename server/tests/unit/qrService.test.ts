import { describe, it, expect } from 'vitest';
import { qrService } from '../../services/qrService';

export const testMeta = {
  category: 'api' as const,
  name: 'QR-Code-Service',
  description: 'Prüft die QR-Code-Generierung für verschiedene Formate',
  severity: 'medium' as const,
};

describe('QR Service - Unit Tests', () => {
  it('should generate PNG QR code as data URL', async () => {
    const url = 'https://example.com/poll/abc123';
    const qrCode = await qrService.generateQRCode(url, 'png');
    
    expect(qrCode).toBeDefined();
    expect(qrCode).toContain('data:image/png;base64,');
  });

  it('should generate SVG QR code as data URL', async () => {
    const url = 'https://example.com/poll/abc123';
    const qrCode = await qrService.generateQRCode(url, 'svg');
    
    expect(qrCode).toBeDefined();
    expect(qrCode).toContain('data:image/svg+xml;base64,');
  });

  it('should generate PNG QR code buffer', async () => {
    const url = 'https://example.com/poll/test456';
    const buffer = await qrService.generateQRCodeBuffer(url, 'png');
    
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate SVG QR code buffer', async () => {
    const url = 'https://example.com/poll/test789';
    const buffer = await qrService.generateQRCodeBuffer(url, 'svg');
    
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toContain('<svg');
  });

  it('should handle URLs with special characters', async () => {
    const url = 'https://example.com/poll/test?param=value&other=123';
    const qrCode = await qrService.generateQRCode(url, 'png');
    
    expect(qrCode).toBeDefined();
    expect(qrCode).toContain('data:image/png;base64,');
  });

  it('should handle URLs with umlauts', async () => {
    const url = 'https://example.com/umfrage/München';
    const qrCode = await qrService.generateQRCode(url, 'png');
    
    expect(qrCode).toBeDefined();
    expect(qrCode).toContain('data:image/png;base64,');
  });

  it('should default to PNG format', async () => {
    const url = 'https://example.com/poll/default';
    const qrCode = await qrService.generateQRCode(url);
    
    expect(qrCode).toContain('data:image/png;base64,');
  });
});
