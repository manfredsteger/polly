import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Einfache Auswahl (Single-/Multiple-Choice)',
  description: 'Prüft Erstellung, Abstimmung und Bearbeitung im Simple-Antwortmodus',
  severity: 'critical' as const,
};

async function createSimplePoll(app: Express, overrides: Record<string, any> = {}) {
  const pollData = {
    ...createTestPoll({ type: 'survey' }),
    responseMode: 'simple',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/polls').send(pollData);
  return res;
}

async function getOptions(app: Express, publicToken: string) {
  const res = await request(app).get(`/api/v1/polls/public/${publicToken}`);
  return res.body.options.map((o: any) => o.id) as number[];
}

describe('Polls - Simple choice mode', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('creation', () => {
    it('creates a simple single-choice survey with default maxSelections=1', async () => {
      const res = await createSimplePoll(app);
      expect(res.status).toBe(200);
      const pub = await request(app).get(`/api/v1/polls/public/${res.body.publicToken}`);
      expect(pub.body.responseMode).toBe('simple');
      expect(pub.body.maxSelections).toBe(1);
    });

    it('creates a simple multiple-choice schedule poll', async () => {
      const res = await createSimplePoll(app, {
        ...createTestPoll({ type: 'schedule' }),
        responseMode: 'simple',
        maxSelections: 2,
      });
      expect(res.status).toBe(200);
      const pub = await request(app).get(`/api/v1/polls/public/${res.body.publicToken}`);
      expect(pub.body.responseMode).toBe('simple');
      expect(pub.body.maxSelections).toBe(2);
    });

    it('rejects simple mode for organization polls', async () => {
      const res = await createSimplePoll(app, {
        ...createTestPoll({ type: 'organization' }),
        responseMode: 'simple',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects simple mode combined with free-text options', async () => {
      const res = await createSimplePoll(app, {
        options: [
          { text: 'Option 1' },
          { text: 'Frage?', isFreeText: true },
        ],
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects maxSelections greater than number of options', async () => {
      const res = await createSimplePoll(app, { maxSelections: 10 });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('classic polls remain unaffected (default responseMode classic)', async () => {
      const res = await request(app).post('/api/v1/polls').send(createTestPoll({ type: 'survey' }));
      expect(res.status).toBe(200);
      const pub = await request(app).get(`/api/v1/polls/public/${res.body.publicToken}`);
      expect(pub.body.responseMode).toBe('classic');
      expect(pub.body.maxSelections).toBeNull();
    });
  });

  describe('voting', () => {
    let publicToken: string;
    let optionIds: number[];

    beforeAll(async () => {
      const res = await createSimplePoll(app); // single choice
      publicToken = res.body.publicToken;
      optionIds = await getOptions(app, publicToken);
    });

    it('accepts a single yes vote', async () => {
      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'Simple Voter',
          voterEmail: 'simple-voter@example.com',
          votes: [{ optionId: optionIds[0], response: 'yes' }],
        });
      expect(res.status).toBe(200);
    });

    it('rejects more selections than maxSelections (single choice)', async () => {
      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'Greedy Voter',
          voterEmail: 'greedy@example.com',
          votes: [
            { optionId: optionIds[0], response: 'yes' },
            { optionId: optionIds[1], response: 'yes' },
          ],
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain('TOO_MANY_SELECTIONS');
    });

    it('rejects non-yes responses in simple mode', async () => {
      for (const response of ['no', 'maybe']) {
        const res = await request(app)
          .post(`/api/v1/polls/${publicToken}/vote-bulk`)
          .send({
            voterName: 'Wrong Response',
            voterEmail: `wrong-${response}@example.com`,
            votes: [{ optionId: optionIds[0], response }],
          });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(JSON.stringify(res.body)).toContain('INVALID_SIMPLE_RESPONSE');
      }
    });

    it('rejects duplicate option selections', async () => {
      const multi = await createSimplePoll(app, { maxSelections: 2 });
      const ids = await getOptions(app, multi.body.publicToken);
      const res = await request(app)
        .post(`/api/v1/polls/${multi.body.publicToken}/vote-bulk`)
        .send({
          voterName: 'Dup Voter',
          voterEmail: 'dup@example.com',
          votes: [
            { optionId: ids[0], response: 'yes' },
            { optionId: ids[0], response: 'yes' },
          ],
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain('DUPLICATE_OPTION_SELECTION');
    });

    it('allows up to maxSelections in multiple choice mode', async () => {
      const multi = await createSimplePoll(app, { maxSelections: 2 });
      const ids = await getOptions(app, multi.body.publicToken);
      const res = await request(app)
        .post(`/api/v1/polls/${multi.body.publicToken}/vote-bulk`)
        .send({
          voterName: 'Multi Voter',
          voterEmail: 'multi@example.com',
          votes: [
            { optionId: ids[0], response: 'yes' },
            { optionId: ids[1], response: 'yes' },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('classic voting with maybe/no still works', async () => {
      const classic = await request(app).post('/api/v1/polls').send(createTestPoll({ type: 'survey' }));
      const ids = await getOptions(app, classic.body.publicToken);
      const res = await request(app)
        .post(`/api/v1/polls/${classic.body.publicToken}/vote-bulk`)
        .send({
          voterName: 'Classic Voter',
          voterEmail: 'classic@example.com',
          votes: [
            { optionId: ids[0], response: 'yes' },
            { optionId: ids[1], response: 'maybe' },
            { optionId: ids[2], response: 'no' },
          ],
        });
      expect(res.status).toBe(200);
    });
  });

  describe('vote editing (replacement semantics)', () => {
    it('replaces the selection when editing in simple mode', async () => {
      const poll = await createSimplePoll(app);
      const publicToken = poll.body.publicToken;
      const ids = await getOptions(app, publicToken);

      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'Edit Voter',
          voterEmail: 'edit-simple@example.com',
          votes: [{ optionId: ids[0], response: 'yes' }],
        });
      expect(voteRes.status).toBe(200);
      const editToken = voteRes.body.voterEditToken;
      expect(editToken).toBeTruthy();

      // GET edit view exposes simple-mode metadata
      const editView = await request(app).get(`/api/v1/votes/edit/${editToken}`);
      expect(editView.status).toBe(200);
      expect(editView.body.poll.responseMode).toBe('simple');
      expect(editView.body.poll.maxSelections).toBe(1);

      // switch selection to option 2
      const putRes = await request(app)
        .put(`/api/v1/votes/edit/${editToken}`)
        .send({ votes: [{ optionId: ids[1], response: 'yes' }] });
      expect(putRes.status).toBe(200);

      const after = await request(app).get(`/api/v1/votes/edit/${editToken}`);
      const yesVotes = after.body.votes.filter((v: any) => v.response === 'yes');
      expect(yesVotes).toHaveLength(1);
      expect(yesVotes[0].optionId).toBe(ids[1]);
    });

    it('rejects edits exceeding maxSelections', async () => {
      const poll = await createSimplePoll(app);
      const publicToken = poll.body.publicToken;
      const ids = await getOptions(app, publicToken);

      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send({
          voterName: 'Limit Editor',
          voterEmail: 'limit-editor@example.com',
          votes: [{ optionId: ids[0], response: 'yes' }],
        });
      const editToken = voteRes.body.voterEditToken;

      const putRes = await request(app)
        .put(`/api/v1/votes/edit/${editToken}`)
        .send({
          votes: [
            { optionId: ids[0], response: 'yes' },
            { optionId: ids[1], response: 'yes' },
          ],
        });
      expect(putRes.status).toBeGreaterThanOrEqual(400);
    });
  });
});

describe('Polls - Simple choice concurrency', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('parallel edit-token replacements never exceed maxSelections', async () => {
    const poll = await createSimplePoll(app); // maxSelections = 1
    const publicToken = poll.body.publicToken;
    const ids = await getOptions(app, publicToken);

    const voteRes = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'Race Voter',
        voterEmail: 'race@example.com',
        votes: [{ optionId: ids[0], response: 'yes' }],
      });
    const editToken = voteRes.body.voterEditToken;

    // Fire two concurrent replacements selecting different options
    await Promise.all([
      request(app).put(`/api/v1/votes/edit/${editToken}`).send({ votes: [{ optionId: ids[1], response: 'yes' }] }),
      request(app).put(`/api/v1/votes/edit/${editToken}`).send({ votes: [{ optionId: ids[2], response: 'yes' }] }),
    ]);

    const after = await request(app).get(`/api/v1/votes/edit/${editToken}`);
    const yesVotes = after.body.votes.filter((v: any) => v.response === 'yes');
    expect(yesVotes.length).toBeLessThanOrEqual(1);
  });

  it('parallel first-time submissions with the same email never exceed maxSelections', async () => {
    const poll = await createSimplePoll(app); // maxSelections = 1
    const publicToken = poll.body.publicToken;
    const ids = await getOptions(app, publicToken);

    const [r1, r2] = await Promise.all([
      request(app).post(`/api/v1/polls/${publicToken}/vote-bulk`).send({
        voterName: 'Race Voter 2',
        voterEmail: 'race2@example.com',
        votes: [{ optionId: ids[0], response: 'yes' }],
      }),
      request(app).post(`/api/v1/polls/${publicToken}/vote-bulk`).send({
        voterName: 'Race Voter 2',
        voterEmail: 'race2@example.com',
        votes: [{ optionId: ids[1], response: 'yes' }],
      }),
    ]);

    const editToken = r1.body.voterEditToken || r2.body.voterEditToken;
    const after = await request(app).get(`/api/v1/votes/edit/${editToken}`);
    const yesVotes = after.body.votes.filter((v: any) => v.response === 'yes');
    expect(yesVotes.length).toBeLessThanOrEqual(1);
  });
});
