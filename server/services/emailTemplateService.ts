import { storage } from '../storage';
import { 
  type EmailTemplate, 
  type EmailTemplateType, 
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES
} from '@shared/schema';

// Email theme settings that can be imported from emailbuilder.js
export interface EmailTheme {
  backdropColor: string;
  canvasColor: string;
  textColor: string;
  headingColor: string;
  linkColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number;
  fontFamily: string;
  secondaryButtonBackgroundColor: string;
  secondaryButtonTextColor: string;
  darkBackdropColor: string;
  darkCanvasColor: string;
  darkTextColor: string;
  darkHeadingColor: string;
}

// Default email theme
const DEFAULT_EMAIL_THEME: EmailTheme = {
  backdropColor: '#F5F5F5',
  canvasColor: '#FFFFFF',
  textColor: '#333333',
  headingColor: '#FF6B35',
  linkColor: '#FF6B35',
  buttonBackgroundColor: '#FF6B35',
  buttonTextColor: '#FFFFFF',
  buttonBorderRadius: 6,
  fontFamily: 'Arial, sans-serif',
  secondaryButtonBackgroundColor: '#4A90A4',
  secondaryButtonTextColor: '#FFFFFF',
  darkBackdropColor: '#1a1a2e',
  darkCanvasColor: '#16213e',
  darkTextColor: '#e0e0e0',
  darkHeadingColor: '#FF8C5A',
};

// Validate and sanitize CSS color values (hex, rgb, rgba, named colors)
function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  
  // Hex color (3, 4, 6, or 8 chars)
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) {
    return trimmed;
  }
  
  // RGB/RGBA
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i.test(trimmed)) {
    return trimmed;
  }
  
  // Named colors (basic list)
  const namedColors = ['white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'grey', 'transparent'];
  if (namedColors.includes(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  
  return null;
}

// Validate and sanitize font family strings - strict regex for safe fonts only
function sanitizeFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  
  // Strict regex: only allow letters, numbers, spaces, commas, hyphens, and single quotes for font names
  // This prevents injection attacks via quotes, semicolons, or other special characters
  if (!/^[A-Za-z0-9 ,\-']+$/.test(trimmed)) {
    return null;
  }
  
  // Limit length
  if (trimmed.length > 200) return null;
  if (trimmed.length === 0) return null;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return null;
  
  return trimmed;
}

// Validate border radius
function sanitizeBorderRadius(value: unknown): number | null {
  if (typeof value === 'number' && value >= 0 && value <= 100) {
    return Math.round(value);
  }
  return null;
}

function lightenColorByPercent(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xFF) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0xFF) + Math.round(255 * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xFF) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xFF) - Math.round(255 * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const NAMED_COLORS: Record<string, string> = {
  white: '#FFFFFF', black: '#000000', red: '#FF0000', green: '#008000',
  blue: '#0000FF', yellow: '#FFFF00', orange: '#FFA500', gray: '#808080',
  grey: '#808080', transparent: '#000000',
};

function colorToRgb(color: string): { r: number; g: number; b: number } {
  const c = color.trim().toLowerCase();

  const namedHex = NAMED_COLORS[c];
  if (namedHex) {
    const num = parseInt(namedHex.slice(1), 16);
    return { r: (num >> 16) & 0xFF, g: (num >> 8) & 0xFF, b: num & 0xFF };
  }

  const rgbMatch = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }

  let hex = c.startsWith('#') ? c.slice(1) : c;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (/^[0-9a-f]{8}$/.test(hex)) {
    hex = hex.slice(0, 6);
  }
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    throw new Error(`Invalid color: ${color}`);
  }
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 0xFF, g: (num >> 8) & 0xFF, b: num & 0xFF };
}

function getRelativeLuminance(color: string): number {
  const { r, g, b } = colorToRgb(color);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ensureButtonTextContrast(bgColor: string, preferredTextColor: string, fallbackDark: string = '#1a1a1a'): string {
  try {
    const ratio = getContrastRatio(bgColor, preferredTextColor);
    if (ratio >= 4.5) return preferredTextColor;
    const whiteRatio = getContrastRatio(bgColor, '#FFFFFF');
    const darkRatio = getContrastRatio(bgColor, fallbackDark);
    return darkRatio > whiteRatio ? fallbackDark : '#FFFFFF';
  } catch {
    return preferredTextColor;
  }
}

const logoBase64Cache = new Map<string, { data: string; fetchedAt: number }>();
const LOGO_CACHE_TTL = 5 * 60 * 1000;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '0.0.0.0' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    if (!isSafeUrl(url)) return null;
    const cached = logoBase64Cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < LOGO_CACHE_TTL) {
      return cached.data;
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > 500_000) return null;
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUri = `data:${contentType};base64,${base64}`;
    logoBase64Cache.set(url, { data: dataUri, fetchedAt: Date.now() });
    return dataUri;
  } catch {
    return null;
  }
}

async function readLocalLogoAsBase64(relativePath: string): Promise<string | null> {
  try {
    const cached = logoBase64Cache.get(relativePath);
    if (cached && Date.now() - cached.fetchedAt < LOGO_CACHE_TTL) {
      return cached.data;
    }
    const filename = relativePath.replace(/^\/uploads\//, '');
    if (filename.includes('..') || filename.includes('/')) return null;
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const filePath = join(process.cwd(), 'uploads', filename);
    const buffer = await readFile(filePath);
    if (buffer.byteLength === 0 || buffer.byteLength > 500_000) return null;
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
    const mime = mimeMap[ext] || 'image/png';
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
    logoBase64Cache.set(relativePath, { data: dataUri, fetchedAt: Date.now() });
    return dataUri;
  } catch {
    return null;
  }
}

// Default email template JSON structures for email-builder-js
// These follow the email-builder-js format with blocks

interface EmailBuilderBlock {
  type: string;
  data: Record<string, unknown>;
}

interface EmailBuilderDocument {
  root: {
    type: 'EmailLayout';
    data: {
      backdropColor: string;
      canvasColor: string;
      textColor: string;
      fontFamily: string;
      childrenIds: string[];
    };
  };
  [blockId: string]: EmailBuilderBlock;
}

interface TemplateDefinition {
  name: string;
  subject: string;
  jsonContent: EmailBuilderDocument;
  textContent: string;
}

function tpl(
  blocks: Record<string, EmailBuilderBlock>,
  childrenIds: string[]
): EmailBuilderDocument {
  return {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F5F5F5',
        canvasColor: '#FFFFFF',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        childrenIds,
      },
    },
    ...blocks,
  };
}

function heading(id: string, text: string, level: string = 'h2'): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Heading',
    data: {
      props: { text, level },
      style: { fontWeight: 'bold', padding: { top: 16, bottom: 8, left: 24, right: 24 } },
    },
  }];
}

function txt(id: string, text: string, opts?: { bold?: boolean; color?: string; fontSize?: number }): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Text',
    data: {
      props: { text },
      style: {
        fontSize: opts?.fontSize || 16,
        padding: { top: 8, bottom: 8, left: 24, right: 24 },
        ...(opts?.bold ? { fontWeight: 'bold' } : {}),
        ...(opts?.color ? { color: opts.color } : {}),
      },
    },
  }];
}

function btn(id: string, text: string, urlVar: string, type: 'primary' | 'secondary' = 'primary'): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Button',
    data: {
      props: { text, url: `{{${urlVar}}}`, buttonType: type },
      style: {
        padding: { top: 12, bottom: 12, left: 24, right: 24 },
        margin: { top: 12, bottom: 12, left: 0, right: 0 },
      },
    },
  }];
}

function lightenColor(hex: string, amount: number): string {
  try {
    const { r, g, b } = colorToRgb(hex);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0').toUpperCase()}`;
  } catch {
    return '#f8f9fa';
  }
}

function darkenColorForDarkMode(hex: string): string {
  try {
    const { r, g, b } = colorToRgb(hex);
    const dr = Math.round(r * 0.15 + 20);
    const dg = Math.round(g * 0.15 + 20);
    const db = Math.round(b * 0.15 + 30);
    return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0')}`;
  } catch {
    return '#2a2a3e';
  }
}

function container(
  id: string,
  fallbackBg: string,
  fallbackDarkBg: string,
  childDefs: [string, EmailBuilderBlock][],
  variant: 'primary' | 'secondary' = 'primary'
): { entry: [string, EmailBuilderBlock]; children: Record<string, EmailBuilderBlock> } {
  const childIds = childDefs.map(([cid]) => cid);
  const children: Record<string, EmailBuilderBlock> = {};
  for (const [cid, cblock] of childDefs) {
    children[cid] = cblock;
  }
  return {
    entry: [id, {
      type: 'Container',
      data: {
        childrenIds: childIds,
        props: { containerVariant: variant },
        style: {
          backgroundColor: fallbackBg,
          darkBackgroundColor: fallbackDarkBg,
          borderRadius: 8,
          padding: { top: 20, right: 24, bottom: 20, left: 24 },
          margin: { top: 12, right: 24, bottom: 12, left: 24 },
        },
      },
    }],
    children,
  };
}

function img(id: string, srcVar: string, alt: string, width: string = '150px'): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Image',
    data: {
      props: { src: `{{${srcVar}}}`, alt },
      style: { width, padding: { top: 16, right: 0, bottom: 16, left: 0 } },
    },
  }];
}

function divider(id: string): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Divider',
    data: { style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } } },
  }];
}


function buildTemplate(
  name: string,
  subject: string,
  defs: [string, EmailBuilderBlock][],
  containers: { entry: [string, EmailBuilderBlock]; children: Record<string, EmailBuilderBlock> }[],
  textContent: string
): TemplateDefinition {
  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];
  for (const [bid, block] of defs) {
    allBlocks[bid] = block;
    topIds.push(bid);
  }
  for (const c of containers) {
    const [cid, cblock] = c.entry;
    allBlocks[cid] = cblock;
    topIds.push(cid);
    for (const [chid, chblock] of Object.entries(c.children)) {
      allBlocks[chid] = chblock;
    }
  }
  return { name, subject, jsonContent: tpl(allBlocks, topIds), textContent };
}

