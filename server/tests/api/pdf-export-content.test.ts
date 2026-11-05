import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';
import { extractPdfText, type ExtractedPdfText } from '../fixtures/pdfText';
import { isChromiumAvailable } from '../fixtures/chromium';

export const testMeta = {
  category: 'api' as const,
  name: 'PDF-Export: Inhalt über die Route',
  description:
    'Lädt PDFs über /polls/:token/export/pdf herunter und prüft per Textebene, dass Titel, Optionen, Stimmen, Teilnehmerliste und Umfragelink der richtigen Umfrage enthalten sind und private Ergebnisse geschützt bleiben',
  severity: 'high' as const,
};

const chromiumAvailable = isChromiumAvailable();
if (!chromiumAvailable) {
  console.log('⚠️  Chromium not available - PDF export content tests will be skipped');
}

type CreatedPoll = { poll: { options: Array<{ id: number }> }; publicToken: string; adminToken: string };

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** URLs can wrap across lines in the PDF; compare without whitespace. */
function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

describe('PDF export route content', () => {
  let app: Express;
  let adminAgent: TestAgent;
  let outsider: CreatedTestUser;
  let publicPoll: CreatedPoll;
  let privatePoll: CreatedPoll;
  let decoyPoll: CreatedPoll;
  let originalSandboxSetting: string | undefined;

  async function createPoll(body: Record<string, unknown>): Promise<CreatedPoll> {
    const res = await adminAgent.post('/api/v1/polls').send(body);
    expect(res.status).toBe(200);
    return res.body as CreatedPoll;
  }

  async function guestVote(publicToken: string, voterName: string, votes: Array<{ optionId: number; response: string }>) {
    const voterEmail = `${voterName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@guest.example`;
    const res = await request(app).post(`/api/v1/polls/${publicToken}/vote-bulk`).send({ voterName, voterEmail, votes });
    expect(res.status).toBe(200);
  }

  async function downloadPdf(agent: TestAgent | ReturnType<typeof request>, path: string) {
    return (agent as any)
      .get(path)
      .buffer(true)
      .parse((r: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  async function downloadPdfText(agent: TestAgent | ReturnType<typeof request>, path: string): Promise<ExtractedPdfText> {
    const res = await downloadPdf(agent, path);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    return extractPdfText(body);
  }

  beforeAll(async () => {
    // Text checks use the default (non-sandboxed) launch so they do not depend on
    // whether the host supports Chromium's sandbox.
    originalSandboxSetting = process.env.PDF_CHROMIUM_SANDBOX;
    delete process.env.PDF_CHROMIUM_SANDBOX;

    app = await createTestApp();
    adminAgent = await loginAdminAgent(app);
    outsider = await createLoggedInUser(app);

    publicPoll = await createPoll({
      title: 'Planung Herbstklausur Vorstand',
      description: 'Bitte bis Freitag abstimmen',
      type: 'schedule',
      resultsPublic: true,
      allowMaybe: true,
      options: [
        { text: 'Montag Vormittag', startTime: inDays(20, 8), endTime: inDays(20, 11) },
        { text: 'Dienstag Nachmittag', startTime: inDays(21, 13), endTime: inDays(21, 16) },
        { text: 'Donnerstag Abend', startTime: inDays(23, 17), endTime: inDays(23, 20) },
      ],
    });
    const [mon, tue, thu] = publicPoll.poll.options.map((o) => o.id);
    await guestVote(publicPoll.publicToken, 'Erika Probst', [
      { optionId: mon, response: 'yes' },
      { optionId: tue, response: 'maybe' },
      { optionId: thu, response: 'no' },
    ]);
    await guestVote(publicPoll.publicToken, 'Jonas Kranz', [
      { optionId: mon, response: 'yes' },
      { optionId: tue, response: 'no' },
    ]);
    await guestVote(publicPoll.publicToken, 'Petra Lang', [
      { optionId: mon, response: 'maybe' },
      { optionId: tue, response: 'yes' },
    ]);

    privatePoll = await createPoll({
      title: 'Geheime Budgetrunde',
      type: 'survey',
      resultsPublic: false,
      options: [{ text: 'Variante Nord' }, { text: 'Variante Sued' }],
    });
    const [north, south] = privatePoll.poll.options.map((o) => o.id);
    await guestVote(privatePoll.publicToken, 'Karla Verborgen', [
      { optionId: north, response: 'yes' },
      { optionId: south, response: 'no' },
    ]);
    await guestVote(privatePoll.publicToken, 'Bruno Still', [{ optionId: north, response: 'yes' }]);

    // A second public poll with votes: its data must never appear in another poll's PDF.
    decoyPoll = await createPoll({
      title: 'Kantinenwunsch Lockvogel',
      type: 'survey',
      resultsPublic: true,
      options: [{ text: 'Lockvogel Option Eins' }, { text: 'Lockvogel Option Zwei' }],
    });
    await guestVote(decoyPoll.publicToken, 'Lockvogel Person', [
      { optionId: decoyPoll.poll.options[0].id, response: 'yes' },
    ]);
  }, 60000);

  afterAll(async () => {
    await storage.deleteUser(outsider.id).catch(() => {});
    if (originalSandboxSetting === undefined) delete process.env.PDF_CHROMIUM_SANDBOX;
    else process.env.PDF_CHROMIUM_SANDBOX = originalSandboxSetting;
  });

  describe('private results are not exposed', () => {
    const privateContent = ['Variante Nord', 'Variante Sued', 'Karla Verborgen', 'Bruno Still', 'Geheime Budgetrunde'];

    it('refuses an anonymous PDF export of a private poll via the public token without leaking results', async () => {
      const res = await request(app).get(`/api/v1/polls/${privatePoll.publicToken}/export/pdf?includeParticipants=1`);
      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toBeUndefined();
      expect(res.body.resultsPrivate).toBe(true);
      for (const value of privateContent) expect(res.text).not.toContain(value);
    });

    it('refuses the PDF export to a logged-in user who did not create the poll', async () => {
      const res = await outsider.agent.get(`/api/v1/polls/${privatePoll.publicToken}/export/pdf?includeParticipants=1`);
      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.resultsPrivate).toBe(true);
      for (const value of privateContent) expect(res.text).not.toContain(value);
    });
  });

  describe.skipIf(!chromiumAvailable)('downloaded PDF content', () => {
    let publicPdf: ExtractedPdfText;
    let publicPdfWithParticipants: ExtractedPdfText;
    let privatePdfViaAdminToken: ExtractedPdfText;
    let privatePdfForCreator: ExtractedPdfText;

    beforeAll(async () => {
      publicPdf = await downloadPdfText(request(app), `/api/v1/polls/${publicPoll.publicToken}/export/pdf`);
      publicPdfWithParticipants = await downloadPdfText(
        request(app),
        `/api/v1/polls/${publicPoll.publicToken}/export/pdf?includeParticipants=1`,
      );
      privatePdfViaAdminToken = await downloadPdfText(
        request(app),
        `/api/v1/polls/${privatePoll.adminToken}/export/pdf?includeParticipants=1`,
      );
      privatePdfForCreator = await downloadPdfText(adminAgent, `/api/v1/polls/${privatePoll.publicToken}/export/pdf`);
    }, 180000);

    it('contains the title, description, options and vote counts of the requested poll', () => {
      const { text } = publicPdf;
      expect(text).toContain('Planung Herbstklausur Vorstand');
      expect(text).toContain('Bitte bis Freitag abstimmen');
      expect(text).toContain('Terminumfrage');

      expect(text).toContain('Montag Vormittag');
      expect(text).toContain('Dienstag Nachmittag');
      expect(text).toContain('Donnerstag Abend');

      // Montag: 2 yes / 1 maybe
      expect(text).toContain('Ja: 2 (67%)');
      expect(text).toContain('Vielleicht: 1 (33%)');
      expect(text).toContain('Gesamtwertung: 5');
      // Dienstag: 1 yes / 1 maybe / 1 no
      expect(text).toContain('Ja: 1 (33%)');
      expect(text).toContain('Nein: 1 (33%)');
      expect(text).toContain('Gesamtwertung: 3');
      // Donnerstag: 1 no
      expect(text).toContain('Nein: 1 (100%)');
      expect(text).toContain('Gesamtwertung: 0');

      expect(text).toContain('Teilnehmer: 3');
      expect(text).toContain('Rücklaufquote: 100%');
    });

    it('names the highest-scoring option as the best option', () => {
      const { text } = publicPdf;
      expect(text).toContain('Beste Option');
      expect(countOccurrences(text, 'Montag Vormittag')).toBe(2);
      expect(countOccurrences(text, 'Dienstag Nachmittag')).toBe(1);
      expect(countOccurrences(text, 'Donnerstag Abend')).toBe(1);
    });

    it('does not contain data from other polls', () => {
      for (const pdf of [publicPdf, publicPdfWithParticipants]) {
        expect(pdf.text).not.toContain('Lockvogel');
        expect(pdf.text).not.toContain('Geheime Budgetrunde');
        expect(pdf.text).not.toContain('Variante Nord');
      }
    });

    it('links to the public poll page of the exported poll', () => {
      const text = compact(publicPdf.text);
      expect(text).toContain(`/poll/${publicPoll.publicToken}`);
      expect(text).not.toContain(publicPoll.adminToken);
      expect(text).not.toContain(decoyPoll.publicToken);
    });

    it('only lists participants when the participant table is requested', () => {
      expect(publicPdf.text).not.toContain('Teilnehmerliste');
      expect(publicPdf.text).not.toContain('Erika Probst');
      expect(publicPdf.text).not.toContain('Jonas Kranz');
      expect(publicPdf.text).not.toContain('Petra Lang');

      const { text } = publicPdfWithParticipants;
      expect(text).toContain('Teilnehmerliste');
      expect(text).toContain('Erika Probst');
      expect(text).toContain('Jonas Kranz');
      expect(text).toContain('Petra Lang');
      // Each option appears in its result card and as a table column; the best one also in the summary.
      expect(countOccurrences(text, 'Montag Vormittag')).toBe(3);
      expect(countOccurrences(text, 'Dienstag Nachmittag')).toBe(2);
      expect(countOccurrences(text, 'Donnerstag Abend')).toBe(2);
    });

    it('gives the admin-token holder the full results of a private poll without exposing the admin link', () => {
      const { text } = privatePdfViaAdminToken;
      expect(text).toContain('Geheime Budgetrunde');
      expect(text).toContain('Nur Ersteller');
      expect(text).toContain('Variante Nord');
      expect(text).toContain('Variante Sued');
      // Nord: 2 yes; Sued: 1 no
      expect(text).toContain('Ja: 2 (100%)');
      expect(text).toContain('Gesamtwertung: 4');
      expect(text).toContain('Nein: 1 (100%)');
      expect(text).toContain('Teilnehmer: 2');
      expect(text).toContain('Karla Verborgen');
      expect(text).toContain('Bruno Still');

      const compacted = compact(text);
      expect(compacted).toContain(`/poll/${privatePoll.publicToken}`);
      expect(compacted).not.toContain(privatePoll.adminToken);
    });

    it('gives the logged-in creator the results of a private poll via the public token', () => {
      const { text } = privatePdfForCreator;
      expect(text).toContain('Geheime Budgetrunde');
      expect(text).toContain('Variante Nord');
      expect(text).toContain('Ja: 2 (100%)');
      expect(text).toContain('Teilnehmer: 2');
      expect(text).not.toContain('Teilnehmerliste');
    });
  });
});
