import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';
import { nanoid } from 'nanoid';

export const testMeta = {
  category: 'polls' as const,
  name: 'E2E: Umfrage-Workflow',
  description: 'Prüft den kompletten Workflow: Erstellen → Abstimmen → Ergebnisse',
  severity: 'critical' as const,
};

describe('E2E - Complete Poll Flow', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should complete full survey poll workflow with edit token', async () => {
    const pollData = { ...createTestPoll({ type: 'survey', resultsPublic: true }), allowVoteEdit: true };
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
    const optionId = fetchResponse.body.options[0].id;

    const voterEmail = `voter-${nanoid(6)}@example.com`;
    const voteResponse = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'Test Voter',
        voterEmail,
        votes: [{ optionId, response: 'yes' }],
      });
    expect(voteResponse.status).toBe(200);
    expect(voteResponse.body.success).toBe(true);
    expect(voteResponse.body.voterEditToken).toBeDefined();
    expect(typeof voteResponse.body.voterEditToken).toBe('string');

    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);
    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body.poll).toBeDefined();
    expect(resultsResponse.body.stats).toBeDefined();

    const adminResponse = await request(app)
      .get(`/api/v1/polls/admin/${adminToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.title).toBe(pollData.title);
  });

  it('should complete full schedule poll workflow', async () => {
    const pollData = createTestPoll({ type: 'schedule', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(createResponse.status).toBe(200);
    const { publicToken } = createResponse.body;

    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    const optionIds = fetchResponse.body.options.map((o: any) => o.id);

    const voterEmail = `voter-${nanoid(6)}@example.com`;
    const voteResponse = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'Schedule Voter',
        voterEmail,
        votes: [
          { optionId: optionIds[0], response: 'yes' },
          { optionId: optionIds[1], response: 'maybe' },
          { optionId: optionIds[2], response: 'no' },
        ],
      });
    expect(voteResponse.status).toBe(200);

    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);
    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body.stats).toBeDefined();
  });

  it('should complete full organization poll workflow', async () => {
    const pollData = createTestPoll({ type: 'organization', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    expect(createResponse.status).toBe(200);
    const { publicToken } = createResponse.body;

    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    const optionId = fetchResponse.body.options[0].id;

    const voterEmail = `voter-${nanoid(6)}@example.com`;
    const voteResponse = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'Orga Voter',
        voterEmail,
        votes: [{ optionId, response: 'yes' }],
      });
    expect(voteResponse.status).toBe(200);
  });

  it('should generate QR code for poll', async () => {
    const pollData = createTestPoll();
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);
    const { publicToken } = createResponse.body;

    const qrResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/qr`);

    expect(qrResponse.status).toBe(200);
    expect(qrResponse.body.qrCode).toBeDefined();
    expect(qrResponse.body.qrCode).toContain('data:image');
    expect(qrResponse.body.pollUrl).toContain(publicToken);
  });

  it('should export poll results as CSV', async () => {
    const pollData = createTestPoll({ resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);
    const { publicToken } = createResponse.body;

    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    const optionId = fetchResponse.body.options[0].id;

    const voterEmail = `csv-${nanoid(6)}@example.com`;
    await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'CSV Test Voter',
        voterEmail,
        votes: [{ optionId, response: 'yes' }],
      });

    const csvResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/export/csv`);

    expect(csvResponse.status).toBe(200);
    expect(csvResponse.headers['content-type']).toContain('text/csv');
  });
});
