import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Poll-CRUD-Operationen',
  description: 'Prüft Erstellen, Lesen, Aktualisieren und Löschen von Umfragen',
  severity: 'high' as const,
};

describe('Polls - CRUD', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should create a new poll', async () => {
    const pollData = createTestPoll({ type: 'survey' });
    
    const response = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('publicToken');
    expect(response.body).toHaveProperty('adminToken');
    expect(response.body.poll.title).toBe(pollData.title);
  });

  it('should return 400 for poll without title', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        type: 'survey',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBe(400);
  });

  it('should return 400 for poll without options', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Test Poll',
        type: 'survey',
        options: [],
      });

    expect(response.status).toBe(400);
  });

  it('should fetch poll by public token', async () => {
    const pollData = createTestPoll();
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    const publicToken = createResponse.body.publicToken;
    
    const response = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);

    expect(response.status).toBe(200);
    expect(response.body.title).toBe(pollData.title);
  });

  it('should return 404 for non-existent poll', async () => {
    const response = await request(app)
      .get('/api/v1/polls/public/nonexistent-token');

    expect(response.status).toBe(404);
  });

  it('should get poll results', async () => {
    const pollData = createTestPoll({ resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    const publicToken = createResponse.body.publicToken;
    
    const response = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('poll');
    expect(response.body).toHaveProperty('stats');
  });
});
