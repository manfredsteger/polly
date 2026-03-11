import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

let app: Express;
let agent: ReturnType<typeof request.agent>;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'manfredsteger';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test';

async function loginAsAdmin(ag: ReturnType<typeof request.agent>) {
  await ag
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
}

describe('Poll CRUD Routes', () => {
  let adminToken: string;
  let publicToken: string;
  let pollId: string;

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await loginAsAdmin(agent);
  });

  describe('POST /api/v1/polls', () => {
    it('should create a schedule poll', async () => {
      const res = await agent.post('/api/v1/polls').send({
        title: 'Test Schedule Poll Routes',
        type: 'schedule',
        allowVoteEdit: true,
        options: [
          { text: 'Montag 10 Uhr' },
          { text: 'Dienstag 14 Uhr' },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('adminToken');
      expect(res.body).toHaveProperty('publicToken');
      expect(res.body).toHaveProperty('poll');
      expect(res.body.poll.title).toBe('Test Schedule Poll Routes');
      expect(res.body.poll.type).toBe('schedule');
      adminToken = res.body.adminToken;
      publicToken = res.body.publicToken;
      pollId = res.body.poll.id;
    });

    it('should create a survey poll', async () => {
      const res = await agent.post('/api/v1/polls').send({
        title: 'Test Survey Poll Routes',
        type: 'survey',
        options: [
          { text: 'Option A' },
          { text: 'Option B' },
          { text: 'Option C' },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.poll.type).toBe('survey');
    });

    it('should create an organization poll', async () => {
      const res = await agent.post('/api/v1/polls').send({
        title: 'Test Orga Poll Routes',
        type: 'organization',
        options: [
          { text: 'Slot 1', maxCapacity: 5 },
          { text: 'Slot 2', maxCapacity: 3 },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.poll.type).toBe('organization');
    });

    it('should reject poll without title', async () => {
      const res = await agent.post('/api/v1/polls').send({
        type: 'schedule',
        options: [{ text: 'Option' }],
      });
      expect(res.status).toBe(400);
    });

    it('should reject poll without type', async () => {
      const res = await agent.post('/api/v1/polls').send({
        title: 'No Type Poll',
        options: [{ text: 'Option' }],
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/polls/public/:token', () => {
    it('should get poll by public token', async () => {
      const res = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test Schedule Poll Routes');
      expect(res.body.options).toHaveLength(2);
      expect(res.body).not.toHaveProperty('adminToken');
    });

    it('should return 404 for invalid public token', async () => {
      const res = await request(app).get('/api/v1/polls/public/nonexistent_token_xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/polls/admin/:token', () => {
    it('should get poll by admin token', async () => {
      const res = await agent.get(`/api/v1/polls/admin/${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test Schedule Poll Routes');
      expect(res.body).toHaveProperty('adminToken');
    });

    it('should return 404 for invalid admin token', async () => {
      const res = await agent.get('/api/v1/polls/admin/nonexistent_admin_token');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/polls/admin/:token', () => {
    it('should update poll title', async () => {
      const res = await agent
        .patch(`/api/v1/polls/admin/${adminToken}`)
        .send({ title: 'Updated Schedule Poll' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Schedule Poll');
    });

    it('should update poll settings', async () => {
      const res = await agent
        .patch(`/api/v1/polls/admin/${adminToken}`)
        .send({ allowMaybe: false, resultsPublic: false });
      expect(res.status).toBe(200);
    });

    it('should return 404 for invalid admin token on update', async () => {
      const res = await agent
        .patch('/api/v1/polls/admin/invalid_token_xyz')
        .send({ title: 'Should Fail' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/polls/admin/:token/options', () => {
    it('should add an option to the poll', async () => {
      const res = await agent
        .post(`/api/v1/polls/admin/${adminToken}/options`)
        .send({ text: 'Mittwoch 16 Uhr' });
      expect([200, 201]).toContain(res.status);
      expect(res.body.text).toBe('Mittwoch 16 Uhr');
    });
  });

  describe('Voting flow', () => {
    it('should vote on a poll via public token', async () => {
      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      const optionId = pollRes.body.options[0].id;

      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'Test Voter Routes',
          voterEmail: 'test-voter-routes@example.com',
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('voterEditToken');
    });

    it('should get votes by edit token', async () => {
      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      const optionId = pollRes.body.options[1].id;

      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'Edit Token Voter',
          voterEmail: 'edit-voter-routes@example.com',
        });

      expect(voteRes.status).toBe(200);
      const editToken = voteRes.body.voterEditToken;
      expect(editToken).toBeTruthy();

      const getRes = await request(app).get(`/api/v1/votes/edit/${editToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty('poll');
      expect(getRes.body).toHaveProperty('votes');
      expect(Array.isArray(getRes.body.votes)).toBe(true);
      expect(getRes.body.voterName).toBe('Edit Token Voter');
    });

    it('should return 404 for invalid edit token', async () => {
      const res = await request(app).get('/api/v1/votes/edit/invalid_edit_token_xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('Export routes', () => {
    it('should generate QR code for poll', async () => {
      const res = await request(app).get(`/api/v1/polls/${publicToken}/qr`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('qrCode');
      expect(res.body).toHaveProperty('pollUrl');
    });

    it('should export poll as CSV via admin token', async () => {
      const res = await request(app).get(`/api/v1/polls/${adminToken}/export/csv`);
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/polls/admin/:token', () => {
    it('should delete poll by admin token', async () => {
      const res = await agent.delete(`/api/v1/polls/admin/${adminToken}`);
      expect(res.status).toBe(200);

      const checkRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('should return 404 when deleting non-existent poll', async () => {
      const res = await agent.delete('/api/v1/polls/admin/nonexistent_delete_token');
      expect(res.status).toBe(404);
    });
  });
});
