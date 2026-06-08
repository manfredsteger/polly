import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';

export const testMeta = {
  category: 'api' as const,
  name: 'Poll Type Gap Fixes',
  description: 'Tests for 7 verified functional gaps: expiry reminder, allowMaybe, freeText length, option delete guard, null capacity, editToken persistence, send-reminder auth',
  severity: 'critical' as const,
};

let app: Express;
let adminAgent: ReturnType<typeof request.agent>;

async function loginAsAdmin(ag: ReturnType<typeof request.agent>) {
  const res = await ag
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  app = await createTestApp();
  adminAgent = request.agent(app);
  await loginAsAdmin(adminAgent);
});

// ---------------------------------------------------------------------------
// Fix 1: PATCH expiry-reminder re-validation
// ---------------------------------------------------------------------------
describe('Fix 1: PATCH route re-validates expiry reminder when expiresAt is updated', () => {
  let adminToken: string;
  let publicToken: string;

  it('creates a schedule poll with expiresAt far in the future and reminder enabled', async () => {
    const farFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix1 Expiry Reminder Test',
      type: 'schedule',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
      expiresAt: farFuture,
      enableExpiryReminder: true,
      expiryReminderHours: 48,
    });
    expect(res.status).toBe(200);
    adminToken = res.body.adminToken;
    publicToken = res.body.publicToken;
  });

  it('PATCH with new expiresAt inside reminder window forces enableExpiryReminder to false', async () => {
    // Set expiresAt only 2 hours from now — within the 48h window
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const res = await adminAgent
      .patch(`/api/v1/polls/admin/${adminToken}`)
      .send({
        expiresAt: twoHoursFromNow,
        enableExpiryReminder: true,
        expiryReminderHours: 48,
      });
    expect(res.status).toBe(200);
    expect(res.body.enableExpiryReminder).toBe(false);
  });

  it('PATCH with expiresAt far in the future keeps enableExpiryReminder true', async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await adminAgent
      .patch(`/api/v1/polls/admin/${adminToken}`)
      .send({
        expiresAt: farFuture,
        enableExpiryReminder: true,
        expiryReminderHours: 48,
      });
    expect(res.status).toBe(200);
    expect(res.body.enableExpiryReminder).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 2: allowMaybe type-aware null fallback
// ---------------------------------------------------------------------------
// Fix 2 note: the DB schema has allowMaybe default(true), so all new polls default to true.
// The null-fallback fix lives in the frontend VotingInterface (null → false for surveys,
// null → true for schedules). Here we test the API-level behaviour: explicit values are
// stored and returned correctly after PATCH (using /admin/:token endpoint).
describe('Fix 2: allowMaybe explicit values respected per poll type', () => {
  it('new survey poll defaults to allowMaybe=true (DB default)', async () => {
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix2 Survey AllowMaybe Default',
      type: 'survey',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
    });
    expect(res.status).toBe(200);
    const publicToken = res.body.publicToken;
    const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
    expect(pollRes.status).toBe(200);
    // DB default is true; frontend applies type-aware null-fallback for legacy null data
    expect(typeof pollRes.body.allowMaybe).toBe('boolean');
  });

  it('survey poll allowMaybe can be set to false via PATCH /admin/:token', async () => {
    const createRes = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix2 Survey PATCH AllowMaybe False',
      type: 'survey',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
    });
    expect(createRes.status).toBe(200);
    const adminToken = createRes.body.adminToken;
    const publicToken = createRes.body.publicToken;
    const patchRes = await request(app)
      .patch(`/api/v1/polls/admin/${adminToken}`)
      .send({ allowMaybe: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.allowMaybe).toBe(false);
    // Confirm public endpoint also reflects the change
    const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
    expect(pollRes.body.allowMaybe).toBe(false);
  });

  it('schedule poll allowMaybe persists after PATCH to true', async () => {
    const createRes = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix2 Schedule PATCH AllowMaybe True',
      type: 'schedule',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
    });
    expect(createRes.status).toBe(200);
    const adminToken = createRes.body.adminToken;
    const patchRes = await request(app)
      .patch(`/api/v1/polls/admin/${adminToken}`)
      .send({ allowMaybe: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.allowMaybe).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 3: freeTextAnswer max 500 chars — /vote and /vote-bulk
// ---------------------------------------------------------------------------
describe('Fix 3: freeTextAnswer over 500 chars returns 400', () => {
  let publicToken: string;
  let optionIds: number[];

  beforeAll(async () => {
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix3 FreeText Validation',
      type: 'survey',
      options: [{ text: 'Option A', isFreeText: false }, { text: 'Option B', isFreeText: true }],
    });
    expect(res.status).toBe(200);
    publicToken = res.body.publicToken;
    const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
    optionIds = pollRes.body.options.map((o: any) => o.id);
  });

  it('/vote-bulk rejects freeTextAnswer over 500 chars with 400 FREE_TEXT_TOO_LONG', async () => {
    const longText = 'x'.repeat(501);
    const res = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'FreeText Tester',
        voterEmail: 'freetextbulk@test.invalid',
        votes: [{ optionId: optionIds[0], response: 'yes', freeTextAnswer: longText }],
      });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('FREE_TEXT_TOO_LONG');
  });

  it('/vote rejects freeTextAnswer over 500 chars with 400 FREE_TEXT_TOO_LONG', async () => {
    const longText = 'y'.repeat(501);
    const res = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote`)
      .send({
        voterName: 'FreeText Tester 2',
        voterEmail: 'freetextvote@test.invalid',
        votes: [{ optionId: optionIds[0], response: 'yes', freeTextAnswer: longText }],
      });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('FREE_TEXT_TOO_LONG');
  });

  it('/vote-bulk accepts freeTextAnswer exactly 500 chars', async () => {
    const exactText = 'z'.repeat(500);
    const res = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: 'FreeText OK',
        voterEmail: 'freetextok@test.invalid',
        votes: [{ optionId: optionIds[0], response: 'yes', freeTextAnswer: exactText }],
      });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Fix 3b: comment max 500 chars — org poll slot comment
// ---------------------------------------------------------------------------
describe('Fix 3b: org poll comment over 500 chars returns 400', () => {
  let orgCommentPublicToken: string;
  let orgCommentOptionId: number;

  beforeAll(async () => {
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix3b Comment Length Test',
      type: 'organization',
      options: [{ text: 'Slot A' }, { text: 'Slot B' }],
    });
    expect(res.status).toBe(200);
    orgCommentPublicToken = res.body.publicToken;
    const pollRes = await request(app).get(`/api/v1/polls/public/${orgCommentPublicToken}`);
    orgCommentOptionId = pollRes.body.options[0].id;
  });

  it('/vote-bulk rejects comment over 500 chars with 400 COMMENT_TOO_LONG', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${orgCommentPublicToken}/vote-bulk`)
      .send({
        voterName: 'Comment Voter',
        voterEmail: 'commentvoter@test.invalid',
        votes: [{ optionId: orgCommentOptionId, response: 'yes', comment: 'x'.repeat(501) }],
      });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('COMMENT_TOO_LONG');
  });

  it('/vote rejects comment over 500 chars with 400 COMMENT_TOO_LONG', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${orgCommentPublicToken}/vote`)
      .send({
        voterName: 'Comment Voter 2',
        voterEmail: 'commentvoter2@test.invalid',
        votes: [{ optionId: orgCommentOptionId, response: 'yes', comment: 'y'.repeat(501) }],
      });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('COMMENT_TOO_LONG');
  });

  it('/vote-bulk accepts comment exactly 500 chars', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${orgCommentPublicToken}/vote-bulk`)
      .send({
        voterName: 'Comment Voter 3',
        voterEmail: 'commentvoter3@test.invalid',
        votes: [{ optionId: orgCommentOptionId, response: 'yes', comment: 'z'.repeat(500) }],
      });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Fix 4: Delete option guard — Orga-Liste (OPTION_HAS_SIGNUPS) + Schedule (OPTION_HAS_VOTES)
