/**
 * Direct storage-layer scenarios for edge branches the HTTP suites skip:
 * vote locking rules per poll type, bulk voting, vote lookups, participation
 * queries, expiry/cleanup jobs, admin activity feed and ClamAV notification
 * bookkeeping. Every row created here is flagged as test data and removed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { db } from '../../db';
import { notificationLogs, passwordResetTokens, emailChangeTokens, clamavScanLogs, polls as pollsTable } from '@shared/schema';

export const testMeta = {
  category: 'database' as const,
  name: 'Datenbank-Randfälle',
  description: 'Prüft Sperr-, Duplikat- und Aufräumlogik der Speicherschicht',
  severity: 'high' as const,
};

const HOUR = 60 * 60 * 1000;
const createdPollIds: string[] = [];
const createdUserIds: number[] = [];

async function makePoll(
  type: 'survey' | 'schedule' | 'organization',
  extra: Record<string, unknown> = {},
  optionExtra: Array<Record<string, unknown>> = [{}, {}, {}],
) {
  const result = await storage.createPoll(
    {
      title: `Storage Edge ${type} ${randomBytes(3).toString('hex')}`,
      type,
      isTestData: true,
      ...extra,
    } as any,
    optionExtra.map((o, i) => ({ text: `Opt ${i}`, order: i, pollId: '', ...o })) as any,
  );
  createdPollIds.push(result.poll.id);
  return result;
}

async function makeUser(role: 'user' | 'admin' = 'user', extra: Record<string, unknown> = {}) {
  const s = randomBytes(4).toString('hex');
  const user = await storage.createUser({
    username: `se_${s}`,
    email: `se-${s}@test.example`,
    name: `Storage Edge ${s}`,
    role,
    provider: 'local',
    isTestData: true,
    ...extra,
  } as any);
  createdUserIds.push(user.id);
  return user;
}

const vote = (pollId: string, optionId: number, extra: Record<string, unknown> = {}) => ({
  pollId,
  optionId,
  voterName: 'Voter',
  response: 'yes',
  isTestData: true,
  ...extra,
}) as any;

beforeAll(async () => {
  await createTestApp();
});

afterAll(async () => {
  if (createdPollIds.length > 0) {
    await db.delete(notificationLogs).where(inArray(notificationLogs.pollId, createdPollIds));
  }
  for (const id of createdPollIds) await storage.deletePoll(id).catch(() => {});
  for (const id of createdUserIds) await storage.deleteUser(id).catch(() => {});
});

describe('storage.vote – organization sign-ups', () => {
  it('rejects unknown polls and options', async () => {
    await expect(storage.vote(vote('00000000-0000-4000-8000-000000000000', 1))).rejects.toThrow('Poll not found');
    const { poll } = await makePoll('organization');
    await expect(storage.vote(vote(poll.id, 2147483000, { voterEmail: 'x@test.example' }))).rejects.toThrow('Option not found');
  });

  it('enforces capacity, single-slot sign-ups and updates an existing sign-up', async () => {
    const { poll, options } = await makePoll('organization', { allowMultipleSlots: false }, [{ maxCapacity: 1 }, {}, {}]);
    const first = await storage.vote(vote(poll.id, options[0].id, { voterEmail: 'a@test.example', voterEditToken: 'tok-a' }));
    expect(first.response).toBe('yes');

    await expect(storage.vote(vote(poll.id, options[0].id, { voterEmail: 'b@test.example' }))).rejects.toThrow('SLOT_FULL');
    await expect(storage.vote(vote(poll.id, options[1].id, { voterEmail: 'a@test.example', voterEditToken: 'tok-a' }))).rejects.toThrow('ALREADY_SIGNED_UP');

    const cancelled = await storage.vote(vote(poll.id, options[0].id, { voterEmail: 'a@test.example', voterEditToken: 'tok-a', response: 'no', comment: 'Krank' }));
    expect(cancelled.id).toBe(first.id);
    expect(cancelled.response).toBe('no');
    expect(cancelled.comment).toBe('Krank');

    // Without the owner's token the existing sign-up cannot be touched.
    await expect(storage.vote(vote(poll.id, options[0].id, { voterEmail: 'a@test.example', response: 'no' }))).rejects.toThrow();
  });

});

describe('storage.vote – surveys and schedules', () => {
  it('blocks a second survey participation unless editing is allowed', async () => {
    const { poll, options } = await makePoll('survey');
    const first = await storage.vote(vote(poll.id, options[0].id, { voterEmail: 's@test.example', voterEditToken: 'tok-s' }));
    await expect(storage.vote(vote(poll.id, options[1].id, { voterEmail: 's@test.example' }))).rejects.toThrow('DUPLICATE_EMAIL_VOTE');

    const updated = await storage.vote(vote(poll.id, options[0].id, { voterEmail: 's@test.example', voterEditToken: 'tok-s', response: 'no' }), true);
    expect(updated.id).toBe(first.id);
    expect(updated.response).toBe('no');

    const added = await storage.vote(vote(poll.id, options[1].id, { voterEmail: 's@test.example', voterEditToken: 'tok-s' }), true);
    expect(added.id).not.toBe(first.id);
  });

  it('updates schedule votes per option and rejects duplicate emails from other voters', async () => {
    const { poll, options } = await makePoll('schedule');
    const user = await makeUser();
    const userVote = await storage.vote(vote(poll.id, options[0].id, { userId: user.id, voterEmail: user.email }));
    const changed = await storage.vote(vote(poll.id, options[0].id, { userId: user.id, voterEmail: user.email, response: 'maybe' }));
    expect(changed.id).toBe(userVote.id);
    expect(changed.response).toBe('maybe');

    const named = await storage.vote(vote(poll.id, options[1].id, { voterName: 'Nur Name', voterEmail: '' }));
    expect((await storage.getUserVoteForOption(undefined, options[1].id, 'Nur Name'))?.id).toBe(named.id);

    await expect(storage.vote(vote(poll.id, options[0].id, { userId: (await makeUser()).id, voterEmail: user.email }))).rejects.toThrow('DUPLICATE_EMAIL_VOTE');
    expect(await storage.getUserVoteForOption(undefined, options[2].id)).toBeUndefined();
  });

  it('reports whether a user has voted', async () => {
    const { poll, options } = await makePoll('survey');
    const user = await makeUser();
    expect(await storage.hasUserVoted(poll.id, user.id)).toBe(false);
    await storage.vote(vote(poll.id, options[0].id, { userId: user.id, voterEmail: user.email }));
    expect(await storage.hasUserVoted(poll.id, user.id)).toBe(true);
  });
});

describe('storage.voteBulk', () => {
  it('inserts once per voter key and reports repeated submissions', async () => {
    const { poll, options } = await makePoll('survey');
    const items = [{ optionId: options[0].id, response: 'yes' }, { optionId: options[1].id, response: 'no' }];
    const first = await storage.voteBulk(poll.id, 'Bulk', 'bulk@test.example', null, 'tok-b', items, 'device-key-1', 'device');
    expect(first.alreadyVoted).toBe(false);
    expect(first.votes).toHaveLength(2);
    expect(first.votes[0].voterSource).toBe('device');

    const again = await storage.voteBulk(poll.id, 'Bulk', 'bulk@test.example', null, 'tok-b', items, 'device-key-1');
    expect(again.alreadyVoted).toBe(true);
  });

  it('falls back to the email when no voter key is given', async () => {
    const { poll, options } = await makePoll('survey');
    const items = [{ optionId: options[2].id, response: 'yes' }];
    const first = await storage.voteBulk(poll.id, 'Mail', 'mail-bulk@test.example', null, null, items);
    expect(first.alreadyVoted).toBe(false);
    expect(first.votes[0].voterKey).toBeNull();
    const again = await storage.voteBulk(poll.id, 'Mail', 'mail-bulk@test.example', null, null, items);
    expect(again.alreadyVoted).toBe(true);
  });
});

describe('Participation and listing queries', () => {
  // Regression: getSharedPolls passed the id list to ANY() as a scalar and
  // left the owner filter's OR unparenthesised, so it crashed for any voter.
  it('lists participated and shared polls for a voter', async () => {
    const user = await makeUser();
    const owner = await makeUser();
    const { poll, options } = await makePoll('survey', { userId: owner.id });
    await storage.vote(vote(poll.id, options[0].id, { userId: user.id, voterEmail: user.email }));

    const participated = await storage.getUserParticipatedPolls(user.id);
    expect(participated.map((p) => p.id)).toContain(poll.id);
    expect(await storage.getUserParticipatedPolls(-1)).toEqual([]);
    expect(await storage.getUserParticipatedPolls(owner.id)).toEqual([]);

    const shared = await storage.getSharedPolls(user.id);
    const entry = shared.find((p) => p.id === poll.id);
    expect(entry?.options).toHaveLength(3);
    expect(entry?.votes).toHaveLength(1);
    expect(await storage.getSharedPolls(owner.id)).toEqual([]);
  });

  it('returns active polls including their creator', async () => {
    const owner = await makeUser();
    const { poll } = await makePoll('survey', { userId: owner.id, expiresAt: new Date(Date.now() + 24 * HOUR) });
    const active = await storage.getActivePolls();
    const found = active.find((p) => p.id === poll.id);
    expect(found?.user?.id).toBe(owner.id);
  });

  it('finds users by Keycloak id', async () => {
    const keycloakId = `kc-${randomBytes(6).toString('hex')}`;
    const user = await makeUser('user', { provider: 'keycloak', keycloakId });
    expect((await storage.getUserByKeycloakId(keycloakId))?.id).toBe(user.id);
    expect(await storage.getUserByKeycloakId('kc-unknown-id')).toBeUndefined();
  });
});

describe('Expiry, reminders and cleanup jobs', () => {
  it('collects distinct voter emails and deactivates expired polls', async () => {
    const { poll, options } = await makePoll('schedule');
    await storage.vote(vote(poll.id, options[0].id, { voterEmail: 'exp@test.example' }));
    await storage.vote(vote(poll.id, options[1].id, { voterEmail: 'exp@test.example', voterName: 'Other' }));
    await storage.vote(vote(poll.id, options[2].id, { voterName: 'No Mail', voterEmail: '' }));
    expect(await storage.getVoterEmailsForPoll(poll.id)).toEqual(['exp@test.example']);

    await db.update(pollsTable).set({ expiresAt: new Date(Date.now() - HOUR) }).where(eq(pollsTable.id, poll.id));
    const deactivated = await storage.deactivateExpiredPolls();
    expect(deactivated.map((p) => p.id)).toContain(poll.id);
    expect((await storage.getPoll(poll.id))?.isActive).toBe(false);
  });

  it('returns notification logs newest first', async () => {
    const { poll } = await makePoll('survey');
    await storage.logNotification({ pollId: poll.id, type: 'manual_reminder', recipientEmail: 'one@test.example' });
    await storage.logNotification({ pollId: poll.id, type: 'expiry_reminder', recipientEmail: 'two@test.example' });
    const logs = await storage.getNotificationLogs(poll.id);
    expect(logs).toHaveLength(2);
    expect(logs[0].createdAt.getTime()).toBeGreaterThanOrEqual(logs[1].createdAt.getTime());
  });

  it('deletes expired password reset and email change tokens only', async () => {
    const user = await makeUser();
    const fresh = await storage.createPasswordResetToken(user.id);
    const [stale] = await db.insert(passwordResetTokens)
      .values({ userId: user.id, token: randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() - HOUR) })
      .returning();
    await storage.deleteExpiredPasswordResetTokens();
    const remainingReset = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    expect(remainingReset.map((t) => t.token)).toEqual([fresh.token]);
    expect(remainingReset.map((t) => t.id)).not.toContain(stale.id);

    const freshChange = await storage.createEmailChangeToken(user.id, `chg-${user.id}@test.example`);
    await db.insert(emailChangeTokens)
      .values({ userId: user.id, newEmail: 'old@test.example', token: randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() - HOUR) });
    await storage.deleteExpiredEmailChangeTokens();
    const remainingChange = await db.select().from(emailChangeTokens).where(eq(emailChangeTokens.userId, user.id));
    expect(remainingChange.map((t) => t.token)).toEqual([freshChange.token]);
  });
});

describe('Admin activity feed and ClamAV bookkeeping', () => {
  it('describes recent polls, votes and notifications of real data', async () => {
    const owner = await makeUser();
    const created = await Promise.all([
      makePoll('schedule', { isTestData: false, userId: owner.id }),
      makePoll('organization', { isTestData: false }),
      makePoll('survey', { isTestData: false }),
    ]);
    const [schedule] = created;
    await storage.vote(vote(schedule.poll.id, schedule.options[0].id, { voterName: 'Feed Voter', voterEmail: 'feed@test.example' }));
    for (const type of ['manual_reminder', 'auto_expired_poll_ended', 'expiry_reminder']) {
      await storage.logNotification({ pollId: schedule.poll.id, type, recipientEmail: 'feed@test.example', sentBy: type === 'manual_reminder' ? 'Owner' : null });
    }

    const stats = await storage.getExtendedStats();
    const messages = stats.recentActivity.map((a) => a.message);
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('Neue Terminumfrage erstellt'),
      expect.stringContaining('Neue Orga erstellt'),
      expect.stringContaining('Neue Umfrage erstellt'),
      'Neue Abstimmung abgegeben',
      expect.stringContaining('Erinnerung versendet'),
      expect.stringContaining('automatisch beendet'),
      'Benachrichtigung versendet',
    ]));
    const reminder = stats.recentActivity.find((a) => a.message.startsWith('Erinnerung'));
    expect(reminder?.actor).toBe('Owner');
    const system = stats.recentActivity.find((a) => a.message === 'Benachrichtigung versendet');
    expect(system?.actor).toBe('System');
    const timestamps = stats.recentActivity.map((a) => new Date(a.timestamp).getTime());
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('marks a ClamAV scan log as notified', async () => {
    const log = await storage.createClamavScanLog({
      filename: 'eicar.txt',
      fileSize: 68,
      scanStatus: 'infected',
      virusName: 'Eicar-Test-Signature',
      actionTaken: 'blocked',
    } as any);
    try {
      expect(log.adminNotifiedAt).toBeNull();
      const updated = await storage.markClamavScanNotified(log.id);
      expect(updated.adminNotifiedAt).toBeInstanceOf(Date);
    } finally {
      await db.delete(clamavScanLogs).where(eq(clamavScanLogs.id, log.id));
    }
  });
});
