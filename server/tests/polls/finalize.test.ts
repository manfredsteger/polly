import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Poll-Finalisierung',
  description: 'Prüft das Setzen und Aufheben des finalen Termins und Kalender-Export-Filterung',
  severity: 'high' as const,
};

describe('Polls - Finalization', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('POST /api/v1/polls/admin/:token/finalize', () => {
    it('should set final option on a poll', async () => {
      const pollData = createTestPoll({ type: 'schedule' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      expect(createResponse.status).toBe(200);
      const { adminToken, poll } = createResponse.body;
      
      // Get the poll with options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);
      
      expect(pollResponse.status).toBe(200);
      const options = pollResponse.body.options;
      expect(options.length).toBeGreaterThan(0);
      
      // Finalize with the first option
      const firstOptionId = options[0].id;
      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: firstOptionId });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.success).toBe(true);
      expect(finalizeResponse.body.poll.finalOptionId).toBe(firstOptionId);
    });

    it('should clear finalization with optionId 0', async () => {
      const pollData = createTestPoll({ type: 'schedule' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      const { adminToken } = createResponse.body;
      
      // Get the poll with options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);
      
      const firstOptionId = pollResponse.body.options[0].id;
      
      // First set a final option
      await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: firstOptionId });

      // Then clear it
      const clearResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0 });

      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.success).toBe(true);
      expect(clearResponse.body.poll.finalOptionId).toBeNull();
    });

    it('should reject invalid optionId', async () => {
      const pollData = createTestPoll({ type: 'schedule' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      const { adminToken } = createResponse.body;
      
      // Try to finalize with non-existent option
      const response = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 999999 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Option nicht gefunden');
    });

    it('should reject request without optionId', async () => {
      const pollData = createTestPoll({ type: 'schedule' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      const { adminToken } = createResponse.body;
      
      const response = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Ungültige Anfrage');
    });

    it('should reject extra properties in request body', async () => {
      const pollData = createTestPoll({ type: 'schedule' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      const { adminToken } = createResponse.body;
      const pollResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);
      
      const firstOptionId = pollResponse.body.options[0].id;
      
      // Try to send extra properties (should be rejected by strict schema)
      const response = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: firstOptionId, isActive: false, title: 'hacked' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Ungültige Anfrage');
    });

    it('should return 404 for non-existent admin token', async () => {
      const response = await request(app)
        .post('/api/v1/polls/admin/nonexistent-token/finalize')
        .send({ optionId: 1 });

      expect(response.status).toBe(404);
    });
  });
});