function buildSimpleTemplate(
  name: string,
  subject: string,
  headingText: string,
  paragraphs: string[],
  buttonText?: string,
  buttonVar?: string,
  buttonType: 'primary' | 'secondary' = 'primary',
): TemplateDefinition {
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', headingText, 'h1'));
  paragraphs.forEach((p, i) => defs.push(txt(`t${i}`, p)));
  if (buttonText && buttonVar) defs.push(btn('b1', buttonText, buttonVar, buttonType));
  defs.push(divider('d1'));
  
  let textContent = `${headingText}\n\n${paragraphs.join('\n\n')}`;
  if (buttonText && buttonVar) textContent += `\n\n${buttonText}: {{${buttonVar}}}`;
  
  return buildTemplate(name, subject, defs, [], textContent);
}

// ---- poll_created: the showcase template with containers ----
function buildPollCreatedTemplate(): TemplateDefinition {
  const adminBox = container('admin-box', '#f8f9fa', '#2a2a3e', [
    heading('ab-h', 'Administratorlink', 'h3'),
    txt('ab-t', 'Mit diesem Link l\u00E4sst sich die Umfrage verwalten, bearbeiten und die Ergebnisse einsehen.'),
    btn('ab-btn', 'Umfrage verwalten', 'adminLink', 'primary'),
  ]);

  const publicBox = container('public-box', '#e8f4f8', '#1e3a4a', [
    heading('pb-h', 'Öffentlicher Link zum Teilen', 'h3'),
    txt('pb-t', 'Diesen Link an alle Teilnehmer weiterleiten, damit diese an der Abstimmung teilnehmen k\u00F6nnen.'),
    btn('pb-btn', 'Zur Abstimmung', 'publicLink', 'secondary'),
  ], 'secondary');

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', '{{pollType}} erfolgreich erstellt!', 'h1'),
    txt('t1', 'Hallo,'),
    txt('t2', 'Die {{pollType}} <strong>"{{pollTitle}}"</strong> wurde erfolgreich erstellt.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    txt('warn', '<strong>\u26A0\uFE0F Wichtig:</strong> Den Administratorlink sicher aufbewahren. Nur damit l\u00E4sst sich die Umfrage verwalten.', { bold: true }),
    divider('d1'),
  ];

  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];

  for (const [id, block] of topDefs) { allBlocks[id] = block; topIds.push(id); }
  
  const [adminId, adminBlock] = adminBox.entry;
  allBlocks[adminId] = adminBlock; topIds.push(adminId);
  for (const [cid, cb] of Object.entries(adminBox.children)) allBlocks[cid] = cb;

  const [pubId, pubBlock] = publicBox.entry;
  allBlocks[pubId] = pubBlock; topIds.push(pubId);
  for (const [cid, cb] of Object.entries(publicBox.children)) allBlocks[cid] = cb;

  for (const [id, block] of bottomDefs) { allBlocks[id] = block; topIds.push(id); }

  const textContent = `{{pollType}} erfolgreich erstellt!\n\nHallo,\n\nDie {{pollType}} "{{pollTitle}}" wurde erfolgreich erstellt.\n\nAdministratorlink:\nUmfrage verwalten: {{adminLink}}\n\n\u00D6ffentlicher Link zum Teilen:\nZur Abstimmung: {{publicLink}}\n\nWichtig: Den Administratorlink sicher aufbewahren. Nur damit l\u00E4sst sich die Umfrage verwalten.`;

  return { name: 'Umfrage erstellt', subject: '[{{siteName}}] {{pollType}} wurde erstellt: {{pollTitle}}', jsonContent: tpl(allBlocks, topIds), textContent };
}

// ---- invitation with QR code ----
function buildInvitationTemplate(): TemplateDefinition {
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', 'Einladung zur Abstimmung', 'h1'));
  defs.push(txt('t0', 'Hallo,'));
  defs.push(txt('t1', '{{inviterName}} lädt Sie ein, an der Umfrage <strong>"{{pollTitle}}"</strong> teilzunehmen.'));
  defs.push(txt('t2', '{{message}}'));
  defs.push(btn('b1', 'Jetzt abstimmen', 'publicLink', 'primary'));
  defs.push(img('qr', 'qrCodeUrl', 'QR-Code zur Umfrage', '150px'));
  defs.push(divider('d1'));

  const textContent = `Einladung zur Abstimmung\n\nHallo,\n\n{{inviterName}} lädt Sie ein, an der Umfrage "{{pollTitle}}" teilzunehmen.\n\n{{message}}\n\nJetzt abstimmen: {{publicLink}}`;

  return buildTemplate('Einladung zur Umfrage', '[{{siteName}}] {{inviterName}} lädt Sie ein: {{pollTitle}}', defs, [], textContent);
}

// ---- reminder with QR code ----
function buildReminderTemplate(): TemplateDefinition {
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', 'Erinnerung zur Abstimmung', 'h1'));
  defs.push(txt('t0', 'Hallo,'));
  defs.push(txt('t1', '{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage <strong>"{{pollTitle}}"</strong>.'));
  defs.push(txt('t2', 'Ihre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.'));
  defs.push(txt('t3', '{{expiresAt}}'));
  defs.push(btn('b1', 'Jetzt abstimmen', 'pollLink', 'primary'));
  defs.push(img('qr', 'qrCodeUrl', 'QR-Code zur Umfrage', '150px'));
  defs.push(divider('d1'));

  const textContent = `Erinnerung zur Abstimmung\n\nHallo,\n\n{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage "{{pollTitle}}".\n\nIhre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.\n\n{{expiresAt}}\n\nJetzt abstimmen: {{pollLink}}`;

  return buildTemplate('Erinnerung', '[{{siteName}}] Erinnerung: {{pollTitle}}', defs, [], textContent);
}

// ---- vote_confirmation with container ----
function buildVoteConfirmationTemplate(): TemplateDefinition {
  const linkBox = container('link-box', '#e8f4f8', '#1e3a4a', [
    txt('lb-t', 'Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren oder die aktuellen Ergebnisse einsehen.'),
    btn('lb-btn1', 'Ergebnisse anzeigen', 'resultsLink', 'secondary'),
  ], 'secondary');

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Vielen Dank für Ihre Teilnahme!', 'h1'),
    txt('t1', 'Hallo {{voterName}},'),
    txt('t2', 'vielen Dank für Ihre Teilnahme an der {{pollType}} <strong>"{{pollTitle}}"</strong>. Ihre Auswahl wurde erfolgreich gespeichert.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    divider('d1'),
  ];

  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];
  for (const [id, block] of topDefs) { allBlocks[id] = block; topIds.push(id); }
  const [boxId, boxBlock] = linkBox.entry;
  allBlocks[boxId] = boxBlock; topIds.push(boxId);
  for (const [cid, cb] of Object.entries(linkBox.children)) allBlocks[cid] = cb;
  for (const [id, block] of bottomDefs) { allBlocks[id] = block; topIds.push(id); }

  return {
    name: 'Abstimmungsbestätigung',
    subject: '[{{siteName}}] Vielen Dank für Ihre Teilnahme - {{pollTitle}}',
    jsonContent: tpl(allBlocks, topIds),
    textContent: 'Vielen Dank für Ihre Teilnahme!\n\nHallo {{voterName}},\n\nvielen Dank für Ihre Teilnahme an der {{pollType}} "{{pollTitle}}". Ihre Auswahl wurde erfolgreich gespeichert.\n\nErgebnisse anzeigen: {{resultsLink}}',
  };
}

// ---- password_reset with container ----
function buildPasswordResetTemplate(): TemplateDefinition {
  const actionBox = container('action-box', '#f8f9fa', '#2a2a3e', [
    txt('ab-t', 'Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben. Dieser Link ist 1 Stunde gültig.'),
    btn('ab-btn', 'Passwort zurücksetzen', 'resetLink', 'primary'),
  ]);

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Passwort zurücksetzen', 'h1'),
    txt('t1', 'Hallo {{userName}},'),
    txt('t2', 'Sie haben angefordert, Ihr Passwort für Ihren {{siteName}} Account zurückzusetzen.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    txt('t3', 'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.', { color: '#6c757d', fontSize: 14 }),
    divider('d1'),
  ];

  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];
  for (const [id, block] of topDefs) { allBlocks[id] = block; topIds.push(id); }
  const [boxId, boxBlock] = actionBox.entry;
  allBlocks[boxId] = boxBlock; topIds.push(boxId);
  for (const [cid, cb] of Object.entries(actionBox.children)) allBlocks[cid] = cb;
  for (const [id, block] of bottomDefs) { allBlocks[id] = block; topIds.push(id); }

  return {
    name: 'Passwort zurücksetzen',
    subject: '[{{siteName}}] Passwort zurücksetzen',
    jsonContent: tpl(allBlocks, topIds),
    textContent: 'Passwort zurücksetzen\n\nHallo {{userName}},\n\nSie haben angefordert, Ihr Passwort zurückzusetzen.\n\nPasswort zurücksetzen: {{resetLink}}\n\nDieser Link ist 1 Stunde gültig.',
  };
}

