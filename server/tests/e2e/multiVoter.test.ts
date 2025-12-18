import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';
import { nanoid } from 'nanoid';

export const testMeta = {
  category: 'polls' as const,
  name: 'E2E: Mehrfach-Abstimmung',
  description: 'Prüft Szenarien mit mehreren Abstimmenden auf derselben Umfrage',
  severity: 'high' as const,
};

describe('E2E - Multiple Voters', () => {
  let app: Express;
  let publicToken: string;
  let optionIds: number[];

  beforeAll(async () => {
    app = await createTestApp();

    const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    publicToken = createResponse.body.publicToken;
    
    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    optionIds = fetchResponse.body.options.map((o: any) => o.id);
  });

  it('should allow multiple different voters to vote', async () => {
    const voters = [
      { name: `Voter A ${nanoid(4)}`, email: `a-${nanoid(4)}@example.com`, response: 'yes' as const },
      { name: `Voter B ${nanoid(4)}`, email: `b-${nanoid(4)}@example.com`, response: 'no' as const },
      { name: `Voter C ${nanoid(4)}`, email: `c-${nanoid(4)}@example.com`, response: 'maybe' as const },
    ];

    for (const voter of voters) {
      const response = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: voter.name,
          voterEmail: voter.email,
          votes: [{ optionId: optionIds[0], response: voter.response }],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);

    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body.stats).toBeDefined();
  });

  it('should track all votes in results', async () => {
    const newPollData = createTestPoll({ resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(newPollData);
    const newPublicToken = createResponse.body.publicToken;
    
    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${newPublicToken}`);
    const newOptionId = fetchResponse.body.options[0].id;

    const voters = [
      { name: `V1 ${nanoid(4)}`, email: `v1-${nanoid(4)}@example.com`, response: 'yes' as const },
      { name: `V2 ${nanoid(4)}`, email: `v2-${nanoid(4)}@example.com`, response: 'yes' as const },
      { name: `V3 ${nanoid(4)}`, email: `v3-${nanoid(4)}@example.com`, response: 'no' as const },
    ];

    for (const voter of voters) {
      await request(app)
        .post(`/api/v1/polls/${newPublicToken}/vote-bulk`)
        .send({
          voterName: voter.name,
          voterEmail: voter.email,
          votes: [{ optionId: newOptionId, response: voter.response }],
        });
    }

    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${newPublicToken}/results`);

    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body.poll).toBeDefined();
    expect(resultsResponse.body.stats).toBeDefined();
  });

  it('should handle bulk voting with multiple options', async () => {
    const newPollData = createTestPoll({ type: 'schedule', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(newPollData);
    const newPublicToken = createResponse.body.publicToken;
    
    const fetchResponse = await request(app)
      .get(`/api/v1/polls/public/${newPublicToken}`);
    const newOptionIds = fetchResponse.body.options.map((o: any) => o.id);

    const bulkVoteResponse = await request(app)
      .post(`/api/v1/polls/${newPublicToken}/vote-bulk`)
      .send({
        voterName: `Bulk Voter ${nanoid(4)}`,
        voterEmail: `bulk-${nanoid(6)}@example.com`,
        votes: newOptionIds.map((optionId: number, index: number) => ({
          optionId,
          response: index === 0 ? 'yes' : index === 1 ? 'maybe' : 'no',
        })),
      });

    expect(bulkVoteResponse.status).toBe(200);
  });
});
