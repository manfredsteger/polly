import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { storage } = vi.hoisted(() => ({
  storage: {
    getPollByPublicToken: vi.fn(),
    getPollByAdminToken: vi.fn(),
    getPollResults: vi.fn(),
  },
}));
vi.mock('../storage', () => ({ storage }));
vi.mock('../services/emailService', () => ({ emailService: {} }));
vi.mock('../services/adminCacheService', () => ({ adminCacheService: {} }));
vi.mock('../services/apiRateLimiterService', () => ({
  pollCreationRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  apiGeneralRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../routes/common', () => ({
  extractUserId: async (req: { session?: { userId?: number } }) => req.session?.userId ?? null,
  createPollSchema: {},
  requireEmailVerified: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import router from '../routes/polls';

function fixture(resultsPublic = true, type = 'survey') {
  return {
    id: 'poll-1', title: 'Lunch', type, userId: 7,
    publicToken: 'public-token', adminToken: 'admin-secret',
    creatorEmail: 'creator@example.test', resultsPublic,
    isActive: true, allowVoteEdit: true, allowVoteWithdrawal: true,
    futurePrivateField: 'must-not-leak',
    options: [{ id: 1, text: 'Monday', maxCapacity: 2, isFreeText: true }],
    user: {
      id: 7, name: 'Creator', username: 'creator', email: 'creator@example.test',
      passwordHash: 'hash-secret', totpSecret: 'mfa-secret', calendarToken: 'calendar-secret',
    },
    votes: [{
      id: 10, pollId: 'poll-1', optionId: 1, voterName: 'Participant', userId: 8,
      voterEmail: 'participant@example.test', voterEditToken: 'edit-secret',
      voterKey: 'device:device-secret', voterSource: 'device',
      response: 'yes', comment: 'Bringing lunch', freeTextAnswer: 'Vegetarian',
      futurePrivateField: 'must-not-leak',
    }],
  };
}

// Invoke the real route handler without listening on a socket or touching a DB.
async function get(path: string, token = 'public-token', userId?: number) {
  const layer = router.stack.find(layer => layer.route?.path === path);
  const handler = layer?.route?.stack.at(-1)?.handle;
  if (!handler) throw new Error(`No route handler found for ${path}`);
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  const next = vi.fn();
  await handler(
    { params: { token }, session: { userId } } as unknown as Request,
    res as unknown as Response,
    next,
  );
  expect(next).not.toHaveBeenCalled();
  return res;
}

function expectNoSecrets(body: unknown) {
  const json = JSON.stringify(body);
  for (const key of ['adminToken', 'creatorEmail', 'voterEmail', 'voterEditToken',
    'passwordHash', 'totpSecret', 'calendarToken', 'voterKey', 'voterSource', 'futurePrivateField']) {
    expect(json).not.toContain(`"${key}"`);
  }
}

function setup(resultsPublic = true, type = 'survey') {
  const poll = fixture(resultsPublic, type);
  storage.getPollByPublicToken.mockResolvedValue(poll);
  storage.getPollResults.mockResolvedValue({
    poll, options: poll.options, votes: poll.votes,
    stats: [{ optionId: 1, yesCount: 1, maybeCount: 0, noCount: 0, score: 2 }],
    participantCount: 1, responseRate: 100,
  });
  return poll;
}

beforeEach(() => {
  vi.resetAllMocks();
  storage.getPollByAdminToken.mockResolvedValue(undefined);
});

describe('Public poll privacy', () => {
  it('keeps public answers, creator attribution and voting settings without secrets', async () => {
    const poll = setup();
    const res = await get('/public/:token');
    expect(res.statusCode).toBe(200);
    expectNoSecrets(res.body);
    expect(res.body.user).toEqual({ name: 'Creator', username: 'creator' });
    expect(res.body).toMatchObject({ allowVoteEdit: true, allowVoteWithdrawal: true });
    expect(res.body.votes[0]).toMatchObject({ voterName: 'Participant', response: 'yes', freeTextAnswer: 'Vegetarian' });
    expect(res.body.options).toEqual(poll.options);
    // Serialization must not mutate the objects used by authenticated routes.
    expect(poll.votes[0].voterEditToken).toBe('edit-secret');
    expect(poll.user.passwordHash).toBe('hash-secret');
  });

  it.each(['survey', 'schedule', 'organization'])('hides private %s votes from visitors', async type => {
    setup(false, type);
    const res = await get('/public/:token');
    expect(res.body.votes).toEqual([]);
    expectNoSecrets(res.body);
    expect(JSON.stringify(res.body)).not.toContain('Participant');
  });

  it('also hides private votes from a logged-in non-owner', async () => {
    setup(false);
    const res = await get('/public/:token', 'public-token', 99);
    expect(res.body.votes).toEqual([]);
    expectNoSecrets(res.body);
  });

  it('preserves slot availability while hiding private signup identities', async () => {
    setup(false, 'organization');
    const res = await get('/public/:token');
    expect(res.body.slotCounts).toEqual({ 1: 1 });
    expect(res.body.options[0].maxCapacity).toBe(2);
    expect(res.body.votes).toEqual([]);
  });

  it('preserves organizer access through an owner session without account secrets', async () => {
    setup(false);
    const res = await get('/public/:token', 'public-token', 7);
    expect(res.body.adminToken).toBe('admin-secret');
    expect(res.body.votes[0].voterEmail).toBe('participant@example.test');
    expect(res.body.user).toEqual({ name: 'Creator', username: 'creator' });
  });

  it('omits credential fields even when the database values are null', async () => {
    const poll = setup();
    Object.assign(poll.user, { passwordHash: null, totpSecret: null });
    expectNoSecrets((await get('/public/:token')).body);
  });

  it('preserves not-found handling', async () => {
    expect((await get('/public/:token')).statusCode).toBe(404);
    expect((await get('/:token/results')).statusCode).toBe(404);
  });
});

describe('Results response privacy', () => {
  it('sanitizes both top-level votes and the nested poll without changing results', async () => {
    setup();
    const res = await get('/:token/results');
    expect(res.statusCode).toBe(200);
    expectNoSecrets(res.body);
    expect(res.body.votes).toEqual(res.body.poll.votes);
    expect(res.body).toMatchObject({ participantCount: 1, responseRate: 100 });
    expect(res.body.stats[0]).toMatchObject({ yesCount: 1, score: 2 });
  });

  it.each([undefined, 99])('denies private results to non-owner %s', async userId => {
    setup(false);
    const res = await get('/:token/results', 'public-token', userId);
    expect(res.statusCode).toBe(403);
    expect(res.body.resultsPrivate).toBe(true);
    expect(storage.getPollResults).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin-token'])('preserves private results for %s access', async access => {
    const poll = setup(false);
    if (access === 'admin-token') storage.getPollByAdminToken.mockResolvedValue(poll);
    const res = await get('/:token/results', access === 'owner' ? 'public-token' : 'admin-secret', access === 'owner' ? 7 : undefined);
    expect(res.statusCode).toBe(200);
    expect(res.body.votes[0].voterEmail).toBe('participant@example.test');
    expect(res.body.poll.user).toEqual({ name: 'Creator', username: 'creator' });
  });
});
