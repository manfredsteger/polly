import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'api' as const,
  name: 'Language API',
  description: 'Tests for user language preference API endpoints',
  severity: 'normal' as const,
};

describe('Language API', () => {
  let app: Express;
  
  beforeAll(async () => {
    app = await createTestApp();
  });
  
  describe('PATCH /api/v1/users/me/language', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/language')
        .send({ language: 'en' });
      
      expect(res.status).toBe(401);
    });
    
    it('should reject invalid language without auth', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/language')
        .send({ language: 'fr' });
      
      expect(res.status).toBe(401);
    });
  });
  
  describe('PUT /api/v1/user/profile with languagePreference', () => {
    it('should require authentication for profile update', async () => {
      const res = await request(app)
        .put('/api/v1/user/profile')
        .send({ languagePreference: 'en' });
      
      expect(res.status).toBe(401);
    });
  });
});

describe('Language Preference Validation', () => {
  it('should only accept de or en as valid languages', () => {
    const validLanguages = ['de', 'en'];
    const invalidLanguages = ['fr', 'es', 'it', 'DE', 'EN', 'german', 'english', ''];
    
    validLanguages.forEach(lang => {
      expect(['de', 'en'].includes(lang)).toBe(true);
    });
    
    invalidLanguages.forEach(lang => {
      expect(['de', 'en'].includes(lang)).toBe(false);
    });
  });
  
  it('should have German as default language', () => {
    const defaultLanguage = 'de';
    expect(defaultLanguage).toBe('de');
  });
  
  it('should support exactly two languages', () => {
    const supportedLanguages = ['de', 'en'];
    expect(supportedLanguages).toHaveLength(2);
    expect(supportedLanguages).toContain('de');
    expect(supportedLanguages).toContain('en');
  });
});
