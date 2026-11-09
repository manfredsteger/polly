import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import os from 'os';
import path from 'path';
import { promises as fs, existsSync } from 'fs';
import { execSync } from 'child_process';
import {
  PDFService,
  generateHTMLTemplate,
  generateTestReportHTMLTemplate,
  resolvePdfLogoSrc,
  safeImageSrc,
  safeHttpUrl,
  escapeHtml,
} from '../../services/pdfService';
import type { PollResults, TestRun, TestResult } from '@shared/schema';

export const testMeta = {
  category: 'security' as const,
  name: 'PDF-Export: HTML-/Skript-Injection',
  description: 'Regressionstests: Nutzerwerte werden im PDF-HTML als Text ausgegeben, URLs/Bilder validiert und der Renderer führt kein JavaScript aus und lädt keine fremden Ressourcen',
  severity: 'critical' as const,
};

const SCRIPT_PAYLOAD = '<script>document.title="PWNED"</script>';
const IMG_PAYLOAD = '<img src="http://169.254.169.254/latest/meta-data/" onerror="alert(1)">';
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function chromiumAvailable(): boolean {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) return true;
  try {
    return !!execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return false;
  }
}

function makeResults(overrides: { title?: string; optionText?: string; voterName?: string; description?: string | null; videoConferenceUrl?: string | null } = {}): PollResults {
  const optionText = overrides.optionText ?? 'Option A';
  return {
    poll: {
      id: 1,
      title: overrides.title ?? 'Harmless poll',
      description: overrides.description ?? null,
      type: 'survey',
      userId: null,
      creatorEmail: null,
      publicToken: 'pub',
      adminToken: 'adm',
      isActive: true,
      isAnonymous: false,
      allowAnonymousVoting: true,
      allowMultipleSlots: true,
      maxSlotsPerUser: null,
      allowVoteEdit: false,
      allowVoteWithdrawal: false,
      resultsPublic: true,
      allowMaybe: true,
      notifyCreatorOnVote: false,
      isTestData: true,
      expiresAt: null,
      videoConferenceUrl: overrides.videoConferenceUrl ?? null,
      finalOptionId: null,
      enableExpiryReminder: false,
      expiryReminderHours: 24,
      expiryReminderSent: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    options: [{ id: 1, pollId: 1, text: optionText, startTime: null, endTime: null, capacity: null }],
    votes: [
      { id: 1, optionId: 1, pollId: 1, response: 'yes', voterName: overrides.voterName ?? 'Alice', userId: null, comment: null, createdAt: new Date(), editToken: null },
    ],
    stats: [{ optionId: 1, yesCount: 1, maybeCount: 0, noCount: 0, score: 2 }],
    participantCount: 1,
    responseRate: 100,
  } as unknown as PollResults;
}

describe('PDF export – output encoding of user values', () => {
  it('escapes a script payload in the poll title (document <title> and heading)', () => {
    const html = generateHTMLTemplate(makeResults({ title: `Meeting ${SCRIPT_PAYLOAD}` }));
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('<title>Polly – Meeting &lt;script&gt;document.title=&quot;PWNED&quot;&lt;/script&gt;</title>');
  });

  it('renders the escaped title as visible text in the heading', () => {
    const html = generateHTMLTemplate(makeResults({ title: IMG_PAYLOAD }), { siteName: 'Poll', siteNameAccent: 'y' });
    expect(html).toContain(`<div class="poll-title">${escapeHtml(IMG_PAYLOAD)}</div>`);
    expect(html).toContain(`<title>Polly – ${escapeHtml(IMG_PAYLOAD)}</title>`);
    expect(html).not.toContain('<img src="http://169.254.169.254');
  });

  it('escapes option text in result cards, best-option box and participant matrix', () => {
    const html = generateHTMLTemplate(makeResults({ optionText: IMG_PAYLOAD }), { includeParticipantTable: true });
    const escaped = escapeHtml(IMG_PAYLOAD);
    expect(html).toContain(`<span class="option-title">${escaped}</span>`);
    expect(html).toContain(`<div class="winner">${escaped}</div>`);
    expect(html).toContain(`<th class="vm-th">${escaped}</th>`);
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it('escapes participant names in the participant table', () => {
    const html = generateHTMLTemplate(makeResults({ voterName: `Eve ${SCRIPT_PAYLOAD}` }), { includeParticipantTable: true });
    expect(html).toContain(`<td class="vm-name">Eve ${escapeHtml(SCRIPT_PAYLOAD)}</td>`);
    expect(html).not.toMatch(/<script/i);
  });

  it('escapes branding site name and accent', () => {
    const html = generateHTMLTemplate(makeResults(), { siteName: '<b onclick="x">Org</b>', siteNameAccent: '"><script>1</script>' });
    expect(html).not.toContain('<b onclick');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;b onclick=&quot;x&quot;&gt;Org&lt;/b&gt;');
  });

  it('still renders allowed Markdown in the description', () => {
    const html = generateHTMLTemplate(makeResults({ description: '**Wichtig** _bitte_ [Info](https://example.com/a?x=1&y=2)\n\n- eins' }));
    expect(html).toContain('<strong>Wichtig</strong>');
    expect(html).toContain('<em>bitte</em>');
    expect(html).toContain('<a href="https://example.com/a?x=1&amp;y=2">Info</a>');
    expect(html).toContain('<li>eins</li>');
  });

  it('prevents attribute break-out via a single-quoted href in raw description HTML', () => {
    const html = generateHTMLTemplate(makeResults({ description: `<a href='https://x.example/" onmouseover="alert(1)'>hover</a>` }));
    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain('<a href="https://x.example/&quot; onmouseover=&quot;alert(1)">');
  });
});

describe('PDF export – URL and image validation', () => {
  it('drops a non-http video conference URL and escapes a valid one', () => {
    expect(generateHTMLTemplate(makeResults({ videoConferenceUrl: 'javascript:alert(1)' }))).not.toContain('Videokonferenz');
    const html = generateHTMLTemplate(makeResults({ videoConferenceUrl: 'https://meet.example/x?a="><script>1</script>' }));
    expect(html).not.toMatch(/<script/i);
    const section = html.match(/<div class="lh-video">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(section).toContain('Videokonferenz');
    expect(section).toContain('href="https://meet.example/x?a=%22%3E%3Cscript%3E1%3C/script%3E"');
  });

  it('drops a non-http poll URL', () => {
    const html = generateHTMLTemplate(makeResults(), { pollUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<div class="poll-link">');
  });

  it('only accepts data: images or https URLs for the logo', () => {
    const results = makeResults();
    expect(generateHTMLTemplate(results, { logoUrl: PNG_DATA_URL })).toContain(`<img src="${PNG_DATA_URL}" alt="Logo"`);
    expect(generateHTMLTemplate(results, { logoUrl: 'https://cdn.example/logo.png' })).toContain('<img src="https://cdn.example/logo.png" alt="Logo"');
    for (const bad of ['http://169.254.169.254/latest', 'file:///etc/passwd', 'data:text/html;base64,PHNjcmlwdD4=', '" onerror="alert(1)', '/uploads/logo.png']) {
      expect(generateHTMLTemplate(results, { logoUrl: bad })).not.toContain('alt="Logo"');
    }
  });

  it('only accepts an inline data: image for the QR code', () => {
    const results = makeResults();
    expect(generateHTMLTemplate(results, { qrCodeDataUrl: PNG_DATA_URL })).toContain('alt="QR Code"');
    expect(generateHTMLTemplate(results, { qrCodeDataUrl: 'https://evil.example/qr.png' })).not.toContain('alt="QR Code"');
  });

  it('URL helpers reject other schemes and malformed input', () => {
    expect(safeHttpUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(safeHttpUrl('ftp://a.example')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeImageSrc('https://a.example/x.png')).toBeNull();
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zy8+')).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('PDF export – logo resolution without renderer fetches', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-logo-'));
    await fs.writeFile(path.join(dir, 'logo.png'), Buffer.from(PNG_DATA_URL.split(',')[1], 'base64'));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'secret');
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('inlines uploaded logos as a data URL', async () => {
    expect(await resolvePdfLogoSrc('/uploads/logo.png', dir)).toBe(PNG_DATA_URL);
  });

  it('confines uploaded logo paths to the uploads directory', async () => {
    expect(await resolvePdfLogoSrc('/uploads/../logo.png', dir)).toBe(PNG_DATA_URL);
    expect(await resolvePdfLogoSrc('/uploads/../../etc/passwd', dir)).toBeUndefined();
    expect(await resolvePdfLogoSrc('/uploads/notes.txt', dir)).toBeUndefined();
    expect(await resolvePdfLogoSrc('/uploads/missing.png', dir)).toBeUndefined();
  });

  it('passes https logos through and rejects other URLs', async () => {
    expect(await resolvePdfLogoSrc('https://cdn.example/logo.png', dir)).toBe('https://cdn.example/logo.png');
    expect(await resolvePdfLogoSrc('http://10.0.0.1/logo.png', dir)).toBeUndefined();
    expect(await resolvePdfLogoSrc('', dir)).toBeUndefined();
    expect(await resolvePdfLogoSrc(null, dir)).toBeUndefined();
  });
});

describe('Test-report PDF – output encoding', () => {
  it('escapes test names, files, errors, categories and status classes', () => {
    const run = { id: 7, status: 'failed', triggeredBy: 'manual', startedAt: new Date(), duration: 1000 } as unknown as TestRun;
    const results = [
      { testFile: '<i>file</i>.ts', testName: SCRIPT_PAYLOAD, category: '<u>cat</u>', status: 'failed', duration: 3, error: IMG_PAYLOAD },
      { testFile: 'b.ts', testName: 'ok', category: 'api', status: '"><script>1</script>', duration: 1, error: null },
    ] as unknown as TestResult[];
    const html = generateTestReportHTMLTemplate(run, results);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<i>file</i>');
    expect(html).not.toContain('<u>cat</u>');
    expect(html).toContain(escapeHtml(SCRIPT_PAYLOAD));
    expect(html).toContain('<div class="test-item ">');
  });
});

describe('PDF renderer hardening (real Chromium)', () => {
  const available = chromiumAvailable();
  let service: PDFService;
  let server: http.Server;
  let baseUrl: string;
  let hits: string[];

  beforeAll(async () => {
    service = new PDFService();
    hits = [];
    server = http.createServer((req, res) => {
      hits.push(req.url || '');
      res.end('x');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  });

  afterAll(async () => {
    await service.cleanup();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it.skipIf(!available)('does not execute page scripts', async () => {
    const pdf = await service.renderHtmlToPdf('<html><head><title>original</title></head><body>x<script>document.title="SCRIPTRAN"</script></body></html>');
    const text = pdf.toString('latin1');
    expect(text).toContain('/Title (original)');
    expect(text).not.toContain('SCRIPTRAN');
  }, 60000);

  it.skipIf(!available)('blocks every network request that is not allow-listed', async () => {
    hits.length = 0;
    const html = `<html><head><link rel="stylesheet" href="${baseUrl}/css"></head><body>
      <img src="${baseUrl}/img"><iframe src="${baseUrl}/frame"></iframe>
      <object data="${baseUrl}/object"></object><meta http-equiv="refresh" content="0;url=${baseUrl}/refresh">
      <img src="${PNG_DATA_URL}"></body></html>`;
    const pdf = await service.renderHtmlToPdf(html);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(hits).toEqual([]);

    await service.renderHtmlToPdf(`<img src="${baseUrl}/allowed">`, { allowedUrls: [`${baseUrl}/allowed`] });
    expect(hits).toEqual(['/allowed']);
  }, 60000);

  it.skipIf(!available)('renders a poll with injected title, option and participant without side effects', async () => {
    hits.length = 0;
    const payload = `<img src="${baseUrl}/leak"><script>document.title="PWNED"</script>`;
    const pdf = await service.generatePollResultsPDF(
      makeResults({ title: payload, optionText: payload, voterName: payload }),
      { includeParticipantTable: true, logoUrl: `${baseUrl}/logo.png`, qrCodeDataUrl: PNG_DATA_URL },
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('/Title (PWNED)');
    expect(hits).toEqual([]);
  }, 60000);
});
