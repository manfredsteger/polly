import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import session from 'express-session';
import request from 'supertest';
import { createTestApp } from '../testApp';
import votesRouter from '../../routes/votes';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { createTestPoll, createTestVote } from '../fixtures/testData';

export const testMeta = {
  category: 'api' as const,
  name: 'Benachrichtigungen beim Abstimmen',
  description: 'Bestätigungs-, Ersteller- und Rückzugs-E-Mails werden bei echten (nicht Test-)Abstimmungen korrekt ausgelöst, gedrosselt und Fehler sauber gemeldet',
  severity: 'high' as const,
};

/**
 * The shared test app flags every request as test traffic, which skips all
 * voter emails. This app mounts the real votes router without that flag so
 * the production email decisions run; only the SMTP sender is mocked.
 */
function createLiveVotingApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'vote-notifications', resave: false, saveUninitialized: false }));
  app.use('/api/v1', votesRouter);
  return app;
}

let testApp: Express;
let liveApp: Express;
const createdPollIds: string[] = [];

async function createPoll(overrides: Parameters<typeof createTestPoll>[0] = {}) {
  const res = await request(testApp).post('/api/v1/polls').send(createTestPoll(overrides));
  expect(res.status).toBe(200);
  const poll = (await storage.getPollByPublicToken(res.body.publicToken))!;
  createdPollIds.push(poll.id);
  return poll;
}

