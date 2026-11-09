import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { storage } from '../../storage';
import { EmailTemplateService, jsonToHtml } from '../../services/emailTemplateService';

export const testMeta = {
  category: 'services' as const,
  name: 'E-Mail-Branding: Logo, Theme-Import und Vorlagen aus Bausteinen',
  description: 'Logos werden sicher eingebettet (keine internen Adressen), importierte Themes übernehmen nur gültige Farben und Bausteine-Vorlagen erzeugen passenden Klartext',
  severity: 'medium' as const,
};

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function renderWithLogo(logoUrl: string) {
  const real = await storage.getCustomizationSettings();
  vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValue({
    ...real,
    branding: { ...real.branding, logoUrl, siteName: 'Polly', siteNameAccent: '' },
  } as any);
  const service = new EmailTemplateService();
  const { html } = await service.wrapWithEmailTheme('Hello', '<p>Body</p>', 'Body');
  const match = html.match(/<img src="(data:[^"]+)"/);
  return match ? match[1] : null;
}

function mockFetchResponse(init: { ok?: boolean; body?: Buffer; type?: string | null } = {}) {
  const body = init.body ?? PNG_BYTES;
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: init.ok ?? true,
    headers: { get: () => (init.type === undefined ? 'image/png' : init.type) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as unknown as Response);
}

afterEach(() => vi.restoreAllMocks());