// ---- welcome with container ----
function buildWelcomeTemplate(): TemplateDefinition {
  const actionBox = container('action-box', '#e8f4f8', '#1e3a4a', [
    txt('ab-t', 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um alle Funktionen von {{siteName}} nutzen zu können.'),
    btn('ab-btn', 'E-Mail bestätigen', 'verificationLink', 'secondary'),
  ], 'secondary');

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Willkommen bei {{siteName}}!', 'h1'),
    txt('t1', 'Hallo {{userName}},'),
    txt('t2', 'vielen Dank für Ihre Registrierung bei {{siteName}}! Ihr Account wurde erfolgreich erstellt.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    divider('d1'),
  ];

  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];
  for (const [id, block] of topDefs) { allBlocks[id] = block; topIds.push(id); }
  const [boxId, boxBlock] = actionBox.entry;
  allBlocks[boxId] = boxBlock; topIds.push(boxId);
  for (const [cid, cb] of Object.entries(actionBox.children)) allBlocks[cid] = cb;
  for (const [id, block] of bottomDefs) { allBlocks[id] = block; topIds.push(id); }

  return {
    name: 'Willkommen',
    subject: '[{{siteName}}] Willkommen bei {{siteName}}!',
    jsonContent: tpl(allBlocks, topIds),
    textContent: 'Willkommen bei {{siteName}}!\n\nHallo {{userName}},\n\nvielen Dank für Ihre Registrierung! Ihr Account wurde erfolgreich erstellt.\n\nE-Mail bestätigen: {{verificationLink}}',
  };
}

const DEFAULT_TEMPLATES: Record<EmailTemplateType, TemplateDefinition> = {
  poll_created: buildPollCreatedTemplate(),

  invitation: buildInvitationTemplate(),

  vote_confirmation: buildVoteConfirmationTemplate(),

  reminder: buildReminderTemplate(),

  password_reset: buildPasswordResetTemplate(),

  email_change: buildSimpleTemplate(
    'E-Mail-Adresse ändern',
    '[{{siteName}}] E-Mail-Adresse bestätigen',
    'E-Mail-Adresse bestätigen',
    [
      'Hallo,',
      'Sie haben angefordert, Ihre E-Mail-Adresse für Ihren {{siteName}} Account zu ändern.',
      '<strong>Alte E-Mail:</strong> {{oldEmail}}',
      '<strong>Neue E-Mail:</strong> {{newEmail}}',
      'Dieser Link ist 24 Stunden gültig.',
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
    ],
    'E-Mail bestätigen',
    'confirmLink',
  ),

  password_changed: buildSimpleTemplate(
    'Passwort geändert',
    '[{{siteName}}] Ihr Passwort wurde geändert',
    'Passwort erfolgreich geändert',
    [
      'Hallo {{userName}},',
      'Ihr Passwort für Ihren {{siteName}} Account wurde erfolgreich geändert.',
      '<strong>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie bitte umgehend den Administrator.</strong>',
    ],
  ),

  test_report: buildSimpleTemplate(
    'Testbericht',
    '[{{siteName}}] Testbericht #{{testRunId}}: {{status}}',
    '{{status}} — Automatischer Testbericht',
    [
      'Der automatische Testlauf <strong>#{{testRunId}}</strong> wurde abgeschlossen.',
      'Gesamte Tests: {{totalTests}}',
      'Bestanden: {{passed}}',
      'Fehlgeschlagen: {{failed}}',
      'Übersprungen: {{skipped}}',
      'Dauer: {{duration}}',
      'Gestartet: {{startedAt}}',
    ],
  ),

  welcome: buildWelcomeTemplate(),

  poll_finalized: buildSimpleTemplate(
    'Termin bestätigt',
    '[{{siteName}}] Termin bestätigt: {{pollTitle}}',
    'Termin bestätigt',
    [
      'Hallo,',
      'für die Terminumfrage <strong>„{{pollTitle}}"</strong> wurde ein Termin festgelegt.',
      '<strong>Datum:</strong> {{confirmedDate}}',
      '{{confirmedTime}}',
      '{{videoConferenceUrl}}',
      'Im Anhang finden Sie eine Kalendereinladung (.ics), die Sie direkt in Ihren Kalender importieren können.',
    ],
    'Zur Umfrage',
    'pollLink',
  ),
};

// HTML escape helper to prevent XSS
function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render footer markup: escapes HTML but processes {{link:URL}} and {{link:URL|Label}} syntax.
 * - {{link:https://example.com}} → <a href="https://example.com" target="_blank">example.com</a>
 * - {{link:https://example.com|Datenschutz}} → <a href="https://example.com" target="_blank">Datenschutz</a>
 * - All other text is HTML-escaped for XSS safety.
 */
function renderFooterMarkup(input: string, linkStyle: string = ''): string {
  const linkPattern = /\{\{link:([^|}]+?)(?:\|([^}]+?))?\}\}/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push(htmlEscape(input.slice(lastIndex, match.index)));
    }
    const url = match[1].trim();
    const label = match[2]?.trim();
    const displayText = label || url.replace(/^https?:\/\//, '');
    const isUrlSafe = /^(https?:\/\/|mailto:)/i.test(url);
    if (isUrlSafe) {
      const styleAttr = linkStyle ? ` style="${linkStyle}"` : '';
      parts.push(`<a href="${htmlEscape(url)}" target="_blank" rel="noopener noreferrer"${styleAttr}>${htmlEscape(displayText)}</a>`);
    } else {
      parts.push(htmlEscape(displayText));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    parts.push(htmlEscape(input.slice(lastIndex)));
  }

  return parts.join('').replace(/\n/g, '<br>');
}

/**
 * Strip {{link:URL|Label}} markup from text for plain-text output.
 * - {{link:https://example.com}} → https://example.com
 * - {{link:https://example.com|Datenschutz}} → Datenschutz (https://example.com)
 */
function stripFooterMarkupToText(input: string): string {
  return input.replace(/\{\{link:([^|}]+?)(?:\|([^}]+?))?\}\}/g, (_match, url: string, label?: string) => {
    const trimUrl = url.trim();
    const trimLabel = label?.trim();
    const isUrlSafe = /^(https?:\/\/|mailto:)/i.test(trimUrl);
    if (!isUrlSafe) {
      return trimLabel || '';
    }
    if (trimLabel) {
      return `${trimLabel} (${trimUrl})`;
    }
    return trimUrl;
  });
}

// Template rendering - replace variables with actual values
// Note: leaves unmatched variables as-is (does not remove them)
export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  }
  
  return result;
}

// Substitute variables with HTML escaping (for safe HTML content)
export function substituteVariables(
  template: string,
  variables: Record<string, string | undefined>,
  escapeHtml: boolean = true
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const safeValue = escapeHtml ? htmlEscape(value) : value;
      result = result.replace(regex, safeValue);
    }
  }
  
  return result;
}

function resolveTheme(theme?: EmailTheme, rootData?: Record<string, unknown>) {
  const rd = (rootData || {}) as Record<string, string>;
  const t = theme || DEFAULT_EMAIL_THEME;
  const buttonBg = t.buttonBackgroundColor || DEFAULT_EMAIL_THEME.buttonBackgroundColor;
  const secondaryBg = t.secondaryButtonBackgroundColor || DEFAULT_EMAIL_THEME.secondaryButtonBackgroundColor;
  const rawButtonText = t.buttonTextColor || DEFAULT_EMAIL_THEME.buttonTextColor;
  const rawSecondaryText = t.secondaryButtonTextColor || DEFAULT_EMAIL_THEME.secondaryButtonTextColor;
  return {
    textColor: t.textColor || rd.textColor || DEFAULT_EMAIL_THEME.textColor,
    headingColor: t.headingColor || DEFAULT_EMAIL_THEME.headingColor,
    buttonBg,
    buttonText: ensureButtonTextContrast(buttonBg, rawButtonText),
    buttonRadius: t.buttonBorderRadius ?? DEFAULT_EMAIL_THEME.buttonBorderRadius,
    secondaryBg,
    secondaryText: ensureButtonTextContrast(secondaryBg, rawSecondaryText),
    fontFamily: t.fontFamily || rd.fontFamily || DEFAULT_EMAIL_THEME.fontFamily,
  };
}

function renderPadding(padding: Record<string, number> | undefined): string {
  if (!padding) return '';
  return `padding: ${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px;`;
}

function renderMargin(margin: Record<string, number> | undefined): string {
  if (!margin) return '';
  return `margin: ${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px;`;
}