function editTokenFromLink(link: unknown): string {
  const match = String(link).match(/\/edit\/([^/?#]+)$/);
  expect(match).not.toBeNull();
  return match![1];
}

describe('vote notification emails', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    liveApp = createLiveVotingApp();
  });

  beforeEach(() => {
    vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(true);
    vi.spyOn(emailService, 'sendVotingConfirmationEmail').mockResolvedValue(undefined as any);
    vi.spyOn(emailService, 'sendNewVoteNotificationEmail').mockResolvedValue(undefined as any);
    vi.spyOn(emailService, 'sendVoteWithdrawalEmail').mockResolvedValue(undefined as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    for (const id of createdPollIds) await storage.deletePoll(id).catch(() => {});
  });

  it('confirms a guest vote by email with a management link and notifies the creator once', async () => {
    const poll = await createPoll({ type: 'survey', creatorEmail: 'creator@vote-notify.example' });
    const voter = createTestVote({ voterName: 'Greta Guest' });
    const vote = await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: voter.voterName,
      voterEmail: voter.voterEmail,
      votes: [
        { optionId: poll.options[0].id, response: 'yes' },
        { optionId: poll.options[1].id, response: 'no' },
      ],
    });

    expect(vote.status).toBe(200);
    expect(vote.body).toMatchObject({ success: true, confirmationEmailStatus: 'sent', managementLinkByEmail: true });
    // Guests receive the management token only by email, never in the response.
    expect(JSON.stringify(vote.body)).not.toContain('voterEditToken');

    const confirm = vi.mocked(emailService.sendVotingConfirmationEmail);
    expect(confirm).toHaveBeenCalledTimes(1);
    const [to, name, title, type, publicLink, resultsLink, selected, editLink] = confirm.mock.calls[0];
    expect([to, name, title, type]).toEqual([voter.voterEmail, 'Greta Guest', poll.title, 'survey']);
    expect(publicLink).toMatch(new RegExp(`/poll/${poll.publicToken}$`));
    expect(resultsLink).toMatch(/#results$/);
    expect(JSON.stringify(selected)).toContain(poll.options[0].text);
    editTokenFromLink(editLink);

    const notify = vi.mocked(emailService.sendNewVoteNotificationEmail);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toBe('creator@vote-notify.example');
    expect(notify.mock.calls[0][4]).toMatch(new RegExp(`/admin/${poll.adminToken}$`));

    // An immediate edit is throttled: no second confirmation, no second creator mail.
    const edit = await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: voter.voterName,
      voterEmail: voter.voterEmail,
      voterEditToken: editTokenFromLink(editLink),
      votes: [{ optionId: poll.options[2].id, response: 'yes' }],
    });
    expect(edit.status).toBe(200);
    expect(edit.body.confirmationEmailStatus).toBe('cooldown');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    // The edit replaced the earlier answers.
    expect((await storage.getVotesByEmail(poll.id, voter.voterEmail)).map((v) => v.optionId)).toEqual([poll.options[2].id]);
  });

  it('reports a failed confirmation and lets the voter get it on the next attempt', async () => {
    const poll = await createPoll({ type: 'survey' });
    const voter = createTestVote();
    const confirm = vi.mocked(emailService.sendVotingConfirmationEmail);
    confirm.mockRejectedValueOnce(new Error('SMTP timeout'));

    const first = await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote-bulk`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail,
      votes: [{ optionId: poll.options[0].id, response: 'yes' }],
    });
    expect(first.status).toBe(200);
    expect(first.body.confirmationEmailStatus).toBe('failed');

    const token = editTokenFromLink(confirm.mock.calls[0][7]);
    const retry = await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote-bulk`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail, voterEditToken: token,
      votes: [{ optionId: poll.options[1].id, response: 'yes' }],
    });
    expect(retry.body.confirmationEmailStatus).toBe('sent');
    expect(confirm).toHaveBeenCalledTimes(2);
    // Edits by the same voter never notify the creator again.
    expect(emailService.sendNewVoteNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it('marks email as unavailable when SMTP is not configured', async () => {
    vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(false);
    const poll = await createPoll({ type: 'survey' });
    const voter = createTestVote();
    const res = await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail,
      votes: [{ optionId: poll.options[0].id, response: 'yes' }],
    });
    expect(res.body.confirmationEmailStatus).toBe('unavailable');
    expect(emailService.sendVotingConfirmationEmail).not.toHaveBeenCalled();
  });

  it('does not notify creators about their own vote', async () => {
    const poll = await createPoll({ type: 'survey', creatorEmail: 'self@vote-notify.example' });
    await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: 'Creator', voterEmail: 'SELF@vote-notify.example',
      votes: [{ optionId: poll.options[0].id, response: 'yes' }],
    });
    expect(emailService.sendVotingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendNewVoteNotificationEmail).not.toHaveBeenCalled();
  });

  it('emails voter and creator when a guest withdraws via the emailed link, even if one delivery fails', async () => {
    const poll = await createPoll({ type: 'survey', creatorEmail: 'owner@vote-notify.example' });
    const voter = createTestVote({ voterName: 'Wanda' });
    await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail,
      votes: [{ optionId: poll.options[0].id, response: 'yes' }, { optionId: poll.options[1].id, response: 'maybe' }],
    });
    const token = editTokenFromLink(vi.mocked(emailService.sendVotingConfirmationEmail).mock.calls[0][7]);

    const withdrawal = vi.mocked(emailService.sendVoteWithdrawalEmail);
    withdrawal.mockRejectedValueOnce(new Error('mailbox full'));
    const res = await request(liveApp).delete(`/api/v1/polls/${poll.publicToken}/vote`).send({ voterEditToken: token });
    expect(res.status).toBe(200);
    expect(res.body.withdrawnCount).toBe(2);

    // One mail per person, not per withdrawn answer.
    expect(withdrawal).toHaveBeenCalledTimes(2);
    const [voterMail, creatorMail] = withdrawal.mock.calls;
    expect(voterMail[0]).toBe(voter.voterEmail.toLowerCase());
    expect(voterMail[3]).toMatch(new RegExp(`/poll/${poll.publicToken}$`));
    expect(voterMail[4]).toBe(false);
    expect(creatorMail[0]).toBe('owner@vote-notify.example');
    expect(creatorMail[1]).toBe('Wanda');
    expect(creatorMail[3]).toMatch(new RegExp(`/admin/${poll.adminToken}$`));
    expect(creatorMail[4]).toBe(true);
    expect(console.error).toHaveBeenCalledWith('Withdrawal email delivery failed:', expect.any(Error));
    expect(await storage.getVotesByEmail(poll.id, voter.voterEmail)).toHaveLength(0);
  });

  it('notifies on withdrawal through the edit page as well', async () => {
    const poll = await createPoll({ type: 'survey' });
    const voter = createTestVote();
    await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail,
      votes: [{ optionId: poll.options[0].id, response: 'yes' }],
    });
    const token = editTokenFromLink(vi.mocked(emailService.sendVotingConfirmationEmail).mock.calls[0][7]);
    const res = await request(liveApp).delete(`/api/v1/votes/edit/${token}`);
    expect(res.status).toBe(200);
    expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledWith(
      voter.voterEmail.toLowerCase(), voter.voterName, poll.title, expect.stringContaining(`/poll/${poll.publicToken}`), false, undefined,
    );
  });

  describe('resending the confirmation', () => {
    it('resends with the management link and reports delivery problems', async () => {
      const poll = await createPoll({ type: 'survey' });
      const voter = createTestVote();
      await request(liveApp).post(`/api/v1/polls/${poll.publicToken}/vote`).send({
        voterName: voter.voterName, voterEmail: voter.voterEmail,
        votes: [{ optionId: poll.options[0].id, response: 'yes' }],
      });
      const confirm = vi.mocked(emailService.sendVotingConfirmationEmail);
      const originalLink = confirm.mock.calls[0][7];

      const url = `/api/v1/polls/${poll.publicToken}/resend-email`;
      expect((await request(liveApp).post('/api/v1/polls/missing-token/resend-email').send({ email: voter.voterEmail })).status).toBe(404);
      expect((await request(liveApp).post(url).send({})).status).toBe(400);
      expect((await request(liveApp).post(url).send({ email: 'nobody@vote-notify.example' })).status).toBe(404);

      const ok = await request(liveApp).post(url).send({ email: voter.voterEmail });
      expect(ok.body.success).toBe(true);
      expect(confirm.mock.calls[1][7]).toBe(originalLink);

      confirm.mockRejectedValueOnce(new Error('550 Spam message rejected'));
      const spam = await request(liveApp).post(url).send({ email: voter.voterEmail });
      expect(spam.body).toMatchObject({ success: false, errorCode: 'EMAIL_BLOCKED_BY_SPAM_FILTER' });

      confirm.mockRejectedValueOnce(new Error('auth failed'));
      expect((await request(liveApp).post(url).send({ email: voter.voterEmail })).status).toBe(500);

      vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(false);
      expect((await request(liveApp).post(url).send({ email: voter.voterEmail })).status).toBe(503);
    });
  });
});

