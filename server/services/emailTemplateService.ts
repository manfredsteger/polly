import { storage } from '../storage';
import { 
  type EmailTemplate, 
  type EmailTemplateType, 
  type EmailLanguage,
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES,
  EMAIL_LANGUAGES,
  DEFAULT_EMAIL_LANGUAGE,
} from '@shared/schema';
import {
  emailStrings,
  emailLocale,
  DEFAULT_EMAIL_FOOTERS,
  AUTO_FOOTER_DETECT,
  AUTO_FOOTER_REPLACE,
} from './emailI18n';

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingSitePrefix(subject: string, siteName: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return trimmed;

  if (!siteName) {
    return trimmed.replace(/^\[\]\s*/, '').trim();
  }

  const sitePrefix = new RegExp(`^\\[${escapeRegExp(siteName)}\\]\\s*`, 'i');
  return trimmed.replace(sitePrefix, '').trim();
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
function buildPollCreatedTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      adminHeading: 'Administratorlink',
      adminText: 'Mit diesem Link l\u00E4sst sich die Umfrage verwalten, bearbeiten und die Ergebnisse einsehen.',
      adminButton: 'Umfrage verwalten',
      publicHeading: 'Öffentlicher Link zum Teilen',
      publicText: 'Diesen Link an alle Teilnehmer weiterleiten, damit diese an der Abstimmung teilnehmen k\u00F6nnen.',
      publicButton: 'Zur Abstimmung',
      headline: '{{pollType}} erfolgreich erstellt!',
      greeting: 'Hallo,',
      intro: 'Die {{pollType}} <strong>"{{pollTitle}}"</strong> wurde erfolgreich erstellt.',
      warn: '<strong>\u26A0\uFE0F Wichtig:</strong> Den Administratorlink sicher aufbewahren. Nur damit l\u00E4sst sich die Umfrage verwalten.',
      text: `{{pollType}} erfolgreich erstellt!\n\nHallo,\n\nDie {{pollType}} "{{pollTitle}}" wurde erfolgreich erstellt.\n\nAdministratorlink:\nUmfrage verwalten: {{adminLink}}\n\n\u00D6ffentlicher Link zum Teilen:\nZur Abstimmung: {{publicLink}}\n\nWichtig: Den Administratorlink sicher aufbewahren. Nur damit l\u00E4sst sich die Umfrage verwalten.`,
      name: 'Umfrage erstellt',
      subject: '[{{siteName}}] {{pollType}} wurde erstellt: {{pollTitle}}',
    },
    en: {
      adminHeading: 'Administrator link',
      adminText: 'Use this link to manage and edit the poll and to view the results.',
      adminButton: 'Manage poll',
      publicHeading: 'Public link to share',
      publicText: 'Forward this link to all participants so they can take part in the vote.',
      publicButton: 'Go to voting',
      headline: '{{pollType}} created successfully!',
      greeting: 'Hello,',
      intro: 'Your {{pollType}} <strong>"{{pollTitle}}"</strong> has been created successfully.',
      warn: '<strong>\u26A0\uFE0F Important:</strong> Keep the administrator link safe. It is the only way to manage the poll.',
      text: `{{pollType}} created successfully!\n\nHello,\n\nYour {{pollType}} "{{pollTitle}}" has been created successfully.\n\nAdministrator link:\nManage poll: {{adminLink}}\n\nPublic link to share:\nGo to voting: {{publicLink}}\n\nImportant: Keep the administrator link safe. It is the only way to manage the poll.`,
      name: 'Poll created',
      subject: '[{{siteName}}] {{pollType}} created: {{pollTitle}}',
    },
  }[lang];

  const adminBox = container('admin-box', '#f8f9fa', '#2a2a3e', [
    heading('ab-h', S.adminHeading, 'h3'),
    txt('ab-t', S.adminText),
    btn('ab-btn', S.adminButton, 'adminLink', 'primary'),
  ]);

  const publicBox = container('public-box', '#e8f4f8', '#1e3a4a', [
    heading('pb-h', S.publicHeading, 'h3'),
    txt('pb-t', S.publicText),
    btn('pb-btn', S.publicButton, 'publicLink', 'secondary'),
  ], 'secondary');

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', S.headline, 'h1'),
    txt('t1', S.greeting),
    txt('t2', S.intro),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    txt('warn', S.warn, { bold: true }),
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

  return { name: S.name, subject: S.subject, jsonContent: tpl(allBlocks, topIds), textContent: S.text };
}

// ---- invitation with QR code ----
function buildInvitationTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      headline: 'Einladung zur Abstimmung',
      greeting: 'Hallo,',
      intro: '{{inviterName}} lädt Sie ein, an der Umfrage <strong>"{{pollTitle}}"</strong> teilzunehmen.',
      button: 'Jetzt abstimmen',
      qrAlt: 'QR-Code zur Umfrage',
      text: `Einladung zur Abstimmung\n\nHallo,\n\n{{inviterName}} lädt Sie ein, an der Umfrage "{{pollTitle}}" teilzunehmen.\n\n{{message}}\n\nJetzt abstimmen: {{publicLink}}`,
      name: 'Einladung zur Umfrage',
      subject: '[{{siteName}}] {{inviterName}} lädt Sie ein: {{pollTitle}}',
    },
    en: {
      headline: 'Invitation to vote',
      greeting: 'Hello,',
      intro: '{{inviterName}} invites you to take part in the poll <strong>"{{pollTitle}}"</strong>.',
      button: 'Vote now',
      qrAlt: 'QR code for the poll',
      text: `Invitation to vote\n\nHello,\n\n{{inviterName}} invites you to take part in the poll "{{pollTitle}}".\n\n{{message}}\n\nVote now: {{publicLink}}`,
      name: 'Poll invitation',
      subject: '[{{siteName}}] {{inviterName}} invites you: {{pollTitle}}',
    },
  }[lang];
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', S.headline, 'h1'));
  defs.push(txt('t0', S.greeting));
  defs.push(txt('t1', S.intro));
  defs.push(txt('t2', '{{message}}'));
  defs.push(btn('b1', S.button, 'publicLink', 'primary'));
  defs.push(img('qr', 'qrCodeUrl', S.qrAlt, '150px'));
  defs.push(divider('d1'));

  return buildTemplate(S.name, S.subject, defs, [], S.text);
}

// ---- reminder with QR code ----
function buildReminderTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      headline: 'Erinnerung zur Abstimmung',
      greeting: 'Hallo,',
      intro: '{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage <strong>"{{pollTitle}}"</strong>.',
      importance: 'Ihre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.',
      button: 'Jetzt abstimmen',
      qrAlt: 'QR-Code zur Umfrage',
      text: `Erinnerung zur Abstimmung\n\nHallo,\n\n{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage "{{pollTitle}}".\n\nIhre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.\n\n{{expiresAt}}\n\nJetzt abstimmen: {{pollLink}}`,
      name: 'Erinnerung',
      subject: '[{{siteName}}] Erinnerung: {{pollTitle}}',
    },
    en: {
      headline: 'Voting reminder',
      greeting: 'Hello,',
      intro: '{{senderName}} kindly reminds you to take part in the poll <strong>"{{pollTitle}}"</strong>.',
      importance: 'Your vote matters! Please take a moment to cast it.',
      button: 'Vote now',
      qrAlt: 'QR code for the poll',
      text: `Voting reminder\n\nHello,\n\n{{senderName}} kindly reminds you to take part in the poll "{{pollTitle}}".\n\nYour vote matters! Please take a moment to cast it.\n\n{{expiresAt}}\n\nVote now: {{pollLink}}`,
      name: 'Reminder',
      subject: '[{{siteName}}] Reminder: {{pollTitle}}',
    },
  }[lang];
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', S.headline, 'h1'));
  defs.push(txt('t0', S.greeting));
  defs.push(txt('t1', S.intro));
  defs.push(txt('t2', S.importance));
  defs.push(txt('t3', '{{expiresAt}}'));
  defs.push(btn('b1', S.button, 'pollLink', 'primary'));
  defs.push(img('qr', 'qrCodeUrl', S.qrAlt, '150px'));
  defs.push(divider('d1'));

  return buildTemplate(S.name, S.subject, defs, [], S.text);
}

function assembleBoxTemplate(
  topDefs: [string, EmailBuilderBlock][],
  box: { entry: [string, EmailBuilderBlock]; children: Record<string, EmailBuilderBlock> },
  bottomDefs: [string, EmailBuilderBlock][],
): EmailBuilderDocument {
  const allBlocks: Record<string, EmailBuilderBlock> = {};
  const topIds: string[] = [];
  for (const [id, block] of topDefs) { allBlocks[id] = block; topIds.push(id); }
  const [boxId, boxBlock] = box.entry;
  allBlocks[boxId] = boxBlock; topIds.push(boxId);
  for (const [cid, cb] of Object.entries(box.children)) allBlocks[cid] = cb;
  for (const [id, block] of bottomDefs) { allBlocks[id] = block; topIds.push(id); }
  return tpl(allBlocks, topIds);
}

