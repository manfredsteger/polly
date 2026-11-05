import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPdfBrowserLaunchOptions, PDFService, generateHTMLTemplate } from '../../services/pdfService';
import { PollResults } from '@shared/schema';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { extractPdfLines, extractPdfText, type ExtractedPdfText } from '../fixtures/pdfText';

function checkChromiumAvailable(): boolean {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return true;
  }
  const possiblePaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) return true;
  }
  try {
    const result = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
    return !!result;
  } catch {
    return false;
  }
}

describe('PDF Service', () => {
  let pdfService: PDFService;
  let chromiumAvailable = false;

  beforeAll(async () => {
    pdfService = new PDFService();
    chromiumAvailable = checkChromiumAvailable();
    if (!chromiumAvailable) {
      console.log('⚠️  Chromium not available - PDF generation tests will be skipped');
      console.log('    To run PDF tests, ensure chromium is installed (Docker or Nix)');
    }
  });

  afterAll(async () => {
    await pdfService.cleanup();
  });

  function createMockPollResults(): PollResults {
    return {
      poll: {
        id: 1,
        title: 'Test Terminumfrage',
        description: 'Eine Beschreibung für die Testumfrage',
        type: 'schedule',
        userId: null,
        creatorEmail: null,
        publicToken: 'test-token-123',
        adminToken: 'admin-token-123',
        isActive: true,
        isAnonymous: false,
        allowAnonymousVoting: true,
        allowMultipleSlots: true,
        maxSlotsPerUser: null,
        allowVoteEdit: false,
        allowVoteWithdrawal: false,
        resultsPublic: true,
        allowMaybe: true,
        notifyCreatorOnVote: true,
        isTestData: true,
        expiresAt: new Date('2024-12-31'),
        videoConferenceUrl: null,
        finalOptionId: null,
        enableExpiryReminder: false,
        expiryReminderHours: 24,
        expiryReminderSent: false,
        createdAt: new Date('2024-12-10'),
        updatedAt: new Date('2024-12-10'),
      },
      options: [
        {
          id: 1,
          pollId: 1,
          text: '11.12.2025 09:00 - 11:00',
          startTime: new Date('2025-12-11T09:00:00'),
          endTime: new Date('2025-12-11T11:00:00'),
          capacity: null,
        },
        {
          id: 2,
          pollId: 1,
          text: '11.12.2025 12:00 - 14:00',
          startTime: new Date('2025-12-11T12:00:00'),
          endTime: new Date('2025-12-11T14:00:00'),
          capacity: null,
        },
        {
          id: 3,
          pollId: 1,
          text: '12.12.2025 10:00 - 12:00',
          startTime: new Date('2025-12-12T10:00:00'),
          endTime: new Date('2025-12-12T12:00:00'),
          capacity: null,
        },
      ],
      votes: [
        { id: 1, optionId: 1, pollId: 1, response: 'yes', voterName: 'Max Mustermann', userId: null, comment: null, createdAt: new Date(), editToken: null },
        { id: 2, optionId: 1, pollId: 1, response: 'yes', voterName: 'Anna Schmidt', userId: null, comment: null, createdAt: new Date(), editToken: null },
        { id: 3, optionId: 1, pollId: 1, response: 'maybe', voterName: 'Tom Weber', userId: null, comment: null, createdAt: new Date(), editToken: null },
        { id: 4, optionId: 2, pollId: 1, response: 'yes', voterName: 'Max Mustermann', userId: null, comment: null, createdAt: new Date(), editToken: null },
        { id: 5, optionId: 2, pollId: 1, response: 'no', voterName: 'Anna Schmidt', userId: null, comment: null, createdAt: new Date(), editToken: null },
        { id: 6, optionId: 3, pollId: 1, response: 'yes', voterName: 'Max Mustermann', userId: null, comment: null, createdAt: new Date(), editToken: null },
      ],
      stats: [
        { optionId: 1, yesCount: 2, maybeCount: 1, noCount: 0, score: 5 },
        { optionId: 2, yesCount: 1, maybeCount: 0, noCount: 1, score: 1 },
        { optionId: 3, yesCount: 1, maybeCount: 0, noCount: 0, score: 2 },
      ],
      participantCount: 3,
      responseRate: 100,
    };
  }

  describe('PDF Generation', () => {
    const sandboxSmokeEnabled = process.env.PDF_CHROMIUM_SANDBOX_SMOKE === 'true';

    if (!sandboxSmokeEnabled) {
      console.log(
        '⏭️  Sandboxed Chromium PDF smoke test skipped (set PDF_CHROMIUM_SANDBOX_SMOKE=true in a supported Linux container)'
      );
    }

    it.skipIf(!sandboxSmokeEnabled)(
      'renders a valid PDF with Chromium sandbox enabled in a supported Linux container',
      async () => {
        expect(chromiumAvailable).toBe(true);
        expect(process.env.PDF_CHROMIUM_SANDBOX).toBe('true');

        const launchOptions = createPdfBrowserLaunchOptions();
        expect(launchOptions.args).not.toContain('--no-sandbox');
        expect(launchOptions.args).not.toContain('--disable-setuid-sandbox');

        const pdfBuffer = await pdfService.generatePollResultsPDF(createMockPollResults());

        expect(pdfBuffer.length).toBeGreaterThan(0);
        expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
      },
      60000
    );

    it('should generate a valid PDF buffer when Chromium is available', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();
      const pdfBuffer = await pdfService.generatePollResultsPDF(results);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    }, 60000);

    it('should include branding options in PDF', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();
      const pdfBuffer = await pdfService.generatePollResultsPDF(results, {
        siteName: 'Poll',
        siteNameAccent: 'y',
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle poll without options gracefully', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results: PollResults = {
        ...createMockPollResults(),
        options: [],
        stats: [],
        votes: [],
        participantCount: 0,
        responseRate: 0,
      };

      const pdfBuffer = await pdfService.generatePollResultsPDF(results);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle survey type polls', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();
      results.poll.type = 'survey';
      results.options = results.options.map(opt => ({
        ...opt,
        startTime: null,
        endTime: null,
        text: `Option ${opt.id}`,
      }));

      const pdfBuffer = await pdfService.generatePollResultsPDF(results);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('keeps the final options and participant rows of a poll spanning several pages', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const OPTION_COUNT = 12;
      const PARTICIPANT_COUNT = 90;
      const pad = (n: number) => String(n).padStart(3, '0');
      const optionLabel = (n: number) => `Termin ${pad(n)}`;
      // Short single-token names: with a dozen option columns the name column is
      // narrow, and a wrapped name would be split across PDF text lines.
      const participantName = (n: number) => `P${pad(n)}`;

      const base = createMockPollResults();
      const options = Array.from({ length: OPTION_COUNT }, (_, i) => ({
        id: i + 1,
        pollId: 1,
        text: optionLabel(i + 1),
        startTime: null,
        endTime: null,
        capacity: null,
      }));

      const cycle = ['yes', 'maybe', 'no'] as const;
      const votes: PollResults['votes'] = [];
      for (let p = 1; p <= PARTICIPANT_COUNT; p++) {
        for (const option of options) {
          // The last participant has a unique row: ✗ everywhere except the
          // final option, so the final column of the final row is identifiable.
          const response = p === PARTICIPANT_COUNT
            ? (option.id === OPTION_COUNT ? 'yes' : 'no')
            : cycle[(p + option.id) % cycle.length];
          votes.push({
            id: votes.length + 1,
            optionId: option.id,
            pollId: 1,
            response,
            voterName: participantName(p),
            userId: null,
            comment: null,
            createdAt: new Date(),
            editToken: null,
          } as PollResults['votes'][number]);
        }
      }

      const stats = options.map(option => {
        const forOption = votes.filter(v => v.optionId === option.id);
        const yesCount = forOption.filter(v => v.response === 'yes').length;
        const maybeCount = forOption.filter(v => v.response === 'maybe').length;
        const noCount = forOption.filter(v => v.response === 'no').length;
        return { optionId: option.id, yesCount, maybeCount, noCount, score: yesCount * 2 + maybeCount };
      });

      const results: PollResults = {
        ...base,
        poll: { ...base.poll, type: 'survey', title: 'Lange Umfrage über viele Seiten' },
        options,
        votes,
        stats,
        participantCount: PARTICIPANT_COUNT,
        responseRate: 100,
      };

      const pdfBuffer = await pdfService.generatePollResultsPDF(results, { includeParticipantTable: true });
      const { pageCount: declaredPageCount, pages } = await extractPdfLines(pdfBuffer);

      // Multiple pages, and every page in the page tree was actually emitted.
      expect(pages.length).toBe(declaredPageCount);
      expect(pages.length).toBeGreaterThanOrEqual(4);

      // Flatten to document order, remembering which page each text item came from.
      const lines = pages.flatMap((items, pageIndex) => items.map(text => ({ text, page: pageIndex })));
      const indicesOf = (text: string, from: number, to: number) =>
        lines.slice(from, to).flatMap((line, i) => (line.text === text ? [from + i] : []));
      const expectStrictlyIncreasing = (positions: number[]) => {
        positions.slice(1).forEach((pos, i) => expect(pos).toBeGreaterThan(positions[i]));
      };

      // The results section (option cards) ends where the participant table begins.
      const tableHeading = indicesOf('Teilnehmerliste', 0, lines.length);
      expect(tableHeading).toHaveLength(1);
      const tableStart = tableHeading[0];
      const footer = indicesOf('Erstellt mit', tableStart, lines.length);
      expect(footer).toHaveLength(1);
      const footerStart = footer[0];

      // The option cards sit between the "Ergebnisse" heading and the
      // best-option summary box, whose winner label is drawn right before the
      // table heading. (Its semi-transparent "★ Beste Option" heading is a
      // transparency group that Chromium draws at the end of the page, so it
      // cannot serve as the boundary.)
      const resultsHeading = indicesOf('Ergebnisse', 0, tableStart);
      expect(resultsHeading).toHaveLength(1);
      const cardsStart = resultsHeading[0];
      const summaryStart = tableStart - 1;
      expect(summaryStart).toBeGreaterThan(cardsStart);
      expect(options.map(option => option.text)).toContain(lines[summaryStart].text);

      // Every option card appears exactly once in the results section, in
      // document order, and the cards continue past the first page.
      const optionPositions = options.map(option => {
        const found = indicesOf(option.text, cardsStart, summaryStart);
        expect(found, `option card "${option.text}"`).toHaveLength(1);
        return found[0];
      });
      expectStrictlyIncreasing(optionPositions);
      expect(lines[optionPositions[OPTION_COUNT - 1]].page).toBeGreaterThan(0);

      // Every participant row appears exactly once inside the table, in document
      // order, and the table continues onto later pages.
      const participantPositions = Array.from({ length: PARTICIPANT_COUNT }, (_, i) => {
        const name = participantName(i + 1);
        const found = indicesOf(name, tableStart, footerStart);
        expect(found, `participant row "${name}"`).toHaveLength(1);
        return found[0];
      });
      expectStrictlyIncreasing(participantPositions);
      const firstRowPage = lines[participantPositions[0]].page;
      const lastRowPage = lines[participantPositions[PARTICIPANT_COUNT - 1]].page;
      expect(lastRowPage).toBeGreaterThan(firstRowPage);

      // The final participant row carries one cell per option, ending with the
      // final option's ✓, and is directly followed by the footer.
      const lastRow = participantPositions[PARTICIPANT_COUNT - 1];
      const rowCells = lines.slice(lastRow + 1, lastRow + 1 + OPTION_COUNT).map(line => line.text);
      expect(rowCells).toEqual([...Array(OPTION_COUNT - 1).fill('✗'), '✓']);
      expect(footerStart).toBe(lastRow + 1 + OPTION_COUNT);

      // The footer is rendered on the last page.
      expect(lines[footerStart].page).toBe(pages.length - 1);
    }, 60000);

    it('should handle organization type polls', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();
      results.poll.type = 'organization';
      results.options = results.options.map((opt, i) => ({
        ...opt,
        startTime: null,
        endTime: null,
        text: `Aufgabe ${i + 1}`,
        capacity: 2,
      }));

      const pdfBuffer = await pdfService.generatePollResultsPDF(results);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  // These tests read the text layer of the rendered PDF, so a template or
  // rendering regression that drops titles, options or result values fails
  // here even though a valid PDF is still produced. They always use the
  // default (non-sandboxed) launch so they do not depend on whether the host
  // supports Chromium's sandbox.
  describe.skipIf(!checkChromiumAvailable())('Exported PDF text content', () => {
    let textPdfService: PDFService;
    let originalSandboxSetting: string | undefined;
    let schedulePdf: ExtractedPdfText;
    let surveyPdf: ExtractedPdfText;
    let organizationPdf: ExtractedPdfText;

    function createSurveyResults(): PollResults {
      const base = createMockPollResults();
      return {
        ...base,
        poll: { ...base.poll, id: 2, type: 'survey', title: 'Mittagessen beim Teamtag', allowMaybe: false },
        options: [
          { id: 21, pollId: 2, text: 'Pizza Margherita', startTime: null, endTime: null, capacity: null },
          { id: 22, pollId: 2, text: 'Gemüsecurry mit Reis', startTime: null, endTime: null, capacity: null },
          { id: 23, pollId: 2, text: 'Linsensuppe', startTime: null, endTime: null, capacity: null },
        ],
        votes: [],
        stats: [
          { optionId: 21, yesCount: 4, maybeCount: 0, noCount: 1, score: 8 },
          { optionId: 22, yesCount: 2, maybeCount: 0, noCount: 3, score: 4 },
          { optionId: 23, yesCount: 0, maybeCount: 0, noCount: 5, score: 0 },
        ],
        participantCount: 5,
        responseRate: 62.5,
      };
    }

    function createOrganizationResults(): PollResults {
      const base = createMockPollResults();
      const vote = (id: number, optionId: number, voterName: string) => ({
        id, optionId, pollId: 3, response: 'yes', voterName, userId: null, comment: null, createdAt: new Date(), editToken: null,
      });
      return {
        ...base,
        poll: { ...base.poll, id: 3, type: 'organization', title: 'Sommerfest Helferliste', maxSlotsPerUser: 2 },
        options: [
          { id: 31, pollId: 3, text: 'Kuchen backen', startTime: null, endTime: null, capacity: 2 },
          { id: 32, pollId: 3, text: 'Getränke ausschenken', startTime: null, endTime: null, capacity: 2 },
          { id: 33, pollId: 3, text: 'Aufbau Bühne', startTime: null, endTime: null, capacity: 2 },
        ],
        votes: [
          vote(301, 31, 'Erika Musterfrau'),
          vote(302, 31, 'Jonas Becker'),
          vote(303, 32, 'Jonas Becker'),
        ] as PollResults['votes'],
        stats: [
          { optionId: 31, yesCount: 2, maybeCount: 0, noCount: 0, score: 4 },
          { optionId: 32, yesCount: 1, maybeCount: 0, noCount: 0, score: 2 },
          { optionId: 33, yesCount: 0, maybeCount: 0, noCount: 0, score: 0 },
        ],
        participantCount: 2,
        responseRate: 100,
      };
    }

    function countOccurrences(text: string, needle: string): number {
      return text.split(needle).length - 1;
    }

    beforeAll(async () => {
      originalSandboxSetting = process.env.PDF_CHROMIUM_SANDBOX;
      delete process.env.PDF_CHROMIUM_SANDBOX;
      textPdfService = new PDFService();

      schedulePdf = await extractPdfText(await textPdfService.generatePollResultsPDF(createMockPollResults()));
      surveyPdf = await extractPdfText(await textPdfService.generatePollResultsPDF(createSurveyResults()));
      organizationPdf = await extractPdfText(
        await textPdfService.generatePollResultsPDF(createOrganizationResults(), { includeParticipantTable: true })
      );
    }, 120000);

    afterAll(async () => {
      await textPdfService?.cleanup();
      if (originalSandboxSetting === undefined) delete process.env.PDF_CHROMIUM_SANDBOX;
      else process.env.PDF_CHROMIUM_SANDBOX = originalSandboxSetting;
    });

    it('schedule poll PDF shows title, type, every date option and its results', () => {
      const { text } = schedulePdf;
      expect(text).toContain('Test Terminumfrage');
      expect(text).toContain('Terminumfrage');
      expect(text).toContain('Eine Beschreibung für die Testumfrage');

      expect(text).toContain('11.12.2025 09:00 - 11:00');
      expect(text).toContain('11.12.2025 12:00 - 14:00');
      expect(text).toContain('12.12.2025 10:00 - 12:00');

      // Option 1: 2 yes / 1 maybe / 0 no
      expect(text).toContain('Ja: 2 (67%)');
      expect(text).toContain('Vielleicht: 1 (33%)');
      expect(text).toContain('Gesamtwertung: 5');
      // Option 2: 1 yes / 1 no
      expect(text).toContain('Ja: 1 (50%)');
      expect(text).toContain('Nein: 1 (50%)');
      expect(text).toContain('Gesamtwertung: 1');
      // Option 3: 1 yes only
      expect(text).toContain('Ja: 1 (100%)');
      expect(text).toContain('Gesamtwertung: 2');

      expect(text).toContain('Teilnehmer: 3');
      expect(text).toContain('Rücklaufquote: 100%');
    });

    it('schedule poll PDF names the highest-scoring option as the best option', () => {
      const { text } = schedulePdf;
      expect(text).toContain('Beste Option');
      // Best option appears in its result card and again in the summary box.
      expect(countOccurrences(text, '11.12.2025 09:00 - 11:00')).toBe(2);
      expect(countOccurrences(text, '11.12.2025 12:00 - 14:00')).toBe(1);
      expect(countOccurrences(text, '12.12.2025 10:00 - 12:00')).toBe(1);
    });

    it('survey poll PDF shows title, type, every option and its results', () => {
      const { text } = surveyPdf;
      expect(text).toContain('Mittagessen beim Teamtag');
      expect(text).toContain('Umfrage');

      expect(text).toContain('Pizza Margherita');
      expect(text).toContain('Gemüsecurry mit Reis');
      expect(text).toContain('Linsensuppe');

      expect(text).toContain('Ja: 4 (80%)');
      expect(text).toContain('Nein: 1 (20%)');
      expect(text).toContain('Gesamtwertung: 8');
      expect(text).toContain('Ja: 2 (40%)');
      expect(text).toContain('Nein: 3 (60%)');
      expect(text).toContain('Gesamtwertung: 4');
      expect(text).toContain('Ja: 0 (0%)');
      expect(text).toContain('Nein: 5 (100%)');
      expect(text).toContain('Gesamtwertung: 0');

      expect(text).toContain('Teilnehmer: 5');
      expect(text).toContain('Rücklaufquote: 63%');
      expect(countOccurrences(text, 'Pizza Margherita')).toBe(2);
    });

    it('survey poll PDF does not leak schedule-only content', () => {
      const { text } = surveyPdf;
      expect(text).not.toContain('Test Terminumfrage');
      expect(text).not.toContain('11.12.2025 09:00 - 11:00');
      expect(text.toLowerCase()).not.toContain('"vielleicht"-option');
    });

    it('organization poll PDF shows title, slot limit, every task and sign-up counts', () => {
      const { text } = organizationPdf;
      expect(text).toContain('Sommerfest Helferliste');
      expect(text).toContain('Orga-Liste');
      expect(text).toContain('Max. 2 Slots/Person');

      expect(text).toContain('Kuchen backen');
      expect(text).toContain('Getränke ausschenken');
      expect(text).toContain('Aufbau Bühne');

      expect(text).toContain('Ja: 2 (100%)');
      expect(text).toContain('Gesamtwertung: 4');
      expect(text).toContain('Ja: 1 (100%)');
      expect(text).toContain('Gesamtwertung: 2');
      expect(text).toContain('Ja: 0 (0%)');
      expect(text).toContain('Gesamtwertung: 0');

      expect(text).toContain('Teilnehmer: 2');
      expect(text).toContain('Rücklaufquote: 100%');
    });

    it('organization poll PDF lists participants when the participant table is requested', () => {
      const { text } = organizationPdf;
      expect(text).toContain('Teilnehmerliste');
      expect(text).toContain('Erika Musterfrau');
      expect(text).toContain('Jonas Becker');
      // Each task appears in its result card and as a table column; the most
      // signed-up task also appears in the best-option summary.
      expect(countOccurrences(text, 'Kuchen backen')).toBe(3);
      expect(countOccurrences(text, 'Getränke ausschenken')).toBe(2);
      expect(countOccurrences(text, 'Aufbau Bühne')).toBe(2);
    });
  });

  describe('HTML Template Generation (unit, no Chromium required)', () => {
    it('should include poll title in the HTML', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Test Terminumfrage');
    });

    it('should include all letterhead fields', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Status');
      expect(html).toContain('Umfragetyp');
      expect(html).toContain('Gestartet am');
      expect(html).toContain('Endet am');
      expect(html).toContain('Ergebnisse');
      expect(html).toContain('Abstimmung');
      expect(html).toContain('Anonyme Teilnahme');
    });

    it('should show active status for active polls', () => {
      const results = createMockPollResults();
      results.poll.isActive = true;
      results.poll.finalOptionId = null;
      results.poll.expiresAt = new Date(Date.now() + 86400000); // tomorrow
      const html = generateHTMLTemplate(results);
      expect(html).toContain('lh-status-active');
      expect(html).toContain('Aktiv');
    });

    it('should show closed status for inactive polls', () => {
      const results = createMockPollResults();
      results.poll.isActive = false;
      results.poll.finalOptionId = null;
      const html = generateHTMLTemplate(results);
      expect(html).toContain('lh-status-closed');
      expect(html).toContain('Abgeschlossen');
    });

    it('should show finalized status when finalOptionId is set', () => {
      const results = createMockPollResults();
      results.poll.finalOptionId = 1;
      const html = generateHTMLTemplate(results);
      expect(html).toContain('lh-status-finalized');
      expect(html).toContain('Finalisiert');
    });

    it('should show expired status for polls past expiresAt', () => {
      const results = createMockPollResults();
      results.poll.isActive = true;
      results.poll.finalOptionId = null;
      results.poll.expiresAt = new Date('2020-01-01'); // past date
      const html = generateHTMLTemplate(results);
      expect(html).toContain('lh-status-expired');
      expect(html).toContain('Abgelaufen');
    });

    it('should render markdown in description', () => {
      const results = createMockPollResults();
      results.poll.description = '**Fettgedruckt** und _kursiv_\n\n## Überschrift';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('<strong>Fettgedruckt</strong>');
      expect(html).toContain('<em>kursiv</em>');
      expect(html).toContain('<h2>');
    });

    it('should render markdown lists', () => {
      const results = createMockPollResults();
      results.poll.description = '- Punkt 1\n- Punkt 2\n- Punkt 3';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      expect(html).toContain('Punkt 1');
    });

    it('should render markdown blockquotes', () => {
      const results = createMockPollResults();
      results.poll.description = '> Ein wichtiger Hinweis';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('<blockquote>');
    });

    it('should strip script tags from markdown description', () => {
      const results = createMockPollResults();
      results.poll.description = 'Normaler Text <script>alert("xss")</script> Ende';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert("xss")');
    });

    it('should strip non-allowlisted tags (div, iframe, object, embed)', () => {
      const results = createMockPollResults();
      results.poll.description = [
        '<div style="color:red">div content</div>',
        '<iframe src="https://evil.com"></iframe>',
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
      ].join('\n');
      const html = generateHTMLTemplate(results);
      const descStart = html.indexOf('<div class="description-section">');
      const descEnd = html.indexOf('</div>', descStart);
      const descHtml = html.slice(descStart, descEnd);
      expect(descHtml).not.toContain('<div style=');
      expect(descHtml).not.toContain('<iframe');
      expect(descHtml).not.toContain('<object');
      expect(descHtml).not.toContain('<embed');
    });

    it('should strip all attributes from non-anchor allowlisted tags', () => {
      const results = createMockPollResults();
      results.poll.description = '<p class="evil" onclick="alert()">Text</p>';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('class="evil"');
      expect(html).not.toContain('onclick');
      expect(html).toContain('<p>Text</p>');
    });

    it('should strip javascript: href but keep anchor text', () => {
      const results = createMockPollResults();
      results.poll.description = '[Klick mich](javascript:alert("xss"))';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Klick mich');
    });

    it('should strip data: href on anchor tags', () => {
      const results = createMockPollResults();
      results.poll.description = '[Link](data:text/html,<script>alert(1)</script>)';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('data:text/html');
      expect(html).toContain('Link');
    });

    it('should keep valid http/https links in anchor tags', () => {
      const results = createMockPollResults();
      results.poll.description = '[Offizielle Website](https://example.com/info)';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('<a href="https://example.com/info">');
      expect(html).toContain('Offizielle Website');
    });

    it('should strip img tags (SSRF prevention in Puppeteer context)', () => {
      const results = createMockPollResults();
      results.poll.description = '![Bild](https://example.com/image.png)';
      const html = generateHTMLTemplate(results);
      const descStart = html.indexOf('<div class="description-section">');
      const descEnd = html.indexOf('</div>', descStart);
      const descHtml = html.slice(descStart, descEnd);
      expect(descHtml).not.toContain('<img');
    });

    it('should strip HTML comments from description', () => {
      const results = createMockPollResults();
      results.poll.description = 'Text <!-- Kommentar --> mehr Text';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('<!--');
      expect(html).not.toContain('-->');
    });

    it('should include poll URL as clickable link when provided', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results, { pollUrl: 'https://example.com/poll/abc' });
      expect(html).toContain('https://example.com/poll/abc');
      expect(html).toContain('poll-link');
    });

    it('should show no expiry date when expiresAt is null', () => {
      const results = createMockPollResults();
      results.poll.expiresAt = null;
      const html = generateHTMLTemplate(results);
      expect(html).toContain('—');
    });

    it('should show "Vielleicht"-Option label for schedule polls', () => {
      const results = createMockPollResults();
      results.poll.type = 'schedule';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('"Vielleicht"-Option');
    });

    it('should NOT show "Vielleicht"-Option label for survey polls', () => {
      const results = createMockPollResults();
      results.poll.type = 'survey';
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('"Vielleicht"-Option');
    });

    it('should show org slot info for organization polls with maxSlotsPerUser', () => {
      const results = createMockPollResults();
      results.poll.type = 'organization';
      results.poll.maxSlotsPerUser = 3;
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Slots pro Person');
      expect(html).toContain('Max. 3 Slots/Person');
    });

    it('should show "Unbegrenzt" for organization polls without slot limit', () => {
      const results = createMockPollResults();
      results.poll.type = 'organization';
      results.poll.maxSlotsPerUser = null;
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Slots pro Person');
      expect(html).toContain('Unbegrenzt');
    });

    it('should show video conference URL when set', () => {
      const results = createMockPollResults();
      results.poll.videoConferenceUrl = 'https://zoom.us/j/123456789';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Videokonferenz');
      expect(html).toContain('https://zoom.us/j/123456789');
    });

    it('should NOT show video conference section when not set', () => {
      const results = createMockPollResults();
      results.poll.videoConferenceUrl = null;
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('Videokonferenz');
    });

    it('should include Polly link in footer', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results);
      expect(html).toContain('polly');
      expect(html).toContain('Erstellt mit');
    });

    it('should include description div when description is set', () => {
      const results = createMockPollResults();
      results.poll.description = 'Eine Beschreibung';
      const html = generateHTMLTemplate(results);
      expect(html).toContain('<div class="description-section">');
    });

    it('should NOT include description div when description is null', () => {
      const results = createMockPollResults();
      results.poll.description = null;
      const html = generateHTMLTemplate(results);
      expect(html).not.toContain('<div class="description-section">');
    });

    it('should render correctly with custom branding', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results, {
        siteName: 'Mein',
        siteNameAccent: 'Tool',
      });
      expect(html).toContain('MeinTool');
    });

    it('should show Ergebnisse section with options', () => {
      const results = createMockPollResults();
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Ergebnisse');
      expect(html).toContain('option-card');
      expect(html).toContain('Beste Option');
    });

    it('should show empty state when no options are present', () => {
      const results: PollResults = {
        ...createMockPollResults(),
        options: [],
        stats: [],
        votes: [],
        participantCount: 0,
        responseRate: 0,
      };
      const html = generateHTMLTemplate(results);
      expect(html).toContain('Keine Optionen vorhanden');
    });
  });

  describe('Error Handling', () => {
    it('should recover from browser crashes', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();

      const pdf1 = await pdfService.generatePollResultsPDF(results);
      expect(pdf1).toBeInstanceOf(Buffer);

      const pdf2 = await pdfService.generatePollResultsPDF(results);
      expect(pdf2).toBeInstanceOf(Buffer);
    });
  });
});