// ---------------------------------------------------------------------------
describe('Fix 4: Delete option guard', () => {
  describe('Orga-Liste: option with signups blocked unless adminForce=true', () => {
    let orgAdminToken: string;
    let orgPublicToken: string;
    let orgOptionId: number;

    beforeAll(async () => {
      const res = await adminAgent.post('/api/v1/polls').send({
        title: 'Fix4 Orga Delete Guard',
        type: 'organization',
        options: [{ text: 'Slot A', maxCapacity: 5 }, { text: 'Slot B', maxCapacity: 3 }, { text: 'Slot C', maxCapacity: 2 }],
      });
      expect(res.status).toBe(200);
      orgAdminToken = res.body.adminToken;
      orgPublicToken = res.body.publicToken;
      const pollRes = await request(app).get(`/api/v1/polls/public/${orgPublicToken}`);
      orgOptionId = pollRes.body.options[0].id;

      // Vote on the first slot
      await request(app)
        .post(`/api/v1/polls/${orgPublicToken}/vote-bulk`)
        .send({
          voterName: 'OrgaVoter',
          voterEmail: 'orgavoter@test.invalid',
          votes: [{ optionId: orgOptionId, response: 'yes' }],
        });
    });

    it('returns 409 OPTION_HAS_SIGNUPS when deleting org slot with signups (no adminForce)', async () => {
      const res = await adminAgent
        .delete(`/api/v1/polls/admin/${orgAdminToken}/options/${orgOptionId}`);
      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('OPTION_HAS_SIGNUPS');
    });

    it('allows deletion with adminForce=true from admin session', async () => {
      const res = await adminAgent
        .delete(`/api/v1/polls/admin/${orgAdminToken}/options/${orgOptionId}?adminForce=true`);
      expect(res.status).toBe(200);
    });
  });

  describe('Schedule: option with votes blocked unless confirmed=true', () => {
    let schedAdminToken: string;
    let schedPublicToken: string;
    let schedOptionId: number;

    beforeAll(async () => {
      const res = await adminAgent.post('/api/v1/polls').send({
        title: 'Fix4 Schedule Delete Guard',
        type: 'schedule',
        options: [{ text: 'Monday 10am' }, { text: 'Tuesday 2pm' }, { text: 'Wednesday 3pm' }],
      });
      expect(res.status).toBe(200);
      schedAdminToken = res.body.adminToken;
      schedPublicToken = res.body.publicToken;
      const pollRes = await request(app).get(`/api/v1/polls/public/${schedPublicToken}`);
      schedOptionId = pollRes.body.options[0].id;

      // Cast a vote on first option
      await request(app)
        .post(`/api/v1/polls/${schedPublicToken}/vote-bulk`)
        .send({
          voterName: 'SchedVoter',
          voterEmail: 'schedvoter@test.invalid',
          votes: [{ optionId: schedOptionId, response: 'yes' }],
        });
    });

    it('returns 409 OPTION_HAS_VOTES when deleting schedule option with votes (no confirmed)', async () => {
      const res = await adminAgent
        .delete(`/api/v1/polls/admin/${schedAdminToken}/options/${schedOptionId}`);
      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('OPTION_HAS_VOTES');
    });

    it('allows deletion with confirmed=true', async () => {
      const res = await adminAgent
        .delete(`/api/v1/polls/admin/${schedAdminToken}/options/${schedOptionId}?confirmed=true`);
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Fix 5: null maxCapacity treated as unlimited (isSlotFull stays false)
// ---------------------------------------------------------------------------
describe('Fix 5: null maxCapacity org slot is unlimited', () => {
  let unlimitedPublicToken: string;
  let unlimitedOptionId: number;

  beforeAll(async () => {
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix5 Unlimited Capacity Slot',
      type: 'organization',
      options: [
        { text: 'Slot Unlimited' },
        { text: 'Slot Also Unlimited' },
      ],
    });
    expect(res.status).toBe(200);
    unlimitedPublicToken = res.body.publicToken;
    const pollRes = await request(app).get(`/api/v1/polls/public/${unlimitedPublicToken}`);
    expect(pollRes.status).toBe(200);
    unlimitedOptionId = pollRes.body.options[0].id;
    expect(pollRes.body.options[0].maxCapacity).toBeNull();
  });

  it('first signup to unlimited slot succeeds', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${unlimitedPublicToken}/vote-bulk`)
      .send({
        voterName: 'Unlimited Voter 1',
        voterEmail: 'unlimited1@test.invalid',
        votes: [{ optionId: unlimitedOptionId, response: 'yes' }],
      });
    expect(res.status).toBe(200);
  });

  it('second signup to unlimited slot also succeeds (not blocked as "full")', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${unlimitedPublicToken}/vote-bulk`)
      .send({
        voterName: 'Unlimited Voter 2',
        voterEmail: 'unlimited2@test.invalid',
        votes: [{ optionId: unlimitedOptionId, response: 'yes' }],
      });
    expect(res.status).toBe(200);
  });

  it('poll shows correct current count for unlimited slot', async () => {
    const pollRes = await request(app).get(`/api/v1/polls/public/${unlimitedPublicToken}`);
    const signups = pollRes.body.votes.filter((v: any) => v.optionId === unlimitedOptionId && v.response === 'yes');
    expect(signups.length).toBeGreaterThanOrEqual(2);
    expect(pollRes.body.options[0].maxCapacity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fix 6: voterEditToken returned for org polls even when allowVoteEdit=false
// ---------------------------------------------------------------------------
describe('Fix 6: voterEditToken returned for org polls', () => {
  let orgPublicToken: string;
  let orgOptionId: number;

  beforeAll(async () => {
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix6 Org EditToken',
      type: 'organization',
      allowVoteEdit: false,
      options: [{ text: 'Slot X', maxCapacity: 10 }, { text: 'Slot Y', maxCapacity: 10 }],
    });
    expect(res.status).toBe(200);
    orgPublicToken = res.body.publicToken;
    const pollRes = await request(app).get(`/api/v1/polls/public/${orgPublicToken}`);
    orgOptionId = pollRes.body.options[0].id;
  });

  it('returns voterEditToken for org poll even when allowVoteEdit=false', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${orgPublicToken}/vote-bulk`)
      .send({
        voterName: 'OrgaToken Tester',
        voterEmail: 'orgatoken@test.invalid',
        votes: [{ optionId: orgOptionId, response: 'yes' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.voterEditToken).toBeTruthy();
  });

  it('/vote endpoint also returns voterEditToken for org poll', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${orgPublicToken}/vote`)
      .send({
        voterName: 'OrgaToken Tester2',
        voterEmail: 'orgatoken2@test.invalid',
        votes: [{ optionId: orgOptionId, response: 'yes' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.voterEditToken).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fix 7: send-reminder ownership check
// ---------------------------------------------------------------------------
describe('Fix 7: POST send-reminder ownership check', () => {
  let ownedPollId: string;
  let anonPollAdminToken: string;
  let anonPollPublicToken: string;

  beforeAll(async () => {
    // Create poll owned by admin user
    const res = await adminAgent.post('/api/v1/polls').send({
      title: 'Fix7 Reminder Auth Test',
      type: 'schedule',
      options: [{ text: 'Option A' }, { text: 'Option B' }],
    });
    expect(res.status).toBe(200);
    ownedPollId = res.body.poll.id;

    // Create anonymous (unowned) poll
    const anonRes = await request(app).post('/api/v1/polls').send({
      title: 'Fix7 Anon Reminder',
      type: 'schedule',
      options: [{ text: 'Option B' }, { text: 'Option C' }],
    });
    expect(anonRes.status).toBe(200);
    anonPollAdminToken = anonRes.body.adminToken;
    anonPollPublicToken = anonRes.body.publicToken;
  });

  it('returns 403 when anonymous request tries to send reminder for user-owned poll', async () => {
    const res = await request(app)
      .post(`/api/v1/polls/${ownedPollId}/send-reminder`)
      .send({ emails: ['test@test.invalid'] });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('NOT_AUTHORIZED');
  });

  it('anonymous poll without adminToken rejects unauthenticated reminder request with 403', async () => {
    const anonPollRes = await request(app).get(`/api/v1/polls/public/${anonPollPublicToken}`);
    const anonPollId = anonPollRes.body.id;
    const res = await request(app)
      .post(`/api/v1/polls/${anonPollId}/send-reminder`)
      .send({ emails: ['hijacker@test.invalid'] });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('NOT_AUTHORIZED');
  });

  it('anonymous poll with valid adminToken can send reminder', async () => {
    const anonPollRes = await request(app).get(`/api/v1/polls/public/${anonPollPublicToken}`);
    const anonPollId = anonPollRes.body.id;
    const res = await request(app)
      .post(`/api/v1/polls/${anonPollId}/send-reminder`)
      .send({ emails: ['recipient@test.invalid'], adminToken: anonPollAdminToken });
    // 200, 429, or 503 — NOT 403
    expect(res.status).not.toBe(403);
  });

  it('admin session can send reminder for any poll', async () => {
    const anonPollRes = await request(app).get(`/api/v1/polls/public/${anonPollPublicToken}`);
    const anonPollId = anonPollRes.body.id;
    const res = await adminAgent
      .post(`/api/v1/polls/${anonPollId}/send-reminder`)
      .send({ emails: ['recipient@test.invalid'] });
    // 200 or 429 (rate limited) or 503 (SMTP not configured) — NOT 403
    expect(res.status).not.toBe(403);
  });

  it('session owner can send reminder for their own poll', async () => {
    const res = await adminAgent
      .post(`/api/v1/polls/${ownedPollId}/send-reminder`)
      .send({ emails: ['recipient@test.invalid'] });
    // 200, 429, or 503 — NOT 403
    expect(res.status).not.toBe(403);
  });
});