// ---- vote_confirmation with container ----
function buildVoteConfirmationTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      boxText: 'Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren oder die aktuellen Ergebnisse einsehen.',
      boxButton: 'Ergebnisse anzeigen',
      headline: 'Vielen Dank für Ihre Teilnahme!',
      greeting: 'Hallo {{voterName}},',
      intro: 'vielen Dank für Ihre Teilnahme an der {{pollType}} <strong>"{{pollTitle}}"</strong>. Ihre Auswahl wurde erfolgreich gespeichert.',
      name: 'Abstimmungsbestätigung',
      subject: '[{{siteName}}] Vielen Dank für Ihre Teilnahme - {{pollTitle}}',
      text: 'Vielen Dank für Ihre Teilnahme!\n\nHallo {{voterName}},\n\nvielen Dank für Ihre Teilnahme an der {{pollType}} "{{pollTitle}}". Ihre Auswahl wurde erfolgreich gespeichert.\n\nErgebnisse anzeigen: {{resultsLink}}',
    },
    en: {
      boxText: 'Use this link to return to the poll or view the current results at any time.',
      boxButton: 'View results',
      headline: 'Thank you for taking part!',
      greeting: 'Hello {{voterName}},',
      intro: 'Thank you for taking part in the {{pollType}} <strong>"{{pollTitle}}"</strong>. Your selection has been saved.',
      name: 'Vote confirmation',
      subject: '[{{siteName}}] Thank you for taking part - {{pollTitle}}',
      text: 'Thank you for taking part!\n\nHello {{voterName}},\n\nThank you for taking part in the {{pollType}} "{{pollTitle}}". Your selection has been saved.\n\nView results: {{resultsLink}}',
    },
  }[lang];
  const linkBox = container('link-box', '#e8f4f8', '#1e3a4a', [
    txt('lb-t', S.boxText),
    btn('lb-btn1', S.boxButton, 'resultsLink', 'secondary'),
  ], 'secondary');

  return {
    name: S.name,
    subject: S.subject,
    jsonContent: assembleBoxTemplate(
      [heading('h1', S.headline, 'h1'), txt('t1', S.greeting), txt('t2', S.intro)],
      linkBox,
      [divider('d1')],
    ),
    textContent: S.text,
  };
}

function buildVoteUpdatedTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      boxText: 'Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren oder die aktuellen Ergebnisse einsehen.',
      boxButton: 'Ergebnisse anzeigen',
      headline: 'Ihre Abstimmung wurde aktualisiert',
      greeting: 'Hallo {{voterName}},',
      intro: 'Ihre Auswahl für die {{pollType}} <strong>"{{pollTitle}}"</strong> wurde erfolgreich aktualisiert.',
      name: 'Abstimmung aktualisiert',
      subject: '[{{siteName}}] Abstimmung aktualisiert - {{pollTitle}}',
      text: 'Ihre Abstimmung wurde aktualisiert\n\nHallo {{voterName}},\n\nIhre Auswahl für die {{pollType}} "{{pollTitle}}" wurde erfolgreich aktualisiert.\n\nErgebnisse anzeigen: {{resultsLink}}',
    },
    en: {
      boxText: 'Use this link to return to the poll or view the current results at any time.',
      boxButton: 'View results',
      headline: 'Your vote has been updated',
      greeting: 'Hello {{voterName}},',
      intro: 'Your selection for the {{pollType}} <strong>"{{pollTitle}}"</strong> has been updated.',
      name: 'Vote updated',
      subject: '[{{siteName}}] Vote updated - {{pollTitle}}',
      text: 'Your vote has been updated\n\nHello {{voterName}},\n\nYour selection for the {{pollType}} "{{pollTitle}}" has been updated.\n\nView results: {{resultsLink}}',
    },
  }[lang];
  const linkBox = container('update-link-box', '#e8f4f8', '#1e3a4a', [
    txt('ulb-t', S.boxText),
    btn('ulb-btn1', S.boxButton, 'resultsLink', 'secondary'),
  ], 'secondary');

  return {
    name: S.name,
    subject: S.subject,
    jsonContent: assembleBoxTemplate(
      [heading('uh1', S.headline, 'h1'), txt('ut1', S.greeting), txt('ut2', S.intro)],
      linkBox,
      [divider('ud1')],
    ),
    textContent: S.text,
  };
}

// ---- new_vote_notification: notify creator on new vote ----
function buildNewVoteNotificationTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      boxText: 'Hier können Sie die aktuellen Ergebnisse einsehen und die Umfrage verwalten.',
      boxButton: 'Ergebnisse anzeigen',
      headline: 'Neue Abstimmung eingegangen',
      greeting: 'Hallo,',
      intro: '<strong>{{voterName}}</strong> hat soeben an Ihrer {{pollType}} <strong>"{{pollTitle}}"</strong> teilgenommen.',
      name: 'Neue Abstimmung (Ersteller)',
      subject: '[{{siteName}}] Neue Abstimmung – {{pollTitle}}',
      text: 'Neue Abstimmung eingegangen\n\nHallo,\n\n{{voterName}} hat soeben an Ihrer {{pollType}} "{{pollTitle}}" teilgenommen.\n\nErgebnisse anzeigen: {{adminLink}}',
    },
    en: {
      boxText: 'Here you can view the current results and manage the poll.',
      boxButton: 'View results',
      headline: 'New response received',
      greeting: 'Hello,',
      intro: '<strong>{{voterName}}</strong> has just taken part in your {{pollType}} <strong>"{{pollTitle}}"</strong>.',
      name: 'New response (creator)',
      subject: '[{{siteName}}] New response – {{pollTitle}}',
      text: 'New response received\n\nHello,\n\n{{voterName}} has just taken part in your {{pollType}} "{{pollTitle}}".\n\nView results: {{adminLink}}',
    },
  }[lang];
  const adminBox = container('nvn-admin-box', '#f8f9fa', '#2a2a3e', [
    txt('nvn-ab-t', S.boxText),
    btn('nvn-ab-btn', S.boxButton, 'adminLink', 'primary'),
  ]);

  return {
    name: S.name,
    subject: S.subject,
    jsonContent: assembleBoxTemplate(
      [heading('nvn-h1', S.headline, 'h1'), txt('nvn-t1', S.greeting), txt('nvn-t2', S.intro)],
      adminBox,
      [divider('nvn-d1')],
    ),
    textContent: S.text,
  };
}

// ---- password_reset with container ----
function buildPasswordResetTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      boxText: 'Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben. Dieser Link ist 1 Stunde gültig.',
      boxButton: 'Passwort zurücksetzen',
      headline: 'Passwort zurücksetzen',
      greeting: 'Hallo {{userName}},',
      intro: 'Sie haben angefordert, Ihr Passwort für Ihren {{siteName}} Account zurückzusetzen.',
      ignore: 'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.',
      name: 'Passwort zurücksetzen',
      subject: '[{{siteName}}] Passwort zurücksetzen',
      text: 'Passwort zurücksetzen\n\nHallo {{userName}},\n\nSie haben angefordert, Ihr Passwort zurückzusetzen.\n\nPasswort zurücksetzen: {{resetLink}}\n\nDieser Link ist 1 Stunde gültig.',
    },
    en: {
      boxText: 'Click the button below to choose a new password. This link is valid for 1 hour.',
      boxButton: 'Reset password',
      headline: 'Reset your password',
      greeting: 'Hello {{userName}},',
      intro: 'You requested a password reset for your {{siteName}} account.',
      ignore: 'If you did not make this request, you can ignore this email. Your password will remain unchanged.',
      name: 'Password reset',
      subject: '[{{siteName}}] Reset your password',
      text: 'Reset your password\n\nHello {{userName}},\n\nYou requested a password reset.\n\nReset password: {{resetLink}}\n\nThis link is valid for 1 hour.',
    },
  }[lang];
  const actionBox = container('action-box', '#f8f9fa', '#2a2a3e', [
    txt('ab-t', S.boxText),
    btn('ab-btn', S.boxButton, 'resetLink', 'primary'),
  ]);

  return {
    name: S.name,
    subject: S.subject,
    jsonContent: assembleBoxTemplate(
      [heading('h1', S.headline, 'h1'), txt('t1', S.greeting), txt('t2', S.intro)],
      actionBox,
      [txt('t3', S.ignore, { color: '#6c757d', fontSize: 14 }), divider('d1')],
    ),
    textContent: S.text,
  };
}

