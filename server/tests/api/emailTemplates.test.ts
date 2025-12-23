import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'security' as const,
  name: 'E-Mail-Vorlagen-Endpunkte',
  description: 'Prüft Zugriffskontrolle und Funktionalität der E-Mail-Vorlagen-API',
  severity: 'high' as const,
};

describe('API - Email Templates Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Authentication', () => {
    it('should reject access to email templates list without auth', async () => {
      const response = await request(app).get('/api/v1/admin/email-templates');
      
      expect(response.status).toBe(401);
    });

    it('should reject access to single template without auth', async () => {
      const response = await request(app).get('/api/v1/admin/email-templates/poll_created');
      
      expect(response.status).toBe(401);
    });

    it('should reject updating template without auth', async () => {
      const response = await request(app)
        .put('/api/v1/admin/email-templates/poll_created')
        .send({ subject: 'Test Subject', jsonContent: {} });
      
      expect(response.status).toBe(401);
    });

    it('should reject template preview without auth', async () => {
      const response = await request(app)
        .post('/api/v1/admin/email-templates/poll_created/preview');
      
      expect(response.status).toBe(401);
    });

    it('should reject test email sending without auth', async () => {
      const response = await request(app)
        .post('/api/v1/admin/email-templates/poll_created/test')
        .send({ recipientEmail: 'test@example.com' });
      
      expect(response.status).toBe(401);
    });

    it('should reject template reset without auth', async () => {
      const response = await request(app)
        .post('/api/v1/admin/email-templates/poll_created/reset');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should return 404 for non-existent template type without auth', async () => {
      const response = await request(app).get('/api/v1/admin/email-templates/nonexistent_type');
      
      expect(response.status).toBe(401);
    });

    it('should validate template type format in URL', async () => {
      const response = await request(app)
        .get('/api/v1/admin/email-templates/invalid<script>type');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Email Footer Endpoints', () => {
    it('should reject GET email-footer without auth', async () => {
      const response = await request(app).get('/api/v1/admin/email-footer');
      
      expect(response.status).toBe(401);
    });

    it('should reject PUT email-footer without auth', async () => {
      const response = await request(app)
        .put('/api/v1/admin/email-footer')
        .send({ footer: 'Test footer text' });
      
      expect(response.status).toBe(401);
    });

    it('should reject PUT email-footer with invalid body', async () => {
      const response = await request(app)
        .put('/api/v1/admin/email-footer')
        .send({});
      
      expect(response.status).toBe(401);
    });
  });
});