function renderBlocksToHtml(
  blockIds: string[],
  doc: EmailBuilderDocument,
  tv: ReturnType<typeof resolveTheme>
): string {
  let html = '';
  for (const blockId of blockIds) {
    const block = doc[blockId];
    if (!block) continue;

    const blockData = block.data as Record<string, unknown>;
    const props = (blockData.props || {}) as Record<string, unknown>;
    const style = (blockData.style || {}) as Record<string, unknown>;

    switch (block.type) {
      case 'Heading': {
        const level = props.level || 'h2';
        const text = props.text || '';
        const color = (style.color as string) || tv.headingColor;
        const fontWeight = (style.fontWeight as string) || 'bold';
        const fontSizeMap: Record<string, string> = { h1: '26px', h2: '22px', h3: '18px', h4: '16px' };
        const fontSize = fontSizeMap[level as string] || '22px';
        const lineHeight = level === 'h1' ? '1.3' : '1.4';
        html += `<${level} class="email-heading" style="color: ${color}; font-size: ${fontSize}; line-height: ${lineHeight}; ${renderPadding(style.padding as Record<string, number>)} margin: 0; font-weight: ${fontWeight};">${text}</${level}>\n`;
        break;
      }
      case 'Text': {
        const text = props.text || '';
        const color = (style.color as string) || tv.textColor;
        const fontSize = style.fontSize || 16;
        const fontWeight = (style.fontWeight as string) || 'normal';
        html += `<p class="email-text" style="color: ${color}; font-size: ${fontSize}px; ${renderPadding(style.padding as Record<string, number>)} margin: 0; line-height: 1.6; font-weight: ${fontWeight};">${text}</p>\n`;
        break;
      }
      case 'Button': {
        const text = props.text || 'Click';
        const url = props.url || '#';
        const buttonType = props.buttonType as string || 'primary';
        const explicitBg = style.backgroundColor as string | undefined;
        const bgColor = explicitBg || (buttonType === 'secondary' ? tv.secondaryBg : tv.buttonBg);
        const color = (style.color as string) || (buttonType === 'secondary' ? tv.secondaryText : tv.buttonText);
        const borderRadius = tv.buttonRadius;
        const paddingStyle = renderPadding(style.padding as Record<string, number>) || 'padding: 14px 28px;';
        const marginStyle = renderMargin(style.margin as Record<string, number>);
        const cssClass = buttonType === 'secondary' ? 'email-btn-secondary' : 'email-btn-primary';
        html += `<div style="text-align: center; ${marginStyle}">
          <a href="${url}" class="${cssClass}" style="display: inline-block; text-decoration: none; background-color: ${bgColor}; color: ${color}; ${paddingStyle} border-radius: ${borderRadius}px; font-weight: 600; font-size: 15px; min-width: 160px; text-align: center;">${text}</a>
        </div>\n`;
        break;
      }
      case 'Container': {
        const variant = props.containerVariant as string | undefined;
        let bgColor: string;
        if (variant === 'secondary' && tv.secondaryBg) {
          bgColor = lightenColor(tv.secondaryBg, 0.85);
        } else if (variant === 'primary' && tv.buttonBg) {
          bgColor = lightenColor(tv.buttonBg, 0.92);
        } else {
          bgColor = (style.backgroundColor as string) || '#f8f9fa';
        }
        const borderRadius = (style.borderRadius as number) ?? 8;
        const borderColor = (style.borderColor as string) || 'transparent';
        const borderWidth = (style.borderWidth as number) ?? 0;
        const padding = style.padding as Record<string, number> || { top: 20, right: 24, bottom: 20, left: 24 };
        const margin = style.margin as Record<string, number> || { top: 12, right: 0, bottom: 12, left: 0 };
        const childIds = (blockData.childrenIds || []) as string[];
        const childHtml = renderBlocksToHtml(childIds, doc, tv);
        const containerClass = `email-container email-container-${blockId}`;
        html += `<div class="${containerClass}" style="background-color: ${bgColor}; border-radius: ${borderRadius}px; ${renderPadding(padding)} ${renderMargin(margin)}${borderWidth > 0 ? ` border: ${borderWidth}px solid ${borderColor};` : ''}">
${childHtml}</div>\n`;
        break;
      }
      case 'Divider': {
        const paddingStyle = renderPadding(style.padding as Record<string, number>);
        html += `<div style="${paddingStyle}"><hr class="email-divider" style="margin: 0; border: none; border-top: 1px solid #e9ecef;"></div>\n`;
        break;
      }
      case 'Image': {
        const src = props.src || '';
        const alt = props.alt || '';
        const width = style.width || '100%';
        if (src) {
          html += `<div style="text-align: center;"><img src="${src}" alt="${alt}" style="max-width: ${width}; height: auto;"></div>\n`;
        }
        break;
      }
    }
  }
  return html;
}

function extractTextRecursive(blockIds: string[], doc: EmailBuilderDocument): string {
  let text = '';
  for (const blockId of blockIds) {
    const block = doc[blockId];
    if (!block) continue;
    const blockData = block.data as Record<string, unknown>;
    const props = (blockData.props || {}) as Record<string, unknown>;
    if (props.text) {
      const rawText = (props.text as string).replace(/<[^>]*>/g, '');
      text += rawText + '\n\n';
    }
    if (block.type === 'Container') {
      const childIds = (blockData.childrenIds || []) as string[];
      text += extractTextRecursive(childIds, doc);
    }
    if (props.url && props.text) {
      text += `${props.url}\n\n`;
    }
  }
  return text;
}

function extractTextFromBlocks(doc: EmailBuilderDocument): string {
  const root = doc.root;
  if (!root || !root.data.childrenIds) return '';
  return extractTextRecursive(root.data.childrenIds, doc).trim();
}

// Convert email-builder JSON to HTML
export function jsonToHtml(jsonContent: EmailBuilderDocument, theme?: EmailTheme): string {
  const root = jsonContent.root;
  if (!root || root.type !== 'EmailLayout') {
    return '<div>Template-Fehler: Ungültiges Format</div>';
  }

  const tv = resolveTheme(theme, root.data as unknown as Record<string, unknown>);
  let html = `<div style="font-family: ${tv.fontFamily}; color: ${tv.textColor};">`;
  html += renderBlocksToHtml(root.data.childrenIds, jsonContent, tv);
  html += `</div>`;
  return html;
}