// ---- welcome with container ----
function buildWelcomeTemplate(lang: EmailLanguage): TemplateDefinition {
  const S = {
    de: {
      boxText: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um alle Funktionen von {{siteName}} nutzen zu können.',
      boxButton: 'E-Mail bestätigen',
      headline: 'Willkommen bei {{siteName}}!',
      greeting: 'Hallo {{userName}},',
      intro: 'vielen Dank für Ihre Registrierung bei {{siteName}}! Ihr Account wurde erfolgreich erstellt.',
      name: 'Willkommen',
      subject: '[{{siteName}}] Willkommen bei {{siteName}}!',
      text: 'Willkommen bei {{siteName}}!\n\nHallo {{userName}},\n\nvielen Dank für Ihre Registrierung! Ihr Account wurde erfolgreich erstellt.\n\nE-Mail bestätigen: {{verificationLink}}',
    },
    en: {
      boxText: 'Please confirm your email address to use all features of {{siteName}}.',
      boxButton: 'Confirm email',
      headline: 'Welcome to {{siteName}}!',
      greeting: 'Hello {{userName}},',
      intro: 'Thank you for registering with {{siteName}}! Your account has been created.',
      name: 'Welcome',
      subject: '[{{siteName}}] Welcome to {{siteName}}!',
      text: 'Welcome to {{siteName}}!\n\nHello {{userName}},\n\nThank you for registering! Your account has been created.\n\nConfirm email: {{verificationLink}}',
    },
  }[lang];
  const actionBox = container('action-box', '#e8f4f8', '#1e3a4a', [
    txt('ab-t', S.boxText),
    btn('ab-btn', S.boxButton, 'verificationLink', 'secondary'),
  ], 'secondary');

  return {
    name: S.name,
    subject: S.subject,
    jsonContent: assembleBoxTemplate(
      [heading('h1', S.headline, 'h1'), txt('t1', S.greeting), txt('t2', S.intro)],
      actionBox,
      [divider('d1')],
    ),
    textContent: S.text,
  };
}

function buildEmailChangeTemplate(lang: EmailLanguage): TemplateDefinition {
  if (lang === 'en') {
    return buildSimpleTemplate(
      'Change email address',
      '[{{siteName}}] Confirm your email address',
      'Confirm your email address',
      [
        'Hello,',
        'You requested to change the email address of your {{siteName}} account.',
        '<strong>Old email:</strong> {{oldEmail}}',
        '<strong>New email:</strong> {{newEmail}}',
        'This link is valid for 24 hours.',
        'If you did not make this request, you can ignore this email.',
      ],
      'Confirm email',
      'confirmLink',
    );
  }
  return buildSimpleTemplate(
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
  );
}

function buildPasswordChangedTemplate(lang: EmailLanguage): TemplateDefinition {
  if (lang === 'en') {
    return buildSimpleTemplate(
      'Password changed',
      '[{{siteName}}] Your password has been changed',
      'Password changed successfully',
      [
        'Hello {{userName}},',
        'The password for your {{siteName}} account has been changed.',
        '<strong>If you did not make this change, please contact the administrator immediately.</strong>',
      ],
    );
  }
  return buildSimpleTemplate(
    'Passwort geändert',
    '[{{siteName}}] Ihr Passwort wurde geändert',
    'Passwort erfolgreich geändert',
    [
      'Hallo {{userName}},',
      'Ihr Passwort für Ihren {{siteName}} Account wurde erfolgreich geändert.',
      '<strong>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie bitte umgehend den Administrator.</strong>',
    ],
  );
}

function buildTestReportTemplate(lang: EmailLanguage): TemplateDefinition {
  if (lang === 'en') {
    return buildSimpleTemplate(
      'Test report',
      '[{{siteName}}] Test report #{{testRunId}}: {{status}}',
      '{{status}} — Automated test report',
      [
        'Automated test run <strong>#{{testRunId}}</strong> has finished.',
        '{{failedSummaryHtml}}',
        'Total tests: {{totalTests}}',
        'Passed: {{passed}}',
        'Failed: {{failed}}',
        'Skipped: {{skipped}}',
        'Duration: {{duration}}',
        'Started: {{startedAt}}',
      ],
    );
  }
  return buildSimpleTemplate(
    'Testbericht',
    '[{{siteName}}] Testbericht #{{testRunId}}: {{status}}',
    '{{status}} — Automatischer Testbericht',
    [
      'Der automatische Testlauf <strong>#{{testRunId}}</strong> wurde abgeschlossen.',
      '{{failedSummaryHtml}}',
      'Gesamte Tests: {{totalTests}}',
      'Bestanden: {{passed}}',
      'Fehlgeschlagen: {{failed}}',
      'Übersprungen: {{skipped}}',
      'Dauer: {{duration}}',
      'Gestartet: {{startedAt}}',
    ],
  );
}

function buildPollFinalizedTemplate(lang: EmailLanguage): TemplateDefinition {
  if (lang === 'en') {
    return buildSimpleTemplate(
      'Poll completed',
      '[{{siteName}}] {{statusLabel}}: {{pollTitle}}',
      '{{statusLabel}}',
      [
        'Hello,',
        'The poll <strong>"{{pollTitle}}"</strong> has been completed.',
        '{{confirmedDate}}',
        '{{confirmedTime}}',
        '{{videoConferenceHtml}}',
      ],
      '{{buttonLabel}}',
      'buttonLink',
    );
  }
  return buildSimpleTemplate(
    'Umfrage abgeschlossen',
    '[{{siteName}}] {{statusLabel}}: {{pollTitle}}',
    '{{statusLabel}}',
    [
      'Hallo,',
      'die Umfrage <strong>„{{pollTitle}}"</strong> wurde abgeschlossen.',
      '{{confirmedDate}}',
      '{{confirmedTime}}',
      '{{videoConferenceHtml}}',
    ],
    '{{buttonLabel}}',
    'buttonLink',
  );
}

function buildDefaultTemplates(lang: EmailLanguage): Record<EmailTemplateType, TemplateDefinition> {
  return {
    poll_created: buildPollCreatedTemplate(lang),
    invitation: buildInvitationTemplate(lang),
    vote_confirmation: buildVoteConfirmationTemplate(lang),
    vote_updated: buildVoteUpdatedTemplate(lang),
    new_vote_notification: buildNewVoteNotificationTemplate(lang),
    reminder: buildReminderTemplate(lang),
    password_reset: buildPasswordResetTemplate(lang),
    email_change: buildEmailChangeTemplate(lang),
    password_changed: buildPasswordChangedTemplate(lang),
    test_report: buildTestReportTemplate(lang),
    welcome: buildWelcomeTemplate(lang),
    poll_finalized: buildPollFinalizedTemplate(lang),
  };
}

// Built-in templates per language. German is the historical set; a missing
// customization in a language always falls back to that language's built-in.
const DEFAULT_TEMPLATES_BY_LANGUAGE: Record<EmailLanguage, Record<EmailTemplateType, TemplateDefinition>> = {
  de: buildDefaultTemplates('de'),
  en: buildDefaultTemplates('en'),
};

function getDefaultTemplateDefinition(type: EmailTemplateType, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): TemplateDefinition {
  return DEFAULT_TEMPLATES_BY_LANGUAGE[lang][type];
}

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
/** Strip dangerous HTML tags from plain footer text (not from inside {{link:...}} labels). */
function stripFooterHtml(text: string): string {
  return text
    // Remove dangerous block tags including their inner content
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Strip remaining HTML tags (keeping their text content)
    .replace(/<[^>]+>/g, '');
}

function renderFooterMarkup(input: string, linkStyle: string = ''): string {
  const linkPattern = /\{\{link:([^|}]+?)(?:\|([^}]+?))?\}\}/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      // Strip HTML from plain-text segments only; labels inside {{link:...}} are
      // handled separately by htmlEscape below so they are not affected here.
      parts.push(htmlEscape(stripFooterHtml(input.slice(lastIndex, match.index))));
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
    parts.push(htmlEscape(stripFooterHtml(input.slice(lastIndex))));
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

function renderSafeCustomMarkup(
  template: string,
  variables: Record<string, string | undefined>
): string {
  const allowedTagMap: Record<string, string> = {
    '<strong>': '__ALLOWED_TAG_STRONG_OPEN__',
    '</strong>': '__ALLOWED_TAG_STRONG_CLOSE__',
    '<em>': '__ALLOWED_TAG_EM_OPEN__',
    '</em>': '__ALLOWED_TAG_EM_CLOSE__',
    '<br>': '__ALLOWED_TAG_BR__',
    '<br/>': '__ALLOWED_TAG_BR__',
    '<br />': '__ALLOWED_TAG_BR__',
  };

  let tokenized = template;
  for (const [tag, token] of Object.entries(allowedTagMap)) {
    tokenized = tokenized.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), token);
  }

  let rendered = substituteVariables(tokenized, variables, true);
  for (const [tag, token] of Object.entries(allowedTagMap)) {
    rendered = rendered.replace(new RegExp(token, 'g'), tag === '<br/>' || tag === '<br />' ? '<br>' : tag);
  }

  return rendered;
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

// Layouts saved by older or hand-edited builders can lack a childrenIds list
// (or store something that is not one). Treat those as "no blocks" so
// rendering and plain-text extraction agree instead of crashing on save.
function childIdList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function renderBlocksToHtml(
  blockIds: string[],
  doc: EmailBuilderDocument,
  tv: ReturnType<typeof resolveTheme>
): string {
  let html = '';
  for (const blockId of blockIds) {
    const block = doc[blockId];
    if (!block || typeof block !== 'object') continue;

    const blockData = (block.data || {}) as Record<string, unknown>;
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
        const childHtml = renderBlocksToHtml(childIdList(blockData.childrenIds), doc, tv);
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
    if (!block || typeof block !== 'object') continue;
    const blockData = (block.data || {}) as Record<string, unknown>;
    const props = (blockData.props || {}) as Record<string, unknown>;
    if (props.text) {
      const rawText = (props.text as string).replace(/<[^>]*>/g, '');
      text += rawText + '\n\n';
    }
    if (block.type === 'Container') {
      text += extractTextRecursive(childIdList(blockData.childrenIds), doc);
    }
    if (props.url && props.text) {
      text += `${props.url}\n\n`;
    }
  }
  return text;
}

