/**
 * Regression tests for two bugs reported in the vote email flow:
 *
 * Bug 1 – Edit link in vote confirmation email (allowVoteEdit=false):
 *   storage.createVote() always assigns a voterEditToken (for internal
 *   tracking), but votes.ts was building the email editLink directly from
 *   that token without checking poll.allowVoteEdit.  The fix must guard
 *   the editLink exactly like the API response already does:
 *     (poll.allowVoteEdit || poll.type === 'organization') ? token : null
 *
 *   Because createTestApp() sets req.isTestMode=true globally (all vote
 *   routes skip email when isTestMode is true), the email path cannot be
 *   reached through the HTTP API in unit tests.  We therefore test it on
 *   two independent levels:
 *     a) API response proxy  – voterEditToken must be null in the JSON
 *        response when allowVoteEdit=false.  If the email fix mirrors this
 *        guard, it is provably correct.
 *     b) Email service level – call sendVotingConfirmationEmail() directly
 *        (no isTestMode gate), spy on sendMail, and assert the rendered
 *        HTML contains / does not contain the edit link.
 *
 * Bug 2 – Duplicate email vote on non-editable poll:
 *   POST /polls/:token/vote returns HTTP 400 with errorCode ALREADY_VOTED
 *   when the same e-mail address tries to vote again on a non-editable
 *   poll.  This error exists server-side but the frontend showed no inline
 *   warning before the colleague's fix.  The server-side contract is
 *   documented here so it can never silently regress.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { emailService } from '../../services/emailService';

export const testMeta = {
  category: 'api' as const,
  name: 'Vote E-Mail Regression',
  description:
    'Bestätigungs-E-Mail darf keinen Edit-Link enthalten wenn allowVoteEdit=false; ' +
    'Duplikat-Vote per E-Mail auf nicht-editierbarer Umfrage muss mit ALREADY_VOTED abgelehnt werden',
  severity: 'critical' as const,
};

let app: Express;
let agent: ReturnType<typeof request.agent>;

async function loginAsAdmin(ag: ReturnType<typeof request.agent>) {
  await ag
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
}

async function createSurveyPoll(
  ag: ReturnType<typeof request.agent>,
  allowVoteEdit: boolean,
): Promise<{ adminToken: string; publicToken: string; poll: { id: string } }> {
  const res = await ag.post('/api/v1/polls').send({
    title: `Regression Survey (allowVoteEdit=${allowVoteEdit})`,
    type: 'survey',
    allowVoteEdit,
    options: [{ text: 'Option A' }, { text: 'Option B' }],
  });
  expect(res.status).toBe(200);
  return res.body;
}

describe('Vote E-Mail Regression', () => {
  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await loginAsAdmin(agent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Bug 1a: API response proxy for the edit-link guard ──────────────────
  //
  // createTestApp sets req.isTestMode=true, so the email-sending branch in
  // votes.ts is never reached via HTTP.  We test the response field
  // voterEditToken instead — the same guard that (after the fix) must also
  // control the email editLink.

  describe('Bug 1 – voterEditToken in API response (proxy for email edit link)', () => {
    it('voterEditToken is null in response when allowVoteEdit=false', async () => {
      const { publicToken, adminToken } = await createSurveyPoll(agent, false);

      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(pollRes.status).toBe(200);
      const optionId: number = pollRes.body.options[0].id;

      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'Regression Voter',
          voterEmail: 'no-edit-token@regression.test',
        });

      expect(voteRes.status).toBe(200);
      expect(voteRes.body.voterEditToken).toBeNull();

      await agent.delete(`/api/v1/polls/admin/${adminToken}`);
    });

    it('voterEditToken is truthy in response when allowVoteEdit=true', async () => {
      const { publicToken, adminToken } = await createSurveyPoll(agent, true);

      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(pollRes.status).toBe(200);
      const optionId: number = pollRes.body.options[0].id;

      const voteRes = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'Editable Voter',
          voterEmail: 'with-edit-token@regression.test',
        });

      expect(voteRes.status).toBe(200);
      expect(voteRes.body.voterEditToken).toBeTruthy();
      expect(typeof voteRes.body.voterEditToken).toBe('string');

      await agent.delete(`/api/v1/polls/admin/${adminToken}`);
    });
  });

  // ─── Bug 1b: Email service level – rendered HTML contains/omits edit link ─
  //
  // We call sendVotingConfirmationEmail() directly (bypassing the API and its
  // isTestMode guard) and spy on sendMail to capture the rendered HTML.

  describe('Bug 1 – sendVotingConfirmationEmail renders edit link only when provided', () => {
    it('rendered HTML does NOT contain an /edit/ URL when editLink is undefined', async () => {
      const capturedHtml: string[] = [];
      vi.spyOn(emailService, 'sendMail').mockImplementation(async (opts) => {
        capturedHtml.push(opts.html);
      });

      await emailService.sendVotingConfirmationEmail(
        'voter@regression.test',
        'Regression Voter',
        'Test Poll (no edit)',
        'survey',
        'https://test.example.com/poll/abc',
        'https://test.example.com/poll/abc#results',
        ['Option A'],
        undefined,
      );

      expect(capturedHtml).toHaveLength(1);
      expect(capturedHtml[0]).not.toMatch(/\/edit\//);
    });

    it('rendered HTML CONTAINS the /edit/ URL when editLink is provided', async () => {
      const capturedHtml: string[] = [];
      vi.spyOn(emailService, 'sendMail').mockImplementation(async (opts) => {
        capturedHtml.push(opts.html);
      });

      const editLink = 'https://test.example.com/edit/abc123token';

      await emailService.sendVotingConfirmationEmail(
        'voter@regression.test',
        'Regression Voter',
        'Test Poll (with edit)',
        'survey',
        'https://test.example.com/poll/abc',
        'https://test.example.com/poll/abc#results',
        ['Option A'],
        editLink,
      );

      expect(capturedHtml).toHaveLength(1);
      expect(capturedHtml[0]).toContain('/edit/abc123token');
    });
  });

  // ─── Bug 2: Duplicate email vote rejected with ALREADY_VOTED ─────────────

  describe('Bug 2 – Duplicate email vote on non-editable poll', () => {
    it('rejects a second vote with the same email (ALREADY_VOTED)', async () => {
      const { publicToken, adminToken } = await createSurveyPoll(agent, false);

      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(pollRes.status).toBe(200);
      const optionId: number = pollRes.body.options[0].id;

      const firstVote = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'First Voter',
          voterEmail: 'duplicate@regression.test',
        });
      expect(firstVote.status).toBe(200);

      const secondVote = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'no' }],
          voterName: 'First Voter',
          voterEmail: 'duplicate@regression.test',
        });

      expect(secondVote.status).toBe(400);
      expect(secondVote.body.errorCode).toBe('ALREADY_VOTED');

      await agent.delete(`/api/v1/polls/admin/${adminToken}`);
    });

    it('permits re-voting with the same email when allowVoteEdit=true (updates, does not block)', async () => {
      const { publicToken, adminToken } = await createSurveyPoll(agent, true);

      const pollRes = await request(app).get(`/api/v1/polls/public/${publicToken}`);
      expect(pollRes.status).toBe(200);
      const optionId: number = pollRes.body.options[0].id;

      const firstVote = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'yes' }],
          voterName: 'Editable Voter',
          voterEmail: 'editable-dup@regression.test',
        });
      expect(firstVote.status).toBe(200);

      const secondVote = await request(app)
        .post(`/api/v1/polls/${publicToken}/vote`)
        .set('x-test-mode', 'polly-e2e-test-mode')
        .send({
          votes: [{ optionId, response: 'no' }],
          voterName: 'Editable Voter',
          voterEmail: 'editable-dup@regression.test',
        });

      expect(secondVote.status).toBe(200);
      expect(secondVote.body.success).toBe(true);

      await agent.delete(`/api/v1/polls/admin/${adminToken}`);
    });
  });
});
