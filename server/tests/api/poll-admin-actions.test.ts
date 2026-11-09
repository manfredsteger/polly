import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Umfrage-Verwaltung (Admin-Link)',
  description: 'Szenario-Tests für Bearbeiten, Beenden, Reaktivieren, Optionen, Einladungen und Erinnerungen über den Admin-Link',
  severity: 'high' as const,
};

let app: Express;
let adminAgent: TestAgent;
let owner: CreatedTestUser;
let stranger: CreatedTestUser;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

async function createPoll(agent: TestAgent | ReturnType<typeof request>, body: Record<string, unknown>) {
  const res = await (agent as any).post('/api/v1/polls').send(body);
  expect(res.status).toBe(200);
  return res.body as { poll: any; publicToken: string; adminToken: string };
}

async function vote(publicToken: string, name: string, email: string, votes: Array<{ optionId: number; response: string }>) {
  const res = await request(app).post(`/api/v1/polls/${publicToken}/vote-bulk`).send({ voterName: name, voterEmail: email, votes });
  expect(res.status).toBe(200);
}

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@guest.example`;

describe('Poll administration via admin token', () => {
  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = await loginAdminAgent(app);
    owner = await createLoggedInUser(app, { name: 'Poll Owner' });
    stranger = await createLoggedInUser(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    for (const u of [owner, stranger]) await storage.deleteUser(u.id).catch(() => {});
  });

  describe('PATCH /polls/admin/:token', () => {
    it('validates video conference URLs for schedule polls only', async () => {
      const schedule = await createPoll(owner.agent, {
        title: 'Video URL poll',
        type: 'schedule',
        options: [
          { text: 'A', startTime: hoursFromNow(48), endTime: hoursFromNow(49) },
          { text: 'B', startTime: hoursFromNow(72), endTime: hoursFromNow(73) },
        ],
      });
      const url = `/api/v1/polls/admin/${schedule.adminToken}`;
      expect((await request(app).patch(url).send({ videoConferenceUrl: 'not a url' })).body.errorCode).toBe('INVALID_VIDEO_URL');
      expect((await request(app).patch(url).send({ videoConferenceUrl: 'ftp://files.example/meeting' })).body.errorCode).toBe('INVALID_VIDEO_URL');
      expect((await request(app).patch(url).send({ videoConferenceUrl: `https://meet.example/${'a'.repeat(2001)}` })).body.errorCode).toBe('INVALID_VIDEO_URL');

      const ok = await request(app).patch(url).send({ videoConferenceUrl: 'https://meet.example/room' });
      expect(ok.status).toBe(200);
      expect(ok.body.videoConferenceUrl).toBe('https://meet.example/room');
      const cleared = await request(app).patch(url).send({ videoConferenceUrl: '' });
      expect(cleared.body.videoConferenceUrl).toBeNull();

      const survey = await createPoll(owner.agent, { title: 'Survey', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const ignored = await request(app).patch(`/api/v1/polls/admin/${survey.adminToken}`).send({ videoConferenceUrl: 'https://meet.example/x' });
      // Only the URL was sent and it is ignored for surveys, so there is nothing to update.
      expect(ignored.status).toBe(400);
    });

    it('re-validates the expiry reminder when the expiry date changes', async () => {
      const poll = await createPoll(owner.agent, { title: 'Expiry poll', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const url = `/api/v1/polls/admin/${poll.adminToken}`;

      const soon = await request(app).patch(url).send({ expiresAt: hoursFromNow(3), enableExpiryReminder: true, expiryReminderHours: 2 });
      expect(soon.body.enableExpiryReminder).toBe(false);

      const capped = await request(app).patch(url).send({ expiresAt: hoursFromNow(48), enableExpiryReminder: true, expiryReminderHours: 72 });
      expect(capped.body.enableExpiryReminder).toBe(true);
      expect(capped.body.expiryReminderHours).toBe(23);

      const cleared = await request(app).patch(url).send({ expiresAt: null });
      expect(cleared.body.expiresAt).toBeNull();
      expect(cleared.body.enableExpiryReminder).toBe(false);

      const toggled = await request(app).patch(url).send({ enableExpiryReminder: true, expiryReminderHours: 12 });
      expect(toggled.body.enableExpiryReminder).toBe(true);
      expect(toggled.body.expiryReminderHours).toBe(12);

      expect((await request(app).patch(url).send({})).status).toBe(400);
      expect((await request(app).patch('/api/v1/polls/admin/unknown-token').send({ title: 'x' })).status).toBe(404);
    });

    it('refuses to reactivate polls whose expiry or dates are in the past', async () => {
      const expired = await createPoll(owner.agent, { title: 'Expired', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      await storage.updatePoll(expired.poll.id, { isActive: false, expiresAt: new Date(Date.now() - 3600_000) } as any);
      const res = await request(app).patch(`/api/v1/polls/admin/${expired.adminToken}`).send({ isActive: true });
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('POLL_EXPIRES_AT_PAST');

      const schedule = await createPoll(owner.agent, {
        title: 'Past dates',
        type: 'schedule',
        options: [
          { text: 'A', startTime: hoursFromNow(24), endTime: hoursFromNow(25) },
          { text: 'B', startTime: hoursFromNow(26), endTime: hoursFromNow(27) },
        ],
      });
      for (const opt of schedule.poll.options) {
        const patched = await request(app)
          .patch(`/api/v1/polls/admin/${schedule.adminToken}/options/${opt.id}`)
          .send({ startTime: hoursFromNow(-48), endTime: hoursFromNow(-47) });
        expect(patched.status).toBe(200);
      }
      await storage.updatePoll(schedule.poll.id, { isActive: false } as any);
      const reactivate = await request(app).patch(`/api/v1/polls/admin/${schedule.adminToken}`).send({ isActive: true });
      expect(reactivate.body.errorCode).toBe('NO_FUTURE_OPTIONS');
    });

    it('notifies survey participants and the creator when a poll is closed', async () => {
      const poll = await createPoll(owner.agent, { title: 'Closing survey', type: 'survey', options: [{ text: 'Pizza' }, { text: 'Pasta' }] });
      const voterEmail = uniqueEmail('closing');
      await vote(poll.publicToken, 'Closer', voterEmail, [{ optionId: poll.poll.options[0].id, response: 'yes' }]);
      await storage.updatePoll(poll.poll.id, { finalOptionId: poll.poll.options[0].id } as any);
      const ended = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch(`/api/v1/polls/admin/${poll.adminToken}`)
        .send({ isActive: false, notifyParticipants: true, closingMessage: 'Danke!' });
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(ended).toHaveBeenCalledTimes(1));
      const [recipients, , , resultsPublic, type, finalText, , closing] = ended.mock.calls[0];
      expect(recipients).toEqual(expect.arrayContaining([voterEmail, owner.email]));
      expect(resultsPublic).toBe(true);
      expect(type).toBe('survey');
      expect(finalText).toBe('Pizza');
      expect(closing).toBe('Danke!');
      await vi.waitFor(async () => expect((await storage.getPoll(poll.poll.id))?.closingMessage).toBe('Danke!'));
    });

    it('sends a slot summary when an organization list is closed', async () => {
      const poll = await createPoll(owner.agent, {
        title: 'Closing orga',
        type: 'organization',
        options: [{ text: 'Aufbau', maxCapacity: 3 }, { text: 'Abbau', maxCapacity: 2 }],
      });
      await vote(poll.publicToken, 'Helper', uniqueEmail('helper'), [{ optionId: poll.poll.options[0].id, response: 'yes' }]);
      const ended = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue(undefined as any);

      await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: false, notifyParticipants: true, resultsPublic: false });
      await vi.waitFor(() => expect(ended).toHaveBeenCalledTimes(1));
      expect(ended.mock.calls[0][3]).toBe(false);
      expect(ended.mock.calls[0][4]).toBe('organization');
      expect(ended.mock.calls[0][6]).toEqual([
        { text: 'Aufbau', filled: 1, total: 3 },
        { text: 'Abbau', filled: 0, total: 2 },
      ]);
    });

    it('sends finalization mails with an ICS invite for confirmed schedule polls, generic mails otherwise', async () => {
      const poll = await createPoll(owner.agent, {
        title: 'Closing schedule',
        type: 'schedule',
        options: [
          { text: 'Mo', startTime: hoursFromNow(30), endTime: hoursFromNow(31) },
          { text: 'Di', startTime: hoursFromNow(54), endTime: hoursFromNow(55) },
        ],
      });
      await vote(poll.publicToken, 'Scheduler', uniqueEmail('sched'), [{ optionId: poll.poll.options[1].id, response: 'yes' }]);

      const ended = vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue(undefined as any);
      const finalized = vi.spyOn(emailService, 'sendFinalizationEmails').mockResolvedValue(undefined as any);
      await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: false, notifyParticipants: true });
      await vi.waitFor(() => expect(ended).toHaveBeenCalledTimes(1));
      expect(finalized).not.toHaveBeenCalled();

      await storage.updatePoll(poll.poll.id, { isActive: true, finalOptionId: poll.poll.options[1].id } as any);
      await request(app).patch(`/api/v1/polls/admin/${poll.adminToken}`).send({ isActive: false, notifyParticipants: true });
      await vi.waitFor(() => expect(finalized).toHaveBeenCalledTimes(1));
      const [, , slot, , ics] = finalized.mock.calls[0];
      expect(slot.text).toBe('Di');
      expect((ics as Buffer).toString('utf-8')).toContain('BEGIN:VEVENT');
    });
  });

  describe('option management', () => {
    it('adds, updates and deletes options with validation', async () => {
      const poll = await createPoll(owner.agent, { title: 'Options', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const base = `/api/v1/polls/admin/${poll.adminToken}/options`;

      expect((await request(app).post(base).send({})).status).toBe(400);
      const badRange = await request(app).post(base).send({ text: 'C', startTime: hoursFromNow(5), endTime: hoursFromNow(4) });
      expect(badRange.body.errorCode).toBe('INVALID_TIME_RANGE');
      expect((await request(app).post('/api/v1/polls/admin/unknown/options').send({ text: 'x' })).status).toBe(404);

      const added = await request(app).post(base).send({ text: 'C', order: 2, altText: 'alt' });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ text: 'C', altText: 'alt' });

      const updated = await request(app).patch(`${base}/${added.body.id}`).send({ text: 'C2', maxCapacity: 4, imageUrl: null, order: 5 });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ text: 'C2', maxCapacity: 4, order: 5 });
      const badUpdate = await request(app).patch(`${base}/${added.body.id}`).send({ startTime: hoursFromNow(3), endTime: hoursFromNow(2) });
      expect(badUpdate.body.errorCode).toBe('INVALID_TIME_RANGE');
      expect((await request(app).patch(`${base}/999999999`).send({ text: 'x' })).status).toBe(404);
      expect((await request(app).patch(`/api/v1/polls/admin/unknown/options/1`).send({ text: 'x' })).status).toBe(404);

      await vote(poll.publicToken, 'Voter', uniqueEmail('opt'), [{ optionId: added.body.id, response: 'yes' }]);
      const needsConfirm = await request(app).delete(`${base}/${added.body.id}`);
      expect(needsConfirm.status).toBe(409);
      expect(needsConfirm.body).toMatchObject({ errorCode: 'OPTION_HAS_VOTES', voteCount: 1 });
      expect((await request(app).delete(`${base}/${added.body.id}?confirmed=true`)).body.success).toBe(true);

      const minimum = await request(app).delete(`${base}/${poll.poll.options[0].id}`);
      expect(minimum.status).toBe(400);
      expect((await request(app).delete(`${base}/999999999`)).status).toBe(404);
      expect((await request(app).delete('/api/v1/polls/admin/unknown/options/1')).status).toBe(404);
    });

    it('only lets system admins force-delete organization slots with sign-ups', async () => {
      const poll = await createPoll(owner.agent, {
        title: 'Orga options',
        type: 'organization',
        options: [{ text: 'A', maxCapacity: 2 }, { text: 'B', maxCapacity: 2 }, { text: 'C', maxCapacity: 2 }],
      });
      const optionId = poll.poll.options[0].id;
      await vote(poll.publicToken, 'Helper', uniqueEmail('orgaopt'), [{ optionId, response: 'yes' }]);
      const url = `/api/v1/polls/admin/${poll.adminToken}/options/${optionId}`;

      const blocked = await request(app).delete(url);
      expect(blocked.status).toBe(409);
      expect(blocked.body).toMatchObject({ errorCode: 'OPTION_HAS_SIGNUPS', signupCount: 1 });

      const notAdmin = await owner.agent.delete(`${url}?adminForce=true`);
      expect(notAdmin.status).toBe(403);
      expect(notAdmin.body.errorCode).toBe('ADMIN_REQUIRED');

      const forced = await adminAgent.delete(url).send({ adminForce: true });
      expect(forced.status).toBe(200);
    });
  });

  describe('invitations and reminders', () => {
    it('sends invitations through both routes and reports missing SMTP', async () => {
      const poll = await createPoll(owner.agent, { title: 'Invite poll', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      for (const path of [`/api/v1/polls/admin/${poll.adminToken}/invite`, `/api/v1/polls/${poll.adminToken}/invite`]) {
        expect((await request(app).post(path).send({ emails: [] })).status).toBe(400);
        const unavailable = await request(app).post(path).send({ emails: ['a@guest.example'] });
        expect(unavailable.status).toBe(503);
        expect(unavailable.body.code).toBe('SMTP_NOT_CONFIGURED');
      }
      expect((await request(app).post('/api/v1/polls/admin/unknown/invite').send({ emails: ['a@b.c'] })).status).toBe(404);
      expect((await request(app).post('/api/v1/polls/unknown/invite').send({ emails: ['a@b.c'] })).status).toBe(404);

      const send = vi.spyOn(emailService, 'sendBulkInvitations').mockResolvedValue({ sent: 1, failed: ['bad@guest.example'], smtpConfigured: true });
      const legacy = await request(app).post(`/api/v1/polls/${poll.adminToken}/invite`).send({ emails: ['a@guest.example', 'bad@guest.example'], customMessage: 'Hi' });
      expect(legacy.body).toMatchObject({ success: true, sent: 1, failed: 1 });
      expect(send.mock.calls[0][2]).toBe('Poll Owner');
      const modern = await request(app).post(`/api/v1/polls/admin/${poll.adminToken}/invite`).send({ emails: ['a@guest.example'] });
      expect(modern.body.success).toBe(true);
    });

    it.each([
      'not-a-uuid',
      '123',
      '00000000-0000-4000-8000-00000000000g',
      '00000000-0000-4000-8000-000000000000-extra',
    ])('rejects malformed reminder poll ID %s before accessing storage', async (id) => {
      const getPoll = vi.spyOn(storage, 'getPoll');
      const send = vi.spyOn(emailService, 'sendPersonalizedReminders');
      const res = await request(app).post(`/api/v1/polls/${id}/send-reminder`).send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid poll ID' });
      expect(getPoll).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('enforces the manual reminder cooldown', async () => {
      const poll = await createPoll(owner.agent, { title: 'Remind poll', type: 'survey', expiresAt: hoursFromNow(100), options: [{ text: 'A' }, { text: 'B' }] });
      const url = `/api/v1/polls/admin/${poll.adminToken}/remind`;
      const send = vi.spyOn(emailService, 'sendBulkReminders').mockResolvedValue({ sent: 1, failed: [] } as any);

      expect((await request(app).post(url).send({})).status).toBe(400);
      expect((await request(app).post('/api/v1/polls/admin/unknown/remind').send({ emails: ['a@b.c'] })).status).toBe(404);
      const first = await request(app).post(url).send({ emails: ['r@guest.example'] });
      expect(first.status).toBe(200);
      expect(first.body.remainingReminders).toBe(2);
      expect(send.mock.calls[0][4]).toBe(new Date(poll.poll.expiresAt).toISOString());

      const second = await request(app).post(url).send({ emails: ['r@guest.example'] });
      expect(second.status).toBe(429);
      expect(second.body.errorCode).toBe('REMINDER_TOO_SOON');

      const status = await owner.agent.get(`/api/v1/polls/${poll.adminToken}/reminder-status`);
      expect(status.status).toBe(200);
      expect(status.body.remindersSent).toBe(1);
      expect(status.body.canSendReminder).toBe(false);
      expect(status.body.isGuest).toBe(false);
    });

    it('stops manual reminders after three', async () => {
      const poll = await createPoll(owner.agent, { title: 'Limit poll', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      for (let i = 0; i < 3; i++) {
        await storage.logNotification({ pollId: poll.poll.id, type: 'manual_reminder', recipientEmail: `x${i}@guest.example` } as any);
      }
      const res = await request(app).post(`/api/v1/polls/admin/${poll.adminToken}/remind`).send({ emails: ['r@guest.example'] });
      expect(res.status).toBe(429);
      expect(res.body.errorCode).toBe('REMINDER_LIMIT_REACHED');
    });

    it('sends personalised participant reminders only for authorised callers', async () => {
      const poll = await createPoll(owner.agent, { title: 'Participant reminders', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const url = `/api/v1/polls/${poll.poll.id}/send-reminder`;
      expect((await request(app).post('/api/v1/polls/00000000-0000-4000-8000-000000000000/send-reminder').send({})).status).toBe(404);
      expect((await stranger.agent.post(url).send({})).status).toBe(403);
      expect((await request(app).post(url).send({ adminToken: 'wrong' })).status).toBe(403);

      const empty = await owner.agent.post(url).send({});
      expect(empty.status).toBe(400);
      expect(empty.body.errorCode).toBe('NO_PARTICIPANTS');

      const voterA = uniqueEmail('remA');
      await vote(poll.publicToken, 'A', voterA, [{ optionId: poll.poll.options[0].id, response: 'yes' }]);
      await vote(poll.publicToken, 'B', uniqueEmail('remB'), [{ optionId: poll.poll.options[1].id, response: 'maybe' }]);
      const send = vi.spyOn(emailService, 'sendPersonalizedReminders').mockImplementation(async (items: any[]) => ({ sent: items.length - 1, failed: [items[1].email] }) as any);

      const res = await request(app).post(url).send({ adminToken: poll.adminToken });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, sent: 1, total: 2 });
      const items = send.mock.calls[0][0] as any[];
      expect(items.find((i) => i.email === voterA.toLowerCase())).toBeTruthy();

      const tooSoon = await adminAgent.post(url).send({});
      expect(tooSoon.status).toBe(429);
    });

    it('reports reminder status for guest polls', async () => {
      const poll = await createPoll(request(app), { title: 'Guest poll', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const res = await request(app).get(`/api/v1/polls/${poll.adminToken}/reminder-status`);
      expect(res.status).toBe(200);
      expect(res.body.isGuest).toBe(true);
      expect(typeof res.body.canSendReminder).toBe('boolean');
      expect((await request(app).get('/api/v1/polls/unknown/reminder-status')).status).toBe(404);
    });
  });

  describe('listing and results', () => {
    it('lists own and shared polls for logged-in users only', async () => {
      expect((await request(app).get('/api/v1/polls/my-polls')).status).toBe(401);
      expect((await request(app).get('/api/v1/polls/shared-polls')).status).toBe(401);

      const mine = await owner.agent.get('/api/v1/polls/my-polls');
      expect(mine.status).toBe(200);
      expect(mine.body.some((p: any) => p.title === 'Options')).toBe(true);

      const someone = await createPoll(adminAgent, { title: 'Shared with stranger', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const sv = await stranger.agent.post(`/api/v1/polls/${someone.publicToken}/vote-bulk`).send({
        voterName: 'Stranger',
        voterEmail: stranger.email,
        votes: [{ optionId: someone.poll.options[0].id, response: 'yes' }],
      });
      expect(sv.status).toBe(200);
      const shared = await stranger.agent.get('/api/v1/polls/shared-polls');
      expect(shared.status).toBe(200);
      expect(shared.body.some((p: any) => p.poll.title === 'Shared with stranger')).toBe(true);
    });

    it('counts votes and voters for the admin view', async () => {
      const poll = await createPoll(owner.agent, { title: 'Count poll', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const email = uniqueEmail('count');
      await vote(poll.publicToken, 'C', email, [
        { optionId: poll.poll.options[0].id, response: 'yes' },
        { optionId: poll.poll.options[1].id, response: 'no' },
      ]);
      const res = await request(app).get(`/api/v1/polls/admin/${poll.adminToken}/vote-count`);
      expect(res.body).toEqual({ totalVotes: 2, uniqueVoters: 1 });
      expect((await request(app).get('/api/v1/polls/admin/unknown/vote-count')).status).toBe(404);
    });

    it('serves private results only to the creator or via the admin token', async () => {
      const poll = await createPoll(owner.agent, { title: 'Private results', type: 'survey', resultsPublic: false, options: [{ text: 'A' }, { text: 'B' }] });
      expect((await request(app).get(`/api/v1/polls/${poll.publicToken}/results`)).status).toBe(403);
      expect((await stranger.agent.get(`/api/v1/polls/${poll.publicToken}/results`)).status).toBe(403);
      const creator = await owner.agent.get(`/api/v1/polls/${poll.publicToken}/results`);
      expect(creator.status).toBe(200);
      expect(creator.body.poll.user).toMatchObject({ name: 'Poll Owner' });
      expect((await request(app).get(`/api/v1/polls/${poll.adminToken}/results`)).status).toBe(200);
      expect((await request(app).get('/api/v1/polls/unknown/results')).status).toBe(404);

      const publicPoll = await createPoll(owner.agent, { title: 'Public results', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const pub = await request(app).get(`/api/v1/polls/${publicPoll.publicToken}/results`);
      expect(pub.status).toBe(200);
      expect(pub.body.poll).not.toHaveProperty('adminToken');
      expect(pub.body.stats).toHaveLength(2);
    });
  });
});
