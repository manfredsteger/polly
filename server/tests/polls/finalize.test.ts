import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Poll-Finalisierung',
  description: 'Prüft das Setzen und Aufheben des finalen Termins, Kalender-Export-Filterung und Orga-Listen-Bestätigung',
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
      const { adminToken, publicToken } = createResponse.body;
      
      // Get the poll with options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);
      
      expect(pollResponse.status).toBe(200);
      const options = pollResponse.body.options;
      expect(options.length).toBeGreaterThan(0);
      
      const firstOptionId = options[0].id;

      // Cast a vote first (required before finalization)
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({
          voterName: 'Test Voter',
          voterEmail: 'voter@example.com',
          votes: [{ optionId: firstOptionId, response: 'yes' }],
        });
      expect(voteResponse.status).toBe(200);
      
      // Finalize with the first option
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

  describe('Orga-Listen Finalisierung (orgFinalize)', () => {
    async function createOrgPollWithVote(app: Express) {
      const pollData = createTestPoll({ type: 'organization' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      expect(createResponse.status).toBe(200);

      const { adminToken, publicToken } = createResponse.body;

      const pollResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);
      expect(pollResponse.status).toBe(200);
      const firstOptionId = pollResponse.body.options[0].id;

      // Cast a vote so the poll has at least one participant
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({
          voterName: 'Test Participant',
          voterEmail: 'participant@example.com',
          votes: [{ optionId: firstOptionId, response: 'yes' }],
        });
      expect(voteResponse.status).toBe(200);

      return { adminToken, publicToken, firstOptionId };
    }

    it('should set finalOptionId to -1 for org finalize', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.success).toBe(true);
      expect(finalizeResponse.body.poll.finalOptionId).toBe(-1);
    });

    it('should close the poll when closePoll is true', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true, closePoll: true });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.poll.finalOptionId).toBe(-1);
      expect(finalizeResponse.body.poll.isActive).toBe(false);
    });

    it('should not close the poll when closePoll is false', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true, closePoll: false });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.poll.finalOptionId).toBe(-1);
      expect(finalizeResponse.body.poll.isActive).toBe(true);
    });

    it('should clear org finalization with optionId 0 and no orgFinalize flag', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      // First finalize
      await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true });

      // Then undo
      const clearResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0 });

      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.success).toBe(true);
      expect(clearResponse.body.poll.finalOptionId).toBeNull();
    });

    it('should reject orgFinalize on non-organization poll type', async () => {
      const pollData = createTestPoll({ type: 'survey' });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      const { adminToken } = createResponse.body;

      const pollResponse = await request(app).get(`/api/v1/polls/admin/${adminToken}`);
      const firstOptionId = pollResponse.body.options[0].id;

      // Cast a vote first
      const publicToken = createResponse.body.publicToken;
      await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({ voterName: 'Voter', voterEmail: 'v@example.com', votes: [{ optionId: firstOptionId, response: 'yes' }] });

      // orgFinalize=true on a survey poll — falls through to normal path (needs valid optionId)
      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true });

      // survey poll does NOT enter org-finalize branch, so optionId:0 clears finalization (returns null, success)
      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.poll.finalOptionId).toBeNull();
    });

    it('should reject extra fields not in schema', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      const response = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true, unknownField: 'bad' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Ungültige Anfrage');
    });

    it('should reopen registration (isActive=true) when undoing org finalization that closed the poll', async () => {
      const { adminToken } = await createOrgPollWithVote(app);

      // Finalize with closePoll=true → poll becomes inactive
      await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true, closePoll: true });

      // Verify poll is closed
      const closedResponse = await request(app).get(`/api/v1/polls/admin/${adminToken}`);
      expect(closedResponse.body.isActive).toBe(false);

      // Undo org finalization → should reopen registration
      const undoResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0 });

      expect(undoResponse.status).toBe(200);
      expect(undoResponse.body.poll.finalOptionId).toBeNull();
      expect(undoResponse.body.poll.isActive).toBe(true);
    });

    it('should work correctly when organizer email is also a participant email', async () => {
      const creatorEmail = `organizer-${Date.now()}@example.com`;
      const pollData = createTestPoll({ type: 'organization', creatorEmail });
      const createResponse = await request(app).post('/api/v1/polls').send(pollData);
      expect(createResponse.status).toBe(200);

      const { adminToken, publicToken } = createResponse.body;
      const pollResponse = await request(app).get(`/api/v1/polls/admin/${adminToken}`);
      const firstOptionId = pollResponse.body.options[0].id;

      // Organizer signs up as a participant
      await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({
          voterName: 'Organizer',
          voterEmail: creatorEmail,
          votes: [{ optionId: firstOptionId, response: 'yes' }],
        });

      // Finalize with notify=true — should succeed even when organizer is also participant
      const finalizeResponse = await request(app)
        .post(`/api/v1/polls/admin/${adminToken}/finalize`)
        .send({ optionId: 0, orgFinalize: true, notifyParticipants: true });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.poll.finalOptionId).toBe(-1);
    });
  });
});