function extractTextFromBlocks(doc: EmailBuilderDocument): string {
  const root = doc.root;
  if (!root) return '';
  return extractTextRecursive(childIdList(root.data?.childrenIds), doc).trim();
}

// Convert email-builder JSON to HTML
export function jsonToHtml(jsonContent: EmailBuilderDocument, theme?: EmailTheme): string {
  const root = jsonContent.root;
  if (!root || root.type !== 'EmailLayout') {
    return '<div>Template-Fehler: Ungültiges Format</div>';
  }

  const tv = resolveTheme(theme, (root.data || {}) as unknown as Record<string, unknown>);
  let html = `<div style="font-family: ${tv.fontFamily}; color: ${tv.textColor};">`;
  html += renderBlocksToHtml(childIdList(root.data?.childrenIds), jsonContent, tv);
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
      editLink: 'https://polly.example.com/edit/token123',
      siteName,
    },
    vote_updated: {
      voterName: 'Anna Schmidt',
      pollType: 'Terminumfrage',
      pollTitle: 'Teammeeting Q1 2025',
      publicLink: 'https://polly.example.com/poll/abc123',
      resultsLink: 'https://polly.example.com/poll/abc123/results',
      editLink: 'https://polly.example.com/edit/token123',
      siteName,
    },
    new_vote_notification: {
      voterName: 'Anna Schmidt',
      pollType: 'Terminumfrage',
      pollTitle: 'Teammeeting Q1 2025',
      adminLink: 'https://polly.example.com/admin/abc123',
      resultsLink: 'https://polly.example.com/poll/abc123#results',
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
      startedAt: new Date().toLocaleString(emailLocale('de')),
      failedSummaryHtml: '<p><strong>Fehlgeschlagene Tests (1)</strong></p><ul><li>API should reject invalid token (server/tests/api/security.test.ts)</li></ul>',
      failedSummaryText: 'Fehlgeschlagene Tests (1): API should reject invalid token (server/tests/api/security.test.ts)',
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
      pollType: 'schedule',
      statusLabel: 'Termin bestätigt',
      confirmedDate: 'Montag, 15. Januar 2025',
      confirmedTime: '14:00 – 15:00 Uhr',
      pollLink: 'https://polly.example.com/poll/abc123',
      buttonLink: 'https://polly.example.com/poll/abc123',
      buttonLabel: 'Zur Umfrage \u2192',
      resultsPublic: 'true',
      siteName,
    },
  };
}


const SAMPLE_DATA_EN_OVERRIDES: Partial<Record<EmailTemplateType, Record<string, string>>> = {
  poll_created: { pollType: 'Schedule Poll', pollTitle: 'Team meeting Q1 2025' },
  invitation: { inviterName: 'John Smith', pollTitle: 'Team meeting Q1 2025', message: 'Please pick the dates that work for you.' },
  vote_confirmation: { voterName: 'Anna Smith', pollType: 'Schedule Poll', pollTitle: 'Team meeting Q1 2025' },
  vote_updated: { voterName: 'Anna Smith', pollType: 'Schedule Poll', pollTitle: 'Team meeting Q1 2025' },
  new_vote_notification: { voterName: 'Anna Smith', pollType: 'Schedule Poll', pollTitle: 'Team meeting Q1 2025' },
  reminder: { senderName: 'John Smith', pollTitle: 'Team meeting Q1 2025', expiresAt: 'The poll ends on 31/12/2025 at 23:59.' },
  password_reset: { userName: 'John Smith' },
  email_change: { oldEmail: 'old-email@example.com', newEmail: 'new-email@example.com' },
  password_changed: { userName: 'John Smith' },
  test_report: {
    status: 'Passed',
    duration: '12.5 seconds',
    failedSummaryHtml: '<p><strong>Failed tests (1)</strong></p><ul><li>API should reject invalid token (server/tests/api/security.test.ts)</li></ul>',
    failedSummaryText: 'Failed tests (1): API should reject invalid token (server/tests/api/security.test.ts)',
  },
  welcome: { userName: 'John Smith', userEmail: 'john.smith@example.com', verificationLink: 'https://polly.example.com/email-bestaetigen/abc123xyz789' },
  poll_finalized: {
    pollTitle: 'Team meeting Q1 2025',
    statusLabel: 'Date confirmed',
    confirmedDate: 'Monday, 15 January 2025',
    confirmedTime: '14:00 – 15:00',
    buttonLabel: 'Go to poll \u2192',
  },
};

function getLocalizedSampleData(siteName: string, lang: EmailLanguage): Record<EmailTemplateType, Record<string, string>> {
  const base = getSampleData(siteName);
  if (lang === 'de') return base;
  const result = { ...base };
  for (const type of EMAIL_TEMPLATE_TYPES) {
    result[type] = { ...base[type], ...(SAMPLE_DATA_EN_OVERRIDES[type] || {}) };
  }
  result.test_report.startedAt = new Date().toLocaleString(emailLocale('en'));
  return result;
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
  language: EmailLanguage;
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
<html lang="${data.language}">
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
          style="color: #9ba8bb; text-decoration: none; border-bottom: 1px solid #c8d0dc;">${htmlEscape(emailStrings(data.language).privacy)}</a>` : ''}
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
  const titleHtml = title
    ? `<p class="link-title" style="font-family: ${fontFamily}; font-size: 17px; color: #1a202c; margin-bottom: 5px;">${title}</p>`
    : '';
  return `<tr><td style="padding: 24px 40px 24px;">
      <p class="link-label" style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin-bottom: 5px;">${label}</p>
      ${titleHtml}
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
  language: EmailLanguage;
}

interface PollCreatedTextOverrides {
  greeting?: string;
  subline?: string;
  adminLabel?: string;
  adminTitle?: string;
  adminDescription?: string;
  adminButtonText?: string;
  publicLabel?: string;
  publicTitle?: string;
  publicDescription?: string;
  publicButtonText?: string;
  noticeTitle?: string;
  noticeBody?: string;
}

function stripTrailingColon(value: string): string {
  return value.trim().replace(/:\s*$/, '');
}

function parseLinkLine(line: string, variableName: 'adminLink' | 'publicLink'): string | undefined {
  const match = line.match(new RegExp(`^(.*?)\\s*\\{\\{${variableName}\\}\\}\\s*$`));
  if (!match) return undefined;
  const label = stripTrailingColon(match[1] || '');
  return label || undefined;
}

// Extracts only the introductory paragraph(s) from a custom poll_created text
// template — i.e. the lines before any link-section content (admin link lines,
// participant link lines, "Wichtig" notice, etc.).  The link sections are
// rendered automatically by the V3 body builder below the intro.
function extractPollCreatedIntroText(textContent: string): string {
  const LINK_SECTION_MARKERS = [
    '{{adminLink}}',
    '{{publicLink}}',
    'Administrator-Link',
    'Admin-Link',
    'Administratorlink',
    'Teilnehmer-Link',
    'Öffentlicher Link',
    'Oeffentlicher Link',
    'Zur Verwaltung',
    'Zur Umfrage',
    'Zur Abstimmung',
    'Wichtig:',
    'Wichtig ',
    // English counterparts
    'Administrator link',
    'Admin link',
    'Participant link',
    'Public link',
    'Manage poll',
    'Go to voting',
    'Go to poll',
    'Important:',
  ];

  const lines = textContent.split(/\r?\n/);
  const introLines: string[] = [];

  for (const line of lines) {
    const isLinkLine = LINK_SECTION_MARKERS.some(marker =>
      line.includes(marker)
    );
    if (isLinkLine) break;
    introLines.push(line);
  }

  return introLines.join('\n').trimEnd();
}

