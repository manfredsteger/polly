import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'integration' as const,
  name: 'Branding & Customization',
  description: 'Prüft das Speichern und Laden von Branding-Einstellungen (Titel, Logo, Farben)',
  severity: 'high' as const,
};

describe('Data - Branding & Customization', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should return customization settings for public access', async () => {
    const response = await request(app).get('/api/v1/customization');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('theme');
    expect(response.body).toHaveProperty('branding');
    expect(response.body).toHaveProperty('footer');
  });

  it('should include branding properties in customization response', async () => {
    const response = await request(app).get('/api/v1/customization');
    
    expect(response.status).toBe(200);
    expect(response.body.branding).toBeDefined();
    // Branding should have siteName and siteNameAccent
    expect(response.body.branding).toHaveProperty('siteName');
    expect(response.body.branding).toHaveProperty('siteNameAccent');
  });

  it('should include theme colors in customization response', async () => {
    const response = await request(app).get('/api/v1/customization');
    
    expect(response.status).toBe(200);
    expect(response.body.theme).toBeDefined();
    expect(response.body.theme).toHaveProperty('primaryColor');
    expect(response.body.theme).toHaveProperty('secondaryColor');
  });

  it('should include footer settings in customization response', async () => {
    const response = await request(app).get('/api/v1/customization');
    
    expect(response.status).toBe(200);
    expect(response.body.footer).toBeDefined();
    expect(response.body.footer).toHaveProperty('description');
    expect(response.body.footer).toHaveProperty('copyrightText');
  });

  it('should return valid hex color format for primary color', async () => {
    const response = await request(app).get('/api/v1/customization');
    
    expect(response.status).toBe(200);
    const primaryColor = response.body.theme?.primaryColor;
    if (primaryColor) {
      // Should match hex color pattern #RRGGBB
      expect(primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('should return theme preference endpoint', async () => {
    const response = await request(app).get('/api/v1/theme');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('themePreference');
    expect(response.body).toHaveProperty('source');
    expect(['light', 'dark', 'system']).toContain(response.body.themePreference);
  });
});
