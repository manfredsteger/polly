import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { storage, tokenService, emailService, deviceTokenService } = vi.hoisted(() => ({
  storage: Object.fromEntries([
    'getPollByPublicToken', 'getCustomizationSettings', 'getVotesByEmail', 'getVotesByUserId',
    'getVotesByEditToken', 'getUser', 'getUserByEmail', 'deleteVote', 'updateVote',
    'createVote', 'replaceSimpleModeVotes', 'getPoll', 'getVotesByVoterKey',
  ].map(name => [name, vi.fn()])),
  tokenService: { extractBearerToken: vi.fn(), validateToken: vi.fn() },
  emailService: { smtpConfigured: true, sendVotingConfirmationEmail: vi.fn(), sendVoteWithdrawalEmail: vi.fn(), sendVoteUpdatedEmail: vi.fn() },
  deviceTokenService: { getVoterKey: vi.fn() },
}));
vi.mock('../storage', () => ({ storage }));
vi.mock('../services/tokenService', () => ({ tokenService }));
vi.mock('../services/emailService', () => ({ emailService }));
vi.mock('../services/deviceTokenService', () => ({ deviceTokenService }));
vi.mock('../services/rateLimiterService', () => ({ loginRateLimiter: {} }));
vi.mock('../services/liveVotingService', () => ({ liveVotingService: { broadcastSlotUpdate: vi.fn() } }));
vi.mock('../services/apiRateLimiterService', () => ({
  voteRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  emailRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  apiGeneralRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
// Use the real validation schema and session/bearer identity extraction.
import router, { getVoteEmailSummary } from '../routes/votes';
import { recentEmailSends } from '../routes/common';
import { assertVoteOwnership } from '../lib/voteOwnership';

const token = 'private-voter-token';
const vote = {
  id: 1, pollId: 'poll-1', optionId: 10, userId: null as number | null,
  voterEmail: 'voter@example.test', voterName: 'Voter', voterEditToken: token, response: 'yes',
};
let poll: ReturnType<typeof makePoll>;
function makePoll() {
  return {
    id: 'poll-1', publicToken: 'public-token', type: 'survey', responseMode: 'classic',
    isActive: true, expiresAt: null as Date | null, allowVoteEdit: true,
    allowVoteWithdrawal: true, allowMaybe: true, maxSelections: 1,
    title: 'Test poll', creatorEmail: 'organizer@example.test', adminToken: 'admin-token',
    notifyCreatorOnVote: false, isAnonymous: false,
    options: [{ id: 10, text: 'One' }, { id: 11, text: 'Two' }], votes: [vote],
  };
}
async function call(method: 'get' | 'post' | 'delete' | 'put', body: unknown, userId?: number, path = '/polls/:token/vote', headers = {}, isTestMode = true) {
  const handler = router.stack.find(l => l.route?.path === path && l.route.stack.some(layer => layer.method === method))?.route?.stack.at(-1)?.handle;
  if (!handler) throw new Error('Route not found');
  const res = {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(data: unknown) { this.body = data; return this; },
  };
  const next = vi.fn();
  await handler({ params: { token: 'public-token', editToken: token }, body, session: { userId }, headers, isTestMode } as unknown as Request, res as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  return res;
}
const submission = (voterEditToken?: unknown) => ({
  voterEmail: vote.voterEmail, voterName: vote.voterName, voterEditToken,
  votes: [{ optionId: 10, response: 'no' }],
});
function expectNoMutation() {
  for (const name of ['deleteVote', 'updateVote', 'createVote', 'replaceSimpleModeVotes']) {
    expect(storage[name]).not.toHaveBeenCalled();
  }
}
beforeEach(() => {
  vi.resetAllMocks();
  recentEmailSends.clear();
  emailService.smtpConfigured = true;
  emailService.sendVotingConfirmationEmail.mockResolvedValue(undefined);
  emailService.sendVoteWithdrawalEmail.mockResolvedValue(undefined);
  emailService.sendVoteUpdatedEmail.mockResolvedValue(undefined);
  deviceTokenService.getVoterKey.mockReturnValue({ voterKey: 'device:test', voterSource: 'device' });
  storage.getVotesByVoterKey.mockResolvedValue([vote]);
  poll = makePoll();
  storage.getPollByPublicToken.mockImplementation(async () => poll);
  storage.getCustomizationSettings.mockResolvedValue({ guestAccess: { allowGuestVoting: true } });
  storage.getVotesByEmail.mockResolvedValue([{ ...vote }]);
  storage.getVotesByUserId.mockResolvedValue([]);
  storage.getVotesByEditToken.mockResolvedValue([]);
  storage.getUserByEmail.mockResolvedValue(undefined);
  storage.getUser.mockResolvedValue({ id: 7, email: vote.voterEmail, provider: 'local' });
  storage.updateVote.mockResolvedValue({ ...vote, response: 'no' });
  storage.createVote.mockResolvedValue({ vote, editToken: token });
  storage.replaceSimpleModeVotes.mockResolvedValue({ votes: [vote], editToken: token });
});

describe.each(['/polls/:token/vote', '/polls/:token/vote-bulk'])('%s authorization', path => {
  it.each([undefined, 'wrong-token', 'token-from-another-poll'])('rejects replacing guest votes with token %s', async supplied => {
    const res = await call('post', submission(supplied), undefined, path);
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe('VOTE_AUTHORIZATION_REQUIRED');
    expectNoMutation();
    expect(JSON.stringify(res.body)).not.toContain(token);
  });
  it('does not treat matching email as logged-in ownership', async () => {
    const res = await call('post', submission(), 7, path);
    expect(res.statusCode).toBe(403);
    expectNoMutation();
  });
  it('rejects a different authenticated voter', async () => {
    storage.getVotesByEmail.mockResolvedValue([{ ...vote, userId: 8 }]);
    expect((await call('post', submission(), 7, path)).statusCode).toBe(403);
    expectNoMutation();
  });
  it.each(['local', 'keycloak'])('allows the %s session owner', async provider => {
    storage.getUser.mockResolvedValue({ id: 7, email: vote.voterEmail, provider });
    storage.getVotesByEmail.mockResolvedValue([{ ...vote, userId: 7 }]);
    expect((await call('post', submission(), 7, path)).statusCode).toBe(200);
    expect(storage.updateVote).toHaveBeenCalledWith(1, 'no', expect.any(Object));
  });
  it('allows a validated IDM bearer identity', async () => {
    tokenService.extractBearerToken.mockReturnValue('idm-token');
    tokenService.validateToken.mockResolvedValue({ valid: true, userId: 7 });
    storage.getVotesByEmail.mockResolvedValue([{ ...vote, userId: 7 }]);
    expect((await call('post', submission(), undefined, path, { authorization: 'Bearer idm-token' })).statusCode).toBe(200);
  });
  it('allows a guest with the correct private token', async () => {
    expect((await call('post', submission(token), undefined, path)).statusCode).toBe(200);
    expect(storage.updateVote).toHaveBeenCalled();
  });
  it('checks every vote before deleting deselected options', async () => {
    storage.getVotesByEmail.mockResolvedValue([vote, { ...vote, id: 2, optionId: 11, voterEditToken: 'different-token' }]);
    expect((await call('post', submission(token), undefined, path)).statusCode).toBe(403);
    expectNoMutation();
  });
  it.each(['survey', 'schedule', 'organization'])('preserves first-time guest voting for %s', async type => {
    poll.type = type;
    storage.getVotesByEmail.mockResolvedValue([]);
    expect((await call('post', submission(), undefined, path)).statusCode).toBe(200);
    expect(storage.createVote).toHaveBeenCalled();
  });
  it('still requires login for first votes using registered emails', async () => {
    storage.getVotesByEmail.mockResolvedValue([]);
    storage.getUserByEmail.mockResolvedValue({ id: 7 });
    expect((await call('post', submission(), undefined, path)).statusCode).toBe(409);
    expectNoMutation();
  });
  it('preserves the no-edit policy even with a valid token', async () => {
    poll.allowVoteEdit = false;
    expect((await call('post', submission(token), undefined, path)).statusCode).toBe(400);
    expectNoMutation();
  });
  it('protects organization booking replacement', async () => {
    poll.type = 'organization';
    expect((await call('post', { ...submission(), votes: [{ optionId: 10, response: 'yes' }] }, undefined, path)).statusCode).toBe(403);
    expectNoMutation();
    expect((await call('post', { ...submission(token), votes: [{ optionId: 10, response: 'yes' }] }, undefined, path)).statusCode).toBe(200);
  });
  it('protects simple-choice replacements and preserves legitimate edits', async () => {
    poll.responseMode = 'simple';
    const body = { ...submission(), votes: [{ optionId: 10, response: 'yes' }] };
    expect((await call('post', body, undefined, path)).statusCode).toBe(403);
    expectNoMutation();
    expect((await call('post', { ...body, voterEditToken: token }, undefined, path)).statusCode).toBe(200);
    expect(storage.replaceSimpleModeVotes).toHaveBeenCalled();
  });
  it('keeps withdrawal-only guest tokens email-only', async () => {
    poll.allowVoteEdit = false;
    storage.getVotesByEmail.mockResolvedValue([]);
    const res = await call('post', submission(), undefined, path);
    expect(res.statusCode).toBe(200);
    expect(res.body.voterEditToken).toBeUndefined();
    expect(res.body.managementLinkByEmail).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(token);
  });
  it('handles post-lock authorization failures as 403', async () => {
    poll.responseMode = 'simple';
    storage.getVotesByEmail.mockResolvedValue([]);
    storage.replaceSimpleModeVotes.mockRejectedValue(new Error('VOTE_AUTHORIZATION_REQUIRED'));
    expect((await call('post', { ...submission(), votes: [{ optionId: 10, response: 'yes' }] }, undefined, path)).statusCode).toBe(403);
  });
});

describe('Withdrawal authorization', () => {
  it('rejects email-only guest withdrawal without looking up the email', async () => {
    expect((await call('delete', { voterEmail: vote.voterEmail })).statusCode).toBe(403);
    expect(storage.getVotesByEmail).not.toHaveBeenCalled();
    expectNoMutation();
  });
  it.each(['local', 'keycloak'])('withdraws only the %s session owner votes by ID', async provider => {
    storage.getUser.mockResolvedValue({ id: 7, email: 'changed@example.test', provider });
    storage.getVotesByUserId.mockResolvedValue([{ ...vote, userId: 7 }]);
    expect((await call('delete', { voterEmail: 'someone-else@example.test' }, 7)).statusCode).toBe(200);
    expect(storage.getVotesByUserId).toHaveBeenCalledWith('poll-1', 7);
    expect(storage.getVotesByEmail).not.toHaveBeenCalled();
    expect(storage.deleteVote).toHaveBeenCalledWith(1);
  });
  it('accepts a private token and limits deletion to its poll', async () => {
    storage.getVotesByEditToken.mockResolvedValue([vote, { ...vote, id: 2, pollId: 'other-poll' }]);
    expect((await call('delete', { voterEditToken: token })).statusCode).toBe(200);
    expect(storage.deleteVote).toHaveBeenCalledTimes(1);
    expect(storage.deleteVote).toHaveBeenCalledWith(1);
  });
  it('rejects a token belonging only to another poll', async () => {
    storage.getVotesByEditToken.mockResolvedValue([{ ...vote, pollId: 'other-poll' }]);
    expect((await call('delete', { voterEditToken: token })).statusCode).toBe(404);
    expectNoMutation();
  });
  it('does not fall back to email when a token is invalid', async () => {
    expect((await call('delete', { voterEditToken: 'invalid', voterEmail: vote.voterEmail })).statusCode).toBe(404);
    expectNoMutation();
  });
  it('validates token input', async () => {
    expect((await call('delete', { voterEditToken: {} })).statusCode).toBe(400);
    expectNoMutation();
  });
  it('preserves withdrawal restrictions', async () => {
    poll.allowVoteWithdrawal = false;
    expect((await call('delete', { voterEditToken: token })).statusCode).toBe(403);
    expectNoMutation();
  });
});

describe('Ownership guard', () => {
  it('requires proof for votes found after acquiring a storage lock', () => {
    expect(() => assertVoteOwnership([vote], null)).toThrow('VOTE_AUTHORIZATION_REQUIRED');
    expect(() => assertVoteOwnership([vote], null, token)).not.toThrow();
    expect(() => assertVoteOwnership([{ ...vote, userId: 7 }], 7)).not.toThrow();
    expect(() => assertVoteOwnership([{ ...vote, voterEditToken: null }], null, '')).toThrow();
  });
});


describe('Private link permissions and withdrawal deadlines', () => {
  beforeEach(() => {
    storage.getPoll.mockImplementation(async () => poll);
    storage.getVotesByEditToken.mockResolvedValue([vote]);
  });

  it.each(['survey', 'schedule'])('reports disabled editing for %s polls', async type => {
    poll.type = type;
    poll.allowVoteEdit = false;
    const res = await call('get', undefined, undefined, '/votes/edit/:editToken');
    expect(res.statusCode).toBe(200);
    expect(res.body.poll.allowVoteEdit).toBe(false);
    expect(res.body.allowVoteWithdrawal).toBe(true);
  });

  it('preserves existing organization booking permissions', async () => {
    poll.type = 'organization';
    poll.allowVoteEdit = false;
    const res = await call('get', undefined, undefined, '/votes/edit/:editToken');
    expect(res.body.poll.allowVoteEdit).toBe(true);
  });

  it.each(['/polls/:token/vote', '/votes/edit/:editToken'])('rejects expired withdrawal at %s even before the scheduler deactivates the poll', async path => {
    poll.expiresAt = new Date(Date.now() - 1000);
    expect(poll.isActive).toBe(true);
    const res = await call('delete', { voterEditToken: token }, undefined, path);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe('POLL_EXPIRED');
    expectNoMutation();
  });

  it.each(['/polls/:token/vote', '/votes/edit/:editToken'])('allows permitted withdrawal before the deadline at %s', async path => {
    poll.expiresAt = new Date(Date.now() + 60000);
    const res = await call('delete', { voterEditToken: token }, undefined, path);
    expect(res.statusCode).toBe(200);
    expect(storage.deleteVote).toHaveBeenCalledWith(1);
  });
});


it('uses current withdrawal-only permissions when resending the confirmation', async () => {
  poll.allowVoteEdit = false;
  const res = await call('post', { email: vote.voterEmail }, undefined, '/polls/:token/resend-email');
  expect(res.statusCode).toBe(200);
  expect(emailService.sendVotingConfirmationEmail.mock.calls[0]?.slice(7)).toEqual([
    expect.stringContaining(`/edit/${token}`), true,
  ]);
});

describe.each(['/polls/:token/vote', '/polls/:token/vote-bulk'])('Email-only guest management at %s', path => {
  beforeEach(() => storage.getVotesByEmail.mockResolvedValue([]));

  it('sends the private link to the submitted address without returning any token', async () => {
    const res = await call('post', submission(), undefined, path, {}, false);
    expect(res.statusCode).toBe(200);
    expect(res.body.confirmationEmailStatus).toBe('sent');
    expect(res.body.managementLinkByEmail).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(res.body).not.toHaveProperty('voterEditToken');
    expect(res.body.votes[0]).not.toHaveProperty('voterEditToken');
    expect(emailService.sendVotingConfirmationEmail).toHaveBeenCalledWith(
      vote.voterEmail, vote.voterName, poll.title, 'survey',
      expect.any(String), expect.any(String), expect.any(Array), expect.stringContaining(`/edit/${token}`),
      false,
    );
  });

  it.each(['survey', 'schedule', 'organization'])('uses withdrawal-only email wording according to %s permissions', async type => {
    poll.type = type;
    poll.allowVoteEdit = false;
    const res = await call('post', submission(), undefined, path, {}, false);
    expect(res.statusCode).toBe(200);
    expect(emailService.sendVotingConfirmationEmail.mock.calls[0]?.[8]).toBe(type !== 'organization');
  });

  it.each(['failed', 'unavailable', 'cooldown'])('reports %s email honestly and never falls back to revealing the token', async status => {
    if (status === 'failed') emailService.sendVotingConfirmationEmail.mockRejectedValue(new Error('SMTP rejected'));
    if (status === 'unavailable') emailService.smtpConfigured = false;
    if (status === 'cooldown') recentEmailSends.set(`${poll.id}:${vote.voterEmail}`, Date.now());
    const res = await call('post', submission(), undefined, path, {}, false);
    expect(res.statusCode).toBe(200);
    expect(res.body.confirmationEmailStatus).toBe(status);
    expect(JSON.stringify(res.body)).not.toContain(token);
    if (status !== 'failed') expect(emailService.sendVotingConfirmationEmail).not.toHaveBeenCalled();
  });

  it('does not expose a token to a logged-in user submitting a guest email', async () => {
    storage.getUser.mockResolvedValue({ id: 7, email: 'different@example.test' });
    const res = await call('post', submission(), 7, path);
    expect(res.statusCode).toBe(200);
    expect(res.body.managementLinkByEmail).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it.each(['local', 'keycloak'])('preserves %s authenticated ownership', async provider => {
    storage.getUser.mockResolvedValue({ id: 7, email: vote.voterEmail, provider });
    storage.createVote.mockResolvedValue({ vote: { ...vote, userId: 7 }, editToken: token });
    const res = await call('post', submission(), 7, path);
    expect(res.statusCode).toBe(200);
    expect(res.body.voterEditToken).toBe(token);
    expect(res.body.managementLinkByEmail).toBe(false);
  });
});

describe('My votes management credentials', () => {
  it('does not expose a guest token through device lookup', async () => {
    const res = await call('get', undefined, undefined, '/polls/:token/my-votes');
    expect(res.statusCode).toBe(200);
    expect(res.body.hasVoted).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(token);
  });
  it('exposes credentials only for the authenticated voter own votes', async () => {
    storage.getVotesByUserId.mockResolvedValue([{ ...vote, optionId: 11, userId: 7 }]);
    const res = await call('get', undefined, 7, '/polls/:token/my-votes');
    expect(res.body.votes[0]).not.toHaveProperty('voterEditToken');
    expect(res.body.votes[1].voterEditToken).toBe(token);
  });
});

describe.each(['/polls/:token/vote', '/votes/edit/:editToken'])('Withdrawal emails at %s', path => {
  beforeEach(() => {
    storage.getPoll.mockImplementation(async () => poll);
    storage.getVotesByEditToken.mockResolvedValue([vote, { ...vote, id: 2, optionId: 11 }]);
  });
  it.each([false, true])('sends one participant email and respects organizer preference %s', async notify => {
    poll.notifyCreatorOnVote = notify;
    const res = await call('delete', { voterEditToken: token }, undefined, path, {}, false);
    expect(res.statusCode).toBe(200);
    expect(storage.deleteVote).toHaveBeenCalledTimes(2);
    expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledTimes(notify ? 2 : 1);
    expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledWith(
      vote.voterEmail, vote.voterName, poll.title, expect.stringContaining('/poll/public-token'),
    );
    if (notify) expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledWith(
      poll.creatorEmail, vote.voterName, poll.title, expect.stringContaining('/admin/admin-token'), true,
    );
    expect(storage.deleteVote.mock.invocationCallOrder[1]).toBeLessThan(emailService.sendVoteWithdrawalEmail.mock.invocationCallOrder[0]);
  });
  it('still notifies the organizer when participant delivery fails', async () => {
    poll.notifyCreatorOnVote = true;
    emailService.sendVoteWithdrawalEmail.mockRejectedValueOnce(new Error('SMTP failed'));
    expect((await call('delete', { voterEditToken: token }, undefined, path, {}, false)).statusCode).toBe(200);
    expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledTimes(2);
  });
  it('does not reveal participant names to the organizer for anonymous polls', async () => {
    poll.notifyCreatorOnVote = true;
    poll.isAnonymous = true;
    await call('delete', { voterEditToken: token }, undefined, path, {}, false);
    expect(emailService.sendVoteWithdrawalEmail.mock.calls[1][1]).toBe('');
  });
  it('avoids a duplicate organizer message for their own withdrawal', async () => {
    poll.notifyCreatorOnVote = true;
    poll.creatorEmail = vote.voterEmail;
    await call('delete', { voterEditToken: token }, undefined, path, {}, false);
    expect(emailService.sendVoteWithdrawalEmail).toHaveBeenCalledTimes(1);
  });
  it.each(['denied', 'delete-failed', 'test-mode', 'no-smtp'])('sends no mail when %s', async scenario => {
    if (scenario === 'denied') poll.allowVoteWithdrawal = false;
    if (scenario === 'delete-failed') storage.deleteVote.mockRejectedValue(new Error('DB unavailable'));
    if (scenario === 'no-smtp') emailService.smtpConfigured = false;
    await call('delete', { voterEditToken: token }, undefined, path, {}, scenario === 'test-mode');
    expect(emailService.sendVoteWithdrawalEmail).not.toHaveBeenCalled();
  });
});

describe('Saved answer email summaries', () => {
  const summaryPoll = { type: 'schedule', options: [
    { id: 10, text: '01.10.2026 09:00–12:00' },
    { id: 11, text: '01.10.2026 14:00–17:00' },
  ] };
  it('omits unanswered slots when only one Yes is saved', () => {
    expect(getVoteEmailSummary(summaryPoll, [{ optionId: 10, response: 'yes' }])).toEqual(['01.10.2026 09:00–12:00 — Ja']);
  });
  it('includes an explicitly saved No alongside Yes', () => {
    expect(getVoteEmailSummary(summaryPoll, [{ optionId: 10, response: 'yes' }, { optionId: 11, response: 'no' }])).toEqual([
      '01.10.2026 09:00–12:00 — Ja', '01.10.2026 14:00–17:00 — Nein',
    ]);
  });
  it.each(['simple', 'organization'])('preserves selection-only wording for %s', mode => {
    const selectionPoll = mode === 'simple' ? { ...summaryPoll, responseMode: 'simple' } : { ...summaryPoll, type: 'organization' };
    expect(getVoteEmailSummary(selectionPoll, [{ optionId: 10, response: 'yes' }, { optionId: 11, response: 'no' }])).toEqual(['01.10.2026 09:00–12:00']);
  });
  it.each([['yes', 'maybe', 'Vielleicht'], ['maybe', 'no', 'Nein']])('emails the new answer after %s to %s and retains unchanged answers', async (previous, next, label) => {
    const saved = [{ ...vote, response: previous }, { ...vote, id: 2, optionId: 11, response: 'yes' }];
    storage.getVotesByEditToken.mockResolvedValue(saved);
    storage.getPoll.mockResolvedValue(poll);
    storage.updateVote.mockResolvedValue({ ...vote, response: next });
    const res = await call('put', { votes: [{ optionId: 10, response: next }] }, undefined, '/votes/edit/:editToken');
    expect(res.statusCode).toBe(200);
    expect(emailService.sendVoteUpdatedEmail.mock.calls[0][6]).toEqual([`One — ${label}`, 'Two — Ja']);
  });
  it.each(['/polls/:token/vote', '/polls/:token/vote-bulk'])('includes explicit No in submission mail at %s', async path => {
    storage.getVotesByEmail.mockResolvedValue([]);
    storage.createVote.mockResolvedValue({ vote: { ...vote, response: 'no' }, editToken: token });
    const res = await call('post', submission(), undefined, path, {}, false);
    expect(res.statusCode).toBe(200);
    expect(emailService.sendVotingConfirmationEmail.mock.calls[0][6]).toEqual(['One — Nein']);
  });
});