describe('vote rules enforced before anything is saved or emailed', () => {
  beforeAll(async () => {
    testApp = testApp ?? await createTestApp();
    liveApp = liveApp ?? createLiveVotingApp();
  });

  beforeEach(() => {
    vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(true);
    vi.spyOn(emailService, 'sendVotingConfirmationEmail').mockResolvedValue(undefined as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  async function vote(poll: { publicToken: string }, votes: unknown[], path = 'vote') {
    const voter = createTestVote();
    return request(liveApp).post(`/api/v1/polls/${poll.publicToken}/${path}`).send({
      voterName: voter.voterName, voterEmail: voter.voterEmail, votes,
    });
  }

  it.each(['vote', 'vote-bulk'])('rejects past dates, wrong answer kinds and closed polls (%s)', async (path) => {
    const schedule = await createPoll({ type: 'survey' });
    await storage.updatePoll(schedule.id, { type: 'schedule', allowMaybe: false } as any);
    await storage.updatePollOption(schedule.options[0].id, { endTime: new Date(Date.now() - 3_600_000) } as any);
    await storage.updatePollOption(schedule.options[1].id, { startTime: new Date(Date.now() + 86_400_000) } as any);

    const past = await vote(schedule, [{ optionId: schedule.options[0].id, response: 'yes' }], path);
    expect(past.status).toBe(400);
    expect(past.body.errorCode).toBe('PAST_OPTION_DATE');
    const maybe = await vote(schedule, [{ optionId: schedule.options[1].id, response: 'maybe' }], path);
    expect(maybe.body.errorCode).toBe('MAYBE_NOT_ALLOWED');
    const freeText = await vote(schedule, [{ optionId: schedule.options[1].id, response: 'freetext' }], path);
    expect(freeText.body.errorCode).toBe('INVALID_FREE_TEXT_RESPONSE');
    const foreign = await vote(schedule, [{ optionId: 999_999_999, response: 'yes' }], path);
    expect(foreign.status).toBe(400);

    const org = await createPoll({ type: 'organization' });
    const orgMaybe = await vote(org, [{ optionId: org.options[0].id, response: 'maybe' }], path);
    expect(orgMaybe.body.errorCode).toBe('INVALID_ORGANIZATION_RESPONSE');

    const missing = await vote({ publicToken: `missing-${path}` }, [{ optionId: 1, response: 'yes' }], path);
    expect(missing.status).toBe(404);

    await storage.updatePoll(org.id, { expiresAt: new Date(Date.now() - 60_000) } as any);
    expect((await vote(org, [{ optionId: org.options[0].id, response: 'yes' }], path)).body.errorCode).toBe('POLL_EXPIRED');
    await storage.updatePoll(org.id, { isActive: false } as any);
    expect((await vote(org, [{ optionId: org.options[0].id, response: 'yes' }], path)).body.errorCode).toBe('POLL_INACTIVE');

    expect(emailService.sendVotingConfirmationEmail).not.toHaveBeenCalled();
    expect((await storage.getPollByPublicToken(schedule.publicToken))!.votes).toHaveLength(0);
  });
});