describe('email logo embedding', () => {
  it('inlines a public logo once and serves later emails from the cache', async () => {
    const fetchSpy = mockFetchResponse();
    const url = `https://cdn.example.org/logo-${nanoid(6)}.png`;
    const first = await renderWithLogo(url);
    expect(first).toBe(`data:image/png;base64,${PNG_BYTES.toString('base64')}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'error' });

    expect(await renderWithLogo(url)).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('defaults the image type when the server sends none', async () => {
    mockFetchResponse({ type: null });
    expect(await renderWithLogo(`https://cdn.example.org/${nanoid(6)}`)).toMatch(/^data:image\/png;base64,/);
  });

  it.each([
    ['an error status', { ok: false }],
    ['an empty file', { body: Buffer.alloc(0) }],
    ['a file over 500 KB', { body: Buffer.alloc(500_001) }],
  ])('sends the email without a logo when the logo URL returns %s', async (_label, init) => {
    mockFetchResponse(init);
    expect(await renderWithLogo(`https://cdn.example.org/${nanoid(6)}.png`)).toBeNull();
  });

  it('sends the email without a logo when the download fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    expect(await renderWithLogo(`https://cdn.example.org/${nanoid(6)}.png`)).toBeNull();
  });

  it.each([
    'http://localhost/logo.png',
    'http://127.0.0.1:5000/logo.png',
    'http://0.0.0.0/logo.png',
    'http://printer.local/logo.png',
    'https://metadata.internal/logo.png',
    'http://10.1.2.3/logo.png',
    'http://172.20.0.5/logo.png',
    'http://192.168.1.10/logo.png',
    'http://169.254.169.254/latest/meta-data',
    'ftp://cdn.example.org/logo.png',
    'not a url at all',
  ])('never requests internal or non-web logo addresses (%s)', async (url) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await renderWithLogo(url)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps valid inline image data and drops anything else', async () => {
    const valid = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
    expect(await renderWithLogo(valid)).toBe(valid);
    expect(await renderWithLogo('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
  });

  it('embeds uploaded logos from the uploads folder with the right type', async () => {
    const dir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const name = `email-logo-test-${nanoid(6)}.svg`;
    const file = path.join(dir, name);
    fs.writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const emptyName = `email-logo-empty-${nanoid(6)}.webp`;
    fs.writeFileSync(path.join(dir, emptyName), '');
    try {
      const uri = await renderWithLogo(`/uploads/${name}`);
      expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(Buffer.from(uri!.split(',')[1], 'base64').toString()).toContain('<svg');
      // Served from the cache even after the file is gone.
      fs.unlinkSync(file);
      expect(await renderWithLogo(`/uploads/${name}`)).toBe(uri);

      expect(await renderWithLogo(`/uploads/${emptyName}`)).toBeNull();
      expect(await renderWithLogo(`/uploads/missing-${nanoid(6)}.png`)).toBeNull();
      expect(await renderWithLogo('/uploads/../package.json')).toBeNull();
      expect(await renderWithLogo('/uploads/nested/logo.png')).toBeNull();
    } finally {
      fs.rmSync(file, { force: true });
      fs.rmSync(path.join(dir, emptyName), { force: true });
    }
  });
});

describe('importing a theme from the email builder', () => {
  it('saves only valid colors found in nested blocks', async () => {
    const service = new EmailTemplateService();
    const saved: unknown[] = [];
    // Capture instead of writing so a test theme never leaks into real emails.
    vi.spyOn(storage, 'setSetting').mockImplementation(async (s: any) => { saved.push(s); return s; });

    const theme = await service.importThemeFromEmailBuilder({
      root: { type: 'EmailLayout', data: { backdropColor: '#eeeeee', fontFamily: 'Georgia; drop', childrenIds: ['box', 'ghost', 'raw', 'nodata', 7] } },
      box: { type: 'Container', data: { style: {}, childrenIds: ['h', 't1', 't2', 'b', 'plain'] } },
      h: { type: 'Heading', data: { style: { color: 'rgb(10, 20, 30)' } } },
      t1: { type: 'Text', data: { style: { color: '#222' } } },
      t2: { type: 'Text', data: { style: { color: '#999' } } },
      b: { type: 'Button', data: { style: { backgroundColor: 'Blue', color: 'expression(alert(1))', borderRadius: 12.6 } } },
      plain: { type: 'Text', data: {} },
      raw: 'not a block',
      nodata: { type: 'Heading' },
    });

    expect(theme).toMatchObject({
      backdropColor: '#eeeeee',
      headingColor: 'rgb(10, 20, 30)',
      textColor: '#222',
      buttonBackgroundColor: 'blue',
      linkColor: 'blue',
      buttonBorderRadius: 13,
    });
    // Unsafe values are dropped, existing theme values are kept.
    expect(theme.fontFamily).not.toContain('drop');
    expect(theme.buttonTextColor).not.toContain('expression');
    expect(saved).toEqual([{ key: 'email_theme', value: theme }]);
  });
});

describe('templates built from blocks', () => {
  const doc = {
    root: { type: 'EmailLayout', data: { childrenIds: ['title', 'card', 'cta', 'line', 'pic', 'nopic', 'gone'] } },
    title: { type: 'Heading', data: { props: { text: 'Welcome <b>aboard</b>', level: 'h1' }, style: {} } },
    card: {
      type: 'Container',
      data: { props: { containerVariant: 'secondary' }, style: { borderWidth: 2, borderColor: '#ccc' }, childrenIds: ['inner'] },
    },
    inner: { type: 'Text', data: { props: { text: 'Inside the card' }, style: { color: '#123456', fontSize: 14 } } },
    cta: { type: 'Button', data: { props: { text: 'Open poll', url: 'https://polly.example/p/1', buttonType: 'secondary' }, style: { margin: { top: 8 } } } },
    line: { type: 'Divider', data: { props: {}, style: { padding: { top: 4, bottom: 4 } } } },
    pic: { type: 'Image', data: { props: { src: 'https://cdn.example.org/a.png', alt: 'A' }, style: { width: '50%' } } },
    nopic: { type: 'Image', data: { props: {}, style: {} } },
  };

  it('derives the plain-text version from the blocks when saving', async () => {
    const service = new EmailTemplateService();
    vi.spyOn(storage, 'upsertEmailTemplate').mockImplementation(async (t: any) => t);

    const saved: any = await service.saveTemplate('welcome', doc, 'Hi', undefined, undefined, 'en');
    expect(saved.textContent).toBe('Welcome aboard\n\nInside the card\n\nOpen poll\n\nhttps://polly.example/p/1');
    expect(saved).toMatchObject({ type: 'welcome', language: 'en', subject: 'Hi', isDefault: false });
    expect(saved.htmlContent).toContain('<h1 class="email-heading"');
    expect(saved.htmlContent).toContain('class="email-btn-secondary"');
    expect(saved.htmlContent).toContain('border: 2px solid #ccc');
    expect(saved.htmlContent).toContain('<img src="https://cdn.example.org/a.png" alt="A" style="max-width: 50%;');
    expect(saved.htmlContent.match(/<img /g)).toHaveLength(1);
    expect(saved.htmlContent).toContain('class="email-divider"');

    // A layout without blocks keeps the default text so the email is never empty.
    const empty: any = await service.saveTemplate('welcome', { root: { type: 'EmailLayout', data: { childrenIds: [] } } } as any, undefined, undefined, undefined, 'en');
    expect(empty.textContent).toBe(EmailTemplateService.getDefaultTemplate('welcome', 'en').textContent);
  });

  it.each([
    ['no childrenIds list', { type: 'EmailLayout', data: {} }],
    ['childrenIds that is not a list', { type: 'EmailLayout', data: { childrenIds: 'title' } }],
    ['no data at all', { type: 'EmailLayout' }],
  ])('saves a layout with %s as an empty template instead of failing', async (_label, root) => {
    const service = new EmailTemplateService();
    vi.spyOn(storage, 'upsertEmailTemplate').mockImplementation(async (t: any) => t);

    const saved: any = await service.saveTemplate('welcome', { root } as any, 'Hi', undefined, undefined, 'en');
    expect(saved.htmlContent).toMatch(/^<div style="font-family: [^"]+">\s*<\/div>$/);
    expect(saved.htmlContent).not.toContain('Ungültiges Format');
    expect(saved.textContent).toBe(EmailTemplateService.getDefaultTemplate('welcome', 'en').textContent);
  });

  it('skips malformed nested blocks but keeps rendering the valid ones', () => {
    const html = jsonToHtml({
      root: { type: 'EmailLayout', data: { childrenIds: ['box', 'bare', 7, 'ok'] } },
      box: { type: 'Container', data: { style: {}, childrenIds: 'inner' } },
      bare: { type: 'Text' },
      ok: { type: 'Text', data: { props: { text: 'Still here' }, style: {} } },
    } as any);
    expect(html).toContain('Still here');
    expect(html).toContain('email-container-box');
  });

  it('renders container variants in the theme colors and flags invalid documents', () => {
    const primary = jsonToHtml({
      root: { type: 'EmailLayout', data: { childrenIds: ['c'] } },
      c: { type: 'Container', data: { props: { containerVariant: 'primary' }, style: {}, childrenIds: [] } },
    } as any);
    expect(primary).toMatch(/email-container-c" style="background-color: #[0-9A-F]{6}/);
    expect(primary).not.toContain('#f8f9fa');
    expect(jsonToHtml({ root: { type: 'Other', data: {} } } as any)).toContain('Ungültiges Format');
  });

  it('exposes the default template definitions per language', () => {
    const service = new EmailTemplateService();
    const de = service.getDefaultTemplate('welcome');
    const en = service.getDefaultTemplate('welcome', 'en');
    expect(de.jsonContent).toHaveProperty('root');
    expect(en.subject).not.toBe(de.subject);
  });
});
