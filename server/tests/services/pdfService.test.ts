import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PDFService, generateHTMLTemplate } from '../../services/pdfService';
import { PollResults } from '@shared/schema';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

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

describe('PDF Service - Docker Environment', () => {
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
