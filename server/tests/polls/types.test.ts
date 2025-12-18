import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Umfrage-Typen',
  description: 'Prüft die verschiedenen Umfragetypen: Terminumfrage, Umfrage, Orga-Liste',
  severity: 'medium' as const,
};

describe('Polls - Types', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should create schedule poll (Terminumfrage)', async () => {
    const pollData = createTestPoll({ type: 'schedule' });
    
    const response = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(response.status).toBe(200);
    expect(response.body.poll.type).toBe('schedule');
  });

  it('should create survey poll (Umfrage)', async () => {
    const pollData = createTestPoll({ type: 'survey' });
    
    const response = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(response.status).toBe(200);
    expect(response.body.poll.type).toBe('survey');
  });

  it('should create organization poll (Orga-Liste)', async () => {
    const pollData = createTestPoll({ type: 'organization' });
    
    const response = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(response.status).toBe(200);
    expect(response.body.poll.type).toBe('organization');
  });

  it('should handle poll with private results correctly', async () => {
    const pollData = createTestPoll({ resultsPublic: false });
    
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(createResponse.status).toBe(200);
    
    const publicToken = createResponse.body.publicToken;
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    
    expect(pollResponse.body.resultsPublic).toBe(false);
  });

  it('should handle private results poll correctly', async () => {
    const pollData = createTestPoll({ resultsPublic: false });
    
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.poll.resultsPublic).toBe(false);

    const publicToken = createResponse.body.publicToken;
    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);

    expect(resultsResponse.status).toBe(403);
    expect(resultsResponse.body).toHaveProperty('resultsPrivate', true);
  });

  it('should allow accessing results for public polls', async () => {
    const pollData = createTestPoll({ resultsPublic: true });
    
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    const publicToken = createResponse.body.publicToken;
    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);

    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body).toHaveProperty('poll');
    expect(resultsResponse.body).toHaveProperty('stats');
  });
});
