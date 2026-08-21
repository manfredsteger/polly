import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
import { tokenService } from '../../services/tokenService';
import { generateTotpForTest } from '../../lib/totpService';

let app: Express;
let adminAgent: ReturnType<typeof request.agent>;

const DEFAULT_GUEST_ACCESS = { allowGuestPollCreation: true, allowGuestVoting: true };

async function setGuestAccess(settings: { allowGuestPollCreation: boolean; allowGuestVoting: boolean }) {
  const res = await adminAgent
    .put('/api/v1/admin/customization')
    .send({ guestAccess: settings });
  expect(res.status).toBe(200);
}

function schedulePollPayload(title: string) {
  return {
    title,
    type: 'schedule' as const,
    options: [{ text: 'Montag 10 Uhr' }, { text: 'Dienstag 14 Uhr' }],
  };
}

async function registerVerifiedUser(prefix: string) {
  const agent = request.agent(app);
  const username = `${prefix}_${Date.now()}`;
  const regRes = await agent
    .post('/api/v1/auth/register')
    .set('x-test-meta', JSON.stringify({ isTestData: true }))
    .send({
      username,
      email: `${username}@test.example`,
      name: 'Guest Access Tester',
      password: 'TestPass123!',
    });
  expect(regRes.status).toBeGreaterThanOrEqual(200);
  expect(regRes.status).toBeLessThan(300);
  const userId: number = regRes.body.user.id;
  // Mark email verified so requireEmailVerified does not interfere
  await storage.updateUser(userId, { emailVerified: true } as any);
  return { agent, userId, username, email: `${username}@test.example`, password: 'TestPass123!' };
}

