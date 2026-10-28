import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { getSubmittedVoteToken } from '../fixtures/voteToken';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Exporte & Stimmverwaltung',
  description: 'Szenario-Tests für QR/PDF/CSV/ICS-Export, Kalender-Abo sowie Bearbeiten, Zurückziehen und Nachschlagen von Stimmen',
  severity: 'high' as const,
};

let app: Express;
let adminAgent: TestAgent;
let voterUser: CreatedTestUser;

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

async function createPoll(agent: TestAgent, body: Record<string, unknown>) {
  const res = await agent.post('/api/v1/polls').send(body);
  expect(res.status).toBe(200);
  return res.body as { poll: any; publicToken: string; adminToken: string };
}

async function guestVote(publicToken: string, voterName: string, voterEmail: string, votes: Array<{ optionId: number; response: string }>) {
  const res = await request(app).post(`/api/v1/polls/${publicToken}/vote-bulk`).send({ voterName, voterEmail, votes });
  expect(res.status).toBe(200);
  return res;
}

describe('Exports and vote management', () => {
  let schedule: { poll: any; publicToken: string; adminToken: string };
  let optionIds: number[];
  let guestEditToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = await loginAdminAgent(app);
    voterUser = await createLoggedInUser(app, { languagePreference: 'en' });

    schedule = await createPoll(adminAgent, {
      title: 'Export Ümlaut "Quote" Poll',
      type: 'schedule',
      resultsPublic: false,
      allowVoteEdit: true,
      allowVoteWithdrawal: true,
      options: [
        { text: 'Slot A', startTime: inDays(10, 9), endTime: inDays(10, 10) },
        { text: 'Slot B', startTime: inDays(11, 14), endTime: inDays(11, 15) },
      ],
    });
    optionIds = schedule.poll.options.map((o: any) => o.id);

    const first = await guestVote(schedule.publicToken, 'Guest "One"', `guest-one-${Date.now()}@guest.example`, [
      { optionId: optionIds[0], response: 'yes' },
      { optionId: optionIds[1], response: 'maybe' },
    ]);
    guestEditToken = await getSubmittedVoteToken(first);
    await guestVote(schedule.publicToken, 'Guest Two', `guest-two-${Date.now()}@guest.example`, [
      { optionId: optionIds[0], response: 'no' },
    ]);
    const userVote = await voterUser.agent.post(`/api/v1/polls/${schedule.publicToken}/vote-bulk`).send({
      voterName: 'Account Voter',
      voterEmail: voterUser.email,
      votes: [{ optionId: optionIds[1], response: 'yes' }],
    });
    expect(userVote.status).toBe(200);
    expect(userVote.body.voterEditToken).toBeTruthy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await storage.deleteUser(voterUser.id).catch(() => {});
  });

  describe('QR codes', () => {
    it('returns PNG and SVG data URLs for the public link', async () => {
      const png = await request(app).get(`/api/v1/polls/${schedule.publicToken}/qr`);
      expect(png.status).toBe(200);
      expect(png.body.format).toBe('png');
      expect(png.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(png.body.pollUrl).toContain(`/poll/${schedule.publicToken}`);

      const svg = await request(app).get(`/api/v1/polls/${schedule.publicToken}/qr?format=svg`);
      expect(svg.body.format).toBe('svg');
    });

    it('downloads QR files with a sanitised filename', async () => {
      const png = await request(app).get(`/api/v1/polls/${schedule.publicToken}/qr/download`).buffer(true);
      expect(png.status).toBe(200);
      expect(png.headers['content-type']).toBe('image/png');
      // Non-ASCII characters are replaced in the plain filename and kept in filename*.
      expect(png.headers['content-disposition']).toContain('filename="QR_Export__mlaut__Quote__Poll.png"');
      expect(png.headers['content-disposition']).toContain("filename*=UTF-8''QR_Export_%C3%9Cmlaut__Quote__Poll.png");

      const svg = await request(app).get(`/api/v1/polls/${schedule.publicToken}/qr/download?format=svg`).buffer(true);
      expect(svg.headers['content-type']).toContain('image/svg+xml');
    });

    it('returns 404 for unknown polls', async () => {
      expect((await request(app).get('/api/v1/polls/nope-token/qr')).status).toBe(404);
      expect((await request(app).get('/api/v1/polls/nope-token/qr/download')).status).toBe(404);
    });
  });

  describe('result exports respect private results', () => {
    it.each(['pdf', 'csv', 'ics'])('blocks anonymous %s export via the public token', async (kind) => {
      const res = await request(app).get(`/api/v1/polls/${schedule.publicToken}/export/${kind}`);
      expect(res.status).toBe(403);
      expect(res.body.resultsPrivate).toBe(true);
    });

    it.each(['pdf', 'csv', 'ics'])('returns 404 for unknown polls (%s)', async (kind) => {
      expect((await request(app).get(`/api/v1/polls/unknown-token/export/${kind}`)).status).toBe(404);
    });

    it('allows the creator to export via the public token', async () => {
      const res = await adminAgent.get(`/api/v1/polls/${schedule.publicToken}/export/csv`);
      expect(res.status).toBe(200);
    });

    it('generates a PDF via the admin token, optionally with participants', async () => {
      const res = await request(app)
        .get(`/api/v1/polls/${schedule.adminToken}/export/pdf?includeParticipants=1`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });

    it('builds a German CSV matrix with dates, quoting and totals', async () => {
      const res = await request(app).get(`/api/v1/polls/${schedule.adminToken}/export/csv`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const text: string = res.text;
      expect(text.charCodeAt(0)).toBe(0xfeff);
      const lines = text.slice(1).trim().split('\n');
      expect(lines[0].split(';')).toHaveLength(3); // date row
      expect(lines[1]).toBe('"Teilnehmer";"Slot A";"Slot B"');
      expect(lines).toContain('"Guest ""One""";"Ja";"Vielleicht"');
      expect(lines).toContain('"Guest Two";"Nein";');
      expect(lines).toContain('"Account Voter";;"Ja"');
      expect(lines[lines.length - 1]).toBe('"Gesamt";1;2');
    });

    it('uses English labels with lang=en', async () => {
      const res = await request(app).get(`/api/v1/polls/${schedule.adminToken}/export/csv?lang=en`);
      expect(res.text).toContain('"Participant";"Slot A";"Slot B"');
      expect(res.text).toContain('"Maybe"');
      expect(res.text).toContain('"Total";1;2');
    });

    it('exports schedule options as ICS events', async () => {
      const res = await request(app).get(`/api/v1/polls/${schedule.adminToken}/export/ics?lang=en`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects ICS export for polls without dated options in both languages', async () => {
      const survey = await createPoll(adminAgent, {
        title: 'No dates survey',
        type: 'survey',
        options: [{ text: 'A' }, { text: 'B' }],
      });
      const de = await request(app).get(`/api/v1/polls/${survey.adminToken}/export/ics`);
      expect(de.status).toBe(400);
      expect(de.body.error).toContain('Keine exportierbaren Termine');
      const en = await request(app).get(`/api/v1/polls/${survey.publicToken}/export/ics?lang=en`);
      expect(en.status).toBe(400);
      expect(en.body.error).toContain('No exportable calendar events');
    });
  });

  describe('calendar subscription', () => {
    it('requires authentication', async () => {
      expect((await request(app).get('/api/v1/calendar/token')).status).toBe(401);
      expect((await request(app).post('/api/v1/calendar/token/regenerate')).status).toBe(401);
    });

    it('creates a stable token, regenerates it and serves the personal feed', async () => {
      const first = await voterUser.agent.get('/api/v1/calendar/token');
      expect(first.status).toBe(200);
      expect(first.body.calendarToken).toMatch(/^[a-f0-9]{64}$/);
      expect(first.body.webcalUrl).toMatch(/^webcal:\/\//);
      expect(first.body.httpsUrl).toContain(`/calendar/${first.body.calendarToken}/feed.ics`);

      const again = await voterUser.agent.get('/api/v1/calendar/token');
      expect(again.body.calendarToken).toBe(first.body.calendarToken);

      const regenerated = await voterUser.agent.post('/api/v1/calendar/token/regenerate');
      expect(regenerated.status).toBe(200);
      expect(regenerated.body.calendarToken).not.toBe(first.body.calendarToken);

      const stale = await request(app).get(`/api/v1/calendar/${first.body.calendarToken}/feed.ics`);
      expect(stale.status).toBe(404);

      const feed = await request(app).get(`/api/v1/calendar/${regenerated.body.calendarToken}/feed.ics`);
      expect(feed.status).toBe(200);
      expect(feed.headers['content-type']).toContain('text/calendar');
      expect(feed.headers['cache-control']).toContain('no-store');
      expect(feed.text).toContain('BEGIN:VCALENDAR');
      expect(feed.text).toContain('Slot B');
    });
  });

  describe('vote lookup helpers', () => {
    it('reports votes by email', async () => {
      const missing = await request(app).post(`/api/v1/polls/${schedule.publicToken}/votes-by-email`).send({});
      expect(missing.status).toBe(400);

      const none = await request(app).post(`/api/v1/polls/${schedule.publicToken}/votes-by-email`).send({ email: 'nobody@guest.example' });
      expect(none.body).toEqual({ hasVoted: false, votes: [] });

      const found = await request(app).post(`/api/v1/polls/${schedule.publicToken}/votes-by-email`).send({ email: `  ${voterUser.email.toUpperCase()} ` });
      expect(found.body.hasVoted).toBe(true);
      expect(found.body.votes[0]).toMatchObject({ optionId: optionIds[1], response: 'yes' });
      expect(found.body.votes[0]).not.toHaveProperty('voterEditToken');

      expect((await request(app).post('/api/v1/polls/unknown/votes-by-email').send({ email: 'a@b.c' })).status).toBe(404);
    });

    it('issues a device token to new anonymous visitors', async () => {
      const res = await request(app).get(`/api/v1/polls/${schedule.publicToken}/my-votes`);
      expect(res.status).toBe(200);
      expect(res.body.hasVoted).toBe(false);
      expect(res.body.voterSource).toBe('device');
      expect(String(res.headers['set-cookie'])).toContain('deviceToken=');
      expect((await request(app).get('/api/v1/polls/unknown/my-votes')).status).toBe(404);
    });

    it('returns the edit token only to the authenticated owner', async () => {
      const res = await voterUser.agent.get(`/api/v1/polls/${schedule.publicToken}/my-votes`);
      expect(res.status).toBe(200);
      expect(res.body.hasVoted).toBe(true);
      expect(res.body.voterSource).toBe('user');
      expect(res.body.votes[0].voterEditToken).toBeTruthy();
    });

    it('resend-email validates input and reports missing SMTP', async () => {
      const base = `/api/v1/polls/${schedule.publicToken}/resend-email`;
      expect((await request(app).post('/api/v1/polls/unknown/resend-email').send({ email: 'a@b.c' })).status).toBe(404);
      expect((await request(app).post(base).send({})).status).toBe(400);
      expect((await request(app).post(base).send({ email: 'nobody@guest.example' })).status).toBe(404);

      vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(false);
      const unavailable = await request(app).post(base).send({ email: voterUser.email });
      expect(unavailable.status).toBe(503);
    });

    it('resend-email sends the confirmation, and maps spam rejections', async () => {
      const base = `/api/v1/polls/${schedule.publicToken}/resend-email`;
      vi.spyOn(emailService, 'smtpConfigured', 'get').mockReturnValue(true);
      const send = vi.spyOn(emailService, 'sendVotingConfirmationEmail').mockResolvedValue(undefined as any);
      const ok = await request(app).post(base).send({ email: voterUser.email });
      expect(ok.status).toBe(200);
      expect(ok.body.success).toBe(true);
      const editLink = send.mock.calls[0][7];
      expect(editLink).toMatch(/\/edit\//);

      send.mockRejectedValueOnce(new Error('550 Spam message rejected'));
      const spam = await request(app).post(base).send({ email: voterUser.email });
      expect(spam.body.errorCode).toBe('EMAIL_BLOCKED_BY_SPAM_FILTER');

      send.mockRejectedValueOnce(new Error('connection refused'));
      const failed = await request(app).post(base).send({ email: voterUser.email });
      expect(failed.status).toBe(500);
    });
  });

  describe('editing via the private edit link', () => {
    it('shows only the voter\'s own data', async () => {
      const res = await request(app).get(`/api/v1/votes/edit/${guestEditToken}`);
      expect(res.status).toBe(200);
      expect(res.body.voterName).toBe('Guest "One"');
      expect(res.body.poll.options).toHaveLength(2);
      expect(res.body.poll).not.toHaveProperty('adminToken');
      expect(res.body.votes.every((v: any) => v.voterName === 'Guest "One"')).toBe(true);
      expect((await request(app).get('/api/v1/votes/edit/unknown-token')).status).toBe(404);
    });

    it('updates responses and notifies the voter', async () => {
      const notify = vi.spyOn(emailService, 'sendVoteUpdatedEmail').mockResolvedValue(undefined as any);
      const res = await request(app)
        .put(`/api/v1/votes/edit/${guestEditToken}`)
        .send({ votes: [{ optionId: optionIds[1], response: 'no' }] });
      expect(res.status).toBe(200);
      expect(res.body.votes).toHaveLength(1);
      expect(res.body.votes[0].response).toBe('no');
      expect(notify).toHaveBeenCalledTimes(1);
      // Unchanged answers are included in the summary mail.
      expect(notify.mock.calls[0][6]).toHaveLength(2);
    });

    it('rejects invalid payloads, unknown tokens and foreign options', async () => {
      expect((await request(app).put(`/api/v1/votes/edit/${guestEditToken}`).send({ votes: 'x' })).status).toBe(400);
      expect((await request(app).put('/api/v1/votes/edit/unknown-token').send({ votes: [{ optionId: optionIds[0], response: 'yes' }] })).status).toBe(404);
      const foreign = await request(app).put(`/api/v1/votes/edit/${guestEditToken}`).send({ votes: [{ optionId: 999999999, response: 'yes' }] });
      expect(foreign.status).toBe(400);
    });

    it('rejects edits on closed polls and polls without edit permission', async () => {
      const locked = await createPoll(adminAgent, {
        title: 'Locked survey',
        type: 'survey',
        allowVoteEdit: false,
        allowVoteWithdrawal: false,
        options: [{ text: 'A' }, { text: 'B' }],
      });
      const optionId = locked.poll.options[0].id;
      const lockedEmail = `locked-${Date.now()}@guest.example`;
      const vote = await guestVote(locked.publicToken, 'Locked Voter', lockedEmail, [{ optionId, response: 'yes' }]);
      const token = await getSubmittedVoteToken(vote);

      const edit = await request(app).put(`/api/v1/votes/edit/${token}`).send({ votes: [{ optionId, response: 'no' }] });
      expect(edit.status).toBe(403);
      expect(edit.body.errorCode).toBe('VOTE_EDIT_NOT_ALLOWED');

      const withdraw = await request(app).delete(`/api/v1/votes/edit/${token}`);
      expect(withdraw.status).toBe(403);
      expect(withdraw.body.errorCode).toBe('WITHDRAWAL_NOT_ALLOWED');

      const again = await request(app).post(`/api/v1/polls/${locked.publicToken}/vote-bulk`).send({
        voterName: 'Locked Voter',
        voterEmail: lockedEmail,
        voterEditToken: token,
        votes: [{ optionId, response: 'no' }],
      });
      expect(again.status).toBe(400);
      expect(again.body.errorCode).toBe('ALREADY_VOTED');
    });

    it('rejects edits and withdrawals once the poll is inactive', async () => {
      const closing = await createPoll(adminAgent, {
        title: 'Closing survey',
        type: 'survey',
        allowVoteEdit: true,
        allowVoteWithdrawal: true,
        options: [{ text: 'A' }, { text: 'B' }],
      });
      const optionId = closing.poll.options[0].id;
      const vote = await guestVote(closing.publicToken, 'Closing Voter', `closing-${Date.now()}@guest.example`, [{ optionId, response: 'yes' }]);
      const token = await getSubmittedVoteToken(vote);
      await storage.updatePoll(closing.poll.id, { isActive: false } as any);

      const edit = await request(app).put(`/api/v1/votes/edit/${token}`).send({ votes: [{ optionId, response: 'no' }] });
      expect(edit.body.errorCode).toBe('POLL_INACTIVE');
      const withdraw = await request(app).delete(`/api/v1/votes/edit/${token}`);
      expect(withdraw.body.errorCode).toBe('POLL_INACTIVE');
      const withdrawDirect = await request(app).delete(`/api/v1/polls/${closing.publicToken}/vote`).send({ voterEditToken: token });
      expect(withdrawDirect.body.errorCode).toBe('POLL_INACTIVE');
      const voteAgain = await request(app).post(`/api/v1/polls/${closing.publicToken}/vote-bulk`).send({ voterName: 'X', voterEmail: 'x@guest.example', votes: [{ optionId, response: 'yes' }] });
      expect(voteAgain.body.errorCode).toBe('POLL_INACTIVE');
    });

    it('withdraws organization sign-ups via the edit link', async () => {
      const orga = await createPoll(adminAgent, {
        title: 'Orga withdrawal',
        type: 'organization',
        allowVoteWithdrawal: true,
        options: [{ text: 'Aufbau', maxCapacity: 2 }, { text: 'Abbau', maxCapacity: 2 }],
      });
      const optionId = orga.poll.options[0].id;
      const vote = await guestVote(orga.publicToken, 'Helper', `helper-${Date.now()}@guest.example`, [{ optionId, response: 'yes' }]);
      const token = await getSubmittedVoteToken(vote);

      const res = await request(app).delete(`/api/v1/votes/edit/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.withdrawnCount).toBe(1);
      expect((await request(app).delete(`/api/v1/votes/edit/${token}`)).status).toBe(404);
    });
  });

  describe('DELETE /polls/:token/vote', () => {
    it('requires authorization and validates the token', async () => {
      const base = `/api/v1/polls/${schedule.publicToken}/vote`;
      expect((await request(app).delete('/api/v1/polls/unknown/vote')).status).toBe(404);
      expect((await request(app).delete(base).send({})).status).toBe(403);
      expect((await request(app).delete(base).send({ voterEditToken: 123 })).status).toBe(400);
      const none = await request(app).delete(base).send({ voterEditToken: 'not-a-real-token' });
      expect(none.status).toBe(404);
      expect(none.body.errorCode).toBe('NO_VOTES_FOUND');
    });

    it('withdraws the logged-in user\'s own votes', async () => {
      const res = await voterUser.agent.delete(`/api/v1/polls/${schedule.publicToken}/vote`).send({});
      expect(res.status).toBe(200);
      expect(res.body.withdrawnCount).toBe(1);
      const after = await voterUser.agent.get(`/api/v1/polls/${schedule.publicToken}/my-votes`);
      expect(after.body.hasVoted).toBe(false);
    });

    it('withdraws a guest\'s votes with the private token', async () => {
      const res = await request(app).delete(`/api/v1/polls/${schedule.publicToken}/vote`).send({ voterEditToken: guestEditToken });
      expect(res.status).toBe(200);
      expect(res.body.withdrawnCount).toBe(2);
    });

    it('refuses withdrawals when the poll disallows them', async () => {
      const locked = await createPoll(adminAgent, {
        title: 'No withdrawal',
        type: 'survey',
        allowVoteWithdrawal: false,
        options: [{ text: 'A' }, { text: 'B' }],
      });
      const res = await request(app).delete(`/api/v1/polls/${locked.publicToken}/vote`).send({ voterEditToken: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('WITHDRAWAL_NOT_ALLOWED');
    });
  });
});