describe('PDF text extraction helper (no Chromium required)', () => {
  // Builds a minimal one-page PDF using a standard font so the extractor can
  // be verified on hosts without Chromium.
  function buildMinimalPdf(lines: string[]): Buffer {
    const escapePdfString = (value: string) => value.replace(/([\\()])/g, '\\$1');
    const content = lines
      .map((line, i) => `BT /F1 12 Tf 20 ${120 - i * 20} Td (${escapePdfString(line)}) Tj ET`)
      .join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
  }

  it('returns the visible text of a PDF', async () => {
    const extracted = await extractPdfText(buildMinimalPdf(['Sommerfest Helferliste', 'Ja: 2 (67%)']));
    expect(extracted.pages).toHaveLength(1);
    expect(extracted.text).toContain('Sommerfest Helferliste');
    expect(extracted.text).toContain('Ja: 2 (67%)');
  });

  it('does not report text that is not in the PDF', async () => {
    const extracted = await extractPdfText(buildMinimalPdf(['Kuchen backen']));
    expect(extracted.text).toContain('Kuchen backen');
    expect(extracted.text).not.toContain('Getränke ausschenken');
  });

  it('rejects data that is not a PDF', async () => {
    await expect(extractPdfText(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});

describe('PDF Service - Docker Environment', () => {
  it('disables Chromium sandbox flags when the opt-in is unset', () => {
    const original = process.env.PDF_CHROMIUM_SANDBOX;
    delete process.env.PDF_CHROMIUM_SANDBOX;
    try {
      const options = createPdfBrowserLaunchOptions();
      expect(options.args).toContain('--no-sandbox');
      expect(options.args).toContain('--disable-setuid-sandbox');
    } finally {
      if (original === undefined) delete process.env.PDF_CHROMIUM_SANDBOX;
      else process.env.PDF_CHROMIUM_SANDBOX = original;
    }
  });

  it('keeps Chromium sandbox enabled when the opt-in is true', () => {
    const original = process.env.PDF_CHROMIUM_SANDBOX;
    process.env.PDF_CHROMIUM_SANDBOX = 'true';
    try {
      const options = createPdfBrowserLaunchOptions();
      expect(options.args).not.toContain('--no-sandbox');
      expect(options.args).not.toContain('--disable-setuid-sandbox');
    } finally {
      if (original === undefined) delete process.env.PDF_CHROMIUM_SANDBOX;
      else process.env.PDF_CHROMIUM_SANDBOX = original;
    }
  });

  it('should detect Chromium path in Docker environment', () => {
    const dockerChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;

    if (process.env.DOCKER_ENV === 'true' || dockerChromiumPath) {
      expect(dockerChromiumPath).toBeDefined();
      expect(existsSync(dockerChromiumPath!)).toBe(true);
      console.log(`  ✓ Docker Chromium path: ${dockerChromiumPath}`);
    } else {
      console.log('  ⏭️  Not running in Docker environment');
    }
  });

  it('should have correct Chromium permissions in Docker', () => {
    const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;

    if (chromiumPath && existsSync(chromiumPath)) {
      try {
        execSync(`test -x ${chromiumPath}`);
        console.log('  ✓ Chromium is executable');
      } catch {
        console.log('  ⚠️  Chromium may not be executable');
      }
    } else {
      console.log('  ⏭️  Chromium path not set or not found');
    }
  });
});