describe('Guest access control', () => {
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Always reset to defaults so other tests are unaffected
    await setGuestAccess(DEFAULT_GUEST_ACCESS);
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      try { await storage.deleteUser(id); } catch { /* ignore */ }
    }
  });

  // ─── Section A: allowGuestPollCreation = false ────────────────────────────
  describe('poll creation', () => {
    it('1. blocks anonymous poll creation with 403 GUEST_POLL_CREATION_DISABLED', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });
      const res = await request(app)
        .post('/api/v1/polls')
        .send(schedulePollPayload('Guest blocked poll'));
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('GUEST_POLL_CREATION_DISABLED');
    });

    it('2. allows a logged-in local user to create a poll', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });
      const { agent, userId } = await registerVerifiedUser('ga_local');
      createdUserIds.push(userId);
      const res = await agent.post('/api/v1/polls').send(schedulePollPayload('Local user poll'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('publicToken');
    });

    it('3. allows a user with an established session (OIDC-equivalent) to create a poll', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });
      // OIDC callback sets req.session.userId exactly like local login,
      // so a session-authenticated user is representative of an OIDC user.
      const { agent, userId } = await registerVerifiedUser('ga_oidc');
      createdUserIds.push(userId);
      const res = await agent.post('/api/v1/polls').send(schedulePollPayload('OIDC user poll'));
      expect(res.status).toBe(200);
    });

    it('4. allows a bearer-token-authenticated user to create a poll (bearer fix)', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });
      const { userId } = await registerVerifiedUser('ga_bearer');
      createdUserIds.push(userId);
      const user = await storage.getUser(userId);
      vi.spyOn(tokenService, 'validateToken').mockResolvedValue({
        valid: true,
        userId,
        user,
      } as any);
      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', 'Bearer test-bearer-token')
        .send(schedulePollPayload('Bearer user poll'));
      expect(res.status).toBe(200);
    });

    it('5. allows anonymous poll creation when the setting is enabled (regression)', async () => {
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: true });
      const res = await request(app)
        .post('/api/v1/polls')
        .send(schedulePollPayload('Guest allowed poll'));
      expect(res.status).toBe(200);
    });

    it('blocks anonymous AI poll apply with 403 GUEST_POLL_CREATION_DISABLED', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });
      const res = await request(app)
        .post('/api/v1/ai/apply')
        .send({
          suggestion: {
            pollType: 'survey',
            title: 'AI Guest Poll',
            options: ['A', 'B'],
          },
          settings: {},
        });
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('GUEST_POLL_CREATION_DISABLED');
    });
  });

  // ─── Section B: allowGuestVoting = false ──────────────────────────────────
  describe('voting', () => {
    let publicToken: string;
    let optionId: string;

    beforeAll(async () => {
      const res = await adminAgent
        .post('/api/v1/polls')
        .send({
          ...schedulePollPayload('Guest voting test poll'),
          allowVoteEdit: true,
          allowVoteWithdrawal: true,
        });
      expect(res.status).toBe(200);
      publicToken = res.body.publicToken;
      optionId = res.body.poll.options[0].id;
    });

    function votePayload(email: string) {
      return {
        voterName: 'Guest Tester',
        voterEmail: email,
        votes: [{ optionId, response: 'yes' }],
      };
    }

    it('6. blocks anonymous voting with 403 GUEST_VOTING_DISABLED', async () => {
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: false });
      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send(votePayload('anon_voter@test.example'));
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('GUEST_VOTING_DISABLED');
    });

    it('also blocks anonymous bulk voting with 403 GUEST_VOTING_DISABLED', async () => {
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: false });
      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote-bulk`)
        .send(votePayload('anon_bulk_voter@test.example'));
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('GUEST_VOTING_DISABLED');
    });

    it('blocks guest vote edits and withdrawals via edit token or public token', async () => {
      // Cast a guest vote first (guest voting enabled)
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: true });
      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send(votePayload('edit_token_guest@test.example'));
      expect(voteRes.status).toBe(200);
      const editToken = voteRes.body.editToken || voteRes.body.voterEditToken;

      // Now disable guest voting: existing edit tokens must no longer mutate votes
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: false });

      if (editToken) {
        const editRes = await request(app)
          .put(`/api/v1/votes/edit/${editToken}`)
          .send({ votes: [{ optionId, response: 'no' }] });
        expect(editRes.status).toBe(403);
        expect(editRes.body.errorCode).toBe('GUEST_VOTING_DISABLED');

        const delRes = await request(app).delete(`/api/v1/votes/edit/${editToken}`);
        expect(delRes.status).toBe(403);
        expect(delRes.body.errorCode).toBe('GUEST_VOTING_DISABLED');
      }

      const withdrawRes = await request(app)
        .delete(`/api/v1/polls/${publicToken}/vote`)
        .send({ voterEmail: 'edit_token_guest@test.example', voterEditToken: editToken });
      expect(withdrawRes.status).toBe(403);
      expect(withdrawRes.body.errorCode).toBe('GUEST_VOTING_DISABLED');
    });

    it('7. allows a logged-in user to vote', async () => {
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: false });
      const { agent, userId, email } = await registerVerifiedUser('ga_voter');
      createdUserIds.push(userId);
      const res = await agent
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send(votePayload(email));
      expect(res.status).toBe(200);
    });

    it('8. allows anonymous voting when the setting is enabled (regression)', async () => {
      await setGuestAccess({ allowGuestPollCreation: true, allowGuestVoting: true });
      const res = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .send(votePayload('anon_voter_ok@test.example'));
      expect(res.status).toBe(200);
    });

    // ─── Section D: public links always readable ────────────────────────────
    it('11. keeps public poll links readable even when guest voting is disabled', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: false });
      const res = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── Section C: OIDC / pending MFA edge cases ─────────────────────────────
  describe('pending MFA state', () => {
    it('9./10. treats a pending-MFA session as guest; full session passes', async () => {
      await setGuestAccess({ allowGuestPollCreation: false, allowGuestVoting: true });

      // Register user, enable MFA
      const { agent, userId, username, password } = await registerVerifiedUser('ga_mfa');
      createdUserIds.push(userId);
      const initRes = await agent.post('/api/v1/auth/mfa/setup-init');
      expect(initRes.status).toBe(200);
      const totpSecret = initRes.body.secret;
      const confirmRes = await agent
        .post('/api/v1/auth/mfa/setup-confirm')
        .send({ token: generateTotpForTest(totpSecret) });
      expect(confirmRes.status).toBe(200);

      // Fresh agent: login sets pendingMfaUserId but no userId yet
      const pendingAgent = request.agent(app);
      const loginRes = await pendingAgent
        .post('/api/v1/auth/login')
        .send({ usernameOrEmail: username, password });
      expect(loginRes.body.mfaRequired ?? loginRes.body.requiresMfa ?? true).toBeTruthy();

      // 9. pending-MFA session is a guest → blocked
      const blocked = await pendingAgent
        .post('/api/v1/polls')
        .send(schedulePollPayload('Pending MFA poll'));
      expect(blocked.status).toBe(403);
      expect(blocked.body.errorCode).toBe('GUEST_POLL_CREATION_DISABLED');

      // Complete MFA challenge → full session
      const validateRes = await pendingAgent
        .post('/api/v1/auth/mfa/validate')
        .send({ token: generateTotpForTest(totpSecret) });
      expect(validateRes.status).toBe(200);

      // 10. completed session passes
      const allowed = await pendingAgent
        .post('/api/v1/polls')
        .send(schedulePollPayload('Completed MFA poll'));
      expect(allowed.status).toBe(200);
    });
  });

  // ─── Section E: defaults unchanged with empty configuration ───────────────
  describe('default behavior (no explicit configuration)', () => {
    it('12./13. anonymous creation and voting work when no setting is stored', async () => {
      // Remove the stored key entirely to simulate a fresh installation
      await (storage as any).deleteSetting?.('customization_guest_access');
      const settings = await storage.getCustomizationSettings();
      expect(settings.guestAccess.allowGuestPollCreation).toBe(true);
      expect(settings.guestAccess.allowGuestVoting).toBe(true);

      const createRes = await request(app)
        .post('/api/v1/polls')
        .send(schedulePollPayload('Default behavior poll'));
      expect(createRes.status).toBe(200);

      const voteRes = await request(app)
        .post(`/api/v1/polls/${createRes.body.publicToken}/vote`)
        .send({
          voterName: 'Default Tester',
          voterEmail: 'default_voter@test.example',
          votes: [{ optionId: createRes.body.poll.options[0].id, response: 'yes' }],
        });
      expect(voteRes.status).toBe(200);
    });
  });
});
