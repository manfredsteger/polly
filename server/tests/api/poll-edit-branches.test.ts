/**
 * Scenario tests for poll editing, finalizing, option management and reminder
 * branches in server/routes/polls.ts that the happy-path suites never reach:
 * reminder-hour capping, video-URL validation, reactivation guards,
 * per-type end-of-poll notifications, org confirmation, option deletion
 * guards, reminder limits/cooldowns and the 500 handlers of every route.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Umfrage-Bearbeitung (Randfälle)',
  description: 'Prüft Bearbeiten, Finalisieren, Optionen und Erinnerungen inkl. Fehlerpfade',
  severity: 'high' as const,
};

const HOUR = 60 * 60 * 1000;
const future = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

let app: Express;
let admin: TestAgent;
let member: CreatedTestUser;

interface CreatedPoll {
  id: string;
  adminToken: string;
  publicToken: string;
  options: Array<{ id: number; text: string }>;
}

async function createPoll(agent: TestAgent | null, body: Record<string, unknown>): Promise<CreatedPoll> {
  const client = agent ?? request(app);
  const res = await client.post('/api/v1/polls').send(body);
  if (res.status !== 200) {
    throw new Error(`Poll creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.poll.id,
    adminToken: res.body.adminToken,
    publicToken: res.body.publicToken,
    options: res.body.poll.options,
  };
}

const surveyBody = (extra: Record<string, unknown> = {}) => ({
  title: 'Edge Survey',
  type: 'survey',
  options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
  ...extra,
});

const scheduleBody = (extra: Record<string, unknown> = {}) => ({
  title: 'Edge Schedule',
  type: 'schedule',
  options: [
    { text: 'Slot 1', startTime: future(48), endTime: future(49) },
    { text: 'Slot 2', startTime: future(72), endTime: future(73) },
    { text: 'Slot 3', startTime: future(96) },
  ],
  ...extra,
});

const orgBody = (extra: Record<string, unknown> = {}) => ({
  title: 'Edge Orga',
  type: 'organization',
  options: [
    { text: 'Kuchen', maxCapacity: 3 },
    { text: 'Getränke', maxCapacity: 2 },
    { text: 'Aufbau', maxCapacity: 2 },
  ],
  ...extra,
});

async function addVote(pollId: string, optionId: number, email: string, response = 'yes') {
  await storage.createVote({
    pollId,
    optionId,
    voterName: email.split('@')[0],
    voterEmail: email,
    response,
    isTestData: true,
  } as any);
}

beforeAll(async () => {
  app = await createTestApp();
  admin = await loginAdminAgent(app);
  member = await createLoggedInUser(app);
});

afterAll(async () => {
  await storage.deleteUser(member.id).catch(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /polls – creation edge branches', () => {
  it('rejects a logged-in session whose user no longer exists', async () => {
    vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    const res = await member.agent.post('/api/v1/polls').send(surveyBody());
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid session');
  });

  it('ignores a foreign creatorEmail from an authenticated user', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await member.agent.post('/api/v1/polls').send(surveyBody({ creatorEmail: 'someone-else@test.example' }));
    expect(res.status).toBe(200);
    expect(res.body.poll.creatorEmail).toBe(member.email);
    expect(warn).toHaveBeenCalled();
  });

  it('asks guests to log in when their email belongs to an account', async () => {
    const res = await request(app).post('/api/v1/polls').send(surveyBody({ creatorEmail: member.email.toUpperCase() }));
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('REQUIRES_LOGIN');
  });

  it('disables the expiry reminder for polls that expire in under 6 hours', async () => {
    const res = await admin.post('/api/v1/polls').send(surveyBody({
      expiresAt: future(3),
      enableExpiryReminder: true,
      expiryReminderHours: 24,
    }));
    expect(res.status).toBe(200);
    expect(res.body.poll.enableExpiryReminder).toBe(false);
  });

  it('caps the reminder lead time at half of the remaining poll duration', async () => {
    const res = await admin.post('/api/v1/polls').send(surveyBody({
      expiresAt: future(10),
      enableExpiryReminder: true,
      expiryReminderHours: 48,
    }));
    expect(res.status).toBe(200);
    expect(res.body.poll.enableExpiryReminder).toBe(true);
    expect(res.body.poll.expiryReminderHours).toBeLessThanOrEqual(5);
    expect(res.body.poll.expiryReminderHours).toBeGreaterThanOrEqual(4);
  });

  it('maps an invalid video conference URL to INVALID_VIDEO_URL', async () => {
    const res = await admin.post('/api/v1/polls').send(scheduleBody({ videoConferenceUrl: 'not a url' }));
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_VIDEO_URL');
  });

  it('maps an end time before the start time to INVALID_TIME_RANGE', async () => {
    const res = await admin.post('/api/v1/polls').send({
      title: 'Bad range',
      type: 'schedule',
      options: [
        { text: 'x', startTime: future(50), endTime: future(49) },
        { text: 'y', startTime: future(60), endTime: future(61) },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_TIME_RANGE');
  });

  it('maps a past schedule slot to INVALID_PAST_TIME_SLOT', async () => {
    const res = await admin.post('/api/v1/polls').send({
      title: 'Past slot',
      type: 'schedule',
      options: [
        { text: 'x', startTime: new Date(Date.now() - 48 * HOUR).toISOString() },
        { text: 'y', startTime: future(60) },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_PAST_TIME_SLOT');
  });

  it('returns 500 when the database rejects the poll', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'createPoll').mockRejectedValueOnce(new Error('db down'));
    const res = await admin.post('/api/v1/polls').send(surveyBody());
    expect(res.status).toBe(500);
  });
});

describe('GET poll views – owner and failure branches', () => {
  it('returns the full poll to its owner on the public route', async () => {
    const poll = await createPoll(admin, surveyBody());
    const res = await admin.get(`/api/v1/polls/public/${poll.publicToken}`);
    expect(res.status).toBe(200);
    expect(res.body.adminToken).toBe(poll.adminToken);
  });

  it.each([
    ['public', (p: CreatedPoll) => `/api/v1/polls/public/${p.publicToken}`, 'getPollByPublicToken'],
    ['admin', (p: CreatedPoll) => `/api/v1/polls/admin/${p.adminToken}`, 'getPollByAdminToken'],
    ['vote-count', (p: CreatedPoll) => `/api/v1/polls/admin/${p.adminToken}/vote-count`, 'getPollByAdminToken'],
    ['results', (p: CreatedPoll) => `/api/v1/polls/${p.adminToken}/results`, 'getPollByAdminToken'],
    ['reminder-status', (p: CreatedPoll) => `/api/v1/polls/${p.adminToken}/reminder-status`, 'getPollByAdminToken'],
  ] as const)('returns 500 on %s when storage fails', async (_name, url, method) => {
    const poll = await createPoll(admin, surveyBody());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, method as any).mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get(url(poll));
    expect(res.status).toBe(500);
  });

  it('returns 500 on my-polls and shared-polls when storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUserPolls').mockRejectedValueOnce(new Error('db down'));
    expect((await member.agent.get('/api/v1/polls/my-polls')).status).toBe(500);
    vi.spyOn(storage, 'getUserParticipations').mockRejectedValueOnce(new Error('db down'));
    expect((await member.agent.get('/api/v1/polls/shared-polls')).status).toBe(500);
  });

  it('returns 404 on shared-polls when the session user vanished', async () => {
    vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    const res = await member.agent.get('/api/v1/polls/shared-polls');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /polls/admin/:token – editing branches', () => {
  it('rejects non-HTTP, overlong and malformed video URLs and clears an empty one', async () => {
    const poll = await createPoll(admin, scheduleBody({ videoConferenceUrl: 'https://meet.example.com/a' }));
    const url = `/api/v1/polls/admin/${poll.adminToken}`;

    const ftp = await request(app).patch(url).send({ videoConferenceUrl: 'ftp://files.example.com/x' });
    expect(ftp.status).toBe(400);
    expect(ftp.body.errorCode).toBe('INVALID_VIDEO_URL');

    const long = await request(app).patch(url).send({ videoConferenceUrl: `https://example.com/${'a'.repeat(2100)}` });
    expect(long.status).toBe(400);
    expect(long.body.error).toMatch(/zu lang/);

    const bad = await request(app).patch(url).send({ videoConferenceUrl: 'nope nope' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Ungültige URL');

    const cleared = await request(app).patch(url).send({ videoConferenceUrl: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.videoConferenceUrl).toBeNull();
  });

  it('turns the reminder off when the expiry is removed or too close', async () => {
    const poll = await createPoll(admin, surveyBody({ expiresAt: future(72), enableExpiryReminder: true }));
    const url = `/api/v1/polls/admin/${poll.adminToken}`;

    const removed = await request(app).patch(url).send({ expiresAt: null });
    expect(removed.status).toBe(200);
    expect(removed.body.expiresAt).toBeNull();
    expect(removed.body.enableExpiryReminder).toBe(false);

    const soon = await request(app).patch(url).send({ expiresAt: future(2), enableExpiryReminder: true });
    expect(soon.status).toBe(200);
    expect(soon.body.enableExpiryReminder).toBe(false);
  });

  it('caps the reminder hours when a new expiry is closer than the lead time', async () => {
    const poll = await createPoll(admin, surveyBody());
    const res = await request(app)
      .patch(`/api/v1/polls/admin/${poll.adminToken}`)
      .send({ expiresAt: future(12), enableExpiryReminder: true, expiryReminderHours: 48 });
    expect(res.status).toBe(200);
    expect(res.body.enableExpiryReminder).toBe(true);
    expect(res.body.expiryReminderHours).toBeLessThanOrEqual(6);
  });

  it('keeps the stored reminder settings when only the expiry changes', async () => {
    const poll = await createPoll(admin, surveyBody({ expiresAt: future(200), enableExpiryReminder: true, expiryReminderHours: 12 }));
    const res = await request(app)
      .patch(`/api/v1/polls/admin/${poll.adminToken}`)
      .send({ expiresAt: future(300) });
    expect(res.status).toBe(200);
    expect(res.body.enableExpiryReminder).toBe(true);
    expect(res.body.expiryReminderHours).toBe(12);
  });

  it('updates reminder settings without touching the expiry', async () => {
    const poll = await createPoll(admin, surveyBody({ expiresAt: future(200) }));
    const res = await request(app)
      .patch(`/api/v1/polls/admin/${poll.adminToken}`)
      .send({ enableExpiryReminder: true, expiryReminderHours: 8, allowMaybe: false, allowMultipleSlots: true, notifyCreatorOnVote: false, allowVoteWithdrawal: true });
    expect(res.status).toBe(200);
    expect(res.body.enableExpiryReminder).toBe(true);
    expect(res.body.expiryReminderHours).toBe(8);
  });

  it('refuses to reactivate a poll whose expiry is in the past', async () => {
    const poll = await createPoll(admin, surveyBody());
    await storage.updatePoll(poll.id, { isActive: false, expiresAt: new Date(Date.now() - HOUR) } as any);
    const res = await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: true });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('POLL_EXPIRES_AT_PAST');
  });

  it('refuses to reactivate a schedule poll whose slots are all in the past', async () => {
    const poll = await createPoll(admin, scheduleBody());
    const past = new Date(Date.now() - 24 * HOUR);
    await storage.updatePollOption(poll.options[0].id, { startTime: past, endTime: new Date(past.getTime() + HOUR) } as any);
    await storage.updatePollOption(poll.options[1].id, { startTime: past, endTime: null } as any);
    await storage.updatePollOption(poll.options[2].id, { startTime: null, endTime: null } as any);
    await storage.updatePoll(poll.id, { isActive: false } as any);

    const res = await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: true });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('NO_FUTURE_OPTIONS');
  });

  it('reactivates a schedule poll with a future start-only slot', async () => {
    const poll = await createPoll(admin, scheduleBody());
    const past = new Date(Date.now() - 24 * HOUR);
    await storage.updatePollOption(poll.options[0].id, { startTime: past, endTime: new Date(past.getTime() + HOUR) } as any);
    await storage.updatePollOption(poll.options[1].id, { startTime: past, endTime: null } as any);
    await storage.updatePoll(poll.id, { isActive: false } as any);

    const res = await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it('rejects an update that contains no recognised fields', async () => {
    const poll = await createPoll(admin, surveyBody());
    const res = await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ unknown: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 500 when the update fails', async () => {
    const poll = await createPoll(admin, surveyBody());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'updatePoll').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ title: 'x' });
    expect(res.status).toBe(500);
  });

  describe('ending a poll with participant notification', () => {
    it('sends finalization mails with the closing message for a confirmed schedule slot', async () => {
      const poll = await createPoll(admin, scheduleBody({ videoConferenceUrl: 'https://meet.example.com/z' }));
      await addVote(poll.id, poll.options[0].id, 'sched-a@test.example');
      await addVote(poll.id, poll.options[2].id, 'sched-b@test.example');
      await storage.updatePoll(poll.id, { finalOptionId: poll.options[2].id } as any);
      const spy = vi.spyOn(emailService, 'sendFinalizationEmails').mockResolvedValue({ sent: 3, failed: 0 });

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true, closingMessage: 'Danke!' });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(spy).toHaveBeenCalled());
      const [recipients, , slot, , ics, videoUrl, message] = spy.mock.calls[0];
      expect(recipients).toEqual(expect.arrayContaining(['sched-a@test.example', 'sched-b@test.example']));
      expect(slot.endTime).toBeNull();
      expect(Buffer.isBuffer(ics)).toBe(true);
      expect(videoUrl).toBe('https://meet.example.com/z');
      expect(message).toBe('Danke!');
      const stored = await storage.getPoll(poll.id);
      expect(stored?.closingMessage).toBe('Danke!');
    });

    it('sends a generic poll-ended mail for an unconfirmed schedule poll', async () => {
      const poll = await createPoll(admin, scheduleBody());
      await addVote(poll.id, poll.options[0].id, 'sched-c@test.example');
      const spy = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue({ sent: 1, failed: 0 });

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true, resultsPublic: false });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][3]).toBe(false);
      expect(spy.mock.calls[0][4]).toBe('survey');
    });

    it('sends a slot summary for organization polls', async () => {
      const poll = await createPoll(admin, orgBody());
      await addVote(poll.id, poll.options[0].id, 'org-a@test.example');
      await addVote(poll.id, poll.options[0].id, 'org-b@test.example');
      await addVote(poll.id, poll.options[1].id, 'org-c@test.example', 'no');
      const spy = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue({ sent: 3, failed: 0 });

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][4]).toBe('organization');
      const summary = spy.mock.calls[0][6] as Array<{ text: string; filled: number; total: number | null }>;
      expect(summary.find((s) => s.text === 'Kuchen')?.filled).toBe(2);
      expect(summary.find((s) => s.text === 'Getränke')?.filled).toBe(0);
    });

    it('names the winning option for a finalized survey', async () => {
      const poll = await createPoll(admin, surveyBody());
      await addVote(poll.id, poll.options[1].id, 'survey-a@test.example');
      await storage.updatePoll(poll.id, { finalOptionId: poll.options[1].id } as any);
      const spy = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue({ sent: 1, failed: 0 });

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][5]).toBe('B');
    });

    it('still answers 200 when the notification mail fails', async () => {
      const poll = await createPoll(null, surveyBody({ creatorEmail: `guest-${Date.now()}@test.example` }));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(emailService, 'sendPollEndedEmails').mockRejectedValue(new Error('smtp down'));

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(err).toHaveBeenCalledWith('Error sending poll-ended emails:', expect.any(Error)));
    });
  });
});

describe('POST /polls/admin/:token/finalize – branches', () => {
  it('confirms org sign-ups, closes the poll and mails the account owner as organizer', async () => {
    const poll = await createPoll(admin, orgBody());
    await addVote(poll.id, poll.options[0].id, 'org-final@test.example');
    const spy = vi.spyOn(emailService, 'sendOrgConfirmationEmails').mockResolvedValue({ sent: 2, failed: 0 });

    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: 0, orgFinalize: true, closePoll: true, notifyParticipants: true });
    expect(res.status).toBe(200);
    expect(res.body.poll.finalOptionId).toBe(-1);
    expect(res.body.poll.isActive).toBe(false);
    expect(res.body.emailResult).toEqual({ sent: 2, failed: 0 });
    expect(spy.mock.calls[0][4]).toEqual(expect.stringContaining('@'));
  });

  it('keeps org confirmation successful when mailing fails', async () => {
    const poll = await createPoll(admin, orgBody());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendOrgConfirmationEmails').mockRejectedValue(new Error('smtp down'));
    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: 0, orgFinalize: true, notifyParticipants: true });
    expect(res.status).toBe(200);
    expect(res.body.emailResult).toBeUndefined();
  });

  it('uses the guest creator email when the organizer has no account', async () => {
    const creatorEmail = `org-guest-${Date.now()}@test.example`;
    const poll = await createPoll(null, orgBody({ creatorEmail }));
    const spy = vi.spyOn(emailService, 'sendOrgConfirmationEmails').mockResolvedValue({ sent: 0, failed: 0 });
    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: 0, orgFinalize: true, notifyParticipants: true });
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][4]).toBe(creatorEmail);
  });

  it('reopens an org poll when the confirmation is undone', async () => {
    const poll = await createPoll(admin, orgBody());
    await storage.updatePoll(poll.id, { finalOptionId: -1, isActive: false } as any);
    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: 0 });
    expect(res.status).toBe(200);
    expect(res.body.poll.isActive).toBe(true);
    expect(res.body.poll.finalOptionId).toBeNull();
  });

  it('rejects unknown options and finalizing without votes', async () => {
    const poll = await createPoll(admin, surveyBody());
    const unknown = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: 999999999 });
    expect(unknown.status).toBe(400);

    const noVotes = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: poll.options[0].id });
    expect(noVotes.status).toBe(400);
    expect(noVotes.body.errorCode).toBe('NO_VOTES_TO_FINALIZE');
  });

  it('closes a schedule poll and mails the confirmed slot with calendar file', async () => {
    const poll = await createPoll(null, scheduleBody({ creatorEmail: `sched-guest-${Date.now()}@test.example` }));
    await addVote(poll.id, poll.options[2].id, 'fin-a@test.example');
    const spy = vi.spyOn(emailService, 'sendFinalizationEmails').mockResolvedValue({ sent: 2, failed: 0 });

    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: poll.options[2].id, closePoll: true, notifyParticipants: true });
    expect(res.status).toBe(200);
    expect(res.body.poll.isActive).toBe(false);
    expect(res.body.emailResult).toEqual({ sent: 2, failed: 0 });
    expect(spy.mock.calls[0][0]).toHaveLength(2);
    expect(spy.mock.calls[0][2].endTime).toBeNull();
  });

  it('mails the winning option for a survey and survives mail failures', async () => {
    const poll = await createPoll(admin, surveyBody());
    await addVote(poll.id, poll.options[0].id, 'fin-s@test.example');
    const spy = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValueOnce({ sent: 1, failed: 0 });

    const ok = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: poll.options[0].id, notifyParticipants: true });
    expect(ok.status).toBe(200);
    expect(spy.mock.calls[0][5]).toBe('A');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    spy.mockRejectedValueOnce(new Error('smtp down'));
    const failed = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: poll.options[0].id, notifyParticipants: true });
    expect(failed.status).toBe(200);
    expect(failed.body.emailResult).toBeUndefined();
  });

  it('skips mailing when no participant has a valid address', async () => {
    const poll = await createPoll(null, surveyBody());
    await addVote(poll.id, poll.options[0].id, 'no-at-sign');
    const spy = vi.spyOn(emailService, 'sendPollEndedEmails');
    const res = await request(app)
      .post(`/api/v1/polls/admin/${poll.adminToken}/finalize`)
      .send({ optionId: poll.options[0].id, notifyParticipants: true });
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 500 when the poll cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getPollByAdminToken').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/v1/polls/admin/whatever/finalize').send({ optionId: 0 });
    expect(res.status).toBe(500);
  });
});

describe('Option management branches', () => {
  it('adds a start-time-only option and rejects inverted ranges', async () => {
    const poll = await createPoll(admin, scheduleBody());
    const url = `/api/v1/polls/admin/${poll.adminToken}/options`;

    const startOnly = await request(app).post(url).send({ startTime: future(120) });
    expect(startOnly.status).toBe(201);
    expect(startOnly.body.text).toBe('');

    const inverted = await request(app).post(url).send({ text: 'x', startTime: future(130), endTime: future(129) });
    expect(inverted.status).toBe(400);
    expect(inverted.body.errorCode).toBe('INVALID_TIME_RANGE');
  });

  it('validates option updates against the stored times and applies every field', async () => {
    const poll = await createPoll(admin, scheduleBody());
    const opt = poll.options[0];
    const url = `/api/v1/polls/admin/${poll.adminToken}/options`;

    const missing = await request(app).patch(`${url}/999999999`).send({ text: 'x' });
    expect(missing.status).toBe(404);

    const inverted = await request(app).patch(`${url}/${opt.id}`).send({ endTime: future(1) });
    expect(inverted.status).toBe(400);
    expect(inverted.body.errorCode).toBe('INVALID_TIME_RANGE');

    const updated = await request(app).patch(`${url}/${opt.id}`).send({
      text: 'Neu',
      startTime: future(200),
      endTime: null,
      maxCapacity: 4,
      imageUrl: null,
      altText: 'Alt',
      order: 5,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.text).toBe('Neu');
    expect(updated.body.endTime).toBeNull();
    expect(updated.body.altText).toBe('Alt');

    const cleared = await request(app).patch(`${url}/${opt.id}`).send({ startTime: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.startTime).toBeNull();
  });

  it('returns 500 when adding or updating options fails', async () => {
    const poll = await createPoll(admin, surveyBody());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'addPollOption').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post(`/api/v1/polls/admin/${poll.adminToken}/options`).send({ text: 'x' })).status).toBe(500);
    vi.spyOn(storage, 'updatePollOption').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}/options/${poll.options[0].id}`).send({ text: 'x' })).status).toBe(500);
    vi.spyOn(storage, 'deletePollOption').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).delete(`/api/v1/polls/admin/${poll.adminToken}/options/${poll.options[0].id}`)).status).toBe(500);
  });

  it('protects org options with sign-ups unless a system admin forces deletion', async () => {
    const poll = await createPoll(admin, orgBody());
    const opt = poll.options[0];
    await addVote(poll.id, opt.id, 'signup@test.example');
    const url = `/api/v1/polls/admin/${poll.adminToken}/options/${opt.id}`;

    const blocked = await request(app).delete(url);
    expect(blocked.status).toBe(409);
    expect(blocked.body.errorCode).toBe('OPTION_HAS_SIGNUPS');

    const anonymousForce = await request(app).delete(`${url}?adminForce=true`);
    expect(anonymousForce.status).toBe(403);
    expect(anonymousForce.body.errorCode).toBe('ADMIN_REQUIRED');

    const memberForce = await member.agent.delete(url).send({ adminForce: true });
    expect(memberForce.status).toBe(403);

    const adminForce = await admin.delete(url).send({ adminForce: true });
    expect(adminForce.status).toBe(200);
  });

  it('deletes an org option without sign-ups directly', async () => {
    const poll = await createPoll(admin, orgBody());
    const res = await request(app).delete(`/api/v1/polls/admin/${poll.adminToken}/options/${poll.options[2].id}`);
    expect(res.status).toBe(200);
  });

  it('requires confirmation before deleting a survey option with votes', async () => {
    const poll = await createPoll(admin, surveyBody());
    await addVote(poll.id, poll.options[0].id, 'voted@test.example');
    const url = `/api/v1/polls/admin/${poll.adminToken}/options/${poll.options[0].id}`;

    const blocked = await request(app).delete(url);
    expect(blocked.status).toBe(409);
    expect(blocked.body.voteCount).toBe(1);

    const confirmed = await request(app).delete(url).send({ confirmed: true });
    expect(confirmed.status).toBe(200);
  });
});

describe('Invitations and manual reminders', () => {
  it('reports missing SMTP for both invitation routes and uses the owner name', async () => {
    const poll = await createPoll(admin, surveyBody());
    const spy = vi.spyOn(emailService, 'sendBulkInvitations').mockResolvedValue({ sent: 0, failed: [], smtpConfigured: false });

    const modern = await request(app).post(`/api/v1/polls/admin/${poll.adminToken}/invite`).send({ emails: ['a@test.example'] });
    expect(modern.status).toBe(503);
    expect(modern.body.code).toBe('SMTP_NOT_CONFIGURED');

    const legacy = await request(app).post(`/api/v1/polls/${poll.adminToken}/invite`).send({ emails: ['a@test.example'] });
    expect(legacy.status).toBe(503);
    expect(spy.mock.calls[0][2]).not.toBe('');
  });

  it('returns 404/400 for invalid legacy invitations and the sent count on success', async () => {
    const poll = await createPoll(admin, surveyBody());
    expect((await request(app).post('/api/v1/polls/unknown-token/invite').send({ emails: ['a@test.example'] })).status).toBe(404);
    expect((await request(app).post(`/api/v1/polls/${poll.adminToken}/invite`).send({ emails: [] })).status).toBe(400);
    vi.spyOn(emailService, 'sendBulkInvitations').mockResolvedValue({ sent: 2, failed: ['x@test.example'], smtpConfigured: true });
    const ok = await request(app).post(`/api/v1/polls/${poll.adminToken}/invite`).send({ emails: ['a@test.example', 'x@test.example'] });
    expect(ok.status).toBe(200);
    expect(ok.body.sent).toBe(2);
    expect(ok.body.failed).toBe(1);
  });

  it('returns 500 when sending invitations throws', async () => {
    const poll = await createPoll(admin, surveyBody());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendBulkInvitations').mockRejectedValue(new Error('smtp down'));
    expect((await request(app).post(`/api/v1/polls/admin/${poll.adminToken}/invite`).send({ emails: ['a@test.example'] })).status).toBe(500);
    expect((await request(app).post(`/api/v1/polls/${poll.adminToken}/invite`).send({ emails: ['a@test.example'] })).status).toBe(500);
  });

  it('enforces the manual reminder limit and cooldown on /remind', async () => {
    const poll = await createPoll(admin, surveyBody({ expiresAt: future(100) }));
    const url = `/api/v1/polls/admin/${poll.adminToken}/remind`;

    vi.spyOn(storage, 'getManualReminderCount').mockResolvedValueOnce(3);
    const limit = await request(app).post(url).send({ emails: ['r@test.example'] });
    expect(limit.status).toBe(429);
    expect(limit.body.errorCode).toBe('REMINDER_LIMIT_REACHED');

    vi.spyOn(storage, 'getLastManualReminderTime').mockResolvedValueOnce(new Date(Date.now() - HOUR));
    const soon = await request(app).post(url).send({ emails: ['r@test.example'] });
    expect(soon.status).toBe(429);
    expect(soon.body.errorCode).toBe('REMINDER_TOO_SOON');
    expect(soon.body.waitMinutes).toBeGreaterThan(0);

    vi.spyOn(storage, 'getLastManualReminderTime').mockResolvedValueOnce(new Date(Date.now() - 5 * HOUR));
    const spy = vi.spyOn(emailService, 'sendBulkReminders').mockResolvedValue({ sent: 1, failed: [] });
    const ok = await request(app).post(url).send({ emails: ['r@test.example'], customMessage: 'Bitte abstimmen' });
    expect(ok.status).toBe(200);
    expect(ok.body.remainingReminders).toBe(2);
    expect(spy.mock.calls[0][4]).toMatch(/^\d{4}-/);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getManualReminderCount').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post(url).send({ emails: ['r@test.example'] })).status).toBe(500);
  });
});

describe('POST /polls/:id/send-reminder – authorization and limits', () => {
  it('lets a system admin remind participants of a poll they do not own', async () => {
    const poll = await createPoll(member.agent, surveyBody({ expiresAt: future(100) }));
    await addVote(poll.id, poll.options[0].id, 'Remind-Me@test.example');
    await addVote(poll.id, poll.options[1].id, 'remind-me@test.example', 'no');
    const spy = vi.spyOn(emailService, 'sendPersonalizedReminders').mockResolvedValue({ sent: 1, failed: [] });

    const res = await admin.post(`/api/v1/polls/${poll.id}/send-reminder`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(res.body.total).toBe(1);
    const reminders = spy.mock.calls[0][0] as Array<{ email: string; selectedOptions?: string[] }>;
    expect(reminders[0]).toEqual({ email: 'remind-me@test.example', selectedOptions: ['A'] });
  });

  it('rejects other logged-in users without the admin token', async () => {
    const poll = await createPoll(admin, surveyBody());
    const res = await member.agent.post(`/api/v1/polls/${poll.id}/send-reminder`).send({});
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('NOT_AUTHORIZED');
  });

  it('applies the configured limit and cooldown', async () => {
    const poll = await createPoll(admin, surveyBody());
    await addVote(poll.id, poll.options[0].id, 'limit@test.example');
    const url = `/api/v1/polls/${poll.id}/send-reminder`;

    vi.spyOn(storage, 'getManualReminderCount').mockResolvedValueOnce(99);
    const limit = await admin.post(url).send({});
    expect(limit.status).toBe(429);
    expect(limit.body.errorCode).toBe('REMINDER_LIMIT_REACHED');

    vi.spyOn(storage, 'getLastManualReminderTime').mockResolvedValueOnce(new Date(Date.now() - 60 * 1000));
    const soon = await admin.post(url).send({});
    expect(soon.status).toBe(429);
    expect(soon.body.errorCode).toBe('REMINDER_TOO_SOON');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getNotificationSettings').mockRejectedValueOnce(new Error('db down'));
    const failed = await admin.post(url).send({});
    expect(failed.status).toBe(500);
  });

  it('accepts a guest with the poll admin token and skips the sender name', async () => {
    const poll = await createPoll(null, surveyBody());
    await addVote(poll.id, poll.options[0].id, 'guest-r@test.example');
    vi.spyOn(storage, 'getManualReminderCount').mockResolvedValueOnce(0);
    const spy = vi.spyOn(emailService, 'sendPersonalizedReminders').mockResolvedValue({ sent: 0, failed: ['guest-r@test.example'] });
    const res = await request(app).post(`/api/v1/polls/${poll.id}/send-reminder`).send({ adminToken: poll.adminToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(spy.mock.calls[0][2]).toBe('');
    expect(spy.mock.calls[0][4]).toBeUndefined();
  });
});

describe('GET /polls/:token/reminder-status – reasons', () => {
  const baseSettings = {
    enabled: true,
    expiryRemindersEnabled: true,
    manualRemindersEnabled: true,
    defaultExpiryReminderHours: 24,
    guestsCanSendReminders: true,
    guestReminderLimitPerPoll: 1,
    userReminderLimitPerPoll: 3,
    reminderCooldownMinutes: 60,
  };

  it.each([
    ['disabled system-wide', { ...baseSettings, enabled: false }, 0, null, /systemweit/],
    ['guests not allowed', { ...baseSettings, guestsCanSendReminders: false }, 0, null, /Gäste/],
    ['limit reached', baseSettings, 5, null, /Maximale Anzahl/],
    ['cooldown running', baseSettings, 0, new Date(Date.now() - 5 * 60 * 1000), /warten/],
  ] as const)('explains why reminders are blocked: %s', async (_name, settings, count, last, reason) => {
    const poll = await createPoll(null, surveyBody());
    vi.spyOn(storage, 'getNotificationSettings').mockResolvedValueOnce(settings as any);
    vi.spyOn(storage, 'getManualReminderCount').mockResolvedValueOnce(count);
    vi.spyOn(storage, 'getLastManualReminderTime').mockResolvedValueOnce(last as any);
    const res = await request(app).get(`/api/v1/polls/${poll.adminToken}/reminder-status`);
    expect(res.status).toBe(200);
    expect(res.body.canSendReminder).toBe(false);
    expect(res.body.reason).toMatch(reason);
    expect(res.body.isGuest).toBe(true);
  });

  it('allows reminders after the cooldown for the owner', async () => {
    const poll = await createPoll(admin, surveyBody());
    vi.spyOn(storage, 'getLastManualReminderTime').mockResolvedValueOnce(new Date(Date.now() - 48 * HOUR));
    const res = await admin.get(`/api/v1/polls/${poll.adminToken}/reminder-status`);
    expect(res.status).toBe(200);
    expect(res.body.isGuest).toBe(false);
    expect(res.body.canSendReminder).toBe(true);
    expect(res.body.reason).toBe('');
  });
});
