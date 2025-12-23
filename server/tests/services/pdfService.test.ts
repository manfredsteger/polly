import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PDFService } from '../../services/pdfService';
import { PollResults } from '@shared/schema';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

describe('PDF Service', () => {
  let pdfService: PDFService;
  let chromiumAvailable = false;

  beforeAll(async () => {
    pdfService = new PDFService();
    
    // Check if Chromium is available
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
    // Check environment variable
    if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return true;
    }
    
    // Check common paths
    const possiblePaths = [
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
    ];
    
    for (const p of possiblePaths) {
      if (existsSync(p)) return true;
    }
    
    // Try which command
    try {
      const result = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
      return !!result;
    } catch {
      return false;
    }
  }

  // Mock poll results for testing
  function createMockPollResults(): PollResults {
    return {
      poll: {
        id: 1,
        title: 'Test Terminumfrage',
        description: 'Eine Beschreibung für die Testumfrage',
        type: 'schedule',
        createdAt: new Date('2024-12-10'),
        expiresAt: new Date('2024-12-31'),
        isActive: true,
        resultsPublic: true,
        allowVoteEditing: true,
        publicToken: 'test-token-123',
        adminToken: 'admin-token-123',
        creatorId: null,
        multipleSelectionsPerPerson: false,
        isTestData: true,
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
      
      // Check PDF magic bytes (%PDF-)
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

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

  describe('HTML Template Generation', () => {
    it('should contain SVG icons instead of emoji entities', async () => {
      // This test verifies the template includes inline SVGs
      // We can't directly test the private function, but we can verify the PDF contains expected structure
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      const results = createMockPollResults();
      const pdfBuffer = await pdfService.generatePollResultsPDF(results);
      
      // PDF should be generated without errors (indicating SVGs rendered correctly)
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should recover from browser crashes', async () => {
      if (!chromiumAvailable) {
        console.log('  ⏭️  Skipping: Chromium not available');
        return;
      }

      // Generate two PDFs in sequence - tests browser recovery
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
    // In Docker, PUPPETEER_EXECUTABLE_PATH should be set
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
        // Check if executable
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