// Sample data generators for each template type (for preview and testing)
// NOTE: Variable names MUST match exactly with the placeholders in DEFAULT_TEMPLATES
function getSampleData(siteName: string): Record<EmailTemplateType, Record<string, string>> {
  return {
    poll_created: {
      pollType: 'Terminumfrage',
      pollTitle: 'Teammeeting Q1 2025',
      publicLink: 'https://polly.example.com/poll/abc123',
      adminLink: 'https://polly.example.com/admin/abc123',
      isRegisteredUser: '',
      siteName,
    },
    invitation: {
      inviterName: 'Max Mustermann',
      pollTitle: 'Teammeeting Q1 2025',
      message: 'Bitte wähle die Termine aus, an denen du Zeit hast.',
      publicLink: 'https://polly.example.com/poll/abc123',
      siteName,
    },
    vote_confirmation: {
      voterName: 'Anna Schmidt',
      pollType: 'Terminumfrage',
      pollTitle: 'Teammeeting Q1 2025',
      publicLink: 'https://polly.example.com/poll/abc123',
      resultsLink: 'https://polly.example.com/poll/abc123/results',
      siteName,
    },
    reminder: {
      senderName: 'Max Mustermann',
      pollTitle: 'Teammeeting Q1 2025',
      expiresAt: 'Die Umfrage endet am 31.12.2025 um 23:59 Uhr.',
      pollLink: 'https://polly.example.com/poll/abc123',
      siteName,
    },
    password_reset: {
      userName: 'Max Mustermann',
      resetLink: 'https://polly.example.com/auth/reset-password?token=xyz789',
      siteName,
    },
    email_change: {
      oldEmail: 'alte-email@example.com',
      newEmail: 'neue-email@example.com',
      confirmLink: 'https://polly.example.com/auth/confirm-email?token=xyz789',
      siteName,
    },
    password_changed: {
      userName: 'Max Mustermann',
      siteName,
    },
    test_report: {
      testRunId: '42',
      status: 'Bestanden',
      totalTests: '24',
      passed: '22',
      failed: '1',
      skipped: '1',
      duration: '12.5 Sekunden',
      startedAt: new Date().toLocaleString('de-DE'),
      siteName,
    },
    welcome: {
      userName: 'Max Mustermann',
      userEmail: 'max.mustermann@example.com',
      verificationLink: 'https://polly.example.com/email-bestaetigen/abc123xyz789',
      siteName,
    },
    poll_finalized: {
      pollTitle: 'Teammeeting Q1 2025',
      confirmedDate: 'Montag, 15. Januar 2025',
      confirmedTime: '<strong>Uhrzeit:</strong> 14:00 – 15:00 Uhr',
      pollLink: 'https://polly.example.com/poll/abc123',
      siteName,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// V3 TEMPLATE SYSTEM
// Single-HTML-template approach with {{VARIABLE}} substitution
// Replaces the old JSON-block + header/footer/dark-mode pipeline
// ═══════════════════════════════════════════════════════════════

interface V3TemplateData {
  logoDataUri: string;
  siteName: string;
  siteAccent: string;
  primaryColor: string;
  secondaryColor: string;
  siteUrl: string;
  privacyUrl: string;
  footerHtml: string;
  footerText: string;
  fontFamily: string;
  subject: string;
}

function v3DarkModeCSS(accentColor: string): string {
  const darkAccent = accentColor || '#e8994a';
  return `@media (prefers-color-scheme: dark) {
      body             { background-color: #0c111d !important; }
      .shell           { background-color: #111827 !important; }
      .email-header    { background-color: #0f1623 !important; border-bottom-color: rgba(255,255,255,0.07) !important; }
      .hdr-sep         { background-color: rgba(255,255,255,0.08) !important; }
      .hdr-site        { color: #7a8fa8 !important; }
      .hdr-accent      { color: ${darkAccent} !important; }
      .survey-tag      { color: ${darkAccent} !important; }
      .headline        { color: #dde3ef !important; }
      .headline-em     { color: ${darkAccent} !important; }
      .subline         { color: #7a8fa8 !important; }
      .sec-divider     { border-top-color: rgba(255,255,255,0.07) !important; }
      .link-label      { color: #7a8fa8 !important; }
      .link-title      { color: #dde3ef !important; }
      .link-desc       { color: #7a8fa8 !important; }
      .btn-primary     { background-color: ${darkAccent} !important; color: #ffffff !important; }
      .btn-secondary   { background-color: rgba(201,123,46,0.12) !important; color: ${darkAccent} !important; }
      .notice          { border-left-color: ${darkAccent} !important; color: #7a8fa8 !important; }
      .notice-bold     { color: #dde3ef !important; }
      .email-footer    { border-top-color: rgba(255,255,255,0.07) !important; }
      .footer-text     { color: #3d5070 !important; }
      .footer-link     { color: #7a8fa8 !important; border-bottom-color: #3d5070 !important; }
    }`;
}

function v3Shell(data: V3TemplateData, bodyHtml: string): string {
  const hdrFont = data.fontFamily;
  const sysFont = 'system-ui, -apple-system, Arial, sans-serif';

  const hasLogo = !!data.logoDataUri;
  const hasName = !!(data.siteName || data.siteAccent);
  const hasHeader = hasLogo || hasName;

  const logoBlock = hasLogo
    ? `<td style="width: 1px; white-space: nowrap;">
            <img src="${data.logoDataUri}" alt="${htmlEscape(data.siteName + data.siteAccent) || 'Logo'}" width="100" style="display: block; height: 36px; width: auto; max-width: 100px;" />
          </td>${hasName ? `
          <td style="width: 1px; padding: 0 14px;">
            <div class="hdr-sep" style="width: 1px; height: 22px; background-color: rgba(0,0,0,0.1);"></div>
          </td>` : ''}`
    : '';

  const wordmark = hasName
    ? `<td>
            <span class="hdr-site" style="font-family: ${hdrFont}; font-size: 18px; font-weight: 400; letter-spacing: -0.01em; color: #6b7280; line-height: 1;">${htmlEscape(data.siteName)}</span>${data.siteAccent ? `<span class="hdr-accent" style="font-family: ${hdrFont}; font-size: 18px; font-weight: 400; letter-spacing: -0.01em; color: ${data.primaryColor}; line-height: 1;">${htmlEscape(data.siteAccent)}</span>` : ''}
          </td>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${htmlEscape(data.subject)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #f0ede8; font-family: ${hdrFont}; -webkit-font-smoothing: antialiased; }
    ${v3DarkModeCSS(data.primaryColor)}
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 28px 16px; background-color: #f0ede8; font-family: ${hdrFont};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 580px; margin: 0 auto;">
<tr><td>
<table class="shell" width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
  ${hasHeader ? `<tr>
    <td class="email-header"
      style="background-color: #ffffff; padding: 14px 40px; border-bottom: 1px solid rgba(0,0,0,0.06);">
      <a href="${htmlEscape(data.siteUrl)}" style="text-decoration: none; color: inherit; display: inline-block;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          ${logoBlock}
          ${wordmark}
        </tr>
      </table>
      </a>
    </td>
  </tr>` : ''}
  ${bodyHtml}
  <tr>
    <td class="email-footer"
      style="padding: 16px 40px 22px; border-top: 1px solid rgba(0,0,0,0.06); text-align: center;">
      <p class="footer-text"
        style="font-family: ${sysFont}; font-size: 12px; color: #b0bcd0; line-height: 1.7;">
        ${data.footerHtml ? renderFooterMarkup(data.footerHtml, 'color: #9ba8bb; text-decoration: none; border-bottom: 1px solid #c8d0dc;') : (hasName ? `<a href="${htmlEscape(data.siteUrl)}" class="footer-link"
          style="color: #9ba8bb; text-decoration: none; border-bottom: 1px solid #c8d0dc;">${htmlEscape(data.siteName + data.siteAccent)}</a>` : `<a href="${htmlEscape(data.siteUrl)}" class="footer-link"
          style="color: #9ba8bb; text-decoration: none; border-bottom: 1px solid #c8d0dc;">${htmlEscape(data.siteUrl)}</a>`)}${data.privacyUrl ? `
        <br>
        <a href="${htmlEscape(data.privacyUrl)}" class="footer-link"
          style="color: #9ba8bb; text-decoration: none; border-bottom: 1px solid #c8d0dc;">Datenschutz</a>` : ''}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function v3Tag(text: string, accentColor?: string): string {
  const color = accentColor || '#7a3800';
  return `<p class="survey-tag" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${color}; margin-bottom: 14px;">${htmlEscape(text)}</p>`;
}

function v3Headline(beforeEm: string, emText: string, afterEm: string, fontFamily: string, accentColor?: string): string {
  const color = accentColor || '#7a3800';
  return `<h1 class="headline" style="font-family: ${fontFamily}; font-size: 25px; font-weight: 400; line-height: 1.35; color: #1a202c; margin-bottom: 12px;">${beforeEm}${emText ? `<br><em class="headline-em" style="font-style: italic; color: ${color};">${emText}</em>` : ''}${afterEm ? `<br>${afterEm}` : ''}</h1>`;
}

function v3SimpleHeadline(text: string, fontFamily: string): string {
  return `<h1 class="headline" style="font-family: ${fontFamily}; font-size: 25px; font-weight: 400; line-height: 1.35; color: #1a202c; margin-bottom: 12px;">${text}</h1>`;
}

function v3Subline(text: string): string {
  return `<p class="subline" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563; line-height: 1.7; margin-bottom: 30px;">${text}</p>`;
}

function v3Divider(): string {
  return `<tr><td style="padding: 0 40px;"><div class="sec-divider" style="border-top: 1px solid rgba(0,0,0,0.06);"></div></td></tr>`;
}

function v3LinkSection(label: string, title: string, desc: string, buttonText: string, buttonUrl: string, buttonType: 'primary' | 'secondary', primaryColor: string, secondaryColor: string, fontFamily: string): string {
  const bgColor = buttonType === 'primary' ? primaryColor : secondaryColor;
  const textColor = ensureButtonTextContrast(bgColor, '#ffffff');
  const cssClass = buttonType === 'primary' ? 'btn-primary' : 'btn-secondary';
  return `<tr><td style="padding: 24px 40px 24px;">
      <p class="link-label" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin-bottom: 5px;">${label}</p>
      <p class="link-title" style="font-family: ${fontFamily}; font-size: 17px; color: #1a202c; margin-bottom: 5px;">${title}</p>
      <p class="link-desc" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 18px;">${desc}</p>
      <table cellpadding="0" cellspacing="0" role="presentation"><tr><td>
        <a href="${htmlEscape(buttonUrl)}" class="${cssClass}" style="display: inline-block; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: ${textColor}; background-color: ${bgColor}; padding: 10px 22px; border-radius: 6px; text-decoration: none;">${buttonText}</a>
      </td></tr></table>
    </td></tr>`;
}

function v3SingleButtonSection(text: string, buttonText: string, buttonUrl: string, buttonType: 'primary' | 'secondary', primaryColor: string, secondaryColor: string): string {
  const bgColor = buttonType === 'primary' ? primaryColor : secondaryColor;
  const textColor = ensureButtonTextContrast(bgColor, '#ffffff');
  const cssClass = buttonType === 'primary' ? 'btn-primary' : 'btn-secondary';
  return `<tr><td style="padding: 24px 40px 24px;">
      <p class="link-desc" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 18px;">${text}</p>
      <table cellpadding="0" cellspacing="0" role="presentation"><tr><td>
        <a href="${htmlEscape(buttonUrl)}" class="${cssClass}" style="display: inline-block; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: ${textColor}; background-color: ${bgColor}; padding: 10px 22px; border-radius: 6px; text-decoration: none;">${buttonText}</a>
      </td></tr></table>
    </td></tr>`;
}

function v3Notice(boldText: string, text: string, primaryColor: string): string {
  return `<tr><td style="padding: 0 40px 34px;">
      <div class="notice" style="border-left: 2px solid ${primaryColor}; padding: 12px 16px; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; color: #4b5563; line-height: 1.65;">
        <span class="notice-bold" style="color: #1a202c; font-weight: 500;">${boldText}</span> ${text}
      </div>
    </td></tr>`;
}

function v3TextBlock(html: string): string {
  return `<tr><td style="padding: 12px 40px;">
      <p class="link-desc" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; color: #4b5563; line-height: 1.6;">${html}</p>
    </td></tr>`;
}

function v3BodyStart(): string {
  return `<tr><td style="padding: 36px 40px 12px;">`;
}

function v3BodyEnd(): string {
  return `</td></tr>`;
}

interface V3BodyContext {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

function buildV3PollCreatedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const pollType = vars.pollType || 'Umfrage';
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const creatorName = htmlEscape(vars.creatorName || '');
  const adminLink = vars.adminLink || '#';
  const publicLink = vars.publicLink || '#';
  const isRegistered = vars.isRegisteredUser === 'true';
  const greeting = creatorName ? `Hallo ${creatorName}` : 'Hallo';

  const subline = isRegistered
    ? `${greeting} \u2014 unten befinden sich der Direktlink zur Umfrage sowie der Abstimmungslink f\u00FCr die Teilnehmer.`
    : `${greeting} \u2014 unten befinden sich der pers\u00F6nliche Administratorlink sowie der Abstimmungslink f\u00FCr die Teilnehmer.`;

  const noticeTitle = isRegistered
    ? 'Diese E-Mail dient als Schnellzugriff.'
    : 'Bitte diese E-Mail aufbewahren.';

  const noticeBody = isRegistered
    ? 'Registrierte Nutzer k\u00F6nnen die Umfrage jederzeit auch unter \u201EMeine Umfragen\u201C verwalten \u2014 nach der Anmeldung.'
    : 'Diese E-Mail enth\u00E4lt den pers\u00F6nlichen Administratorlink \u2014 nur damit l\u00E4sst sich die Umfrage verwalten, bearbeiten und schlie\u00DFen.';

  return `${v3BodyStart()}
      ${v3Tag(pollType, ctx.primaryColor)}
      ${v3Headline('Umfrage', `\u201E${pollTitle}\u201C`, 'wurde erstellt.', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(subline)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3LinkSection('Administratorlink', 'Umfrage verwalten', 'Bearbeiten, schlie\u00DFen und Ergebnisse einsehen. Nicht weitergeben.', 'Zur Verwaltung \u2192', adminLink, 'primary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}
    ${v3Divider()}
    ${v3LinkSection('\u00D6ffentlicher Link \u00B7 F\u00FCr Teilnehmer', 'Abstimmung \u00F6ffnen', 'Diesen Link an alle Teilnehmer weiterleiten, damit diese abstimmen k\u00F6nnen.', 'Zur Abstimmung \u2192', publicLink, 'secondary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}
    ${v3Notice(noticeTitle, noticeBody, ctx.primaryColor)}`;
}

function buildV3InvitationBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const inviterName = htmlEscape(vars.inviterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const message = vars.message ? htmlEscape(vars.message) : '';
  const publicLink = vars.publicLink || '#';

  return `${v3BodyStart()}
      ${v3Tag('Einladung', ctx.primaryColor)}
      ${v3Headline('Einladung zur Abstimmung', `\u201E${pollTitle}\u201C`, '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`${inviterName} l\u00E4dt Sie ein, an dieser Umfrage teilzunehmen.${message ? ` ${message}` : ''}`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Klicken Sie auf den Button, um zur Abstimmung zu gelangen.', 'Jetzt abstimmen \u2192', publicLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3ReminderBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const senderName = htmlEscape(vars.senderName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const expiresAt = vars.expiresAt ? htmlEscape(vars.expiresAt) : '';
  const pollLink = vars.pollLink || '#';

  return `${v3BodyStart()}
      ${v3Tag('Erinnerung', ctx.primaryColor)}
      ${v3Headline('Erinnerung an', `\u201E${pollTitle}\u201C`, '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`${senderName} erinnert Sie freundlich an die Teilnahme. Ihre Stimme ist wichtig!${expiresAt ? ` ${expiresAt}` : ''}`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Bitte nehmen Sie sich kurz Zeit, um abzustimmen.', 'Jetzt abstimmen \u2192', pollLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3VoteConfirmationBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const voterName = htmlEscape(vars.voterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const pollType = vars.pollType || 'Umfrage';
  const resultsLink = vars.resultsLink || '#';
  const greeting = voterName ? `Hallo ${voterName}` : 'Hallo';

  return `${v3BodyStart()}
      ${v3Tag('Best\u00E4tigung', ctx.primaryColor)}
      ${v3SimpleHeadline('Vielen Dank f\u00FCr Ihre Teilnahme!', ctx.fontFamily)}
      ${v3Subline(`${greeting} \u2014 vielen Dank f\u00FCr Ihre Teilnahme an der ${htmlEscape(pollType)} \u201E${pollTitle}\u201C. Ihre Auswahl wurde erfolgreich gespeichert.`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Mit diesem Link k\u00F6nnen Sie jederzeit zur Umfrage zur\u00FCckkehren oder die aktuellen Ergebnisse einsehen.', 'Ergebnisse anzeigen \u2192', resultsLink, 'secondary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3PasswordResetBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const userName = htmlEscape(vars.userName || '');
  const resetLink = vars.resetLink || '#';
  const greeting = userName ? `Hallo ${userName}` : 'Hallo';

  return `${v3BodyStart()}
      ${v3Tag('Sicherheit', ctx.primaryColor)}
      ${v3SimpleHeadline('Passwort zur\u00FCcksetzen', ctx.fontFamily)}
      ${v3Subline(`${greeting} \u2014 Sie haben angefordert, Ihr Passwort zur\u00FCckzusetzen.`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben. Dieser Link ist 1 Stunde g\u00FCltig.', 'Passwort zur\u00FCcksetzen \u2192', resetLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}
    ${v3Notice('Falls Sie diese Anfrage nicht gestellt haben,', 'k\u00F6nnen Sie diese E-Mail ignorieren. Ihr Passwort bleibt unver\u00E4ndert.', ctx.primaryColor)}`;
}

function buildV3EmailChangeBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const oldEmail = htmlEscape(vars.oldEmail || '');
  const newEmail = htmlEscape(vars.newEmail || '');
  const confirmLink = vars.confirmLink || '#';

  return `${v3BodyStart()}
      ${v3Tag('Sicherheit', ctx.primaryColor)}
      ${v3SimpleHeadline('E-Mail-Adresse best\u00E4tigen', ctx.fontFamily)}
      ${v3Subline('Sie haben angefordert, Ihre E-Mail-Adresse zu \u00E4ndern.')}
    ${v3BodyEnd()}
    ${v3TextBlock(`<strong>Alte E-Mail:</strong> ${oldEmail}<br><strong>Neue E-Mail:</strong> ${newEmail}`)}
    ${v3Divider()}
    ${v3SingleButtonSection('Dieser Link ist 24 Stunden g\u00FCltig.', 'E-Mail best\u00E4tigen \u2192', confirmLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}
    ${v3Notice('Falls Sie diese Anfrage nicht gestellt haben,', 'k\u00F6nnen Sie diese E-Mail ignorieren.', ctx.primaryColor)}`;
}

function buildV3PasswordChangedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const userName = htmlEscape(vars.userName || '');
  const greeting = userName ? `Hallo ${userName}` : 'Hallo';

  return `${v3BodyStart()}
      ${v3Tag('Sicherheit', ctx.primaryColor)}
      ${v3SimpleHeadline('Passwort erfolgreich ge\u00E4ndert', ctx.fontFamily)}
      ${v3Subline(`${greeting} \u2014 Ihr Passwort wurde erfolgreich ge\u00E4ndert.`)}
    ${v3BodyEnd()}
    ${v3Notice('Falls Sie diese \u00C4nderung nicht vorgenommen haben,', 'kontaktieren Sie bitte umgehend den Administrator.', ctx.primaryColor)}`;
}

function buildV3TestReportBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const status = htmlEscape(vars.status || '');
  const testRunId = htmlEscape(vars.testRunId || '');
  const totalTests = htmlEscape(vars.totalTests || '0');
  const passed = htmlEscape(vars.passed || '0');
  const failed = htmlEscape(vars.failed || '0');
  const skipped = htmlEscape(vars.skipped || '0');
  const duration = htmlEscape(vars.duration || '');
  const startedAt = htmlEscape(vars.startedAt || '');

  return `${v3BodyStart()}
      ${v3Tag('Testbericht', ctx.primaryColor)}
      ${v3SimpleHeadline(`${status} \u2014 Testlauf #${testRunId}`, ctx.fontFamily)}
      ${v3Subline('Der automatische Testlauf wurde abgeschlossen.')}
    ${v3BodyEnd()}
    ${v3TextBlock(`Gesamte Tests: <strong>${totalTests}</strong><br>Bestanden: <strong>${passed}</strong><br>Fehlgeschlagen: <strong>${failed}</strong><br>\u00DCbersprungen: <strong>${skipped}</strong><br>Dauer: <strong>${duration}</strong><br>Gestartet: <strong>${startedAt}</strong>`)}`;
}

function buildV3WelcomeBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const userName = htmlEscape(vars.userName || '');
  const verificationLink = vars.verificationLink || '#';
  const siteName = htmlEscape(vars.siteName || '');
  const greeting = userName ? `Hallo ${userName}` : 'Hallo';

  return `${v3BodyStart()}
      ${v3Tag('Willkommen', ctx.primaryColor)}
      ${v3SimpleHeadline(`Willkommen bei ${siteName}!`, ctx.fontFamily)}
      ${v3Subline(`${greeting} \u2014 vielen Dank f\u00FCr Ihre Registrierung! Ihr Account wurde erfolgreich erstellt.`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Bitte best\u00E4tigen Sie Ihre E-Mail-Adresse, um alle Funktionen nutzen zu k\u00F6nnen.', 'E-Mail best\u00E4tigen \u2192', verificationLink, 'secondary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3PollFinalizedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const confirmedDate = htmlEscape(vars.confirmedDate || '');
  const confirmedTime = vars.confirmedTime || '';
  const pollLink = vars.pollLink || '#';
  const videoConferenceUrl = vars.videoConferenceUrl || '';

  const videoLine = videoConferenceUrl
    ? `<br/><strong>Videokonferenz:</strong> <a href="${htmlEscape(videoConferenceUrl)}" style="color:${ctx.primaryColor};text-decoration:underline;">${htmlEscape(videoConferenceUrl)}</a>`
    : '';

  return `${v3BodyStart()}
      ${v3Tag('Termin bestätigt', ctx.primaryColor)}
      ${v3Headline('Termin festgelegt für', `\u201E${pollTitle}\u201C`, '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`<strong>Datum:</strong> ${confirmedDate}${confirmedTime ? `<br/>${confirmedTime}` : ''}${videoLine}<br/><br/>Im Anhang finden Sie eine Kalendereinladung (.ics), die Sie direkt in Ihren Kalender importieren können.`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection('Klicken Sie auf den Button, um die Umfrage und Ergebnisse einzusehen.', 'Zur Umfrage \u2192', pollLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3GenericBody(bodyHtml: string, fontFamily: string): string {
  return `${v3BodyStart()}
      <div style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563; line-height: 1.7;">
        ${bodyHtml}
      </div>
    ${v3BodyEnd()}`;
}

const V3_BODY_BUILDERS: Record<string, (vars: Record<string, string | undefined>, ctx: V3BodyContext) => string> = {
  poll_created: buildV3PollCreatedBody,
  invitation: buildV3InvitationBody,
  reminder: buildV3ReminderBody,
  vote_confirmation: buildV3VoteConfirmationBody,
  password_reset: buildV3PasswordResetBody,
  email_change: buildV3EmailChangeBody,
  password_changed: buildV3PasswordChangedBody,
  test_report: buildV3TestReportBody,
  welcome: buildV3WelcomeBody,
  poll_finalized: buildV3PollFinalizedBody,
};

export class EmailTemplateService {
  // Static method: Get default template by type
  static getDefaultTemplate(type: EmailTemplateType): {
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  } {
    const defaultData = DEFAULT_TEMPLATES[type];
    if (!defaultData) {
      throw new Error(`Unknown template type: ${type}`);
    }
    return {
      type,
      name: defaultData.name,
      subject: defaultData.subject,
      jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
      textContent: defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type],
    };
  }

  // Static method: Get all default templates
  static getAllDefaultTemplates(): Array<{
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  }> {
    return EMAIL_TEMPLATE_TYPES.map(type => EmailTemplateService.getDefaultTemplate(type));
  }

  // Static method: Substitute variables (with optional HTML escaping)
  static substituteVariables(
    template: string,
    variables: Record<string, string | undefined>,
    escapeHtml: boolean = true
  ): string {
    return substituteVariables(template, variables, escapeHtml);
  }

  static async getSampleDataForType(type: string): Promise<Record<string, string>> {
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const data = getSampleData(siteName);
    return data[type as EmailTemplateType] || {};
  }

  // Static method: Render template to HTML
  static async renderTemplate(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>
  ): Promise<string> {
    const defaultData = DEFAULT_TEMPLATES[type];
    if (!defaultData) {
      throw new Error(`Unknown template type: ${type}`);
    }
    
    const service = new EmailTemplateService();
    const emailTheme = await service.getEmailTheme();
    
    const jsonStr = substituteVariables(
      JSON.stringify(defaultData.jsonContent),
      variables,
      true
    );
    const renderedJson = JSON.parse(jsonStr) as EmailBuilderDocument;
    
    return jsonToHtml(renderedJson, emailTheme);
  }

  // Get all templates (from DB or defaults)
  async getAllTemplates(): Promise<EmailTemplate[]> {
    const dbTemplates = await storage.getEmailTemplates();
    const result: EmailTemplate[] = [];

    for (const type of EMAIL_TEMPLATE_TYPES) {
      const dbTemplate = dbTemplates.find(t => t.type === type);
      if (dbTemplate) {
        result.push(dbTemplate);
      } else {
        // Return default template as a pseudo-template
        const defaultData = DEFAULT_TEMPLATES[type];
        result.push({
          id: 0,
          type,
          name: defaultData.name,
          subject: defaultData.subject,
          jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
          htmlContent: null,
          textContent: defaultData.textContent,
          variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
          isDefault: true,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        });
      }
    }

    return result;
  }

  // Get a specific template
  async getTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    const dbTemplate = await storage.getEmailTemplate(type);
    
    if (dbTemplate) {
      return dbTemplate;
    }

    // Return default template
    const defaultData = DEFAULT_TEMPLATES[type];
    return {
      id: 0,
      type,
      name: defaultData.name,
      subject: defaultData.subject,
      jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
      htmlContent: null,
      textContent: defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
      isDefault: true,
      isActive: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
  }

  // Save/update a template
  async saveTemplate(
    type: EmailTemplateType,
    jsonContent: Record<string, unknown>,
    subject?: string,
    name?: string,
    textContentOverride?: string
  ): Promise<EmailTemplate> {
    const defaultData = DEFAULT_TEMPLATES[type];
    
    // If textContent is provided, we'll generate HTML from it instead of JSON
    let htmlContent: string;
    let textContent: string;
    
    const currentTheme = await this.getEmailTheme();
    
    if (textContentOverride) {
      textContent = textContentOverride;
      htmlContent = this.textToSimpleHtmlWithTheme(textContent, currentTheme);
    } else {
      htmlContent = jsonToHtml(jsonContent as EmailBuilderDocument, currentTheme);
      textContent = extractTextFromBlocks(jsonContent as EmailBuilderDocument);
    }

    return await storage.upsertEmailTemplate({
      type,
      name: name || defaultData.name,
      subject: subject || defaultData.subject,
      jsonContent,
      htmlContent,
      textContent: textContent.trim() || defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
      isDefault: false,
      isActive: true,
    });
  }

  // Reset template to default
  async resetTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    await storage.resetEmailTemplate(type);
    return this.getTemplate(type);
  }

  // Get email footer from system settings
  static readonly DEFAULT_FOOTER = 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.\n{{link:#|Datenschutz}}';

  async getEmailFooter(): Promise<{ html: string; text: string }> {
    const setting = await storage.getSetting('email_footer');
    if (setting?.value) {
      const footerData = setting.value as { html?: string; text?: string };
      return {
        html: footerData.html || EmailTemplateService.DEFAULT_FOOTER,
        text: footerData.text || EmailTemplateService.DEFAULT_FOOTER
      };
    }
    return {
      html: EmailTemplateService.DEFAULT_FOOTER,
      text: EmailTemplateService.DEFAULT_FOOTER
    };
  }

  // Set email footer in system settings
  async setEmailFooter(footer: { html: string; text: string }): Promise<{ html: string; text: string }> {
    await storage.setSetting({
      key: 'email_footer',
      value: footer
    });
    return footer;
  }

  // Get email theme from system settings
  async getEmailTheme(): Promise<EmailTheme> {
    const setting = await storage.getSetting('email_theme');
    if (setting?.value) {
      return { ...DEFAULT_EMAIL_THEME, ...(setting.value as Partial<EmailTheme>) };
    }
    return { ...DEFAULT_EMAIL_THEME };
  }

  // Set email theme in system settings
  async setEmailTheme(theme: Partial<EmailTheme>): Promise<EmailTheme> {
    const currentTheme = await this.getEmailTheme();
    const newTheme = { ...currentTheme, ...theme };
    await storage.setSetting({
      key: 'email_theme',
      value: newTheme
    });
    return newTheme;
  }

  async resetEmailTheme(): Promise<EmailTheme> {
    const customization = await storage.getCustomizationSettings();
    const primaryColor = customization.theme?.primaryColor || '#FF6B35';
    const secondaryColor = customization.theme?.secondaryColor || '#4A90A4';
    
    const lighterPrimary = lightenColorByPercent(primaryColor, 30);
    
    const primaryTextColor = ensureButtonTextContrast(primaryColor, '#FFFFFF');
    const secondaryTextColor = ensureButtonTextContrast(secondaryColor, '#FFFFFF');
    
    const brandedTheme: EmailTheme = {
      backdropColor: '#F5F5F5',
      canvasColor: '#FFFFFF',
      textColor: '#333333',
      headingColor: primaryColor,
      linkColor: primaryColor,
      buttonBackgroundColor: primaryColor,
      buttonTextColor: primaryTextColor,
      buttonBorderRadius: 6,
      fontFamily: 'Arial, sans-serif',
      secondaryButtonBackgroundColor: secondaryColor,
      secondaryButtonTextColor: secondaryTextColor,
      darkBackdropColor: '#1a1a2e',
      darkCanvasColor: '#16213e',
      darkTextColor: '#e0e0e0',
      darkHeadingColor: lighterPrimary,
    };
    
    await storage.setSetting({
      key: 'email_theme',
      value: brandedTheme
    });
    return brandedTheme;
  }

  // Extract theme from emailbuilder.js JSON with sanitization
  extractThemeFromEmailBuilder(jsonContent: unknown): Partial<EmailTheme> {
    const theme: Partial<EmailTheme> = {};
    
    try {
      // Basic structure validation
      if (!jsonContent || typeof jsonContent !== 'object') {
        return theme;
      }
      
      const doc = jsonContent as Record<string, unknown>;
      const root = doc.root as { data?: Record<string, unknown> } | undefined;
      
      // Extract root-level theme settings with sanitization
      if (root?.data && typeof root.data === 'object') {
        const rootData = root.data;
        
        const backdrop = sanitizeColor(rootData.backdropColor);
        if (backdrop) theme.backdropColor = backdrop;
        
        const canvas = sanitizeColor(rootData.canvasColor);
        if (canvas) theme.canvasColor = canvas;
        
        const text = sanitizeColor(rootData.textColor);
        if (text) theme.textColor = text;
        
        const font = sanitizeFontFamily(rootData.fontFamily);
        if (font) theme.fontFamily = font;
      }
      
      const extractFromBlockIds = (ids: unknown[]) => {
        const blockIds = ids.filter(id => typeof id === 'string') as string[];
        for (const blockId of blockIds) {
          const block = doc[blockId] as { type?: string; data?: Record<string, unknown> } | undefined;
          if (!block || typeof block !== 'object') continue;
          
          const blockData = block.data;
          if (!blockData || typeof blockData !== 'object') continue;
          
          const style = blockData.style as Record<string, unknown> | undefined;
          
          if (block.type === 'Container') {
            const childIds = blockData.childrenIds;
            if (Array.isArray(childIds)) extractFromBlockIds(childIds);
            continue;
          }
          
          if (!style || typeof style !== 'object') continue;
          
          switch (block.type) {
            case 'Heading': {
              const color = sanitizeColor(style.color);
              if (color) theme.headingColor = color;
              break;
            }
            case 'Text': {
              const color = sanitizeColor(style.color);
              if (color && !theme.textColor) theme.textColor = color;
              break;
            }
            case 'Button': {
              const bgColor = sanitizeColor(style.backgroundColor);
              if (bgColor) {
                theme.buttonBackgroundColor = bgColor;
                if (!theme.linkColor) theme.linkColor = bgColor;
              }
              
              const textColor = sanitizeColor(style.color);
              if (textColor) theme.buttonTextColor = textColor;
              
              const radius = sanitizeBorderRadius(style.borderRadius);
              if (radius !== null) theme.buttonBorderRadius = radius;
              break;
            }
          }
        }
      };

      const childrenIds = (root?.data as Record<string, unknown>)?.childrenIds;
      if (Array.isArray(childrenIds)) extractFromBlockIds(childrenIds);
    } catch (error) {
      console.error('Error extracting theme from emailbuilder JSON:', error);
    }
    
    return theme;
  }

  // Import theme from emailbuilder.js JSON and save it
  async importThemeFromEmailBuilder(jsonContent: unknown): Promise<EmailTheme> {
    const extractedTheme = this.extractThemeFromEmailBuilder(jsonContent);
    return await this.setEmailTheme(extractedTheme);
  }

  // Convert plain text to simple HTML for email body (with theme support)
  private textToSimpleHtmlWithTheme(text: string, theme: EmailTheme): string {
    const escapedText = htmlEscape(text);
    const paragraphs = escapedText.split('\n\n').filter(p => p.trim());
    
    let html = `<div style="padding: 16px 24px; font-family: ${theme.fontFamily};">`;
    for (const para of paragraphs) {
      // Check if it looks like a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const withLinks = para.replace(urlRegex, `<a href="$1" style="color: ${theme.linkColor};">$1</a>`);
      html += `<p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">${withLinks.replace(/\n/g, '<br>')}</p>`;
    }
    html += '</div>';
    
    return html;
  }

  private generateFooterHtmlWithTheme(footerText: string, theme: EmailTheme): string {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
        <tr>
          <td style="padding: 0 24px;">
            <div style="border-top: 1px solid #e9ecef;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 24px 24px; text-align: center;">
            <p class="email-footer-text" style="color: #999999; font-size: 12px; margin: 0; line-height: 1.5; font-family: ${theme.fontFamily};">
              ${renderFooterMarkup(footerText, 'color: #999999; text-decoration: underline;')}
            </p>
          </td>
        </tr>
      </table>
    `;
  }

  private async resolveLogoDataUri(logoUrl?: string): Promise<string> {
    if (!logoUrl) return '';
    if (logoUrl.startsWith('data:')) {
      if (/^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);base64,[A-Za-z0-9+/=]+$/.test(logoUrl)) {
        return logoUrl;
      }
      return '';
    }
    if (logoUrl.startsWith('/uploads/')) {
      return (await readLocalLogoAsBase64(logoUrl)) || '';
    }
    return (await fetchLogoAsBase64(logoUrl)) || '';
  }

  private resolvePrivacyUrl(customization: any): string {
    try {
      const footer = customization?.footer;
      if (footer?.supportLinks && Array.isArray(footer.supportLinks)) {
        const privacyLink = footer.supportLinks.find(
          (link: { label?: string; url?: string }) =>
            link.label?.toLowerCase().includes('datenschutz') ||
            link.label?.toLowerCase().includes('privacy')
        );
        if (privacyLink?.url && privacyLink.url !== '#') return privacyLink.url;
      }
    } catch {}
    return '';
  }

  private async buildV3TemplateData(
    customization: any,
    emailTheme: EmailTheme,
    subject: string
  ): Promise<V3TemplateData> {
    const { getBaseUrl } = await import('../utils/baseUrl');
    const siteUrl = getBaseUrl();
    const logoDataUri = await this.resolveLogoDataUri(customization.branding.logoUrl || undefined);
    const footer = await this.getEmailFooter();
    const fullSiteName = `${customization.branding.siteName || ''}${customization.branding.siteNameAccent || ''}`;
    const privacyUrl = this.resolvePrivacyUrl(customization);
    const hasFooterPrivacyPlaceholder = /\{\{link:#\|/.test(footer.html);
    const resolveFooterVars = (text: string) => {
      let result = text
        .replace(/\{\{siteName\}\}/g, fullSiteName)
        .replace(/\{\{siteUrl\}\}/g, siteUrl);
      if (privacyUrl && hasFooterPrivacyPlaceholder) {
        result = result.replace(/\{\{link:#\|/g, `{{link:${privacyUrl}|`);
      }
      return result;
    };
    const footerHtml = resolveFooterVars(footer.html);
    const footerText = stripFooterMarkupToText(resolveFooterVars(footer.text));

    return {
      logoDataUri,
      siteName: customization.branding.siteName || '',
      siteAccent: customization.branding.siteNameAccent || '',
      primaryColor: emailTheme.buttonBackgroundColor || DEFAULT_EMAIL_THEME.buttonBackgroundColor,
      secondaryColor: emailTheme.secondaryButtonBackgroundColor || DEFAULT_EMAIL_THEME.secondaryButtonBackgroundColor,
      siteUrl,
      privacyUrl: hasFooterPrivacyPlaceholder ? '' : privacyUrl,
      footerHtml,
      footerText,
      fontFamily: emailTheme.fontFamily || DEFAULT_EMAIL_THEME.fontFamily,
      subject,
    };
  }

  // Render a template with variables — V3 template system
  async renderEmail(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>
  ): Promise<{ subject: string; html: string; text: string }> {
    const template = await this.getTemplate(type);
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const emailTheme = await this.getEmailTheme();
    const allVariables = { siteName, ...variables };

    const rawSubject = renderTemplate(template.subject, allVariables);
    const subject = rawSubject.replace(/^\[\]\s*/, '');

    const v3Builder = V3_BODY_BUILDERS[type];
    if (template.isDefault && v3Builder) {
      const v3Data = await this.buildV3TemplateData(customization, emailTheme, subject);
      const ctx: V3BodyContext = {
        primaryColor: v3Data.primaryColor,
        secondaryColor: v3Data.secondaryColor,
        fontFamily: v3Data.fontFamily,
      };
      const bodyHtml = v3Builder(allVariables, ctx);
      const html = v3Shell(v3Data, bodyHtml);
      let textBase = template.textContent || '';
      if (type === 'poll_created' && allVariables.isRegisteredUser === 'true') {
        textBase = textBase
          .replace(/Den Administratorlink sicher aufbewahren\. Nur damit l\u00E4sst sich die Umfrage verwalten\./,
            'Diese E-Mail dient als Schnellzugriff. Registrierte Nutzer k\u00F6nnen die Umfrage jederzeit auch unter \u201EMeine Umfragen\u201C verwalten.');
      }
      if (/\n---\nDiese E-Mail wurde automatisch vo[nm]/.test(textBase)) {
        textBase = textBase.replace(/\n---\nDiese E-Mail wurde automatisch vo[nm][^\n]*$/, `\n---\n${v3Data.footerText}`);
      } else if (v3Data.footerText) {
        textBase = textBase.trimEnd() + `\n\n---\n${v3Data.footerText}`;
      }
      const text = renderTemplate(textBase, allVariables);
      return { subject, html, text };
    }

    let bodyHtml: string;
    if (!template.isDefault && template.textContent) {
      const renderedText = substituteVariables(template.textContent, allVariables, false);
      bodyHtml = this.textToSimpleHtmlWithTheme(renderedText, emailTheme);
    } else if (template.htmlContent) {
      bodyHtml = substituteVariables(template.htmlContent, allVariables, true);
    } else {
      bodyHtml = '<p>Template-Fehler: Kein Inhalt verf\u00FCgbar</p>';
    }

    const v3Data = await this.buildV3TemplateData(customization, emailTheme, subject);
    const wrappedBody = buildV3GenericBody(bodyHtml, v3Data.fontFamily);
    const html = v3Shell(v3Data, wrappedBody);
    let textFallback = template.textContent || '';
    if (/\n---\nDiese E-Mail wurde automatisch vo[nm]/.test(textFallback)) {
      textFallback = textFallback.replace(/\n---\nDiese E-Mail wurde automatisch vo[nm][^\n]*$/, `\n---\n${v3Data.footerText}`);
    } else if (v3Data.footerText) {
      textFallback = textFallback.trimEnd() + `\n\n---\n${v3Data.footerText}`;
    }
    const text = renderTemplate(textFallback, allVariables);
    return { subject, html, text };
  }

  async wrapWithEmailTheme(
    subject: string,
    bodyHtml: string,
    plainText: string
  ): Promise<{ subject: string; html: string; text: string }> {
    const customization = await storage.getCustomizationSettings();
    const emailTheme = await this.getEmailTheme();

    const v3Data = await this.buildV3TemplateData(customization, emailTheme, subject);
    const wrappedBody = buildV3GenericBody(bodyHtml, v3Data.fontFamily);
    const html = v3Shell(v3Data, wrappedBody);

    let text = plainText;
    if (/\n---\nDiese E-Mail wurde automatisch vo[nm]/.test(text)) {
      text = text.replace(/\n---\nDiese E-Mail wurde automatisch vo[nm][^\n]*$/, `\n---\n${v3Data.footerText}`);
    } else if (v3Data.footerText) {
      text = text.trimEnd() + `\n\n---\n${v3Data.footerText}`;
    }

    return { subject, html, text };
  }

  private extractContainerDarkColors(doc: Record<string, unknown> | null, emailTheme?: EmailTheme): Map<string, string> {
    const colors = new Map<string, string>();
    if (!doc) return colors;
    for (const [blockId, block] of Object.entries(doc)) {
      if (blockId === 'root') continue;
      const b = block as { type?: string; data?: { props?: Record<string, unknown>; style?: Record<string, unknown> } };
      if (b.type !== 'Container') continue;
      if (b.data?.style?.darkBackgroundColor) {
        colors.set(blockId, b.data.style.darkBackgroundColor as string);
      } else {
        const variant = b.data?.props?.containerVariant as string | undefined;
        if (variant && emailTheme) {
          const themeColor = variant === 'secondary'
            ? (emailTheme.secondaryButtonBackgroundColor || '#4A90A4')
            : (emailTheme.buttonBackgroundColor || '#FF6B35');
          colors.set(blockId, darkenColorForDarkMode(themeColor));
        }
      }
    }
    return colors;
  }

  private generateDarkModeStyles(darkBackdrop: string, darkCanvas: string, darkHeading: string, darkText: string, containerDarkColors?: Map<string, string>): string {
    let containerStyles = '';
    if (containerDarkColors && containerDarkColors.size > 0) {
      for (const [id, color] of containerDarkColors) {
        containerStyles += `        .email-container-${id} { background-color: ${color} !important; }\n`;
      }
    }
    return `
      @media (prefers-color-scheme: dark) {
        body, .email-backdrop { background-color: ${darkBackdrop} !important; }
        .email-canvas { background-color: ${darkCanvas} !important; }
        .email-heading { color: ${darkHeading} !important; }
        .email-text { color: ${darkText} !important; }
${containerStyles}        .email-footer-text { color: #999999 !important; }
        .email-header-text { color: #999999 !important; }
        .email-divider { border-top-color: #3a3a5c !important; }
      }
    `;
  }

  private buildEmailHtml(subject: string, emailTheme: EmailTheme, darkModeStyles: string, headerHtml: string, bodyHtml: string, footerHtml: string): string {
    return `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>${htmlEscape(subject)}</title>
        <style type="text/css">
          ${darkModeStyles}
        </style>
        <!--[if mso]>
        <style type="text/css">
          body, table, td { font-family: Arial, sans-serif !important; }
        </style>
        <![endif]-->
      </head>
      <body class="email-backdrop" style="margin: 0; padding: 0; background-color: ${emailTheme.backdropColor}; font-family: ${emailTheme.fontFamily};">
        <table width="100%" cellpadding="0" cellspacing="0" class="email-backdrop" style="background-color: ${emailTheme.backdropColor}; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" class="email-canvas" style="max-width: 600px; width: 100%; background-color: ${emailTheme.canvasColor}; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td>
                    ${headerHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0 8px 0;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td>
                    ${footerHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // Get available variables for a template type
  getVariables(type: EmailTemplateType): { key: string; description: string }[] {
    return EMAIL_TEMPLATE_VARIABLES[type];
  }

  // Get default template data
  getDefaultTemplate(type: EmailTemplateType): {
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
  } {
    return DEFAULT_TEMPLATES[type];
  }
}

export const emailTemplateService = new EmailTemplateService();
