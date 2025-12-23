import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll, createTestVote, createTestUser } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'data' as const,
  name: 'Testdaten-Generierung',
  description: 'Prüft Fixture-Funktionen und Testdaten-Erstellung',
  severity: 'medium' as const,
};

describe('Data - Test Data Generation', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('createTestPoll Fixture', () => {
    it('should generate unique poll titles with nanoid suffix', () => {
      const poll1 = createTestPoll();
      const poll2 = createTestPoll();
      
      expect(poll1.title).toMatch(/^Test Poll [A-Za-z0-9_-]{6}$/);
      expect(poll2.title).toMatch(/^Test Poll [A-Za-z0-9_-]{6}$/);
      expect(poll1.title).not.toBe(poll2.title);
    });

    it('should create survey poll by default', () => {
      const poll = createTestPoll();
      expect(poll.type).toBe('survey');
    });

    it('should allow type override to schedule', () => {
      const poll = createTestPoll({ type: 'schedule' });
      expect(poll.type).toBe('schedule');
    });

    it('should allow type override to organization', () => {
      const poll = createTestPoll({ type: 'organization' });
      expect(poll.type).toBe('organization');
      expect(poll.options[0]).toHaveProperty('maxCapacity');
    });

    it('should include default options for survey type', () => {
      const poll = createTestPoll({ type: 'survey' });
      expect(poll.options.length).toBe(3);
      expect(poll.options[0].text).toBe('Option 1');
    });

    it('should include maxCapacity for organization type', () => {
      const poll = createTestPoll({ type: 'organization' });
      const firstOption = poll.options[0] as { text: string; maxCapacity: number };
      expect(firstOption.maxCapacity).toBeDefined();
      expect(typeof firstOption.maxCapacity).toBe('number');
    });

    it('should respect resultsPublic override', () => {
      const publicPoll = createTestPoll({ resultsPublic: true });
      const privatePoll = createTestPoll({ resultsPublic: false });
      
      expect(publicPoll.resultsPublic).toBe(true);
      expect(privatePoll.resultsPublic).toBe(false);
    });

    it('should generate unique creator emails', () => {
      const poll1 = createTestPoll();
      const poll2 = createTestPoll();
      
      expect(poll1.creatorEmail).toMatch(/^creator-[A-Za-z0-9_-]+@example\.com$/);
      expect(poll1.creatorEmail).not.toBe(poll2.creatorEmail);
    });
  });

  describe('createTestVote Fixture', () => {
    it('should generate unique voter names', () => {
      const vote1 = createTestVote();
      const vote2 = createTestVote();
      
      expect(vote1.voterName).toMatch(/^Voter [A-Za-z0-9_-]{4}$/);
      expect(vote1.voterName).not.toBe(vote2.voterName);
    });

    it('should generate unique voter emails', () => {
      const vote1 = createTestVote();
      const vote2 = createTestVote();
      
      expect(vote1.voterEmail).toMatch(/^voter-[A-Za-z0-9_-]+@example\.com$/);
      expect(vote1.voterEmail).not.toBe(vote2.voterEmail);
    });

    it('should default to yes response', () => {
      const vote = createTestVote();
      expect(vote.response).toBe('yes');
    });

    it('should allow response override', () => {
      const noVote = createTestVote({ response: 'no' });
      const maybeVote = createTestVote({ response: 'maybe' });
      
      expect(noVote.response).toBe('no');
      expect(maybeVote.response).toBe('maybe');
    });
  });

  describe('createTestUser Fixture', () => {
    it('should generate unique user emails', () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      
      expect(user1.email).toMatch(/^test-[A-Za-z0-9_-]+@example\.com$/);
      expect(user1.email).not.toBe(user2.email);
    });

    it('should generate unique user names', () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      
      expect(user1.name).toMatch(/^Test User [A-Za-z0-9_-]{4}$/);
    });

    it('should default to user role', () => {
      const user = createTestUser();
      expect(user.role).toBe('user');
    });

    it('should allow role override', () => {
      const adminUser = createTestUser({ role: 'admin' });
      expect(adminUser.role).toBe('admin');
    });

    it('should use default password', () => {
      const user = createTestUser();
      expect(user.password).toBe('TestPassword123!');
    });
  });

  describe('Test Data Persistence', () => {
    it('should persist test poll to database', async () => {
      const pollData = createTestPoll();
      
      const response = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      expect(response.status).toBe(200);
      expect(response.body.publicToken).toBeDefined();
      
      const fetchResponse = await request(app)
        .get(`/api/v1/polls/public/${response.body.publicToken}`);
      
      expect(fetchResponse.status).toBe(200);
      expect(fetchResponse.body.title).toBe(pollData.title);
    });

    it('should persist test vote to database', async () => {
      const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
      
      const pollResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      const { publicToken } = pollResponse.body;
      
      const pollDetails = await request(app)
        .get(`/api/v1/polls/public/${publicToken}`);
      
      const optionId = pollDetails.body.options[0].id;
      const voteData = createTestVote();
      
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: voteData.voterName,
          voterEmail: voteData.voterEmail,
          votes: [{ optionId, response: voteData.response }],
        });
      
      expect(voteResponse.status).toBe(200);
    });
  });
});
