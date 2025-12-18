import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'api' as const,
  name: 'Eingabe-Validierung',
  description: 'Prüft Validierung von Eingabedaten und Fehlermeldungen',
  severity: 'high' as const,
};

describe('API - Input Validation', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should accept poll creation with special characters in title', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Test Poll with Ümlauts & Special chars',
        type: 'survey',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('publicToken');
  });

  it('should reject poll with title exceeding 200 chars', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'A'.repeat(201),
        type: 'survey',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject poll with empty title', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: '',
        type: 'survey',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject poll with invalid type', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Test Poll',
        type: 'invalid-type',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject poll with empty options array', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Test Poll',
        type: 'survey',
        options: [],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should handle special characters in voter name', async () => {
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Test Poll',
        type: 'survey',
        options: [{ text: 'Option 1' }],
      });

    const publicToken = createResponse.body.publicToken;
    
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    const optionId = pollResponse.body.options[0].id;

    const response = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: "Müller-Schmidt",
        voterEmail: "mueller@example.com",
        votes: [{ optionId, response: 'yes' }],
      });

    expect(response.status).toBe(200);
  });

  it('should accept valid poll types: schedule', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Schedule Poll',
        type: 'schedule',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBe(200);
    expect(response.body.poll.type).toBe('schedule');
  });

  it('should accept valid poll types: organization', async () => {
    const response = await request(app)
      .post('/api/v1/polls')
      .send({
        title: 'Orga Poll',
        type: 'organization',
        options: [{ text: 'Option 1' }],
      });

    expect(response.status).toBe(200);
    expect(response.body.poll.type).toBe('organization');
  });
});