function parsePollCreatedTextOverrides(textContent?: string | null): PollCreatedTextOverrides {
  if (!textContent) return {};

  const lines = textContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const adminLinkIndex = lines.findIndex((line) => line.includes('{{adminLink}}'));
  const publicLinkIndex = lines.findIndex((line) => line.includes('{{publicLink}}'));

  if (adminLinkIndex < 0 || publicLinkIndex < 0 || publicLinkIndex <= adminLinkIndex) {
    return {};
  }

  const overrides: PollCreatedTextOverrides = {};

  const greetingLine = lines[0];
  const hasGreeting = /^(hallo|hello|hi)\b/i.test(greetingLine || '');
  if (hasGreeting) {
    overrides.greeting = greetingLine;
  }

  const introAndAdminLines = lines.slice(hasGreeting ? 1 : 0, adminLinkIndex);
  // Match the admin section header: line must mention "administrator" or "admin"
  // (with or without a trailing colon — users often omit it)
  const adminTitleIndex = introAndAdminLines.findIndex((line) => /\badministrator|\badmin[-\s]/i.test(line));

  if (adminTitleIndex >= 0) {
    const introLines = introAndAdminLines.slice(0, adminTitleIndex);
    if (introLines.length > 0) {
      overrides.subline = introLines.join(' ');
    }
    overrides.adminLabel = stripTrailingColon(introAndAdminLines[adminTitleIndex]);
    const adminDescriptionLines = introAndAdminLines.slice(adminTitleIndex + 1);
    if (adminDescriptionLines.length > 0) {
      overrides.adminDescription = adminDescriptionLines.join(' ');
    }
  } else if (introAndAdminLines.length > 0) {
    overrides.subline = introAndAdminLines.join(' ');
  }

  const adminButtonText = parseLinkLine(lines[adminLinkIndex], 'adminLink');
  if (adminButtonText) {
    overrides.adminButtonText = adminButtonText;
  }

  const publicSectionLines = lines.slice(adminLinkIndex + 1, publicLinkIndex);
  // Match the public section header: line mentions "teilnehmer" or "öffentlich"
  // (with or without a trailing colon — users often omit it)
  const publicTitleIndex = publicSectionLines.findIndex((line) => /(teilnehmer|öffentlich|oeffentlich|participant|public)/i.test(line));
  if (publicTitleIndex >= 0) {
    overrides.publicLabel = stripTrailingColon(publicSectionLines[publicTitleIndex]);
    const publicDescriptionLines = publicSectionLines.slice(publicTitleIndex + 1);
    if (publicDescriptionLines.length > 0) {
      overrides.publicDescription = publicDescriptionLines.join(' ');
    }
  } else if (publicSectionLines.length > 0) {
    overrides.publicDescription = publicSectionLines.join(' ');
  }

  const publicButtonText = parseLinkLine(lines[publicLinkIndex], 'publicLink');
  if (publicButtonText) {
    overrides.publicButtonText = publicButtonText;
  }

  const noticeLines = lines.slice(publicLinkIndex + 1);
  if (noticeLines.length > 0) {
    const firstNoticeLine = noticeLines[0];
    const noticeMatch = firstNoticeLine.match(/^([^:]+):\s*(.*)$/);
    if (noticeMatch) {
      overrides.noticeTitle = noticeMatch[1].trim();
      const bodyLines = [noticeMatch[2].trim(), ...noticeLines.slice(1)].filter(Boolean);
      if (bodyLines.length > 0) {
        overrides.noticeBody = bodyLines.join(' ');
      }
    } else {
      overrides.noticeBody = noticeLines.join(' ');
    }
  }

  return overrides;
}

function resolveOverrideText(
  vars: Record<string, string | undefined>,
  key: keyof PollCreatedTextOverrides,
): string | undefined {
  const value = vars[`pollCreatedOverride_${key}`];
  if (!value) return undefined;
  return renderTemplate(value, vars).trim();
}

function buildV3PollCreatedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const P = L.pollCreated;
  const pollType = vars.pollType || L.defaultPollType;
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const creatorName = htmlEscape(vars.creatorName || '');
  const adminLink = vars.adminLink || '#';
  const publicLink = vars.publicLink || '#';
  const isRegistered = vars.isRegisteredUser === 'true';

  // Custom intro text is set when the admin has saved a custom text template.
  // In that case, we show the custom text as a simple paragraph instead of the
  // default tag + headline block, but keep all the link sections and notice below.
  const customIntro = vars.pollCreatedCustomIntro ?? null;

  let headBlock: string;
  if (customIntro !== null) {
    const lines = customIntro.split('\n').map(line => htmlEscape(line)).join('<br>');
    headBlock = `${v3BodyStart()}
      <p style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 15px; color: #374151; line-height: 1.6; margin: 0;">${lines}</p>
    ${v3BodyEnd()}`;
  } else {
    const greetingOverride = resolveOverrideText(vars, 'greeting');
    const greeting = greetingOverride
      ? htmlEscape(greetingOverride)
      : L.greeting(creatorName);
    const defaultSubline = isRegistered ? P.sublineRegistered(greeting) : P.sublineGuest(greeting);
    const sublineOverride = resolveOverrideText(vars, 'subline');
    const subline = htmlEscape(sublineOverride || defaultSubline);
    headBlock = `${v3BodyStart()}
      ${v3Tag(pollType, ctx.primaryColor)}
      ${v3Headline(P.headlineBefore, L.quote(pollTitle), P.headlineAfter, ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(subline)}
    ${v3BodyEnd()}`;
  }

  const defaultNoticeTitle = isRegistered ? P.noticeTitleRegistered : P.noticeTitleGuest;
  const defaultNoticeBody = isRegistered ? P.noticeBodyRegistered : P.noticeBodyGuest;

  // When showing a custom intro (non-default template), omit the big section titles
  // ("Umfrage verwalten", "Abstimmung öffnen") by default — the custom label already
  // serves as the section header.  Default templates always show full titles.
  const isCustomTemplate = customIntro !== null;
  const adminLabel = htmlEscape(resolveOverrideText(vars, 'adminLabel') || P.adminLabel);
  const adminTitle = htmlEscape(resolveOverrideText(vars, 'adminTitle') ?? (isCustomTemplate ? '' : P.adminTitle));
  const adminDescription = htmlEscape(resolveOverrideText(vars, 'adminDescription') || P.adminDescription);
  const adminButtonText = htmlEscape(resolveOverrideText(vars, 'adminButtonText') || P.adminButton);
  const publicLabel = htmlEscape(resolveOverrideText(vars, 'publicLabel') || P.publicLabel);
  const publicTitle = htmlEscape(resolveOverrideText(vars, 'publicTitle') ?? (isCustomTemplate ? '' : P.publicTitle));
  const publicDescription = htmlEscape(resolveOverrideText(vars, 'publicDescription') || P.publicDescription);
  const publicButtonText = htmlEscape(resolveOverrideText(vars, 'publicButtonText') || P.publicButton);
  const noticeTitle = htmlEscape(resolveOverrideText(vars, 'noticeTitle') || defaultNoticeTitle);
  const noticeBody = htmlEscape(resolveOverrideText(vars, 'noticeBody') || defaultNoticeBody);

  return `${headBlock}
    ${v3Divider()}
    ${v3LinkSection(adminLabel, adminTitle, adminDescription, adminButtonText, adminLink, 'primary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}
    ${v3Divider()}
    ${v3LinkSection(publicLabel, publicTitle, publicDescription, publicButtonText, publicLink, 'secondary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}
    ${v3Notice(noticeTitle, noticeBody, ctx.primaryColor)}`;
}

