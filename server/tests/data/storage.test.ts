import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';
import { nanoid } from 'nanoid';

export const testMeta = {
  category: 'database' as const,
  name: 'Datenbank-Operationen',
  description: 'Prüft CRUD-Operationen und Datenintegrität',
  severity: 'critical' as const,
};

describe('Data - Storage Operations', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Poll Data Operations', () => {
    it('should persist poll and return tokens', async () => {
      const pollData = {
        title: `Data Test Poll ${nanoid(6)}`,
        description: 'Test description for data test',
        type: 'survey',
        options: [
          { text: 'Option A' },
          { text: 'Option B' },
          { text: 'Option C' },
        ],
      };

      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      expect(createResponse.status).toBe(200);
      const { publicToken, adminToken } = createResponse.body;
      expect(publicToken).toBeDefined();
      expect(adminToken).toBeDefined();

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);

      expect(fetchResponse.status).toBe(200);
      expect(fetchResponse.body.title).toBe(pollData.title);
      expect(fetchResponse.body.description).toBe(pollData.description);
      expect(fetchResponse.body.options).toBeDefined();
      expect(fetchResponse.body.options.length).toBe(3);
    });

    it('should generate unique tokens for each poll', async () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/v1/polls')
          .send(createTestPoll());

        expect(response.status).toBe(200);
        tokens.add(response.body.publicToken);
        tokens.add(response.body.adminToken);
      }

      expect(tokens.size).toBe(10);
    });

    it('should persist poll settings correctly', async () => {
      const pollData = {
        ...createTestPoll(),
        resultsPublic: false,
        allowVoteEdit: true,
        allowMultipleSlots: false,
      };

      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);

      expect(createResponse.status).toBe(200);
      const { publicToken } = createResponse.body;

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);

      expect(fetchResponse.body.resultsPublic).toBe(false);
      expect(fetchResponse.body.allowVoteEdit).toBe(true);
    });
  });

  describe('Vote Data Operations', () => {
    it('should persist vote with edit token when allowVoteEdit is enabled', async () => {
      const pollData = { ...createTestPoll({ resultsPublic: true }), allowVoteEdit: true };
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      expect(createResponse.status).toBe(200);
      const { publicToken } = createResponse.body;

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);
      expect(fetchResponse.status).toBe(200);
      const optionId = fetchResponse.body.options[0].id;

      const voterEmail = `voter-${nanoid(8)}@example.com`;
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'Data Test Voter',
          voterEmail,
          votes: [{ optionId, response: 'yes' }],
        });

      expect(voteResponse.status).toBe(200);
      expect(voteResponse.body.success).toBe(true);
      expect(voteResponse.body.votes).toBeDefined();
      expect(voteResponse.body.voterEditToken).toBeDefined();
      expect(typeof voteResponse.body.voterEditToken).toBe('string');
      expect(voteResponse.body.voterEditToken.length).toBeGreaterThan(10);
    });

    it('should not return edit token when allowVoteEdit is disabled', async () => {
      const pollData = { ...createTestPoll({ resultsPublic: true }), allowVoteEdit: false };
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      expect(createResponse.status).toBe(200);
      const { publicToken } = createResponse.body;

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);
      const optionId = fetchResponse.body.options[0].id;

      const voterEmail = `voter-${nanoid(8)}@example.com`;
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'No Edit Voter',
          voterEmail,
          votes: [{ optionId, response: 'yes' }],
        });

      expect(voteResponse.status).toBe(200);
      expect(voteResponse.body.success).toBe(true);
      expect(voteResponse.body.voterEditToken).toBeNull();
    });

    it('should allow first vote from unique voter', async () => {
      const pollData = createTestPoll({ resultsPublic: true });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      expect(createResponse.status).toBe(200);
      const { publicToken } = createResponse.body;

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);
      const optionId = fetchResponse.body.options[0].id;
      const voterName = `UniqueVoter ${nanoid(8)}`;
      const voterEmail = `unique-${nanoid(8)}@example.com`;

      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName,
          voterEmail,
          votes: [{ optionId, response: 'yes' }],
        });

      expect(voteResponse.status).toBe(200);
      expect(voteResponse.body.success).toBe(true);
    });
  });

  describe('Data Retrieval', () => {
    it('should return correct poll data after creation', async () => {
      const pollData = createTestPoll({ resultsPublic: true });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      expect(createResponse.status).toBe(200);
      const { publicToken } = createResponse.body;

      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);
      const optionId = fetchResponse.body.options[0].id;

      await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: `Voter ${nanoid(4)}`,
          voterEmail: `v-${nanoid(6)}@example.com`,
          votes: [{ optionId, response: 'yes' }],
        });

      const resultsResponse = await request(app)
        .get(`/api/v1/polls/${publicToken}/results`);

      expect(resultsResponse.status).toBe(200);
      expect(resultsResponse.body.poll).toBeDefined();
      expect(resultsResponse.body.stats).toBeDefined();
    });

    it('should return 404 for non-existent poll', async () => {
      const response = await request(app)
        .get(`/api/v1/polls/public/nonexistent-token-${nanoid(10)}`);

      expect(response.status).toBe(404);
    });

    it('should return admin view with admin token for guest polls', async () => {
      const pollData = createTestPoll();
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      const { adminToken } = createResponse.body;

      const adminResponse = await request(app)
        .get(`/api/v1/polls/admin/${adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.title).toBe(pollData.title);
    });
  });
});