function buildV3InvitationBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const inviterName = htmlEscape(vars.inviterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const message = vars.message ? htmlEscape(vars.message) : '';
  const publicLink = vars.publicLink || '#';

  return `${v3BodyStart()}
      ${v3Tag(L.invitation.tag, ctx.primaryColor)}
      ${v3Headline(L.invitation.headline, L.quote(pollTitle), '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`${L.invitation.subline(inviterName)}${message ? ` ${message}` : ''}`)}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection(L.invitation.buttonText, L.invitation.button, publicLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3NewVoteNotificationBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const N = L.newVote;
  const voterName = htmlEscape(vars.voterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const pollType = vars.pollType || L.defaultPollType;
  const adminLink = vars.adminLink || '#';
  const resultsLink = vars.resultsLink || '#';
  const participant = voterName || N.participantFallback;

  return `${v3BodyStart()}
      ${v3Tag(N.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(N.headline, ctx.fontFamily)}
      ${v3Subline(N.subline(participant, htmlEscape(pollType), L.quote(pollTitle)))}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3LinkSection(N.manageLabel, N.manageTitle, N.manageDescription, N.manageButton, adminLink, 'primary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}
    ${v3Divider()}
    ${v3LinkSection(N.resultsLabel, N.resultsTitle, N.resultsDescription, N.resultsButton, resultsLink, 'secondary', ctx.primaryColor, ctx.secondaryColor, ctx.fontFamily)}`;
}

function v3OptionsBlock(label: string, selectedOptionsHtml: string): string {
  return selectedOptionsHtml
    ? `<tr><td style="padding: 0 40px 20px;">
      <p style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin: 0 0 8px 0;">${label}</p>
      ${selectedOptionsHtml}
    </td></tr>`
    : '';
}

function buildV3ReminderBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const R = L.reminder;
  const senderName = htmlEscape(vars.senderName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const expiresAt = vars.expiresAt ? htmlEscape(vars.expiresAt) : '';
  const pollLink = vars.pollLink || '#';
  const optionsBlock = v3OptionsBlock(R.currentSelection, vars.selectedOptionsHtml || '');

  return `${v3BodyStart()}
      ${v3Tag(R.tag, ctx.primaryColor)}
      ${v3Headline(R.headlineBefore, L.quote(pollTitle), '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`${R.subline(senderName)}${expiresAt ? ` ${expiresAt}` : ''}`)}
    ${v3BodyEnd()}
    ${optionsBlock}
    ${v3Divider()}
    ${v3SingleButtonSection(R.buttonText, R.button, pollLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3VoteConfirmationBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const V = L.vote;
  const voterName = htmlEscape(vars.voterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const pollType = vars.pollType || L.defaultPollType;
  const resultsLink = vars.resultsLink || '#';
  const editLink = vars.editLink || '';
  const greeting = L.greeting(voterName);
  const optionsBlock = v3OptionsBlock(V.selection, vars.selectedOptionsHtml || '');
  const withdraw = vars.voteManagementAction === 'withdraw';

  const editSection = editLink
    ? `${v3Divider()}
    ${v3SingleButtonSection(
      withdraw ? V.withdrawText : V.editText,
      withdraw ? V.withdrawButton : V.editButton,
      editLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`
    : '';

  return `${v3BodyStart()}
      ${v3Tag(V.confirmationTag, ctx.primaryColor)}
      ${v3SimpleHeadline(V.confirmationHeadline, ctx.fontFamily)}
      ${v3Subline(V.confirmationSubline(greeting, htmlEscape(pollType), L.quote(pollTitle)))}
    ${v3BodyEnd()}
    ${optionsBlock}
    ${vars.resultsPublic === 'false' ? '' : `${v3Divider()}
    ${v3SingleButtonSection(V.resultsText, V.resultsButton, resultsLink, 'secondary', ctx.primaryColor, ctx.secondaryColor)}`}${editSection}`;
}

function buildV3VoteUpdatedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const V = L.vote;
  const voterName = htmlEscape(vars.voterName || '');
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const pollType = vars.pollType || L.defaultPollType;
  const resultsLink = vars.resultsLink || '#';
  const editLink = vars.editLink || '';
  const greeting = L.greeting(voterName);
  const optionsBlock = v3OptionsBlock(V.currentSelection, vars.selectedOptionsHtml || '');

  const editSection = editLink
    ? `${v3Divider()}
    ${v3SingleButtonSection(V.updatedEditText, V.updatedEditButton, editLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`
    : '';

  return `${v3BodyStart()}
      ${v3Tag(V.updatedTag, ctx.primaryColor)}
      ${v3SimpleHeadline(V.updatedHeadline, ctx.fontFamily)}
      ${v3Subline(V.updatedSubline(greeting, htmlEscape(pollType), L.quote(pollTitle)))}
    ${v3BodyEnd()}
    ${optionsBlock}
    ${vars.resultsPublic === 'false' ? '' : `${v3Divider()}
    ${v3SingleButtonSection(V.resultsText, V.resultsButton, resultsLink, 'secondary', ctx.primaryColor, ctx.secondaryColor)}`}${editSection}`;
}

function buildV3PasswordResetBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const S = L.security;
  const userName = htmlEscape(vars.userName || '');
  const resetLink = vars.resetLink || '#';
  const greeting = L.greeting(userName);

  return `${v3BodyStart()}
      ${v3Tag(S.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(S.resetHeadline, ctx.fontFamily)}
      ${v3Subline(S.resetSubline(greeting))}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection(S.resetButtonText, S.resetButton, resetLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}
    ${v3Notice(S.notRequestedBold, S.resetNotice, ctx.primaryColor)}`;
}

function buildV3EmailChangeBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const S = emailStrings(ctx.language).security;
  const oldEmail = htmlEscape(vars.oldEmail || '');
  const newEmail = htmlEscape(vars.newEmail || '');
  const confirmLink = vars.confirmLink || '#';

  return `${v3BodyStart()}
      ${v3Tag(S.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(S.changeHeadline, ctx.fontFamily)}
      ${v3Subline(S.changeSubline)}
    ${v3BodyEnd()}
    ${v3TextBlock(`<strong>${S.oldEmail}</strong> ${oldEmail}<br><strong>${S.newEmail}</strong> ${newEmail}`)}
    ${v3Divider()}
    ${v3SingleButtonSection(S.changeValidity, S.changeButton, confirmLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}
    ${v3Notice(S.notRequestedBold, S.changeNotice, ctx.primaryColor)}`;
}

function buildV3PasswordChangedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const S = L.security;
  const userName = htmlEscape(vars.userName || '');
  const greeting = L.greeting(userName);

  return `${v3BodyStart()}
      ${v3Tag(S.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(S.changedHeadline, ctx.fontFamily)}
      ${v3Subline(S.changedSubline(greeting))}
    ${v3BodyEnd()}
    ${v3Notice(S.changedNoticeBold, S.changedNotice, ctx.primaryColor)}`;
}

function buildV3TestReportBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const T = emailStrings(ctx.language).testReport;
  const status = htmlEscape(vars.status || '');
  const testRunId = htmlEscape(vars.testRunId || '');
  const totalTests = htmlEscape(vars.totalTests || '0');
  const passed = htmlEscape(vars.passed || '0');
  const failed = htmlEscape(vars.failed || '0');
  const skipped = htmlEscape(vars.skipped || '0');
  const duration = htmlEscape(vars.duration || '');
  const startedAt = htmlEscape(vars.startedAt || '');
  const failedSummaryHtml = vars.failedSummaryHtml || '';

  return `${v3BodyStart()}
      ${v3Tag(T.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(T.headline(status, testRunId), ctx.fontFamily)}
      ${v3Subline(T.subline)}
    ${v3BodyEnd()}
    ${failedSummaryHtml ? v3TextBlock(failedSummaryHtml) : ''}
    ${v3TextBlock(`${T.total}: <strong>${totalTests}</strong><br>${T.passed}: <strong>${passed}</strong><br>${T.failed}: <strong>${failed}</strong><br>${T.skipped}: <strong>${skipped}</strong><br>${T.duration}: <strong>${duration}</strong><br>${T.started}: <strong>${startedAt}</strong>`)}`;
}

function buildV3WelcomeBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const W = L.welcome;
  const userName = htmlEscape(vars.userName || '');
  const verificationLink = vars.verificationLink || '#';
  const siteName = htmlEscape(vars.siteName || '');
  const greeting = L.greeting(userName);

  return `${v3BodyStart()}
      ${v3Tag(W.tag, ctx.primaryColor)}
      ${v3SimpleHeadline(W.headline(siteName), ctx.fontFamily)}
      ${v3Subline(W.subline(greeting))}
    ${v3BodyEnd()}
    ${v3Divider()}
    ${v3SingleButtonSection(W.buttonText, W.button, verificationLink, 'secondary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildV3PollFinalizedBody(vars: Record<string, string | undefined>, ctx: V3BodyContext): string {
  const L = emailStrings(ctx.language);
  const F = L.finalized;
  const pollTitle = htmlEscape(vars.pollTitle || '');
  const pollType = vars.pollType || 'schedule';
  const pollLink = vars.pollLink || '#';
  const buttonLink = vars.buttonLink || pollLink;
  const buttonLabel = vars.buttonLabel || F.goToPoll;

  if (pollType === 'schedule') {
    const confirmedDate = htmlEscape(vars.confirmedDate || '');
    const confirmedTime = htmlEscape(vars.confirmedTime || '');
    const videoConferenceUrl = vars.videoConferenceUrl || '';
    const videoLine = videoConferenceUrl
      ? `<br/><strong>${F.videoConference}</strong> <a href="${htmlEscape(videoConferenceUrl)}" style="color:${ctx.primaryColor};text-decoration:underline;">${htmlEscape(videoConferenceUrl)}</a>`
      : '';
    const scheduleClosingHtml = vars.closingMessageHtml || '';
    const scheduleClosingBlock = scheduleClosingHtml
      ? `${v3Divider()}
    ${buildPollFinalizedClosingBlock(scheduleClosingHtml, ctx.primaryColor, ctx.language)}`
      : '';
    return `${v3BodyStart()}
      ${v3Tag(F.scheduleTag, ctx.primaryColor)}
      ${v3Headline(F.scheduleHeadline, L.quote(pollTitle), '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(`<strong>${F.date}</strong> ${confirmedDate}${confirmedTime ? `<br/><strong>${F.time}</strong> ${confirmedTime}` : ''}${videoLine}<br/><br/>${F.icsNote}`)}
    ${v3BodyEnd()}
    ${scheduleClosingBlock}
    ${v3Divider()}
    ${v3SingleButtonSection(F.scheduleButtonText, buttonLabel, buttonLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
  }

  // Survey / orga: "poll ended" notification
  const resultsPublic = vars.resultsPublic !== 'false';
  const resultNote = resultsPublic ? F.resultsPublicNote : F.resultsPrivateNote;

  const finalOptionText = vars.finalOptionText || '';
  const slotSummaryHtml = vars.slotSummaryHtml || '';

  let extraBlock = '';
  if (finalOptionText) {
    extraBlock = `<tr><td style="padding: 0 40px 16px;">
      <p style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563; margin: 0;">
        <strong>${F.finalResult}</strong> ${finalOptionText}
      </p>
    </td></tr>`;
  } else if (slotSummaryHtml) {
    extraBlock = `<tr><td style="padding: 0 40px 16px;">
      <p style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563; margin: 0 0 4px 0;"><strong>${F.slotOverview}</strong></p>
      <div style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563;">${slotSummaryHtml}</div>
    </td></tr>`;
  }

  const closingMessageHtml = vars.closingMessageHtml || '';
  const closingBlock = buildPollFinalizedClosingBlock(closingMessageHtml, ctx.primaryColor, ctx.language);

  return `${v3BodyStart()}
      ${v3Tag(F.endedTag, ctx.primaryColor)}
      ${v3Headline(F.endedHeadline, L.quote(pollTitle), '', ctx.fontFamily, ctx.primaryColor)}
      ${v3Subline(resultNote)}
    ${v3BodyEnd()}
    ${extraBlock}
    ${closingBlock}
    ${v3Divider()}
    ${v3SingleButtonSection('', buttonLabel, buttonLink, 'primary', ctx.primaryColor, ctx.secondaryColor)}`;
}

function buildPollFinalizedClosingBlock(closingMessageHtml: string, primaryColor: string, language: EmailLanguage): string {
  if (!closingMessageHtml) return '';

  return `<tr><td style="padding: 0 40px 20px;">
        <div style="background-color: #f8f5f0; border-left: 4px solid ${primaryColor}; border-radius: 4px; padding: 14px 16px; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">${emailStrings(language).organizerMessage}</p>
          <div style="margin: 0;">${closingMessageHtml}</div>
        </div>
      </td></tr>`;
}

function buildV3GenericBody(bodyHtml: string, fontFamily: string): string {
  return `${v3BodyStart()}
      <div style="font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #4b5563; line-height: 1.7;">
        ${bodyHtml}
      </div>
    ${v3BodyEnd()}`;
}

function buildV3CustomContentBody(text: string, ctx: V3BodyContext): string {
  const paragraphs = text.split('\n\n').filter(p => p.trim());

  const textParas: string[] = [];
  const urlBlocks: Array<{ before: string; url: string }> = [];

  for (const para of paragraphs) {
    const m = para.match(/(https?:\/\/[^\s]+)/);
    if (m) {
      const url = m[1];
      const before = para.substring(0, m.index).trim().replace(/:$/, '').trim();
      urlBlocks.push({ before, url });
    } else {
      textParas.push(para);
    }
  }

  const sublines = textParas
    .map(p => v3Subline(p.replace(/\n/g, '<br>')))
    .join('');

  const buttonSections = urlBlocks
    .map(({ before, url }) =>
      `${v3Divider()}${v3SingleButtonSection(
        before ? htmlEscape(before) : htmlEscape(url),
        emailStrings(ctx.language).openLink,
        url,
        'primary',
        ctx.primaryColor,
        ctx.secondaryColor,
      )}`
    )
    .join('');

  return `${v3BodyStart()}
      ${sublines}
    ${v3BodyEnd()}${buttonSections}`;
}

const V3_BODY_BUILDERS: Record<EmailTemplateType, (vars: Record<string, string | undefined>, ctx: V3BodyContext) => string> = {
  poll_created: buildV3PollCreatedBody,
  invitation: buildV3InvitationBody,
  reminder: buildV3ReminderBody,
  vote_confirmation: buildV3VoteConfirmationBody,
  vote_updated: buildV3VoteUpdatedBody,
  new_vote_notification: buildV3NewVoteNotificationBody,
  password_reset: buildV3PasswordResetBody,
  email_change: buildV3EmailChangeBody,
  password_changed: buildV3PasswordChangedBody,
  test_report: buildV3TestReportBody,
  welcome: buildV3WelcomeBody,
  poll_finalized: buildV3PollFinalizedBody,
};

export class EmailTemplateService {
  private withCurrentVariables(template: EmailTemplate): EmailTemplate {
    return {
      ...template,
      variables: EMAIL_TEMPLATE_VARIABLES[template.type as EmailTemplateType] as unknown as unknown[],
    };
  }

  private appendVoteEditLink(
    text: string,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): string {
    if (!variables.editLink) return text;

    const hasEditPlaceholder = text.includes('{{editLink}}');
    const hasRenderedEditLink = !!variables.editLink && text.includes(variables.editLink);
    if (hasEditPlaceholder || hasRenderedEditLink) return text;

    const V = emailStrings(lang).vote;
    const label = variables.voteManagementAction === 'withdraw' ? V.withdrawLabel : V.editLabel;
    return text.trimEnd() + `\n\n${label}: {{editLink}}`;
  }

  private extractSelectedOptionsText(selectedOptionsHtml: string | undefined): string[] {
    if (!selectedOptionsHtml) return [];

    return selectedOptionsHtml
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }

  private appendVoteSelectedOptions(
    text: string,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): string {
    const optionLines = this.extractSelectedOptionsText(variables.selectedOptionsHtml);
    if (optionLines.length === 0) return text;

    const alreadyContainsAllOptions = optionLines.every(line => text.includes(line));
    if (alreadyContainsAllOptions) return text;

    const optionsSection = `${emailStrings(lang).vote.selection}:\n${optionLines.map(line => `- ${line}`).join('\n')}`;
    return text.trimEnd() + `\n\n${optionsSection}`;
  }

  private appendReminderSelectedOptions(
    text: string,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): string {
    const optionLines = this.extractSelectedOptionsText(variables.selectedOptionsHtml);
    if (optionLines.length === 0) return text;

    const alreadyContainsAllOptions = optionLines.every(line => text.includes(line));
    if (alreadyContainsAllOptions) return text;

    const optionsSection = `${emailStrings(lang).reminder.currentSelection}:\n${optionLines.map(line => `- ${line}`).join('\n')}`;
    return text.trimEnd() + `\n\n${optionsSection}`;
  }

  private enhanceVoteTemplateText(
    text: string,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): string {
    // Remove the results link and standard explanatory copy in plain-text and
    // customized text templates as well as in the default HTML body.
    if (variables.resultsPublic === 'false') {
      const resultsCopy = EMAIL_LANGUAGES.map(l => emailStrings(l).vote.resultsText);
      text = text.split('\n').filter(line =>
        !line.includes('{{resultsLink}}') &&
        !resultsCopy.some(copy => line.includes(copy))
      ).join('\n');
    }
    let enhanced = this.appendVoteSelectedOptions(text, variables, lang);
    enhanced = this.appendVoteEditLink(enhanced, variables, lang);
    return enhanced;
  }

  // Static method: Get default template by type
  static getDefaultTemplate(type: EmailTemplateType, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): {
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  } {
    const defaultData = getDefaultTemplateDefinition(type, lang);
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
  static getAllDefaultTemplates(lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Array<{
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  }> {
    return EMAIL_TEMPLATE_TYPES.map(type => EmailTemplateService.getDefaultTemplate(type, lang));
  }

  // Static method: Substitute variables (with optional HTML escaping)
  static substituteVariables(
    template: string,
    variables: Record<string, string | undefined>,
    escapeHtml: boolean = true
  ): string {
    return substituteVariables(template, variables, escapeHtml);
  }

  static async getSampleDataForType(type: string, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<Record<string, string>> {
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const data = getLocalizedSampleData(siteName, lang);
    return data[type as EmailTemplateType] || {};
  }

  // Static method: Render template to HTML
  static async renderTemplate(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): Promise<string> {
    const defaultData = getDefaultTemplateDefinition(type, lang);
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
  async getAllTemplates(lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<EmailTemplate[]> {
    const dbTemplates = await storage.getEmailTemplates(lang);
    const result: EmailTemplate[] = [];

    for (const type of EMAIL_TEMPLATE_TYPES) {
      const dbTemplate = dbTemplates.find(t => t.type === type && (t.language ?? DEFAULT_EMAIL_LANGUAGE) === lang);
      if (dbTemplate) {
        result.push(this.withCurrentVariables(dbTemplate));
      } else {
        // Return default template as a pseudo-template
        const defaultData = getDefaultTemplateDefinition(type, lang);
        result.push({
          id: 0,
          type,
          language: lang,
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
  // A missing customization falls back to the built-in template of the SAME
  // language — never to a customization written in another language.
  async getTemplate(type: EmailTemplateType, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<EmailTemplate> {
    const dbTemplate = await storage.getEmailTemplate(type, lang);
    
    if (dbTemplate) {
      return this.withCurrentVariables(dbTemplate);
    }

    // Return default template
    const defaultData = getDefaultTemplateDefinition(type, lang);
    return {
      id: 0,
      type,
      language: lang,
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
    textContentOverride?: string,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): Promise<EmailTemplate> {
    const defaultData = getDefaultTemplateDefinition(type, lang);
    
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
      language: lang,
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
  async resetTemplate(type: EmailTemplateType, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<EmailTemplate> {
    await storage.resetEmailTemplate(type, lang);
    return this.getTemplate(type, lang);
  }

  // Get email footer from system settings
  static readonly DEFAULT_FOOTER = DEFAULT_EMAIL_FOOTERS.de;

  // German keeps the historical setting key so existing footers stay intact.
  static footerSettingKey(lang: EmailLanguage): string {
    return lang === 'de' ? 'email_footer' : `email_footer_${lang}`;
  }

  async getEmailFooter(lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<{ html: string; text: string }> {
    const fallback = DEFAULT_EMAIL_FOOTERS[lang];
    const setting = await storage.getSetting(EmailTemplateService.footerSettingKey(lang));
    if (setting?.value) {
      const footerData = setting.value as { html?: string; text?: string };
      return {
        html: footerData.html || fallback,
        text: footerData.text || fallback
      };
    }
    return {
      html: fallback,
      text: fallback
    };
  }

  // Set email footer in system settings
  async setEmailFooter(footer: { html: string; text: string }, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): Promise<{ html: string; text: string }> {
    await storage.setSetting({
      key: EmailTemplateService.footerSettingKey(lang),
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
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    let html = `<div style="padding: 16px 24px; font-family: ${theme.fontFamily};">`;
    for (const para of paragraphs) {
      const safePara = htmlEscape(para);
      // Linkify only after escaping so arbitrary HTML cannot be injected.
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      const withLinks = safePara.replace(
        urlRegex,
        `<a href="$1" style="color: ${theme.linkColor};">$1</a>`,
      );
      html += `<p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">${withLinks.replace(/\n/g, '<br>')}</p>`;
    }
    html += '</div>';
    
    return html;
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
    subject: string,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): Promise<V3TemplateData> {
    const { getBaseUrl } = await import('../utils/baseUrl');
    const siteUrl = getBaseUrl();
    const logoDataUri = await this.resolveLogoDataUri(customization.branding.logoUrl || undefined);
    const footer = await this.getEmailFooter(lang);
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
      primaryColor: customization.theme?.primaryColor || emailTheme.buttonBackgroundColor || DEFAULT_EMAIL_THEME.buttonBackgroundColor,
      secondaryColor: customization.theme?.secondaryColor || emailTheme.secondaryButtonBackgroundColor || DEFAULT_EMAIL_THEME.secondaryButtonBackgroundColor,
      siteUrl,
      privacyUrl: hasFooterPrivacyPlaceholder ? '' : privacyUrl,
      footerHtml,
      footerText,
      fontFamily: emailTheme.fontFamily || DEFAULT_EMAIL_THEME.fontFamily,
      subject,
      language: lang,
    };
  }

  // Uses the existing branding without adding persisted template types.
  async renderVoteWithdrawalEmail(voterName: string, pollTitle: string, link: string, organizer = false, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE) {
    const W = emailStrings(lang).withdrawal;
    const subject = organizer ? W.subjectOrganizer(pollTitle) : W.subjectVoter(pollTitle);
    const heading = organizer ? W.headingOrganizer : W.headingVoter;
    const message = organizer ? W.messageOrganizer(voterName, pollTitle) : W.messageVoter(voterName, pollTitle);
    const label = organizer ? W.labelOrganizer : W.labelVoter;
    const customization = await storage.getCustomizationSettings();
    const data = await this.buildV3TemplateData(customization, await this.getEmailTheme(), subject, lang);
    const body = `${v3BodyStart()}${v3Tag(W.tag, data.primaryColor)}${v3SimpleHeadline(heading, data.fontFamily)}${v3Subline(htmlEscape(message))}${v3BodyEnd()}${v3Divider()}${v3SingleButtonSection('', `${label} →`, link, 'primary', data.primaryColor, data.secondaryColor)}`;
    return {
      subject,
      html: v3Shell(data, body),
      text: `${heading}\n\n${message}\n\n${label}: ${link}\n\n${data.footerText}`,
    };
  }

  // Render a template with variables — V3 template system
  async renderEmail(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): Promise<{ subject: string; html: string; text: string }> {
    const L = emailStrings(lang);
    const template = await this.getTemplate(type, lang);
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const emailTheme = await this.getEmailTheme();
    const allVariables: Record<string, string | undefined> = { siteName, ...variables };

    const rawSubject = renderTemplate(template.subject, allVariables);
    const subject = stripLeadingSitePrefix(rawSubject, siteName);

    const v3Builder = V3_BODY_BUILDERS[type];
    const shouldUsePollCreatedV3 = type === 'poll_created' && !template.isDefault && !!template.textContent;
    const v3Data = await this.buildV3TemplateData(customization, emailTheme, subject, lang);
    const ctx: V3BodyContext = {
      primaryColor: v3Data.primaryColor,
      secondaryColor: v3Data.secondaryColor,
      fontFamily: v3Data.fontFamily,
      language: lang,
    };
    let mergedVariables = { ...allVariables };
    let bodyHtml: string;
    if (shouldUsePollCreatedV3 && template.textContent) {
      // Parse the custom template text into structured overrides for the V3 sections.
      // The greeting + subline become the intro paragraph (replacing the default tag+headline).
      // All other overrides (adminLabel, adminDescription, adminButtonText, publicLabel, etc.)
      // are passed as pollCreatedOverride_* vars so the V3 sections use the custom content.
      const overrides = parsePollCreatedTextOverrides(template.textContent);
      const introLines = [overrides.greeting, overrides.subline].filter(Boolean).join('\n');
      // Fall back to line-based extraction if the structured parse didn't find a greeting
      const rawIntro = introLines || extractPollCreatedIntroText(template.textContent);
      const customIntroText = substituteVariables(rawIntro || template.textContent, allVariables, false);
      const overrideVars = Object.fromEntries(
        Object.entries(overrides)
          .filter(([, v]) => v !== undefined)
          .map(([key, value]) => [`pollCreatedOverride_${key}`, value as string])
      );
      mergedVariables = { ...allVariables, ...overrideVars, pollCreatedCustomIntro: customIntroText };
      bodyHtml = v3Builder(mergedVariables, ctx);
    } else if (!template.isDefault && template.textContent) {
      // Custom non-poll_created templates: render custom text with V3 structure and theme styles.
      // URLs in the text become styled primary buttons; plain text becomes V3 sublines.
      // The outer v3Shell (logo, branding, footer) is always applied.
      let customTemplateText = template.textContent;
      if (type === 'vote_confirmation' || type === 'vote_updated') {
        customTemplateText = this.enhanceVoteTemplateText(template.textContent, allVariables, lang);
      } else if (type === 'reminder') {
        customTemplateText = this.appendReminderSelectedOptions(template.textContent, allVariables, lang);
      }
      const renderedText = renderSafeCustomMarkup(customTemplateText, allVariables);
      bodyHtml = buildV3CustomContentBody(renderedText, ctx);
      if (type === 'poll_finalized') {
        const closingBlock = buildPollFinalizedClosingBlock(allVariables.closingMessageHtml || '', ctx.primaryColor, lang);
        if (closingBlock) {
          bodyHtml += `${v3Divider()}
    ${closingBlock}`;
        }
      }
    } else {
      bodyHtml = v3Builder(mergedVariables, ctx);
    }
    const html = v3Shell(v3Data, bodyHtml);
    let textBase = template.textContent || '';
    if (type === 'vote_confirmation' || type === 'vote_updated') {
      textBase = this.enhanceVoteTemplateText(textBase, allVariables, lang);
    } else if (type === 'reminder') {
      textBase = this.appendReminderSelectedOptions(textBase, allVariables, lang);
    } else if (type === 'poll_finalized') {
      const closingMsgText = allVariables.closingMessageText;
      if (closingMsgText && closingMsgText.trim()) {
        textBase = textBase.trimEnd() + `\n\n${L.organizerMessage}:\n${closingMsgText.trim()}`;
      }
    }
    if (type === 'poll_created' && allVariables.isRegisteredUser === 'true') {
      textBase = textBase.replace(L.pollCreated.textGuestNotice, L.pollCreated.textRegisteredNotice);
    }
    if (AUTO_FOOTER_DETECT.test(textBase)) {
      textBase = textBase.replace(AUTO_FOOTER_REPLACE, `\n---\n${v3Data.footerText}`);
    } else if (v3Data.footerText) {
      textBase = textBase.trimEnd() + `\n\n---\n${v3Data.footerText}`;
    }
    const text = renderTemplate(textBase, allVariables);
    return { subject, html, text };
  }

  async wrapWithEmailTheme(
    subject: string,
    bodyHtml: string,
    plainText: string,
    lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE
  ): Promise<{ subject: string; html: string; text: string }> {
    const customization = await storage.getCustomizationSettings();
    const emailTheme = await this.getEmailTheme();

    const v3Data = await this.buildV3TemplateData(customization, emailTheme, subject, lang);
    const wrappedBody = buildV3GenericBody(bodyHtml, v3Data.fontFamily);
    const html = v3Shell(v3Data, wrappedBody);

    let text = plainText;
    if (AUTO_FOOTER_DETECT.test(text)) {
      text = text.replace(AUTO_FOOTER_REPLACE, `\n---\n${v3Data.footerText}`);
    } else if (v3Data.footerText) {
      text = text.trimEnd() + `\n\n---\n${v3Data.footerText}`;
    }

    return { subject, html, text };
  }

  // Get available variables for a template type
  getVariables(type: EmailTemplateType): { key: string; description: string }[] {
    return EMAIL_TEMPLATE_VARIABLES[type];
  }

  // Get default template data
  getDefaultTemplate(type: EmailTemplateType, lang: EmailLanguage = DEFAULT_EMAIL_LANGUAGE): {
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
  } {
    const def = getDefaultTemplateDefinition(type, lang);
    return { ...def, jsonContent: def.jsonContent as unknown as Record<string, unknown> };
  }
}

export const emailTemplateService = new EmailTemplateService();
