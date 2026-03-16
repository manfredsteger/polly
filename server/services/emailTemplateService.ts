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

function lightenColor(hex: string, percent: number): string {
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

function container(
  id: string,
  bgColor: string,
  darkBg: string,
  childDefs: [string, EmailBuilderBlock][]
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
        style: {
          backgroundColor: bgColor,
          darkBackgroundColor: darkBg,
          borderRadius: 8,
          padding: { top: 20, right: 24, bottom: 20, left: 24 },
          margin: { top: 12, right: 24, bottom: 12, left: 24 },
        },
      },
    }],
    children,
  };
}

function divider(id: string): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Divider',
    data: { style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } } },
  }];
}

function footerBlock(id: string, text: string): [string, EmailBuilderBlock] {
  return [id, {
    type: 'Text',
    data: {
      props: { text },
      style: { color: '#6c757d', fontSize: 14, padding: { top: 8, bottom: 16, left: 24, right: 24 } },
    },
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
  footerText: string = 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
): TemplateDefinition {
  const defs: [string, EmailBuilderBlock][] = [];
  defs.push(heading('h1', headingText));
  paragraphs.forEach((p, i) => defs.push(txt(`t${i}`, p)));
  if (buttonText && buttonVar) defs.push(btn('b1', buttonText, buttonVar, buttonType));
  defs.push(divider('d1'));
  defs.push(footerBlock('f1', footerText));
  
  let textContent = `${headingText}\n\n${paragraphs.join('\n\n')}`;
  if (buttonText && buttonVar) textContent += `\n\n${buttonText}: {{${buttonVar}}}`;
  textContent += `\n\n---\n${footerText}`;
  
  return buildTemplate(name, subject, defs, [], textContent);
}

// ---- poll_created: the showcase template with containers ----
function buildPollCreatedTemplate(): TemplateDefinition {
  const adminBox = container('admin-box', '#f8f9fa', '#2a2a3e', [
    heading('ab-h', 'Administratorlink (nur für Sie)', 'h3'),
    txt('ab-t', 'Mit diesem Link können Sie Ihre Umfrage verwalten, bearbeiten und die Ergebnisse einsehen.'),
    btn('ab-btn', 'Umfrage verwalten', 'adminLink', 'primary'),
  ]);

  const publicBox = container('public-box', '#e8f4f8', '#1e3a4a', [
    heading('pb-h', 'Öffentlicher Link zum Teilen', 'h3'),
    txt('pb-t', 'Teilen Sie diesen Link mit Ihren Teilnehmern, damit diese an der Abstimmung teilnehmen können.'),
    btn('pb-btn', 'Zur Abstimmung', 'publicLink', 'secondary'),
  ]);

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', '{{pollType}} erfolgreich erstellt!'),
    txt('t1', 'Hallo,'),
    txt('t2', 'Ihre {{pollType}} <strong>"{{pollTitle}}"</strong> wurde erfolgreich erstellt.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    txt('warn', '<strong>⚠️ Wichtig:</strong> Bewahren Sie den Administratorlink sicher auf. Nur mit diesem Link können Sie Ihre Umfrage verwalten.', { bold: true }),
    divider('d1'),
    footerBlock('f1', 'Diese E-Mail wurde automatisch von {{siteName}} erstellt. — Open-Source Abstimmungsplattform für Teams'),
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

  const textContent = `{{pollType}} erfolgreich erstellt!\n\nHallo,\n\nIhre {{pollType}} "{{pollTitle}}" wurde erfolgreich erstellt.\n\nAdministratorlink (nur für Sie):\nUmfrage verwalten: {{adminLink}}\n\nÖffentlicher Link zum Teilen:\nZur Abstimmung: {{publicLink}}\n\nWichtig: Bewahren Sie den Administratorlink sicher auf.\n\n---\nDiese E-Mail wurde automatisch von {{siteName}} erstellt.`;

  return { name: 'Umfrage erstellt', subject: '[{{siteName}}] Ihre {{pollType}} wurde erstellt: {{pollTitle}}', jsonContent: tpl(allBlocks, topIds), textContent };
}

// ---- vote_confirmation with container ----
function buildVoteConfirmationTemplate(): TemplateDefinition {
  const linkBox = container('link-box', '#e8f4f8', '#1e3a4a', [
    txt('lb-t', 'Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren oder die aktuellen Ergebnisse einsehen.'),
    btn('lb-btn1', 'Ergebnisse anzeigen', 'resultsLink', 'secondary'),
  ]);

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Vielen Dank für Ihre Teilnahme!'),
    txt('t1', 'Hallo {{voterName}},'),
    txt('t2', 'vielen Dank für Ihre Teilnahme an der {{pollType}} <strong>"{{pollTitle}}"</strong>. Ihre Auswahl wurde erfolgreich gespeichert.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    divider('d1'),
    footerBlock('f1', 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'),
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
    textContent: 'Vielen Dank für Ihre Teilnahme!\n\nHallo {{voterName}},\n\nvielen Dank für Ihre Teilnahme an der {{pollType}} "{{pollTitle}}". Ihre Auswahl wurde erfolgreich gespeichert.\n\nErgebnisse anzeigen: {{resultsLink}}\n\n---\nDiese E-Mail wurde automatisch von {{siteName}} erstellt.',
  };
}

// ---- password_reset with container ----
function buildPasswordResetTemplate(): TemplateDefinition {
  const actionBox = container('action-box', '#f8f9fa', '#2a2a3e', [
    txt('ab-t', 'Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben. Dieser Link ist 1 Stunde gültig.'),
    btn('ab-btn', 'Passwort zurücksetzen', 'resetLink', 'primary'),
  ]);

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Passwort zurücksetzen'),
    txt('t1', 'Hallo {{userName}},'),
    txt('t2', 'Sie haben angefordert, Ihr Passwort für Ihren {{siteName}} Account zurückzusetzen.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    txt('t3', 'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.', { color: '#6c757d', fontSize: 14 }),
    divider('d1'),
    footerBlock('f1', 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'),
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
    textContent: 'Passwort zurücksetzen\n\nHallo {{userName}},\n\nSie haben angefordert, Ihr Passwort zurückzusetzen.\n\nPasswort zurücksetzen: {{resetLink}}\n\nDieser Link ist 1 Stunde gültig.\n\n---\nDiese E-Mail wurde automatisch von {{siteName}} erstellt.',
  };
}

// ---- welcome with container ----
function buildWelcomeTemplate(): TemplateDefinition {
  const actionBox = container('action-box', '#e8f4f8', '#1e3a4a', [
    txt('ab-t', 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um alle Funktionen von {{siteName}} nutzen zu können.'),
    btn('ab-btn', 'E-Mail bestätigen', 'verificationLink', 'secondary'),
  ]);

  const topDefs: [string, EmailBuilderBlock][] = [
    heading('h1', 'Willkommen bei {{siteName}}!'),
    txt('t1', 'Hallo {{userName}},'),
    txt('t2', 'vielen Dank für Ihre Registrierung bei {{siteName}}! Ihr Account wurde erfolgreich erstellt.'),
  ];

  const bottomDefs: [string, EmailBuilderBlock][] = [
    divider('d1'),
    footerBlock('f1', 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'),
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
    textContent: 'Willkommen bei {{siteName}}!\n\nHallo {{userName}},\n\nvielen Dank für Ihre Registrierung! Ihr Account wurde erfolgreich erstellt.\n\nE-Mail bestätigen: {{verificationLink}}\n\n---\nDiese E-Mail wurde automatisch von {{siteName}} erstellt.',
  };
}

const DEFAULT_TEMPLATES: Record<EmailTemplateType, TemplateDefinition> = {
  poll_created: buildPollCreatedTemplate(),

  invitation: buildSimpleTemplate(
    'Einladung zur Umfrage',
    '[{{siteName}}] {{inviterName}} lädt Sie ein: {{pollTitle}}',
    'Einladung zur Abstimmung',
    [
      'Hallo,',
      '{{inviterName}} lädt Sie ein, an der Umfrage <strong>"{{pollTitle}}"</strong> teilzunehmen.',
      '{{message}}',
    ],
    'Jetzt abstimmen',
    'publicLink',
    'primary',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),

  vote_confirmation: buildVoteConfirmationTemplate(),

  reminder: buildSimpleTemplate(
    'Erinnerung',
    '[{{siteName}}] Erinnerung: {{pollTitle}}',
    'Erinnerung zur Abstimmung',
    [
      'Hallo,',
      '{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage <strong>"{{pollTitle}}"</strong>.',
      'Ihre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.',
      '{{expiresAt}}',
    ],
    'Jetzt abstimmen',
    'pollLink',
    'primary',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),

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
    'primary',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
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
    undefined,
    undefined,
    'primary',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
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
    undefined,
    undefined,
    'primary',
    'Diese E-Mail wurde automatisch vom {{siteName}} Testsystem erstellt.'
  ),

  welcome: buildWelcomeTemplate(),
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

// Resolve effective theme values for rendering
// Priority: explicit theme > root.data values > defaults
function resolveTheme(theme?: EmailTheme, rootData?: Record<string, unknown>) {
  const rd = (rootData || {}) as Record<string, string>;
  const t = theme || DEFAULT_EMAIL_THEME;
  return {
    textColor: t.textColor || rd.textColor || DEFAULT_EMAIL_THEME.textColor,
    headingColor: t.headingColor || DEFAULT_EMAIL_THEME.headingColor,
    buttonBg: t.buttonBackgroundColor || DEFAULT_EMAIL_THEME.buttonBackgroundColor,
    buttonText: t.buttonTextColor || DEFAULT_EMAIL_THEME.buttonTextColor,
    buttonRadius: t.buttonBorderRadius ?? DEFAULT_EMAIL_THEME.buttonBorderRadius,
    secondaryBg: t.secondaryButtonBackgroundColor || DEFAULT_EMAIL_THEME.secondaryButtonBackgroundColor,
    secondaryText: t.secondaryButtonTextColor || DEFAULT_EMAIL_THEME.secondaryButtonTextColor,
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
        html += `<${level} class="email-heading" style="color: ${color}; ${renderPadding(style.padding as Record<string, number>)} margin: 0; font-weight: ${fontWeight};">${text}</${level}>\n`;
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
        const paddingStyle = renderPadding(style.padding as Record<string, number>) || 'padding: 12px 24px;';
        const marginStyle = renderMargin(style.margin as Record<string, number>);
        const cssClass = buttonType === 'secondary' ? 'email-btn-secondary' : 'email-btn-primary';
        html += `<div style="text-align: center; ${marginStyle}">
          <a href="${url}" class="${cssClass}" style="display: inline-block; text-decoration: none; background-color: ${bgColor}; color: ${color}; ${paddingStyle} border-radius: ${borderRadius}px; font-weight: bold;">${text}</a>
        </div>\n`;
        break;
      }
      case 'Container': {
        const bgColor = (style.backgroundColor as string) || '#f8f9fa';
        const borderRadius = (style.borderRadius as number) ?? 8;
        const borderColor = (style.borderColor as string) || 'transparent';
        const borderWidth = (style.borderWidth as number) ?? 0;
        const padding = style.padding as Record<string, number> || { top: 20, right: 24, bottom: 20, left: 24 };
        const margin = style.margin as Record<string, number> || { top: 12, right: 0, bottom: 12, left: 0 };
        const childIds = (blockData.childrenIds || []) as string[];
        const childHtml = renderBlocksToHtml(childIds, doc, tv);
        html += `<div class="email-container" style="background-color: ${bgColor}; border-radius: ${borderRadius}px; ${renderPadding(padding)} ${renderMargin(margin)}${borderWidth > 0 ? ` border: ${borderWidth}px solid ${borderColor};` : ''}">
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
        html += `<div style="text-align: center;"><img src="${src}" alt="${alt}" style="max-width: ${width}; height: auto;"></div>\n`;
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
const SAMPLE_DATA: Record<EmailTemplateType, Record<string, string>> = {
  poll_created: {
    pollType: 'Terminumfrage',
    pollTitle: 'Teammeeting Q1 2025',
    publicLink: 'https://polly.example.com/poll/abc123',
    adminLink: 'https://polly.example.com/admin/abc123',
    siteName: 'Polly',
  },
  invitation: {
    inviterName: 'Max Mustermann',
    pollTitle: 'Teammeeting Q1 2025',
    message: 'Bitte wähle die Termine aus, an denen du Zeit hast.',
    publicLink: 'https://polly.example.com/poll/abc123',
    siteName: 'Polly',
  },
  vote_confirmation: {
    voterName: 'Anna Schmidt',
    pollType: 'Terminumfrage',
    pollTitle: 'Teammeeting Q1 2025',
    publicLink: 'https://polly.example.com/poll/abc123',
    resultsLink: 'https://polly.example.com/poll/abc123/results',
    siteName: 'Polly',
  },
  reminder: {
    senderName: 'Max Mustermann',
    pollTitle: 'Teammeeting Q1 2025',
    expiresAt: 'Die Umfrage endet am 31.12.2025 um 23:59 Uhr.',
    pollLink: 'https://polly.example.com/poll/abc123',
    siteName: 'Polly',
  },
  password_reset: {
    userName: 'Max Mustermann',
    resetLink: 'https://polly.example.com/auth/reset-password?token=xyz789',
    siteName: 'Polly',
  },
  email_change: {
    oldEmail: 'alte-email@example.com',
    newEmail: 'neue-email@example.com',
    confirmLink: 'https://polly.example.com/auth/confirm-email?token=xyz789',
    siteName: 'Polly',
  },
  password_changed: {
    userName: 'Max Mustermann',
    siteName: 'Polly',
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
    siteName: 'Polly',
  },
  welcome: {
    userName: 'Max Mustermann',
    userEmail: 'max.mustermann@example.com',
    verificationLink: 'https://polly.example.com/email-bestaetigen/abc123xyz789',
    siteName: 'Polly',
  },
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

  // Static method: Get sample data for preview/testing
  static getSampleDataForType(type: string): Record<string, string> {
    return SAMPLE_DATA[type as EmailTemplateType] || {};
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
  async getEmailFooter(): Promise<{ html: string; text: string }> {
    const setting = await storage.getSetting('email_footer');
    if (setting?.value) {
      const footerData = setting.value as { html?: string; text?: string };
      return {
        html: footerData.html || 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.',
        text: footerData.text || 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
      };
    }
    return {
      html: 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.',
      text: 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
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
    
    const lighterPrimary = lightenColor(primaryColor, 30);
    
    const brandedTheme: EmailTheme = {
      backdropColor: '#F5F5F5',
      canvasColor: '#FFFFFF',
      textColor: '#333333',
      headingColor: primaryColor,
      linkColor: primaryColor,
      buttonBackgroundColor: primaryColor,
      buttonTextColor: '#FFFFFF',
      buttonBorderRadius: 6,
      fontFamily: 'Arial, sans-serif',
      secondaryButtonBackgroundColor: secondaryColor,
      secondaryButtonTextColor: '#FFFFFF',
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

  // Generate email header HTML with branding
  private generateHeaderHtml(branding: {
    siteName: string;
    siteNameAccent: string;
    logoUrl?: string;
    primaryColor?: string;
  }): string {
    const fullName = `${branding.siteName}${branding.siteNameAccent}`;
    const primaryColor = branding.primaryColor || '#FF6B35';
    
    let logoHtml = '';
    if (branding.logoUrl) {
      logoHtml = `<img src="${branding.logoUrl}" alt="${htmlEscape(fullName)}" style="max-height: 50px; max-width: 200px; width: auto; height: auto; vertical-align: middle;" />`;
    }
    
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${primaryColor}; padding: 12px 24px;">
        <tr>
          <td style="text-align: left; vertical-align: middle;">
            ${logoHtml ? `<span style="display: inline-block; margin-right: 12px; vertical-align: middle;">${logoHtml}</span>` : ''}
            <h1 style="color: #FFFFFF; font-size: 22px; font-weight: bold; margin: 0; font-family: Arial, sans-serif; display: inline-block; vertical-align: middle;">
              ${htmlEscape(branding.siteName)}<span style="font-weight: normal;">${htmlEscape(branding.siteNameAccent)}</span>
            </h1>
          </td>
        </tr>
      </table>
    `;
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
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e0e0e0; margin-top: 24px;">
        <tr>
          <td style="padding: 16px 24px; text-align: center;">
            <p class="email-footer-text" style="color: #6c757d; font-size: 12px; margin: 0; font-family: ${theme.fontFamily};">
              ${footerText}
            </p>
          </td>
        </tr>
      </table>
    `;
  }

  // Render a template with variables
  async renderEmail(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>
  ): Promise<{ subject: string; html: string; text: string }> {
    const template = await this.getTemplate(type);
    
    // Get branding settings
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const primaryColor = customization.theme?.primaryColor || '#FF6B35';
    
    // Get email theme settings
    const emailTheme = await this.getEmailTheme();
    
    // Get centralized footer
    const footer = await this.getEmailFooter();
    
    // Add siteName to variables if not provided
    const allVariables = { siteName, ...variables };
    
    // Render subject (plain text — no escaping needed)
    const subject = renderTemplate(template.subject, allVariables);
    
    let bodyHtml: string;
    if (!template.isDefault && template.textContent) {
      const renderedText = substituteVariables(template.textContent, allVariables, false);
      bodyHtml = this.textToSimpleHtmlWithTheme(renderedText, emailTheme);
    } else if (template.jsonContent && Object.keys(template.jsonContent).length > 0) {
      // For JSON templates: HTML-escape values first (for XSS safety),
      // then JSON-escape to survive JSON.parse()
      const jsonSafeVars: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(allVariables)) {
        if (value !== undefined) {
          const htmlSafe = htmlEscape(value);
          jsonSafeVars[key] = JSON.stringify(htmlSafe).slice(1, -1);
        }
      }
      const renderedJson = JSON.parse(
        renderTemplate(JSON.stringify(template.jsonContent), jsonSafeVars)
      ) as EmailBuilderDocument;
      bodyHtml = jsonToHtml(renderedJson, emailTheme);
    } else if (template.htmlContent) {
      bodyHtml = substituteVariables(template.htmlContent, allVariables, true);
    } else {
      bodyHtml = '<p>Template-Fehler: Kein Inhalt verfügbar</p>';
    }
    
    // Generate header with branding
    const headerHtml = this.generateHeaderHtml({
      siteName: customization.branding.siteName,
      siteNameAccent: customization.branding.siteNameAccent,
      logoUrl: customization.branding.logoUrl || undefined,
      primaryColor
    });
    
    // Render footer with variables
    const footerHtmlRendered = renderTemplate(footer.html, allVariables);
    const footerHtml = this.generateFooterHtmlWithTheme(footerHtmlRendered, emailTheme);
    
    const darkBackdrop = emailTheme.darkBackdropColor || DEFAULT_EMAIL_THEME.darkBackdropColor;
    const darkCanvas = emailTheme.darkCanvasColor || DEFAULT_EMAIL_THEME.darkCanvasColor;
    const darkText = emailTheme.darkTextColor || DEFAULT_EMAIL_THEME.darkTextColor;
    const darkHeading = emailTheme.darkHeadingColor || DEFAULT_EMAIL_THEME.darkHeadingColor;

    const darkModeStyles = `
      @media (prefers-color-scheme: dark) {
        body, .email-backdrop { background-color: ${darkBackdrop} !important; }
        .email-canvas { background-color: ${darkCanvas} !important; }
        .email-heading { color: ${darkHeading} !important; }
        .email-text { color: ${darkText} !important; }
        .email-container { filter: brightness(0.85) !important; }
        .email-footer-text { color: #999999 !important; }
        .email-divider { border-top-color: #3a3a5c !important; }
      }
    `;

    const html = `
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
                  <td style="padding: 0;">
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
    
    // Render text with footer
    const footerTextRendered = renderTemplate(footer.text, allVariables);
    const text = `${renderTemplate(template.textContent || '', allVariables)}\n\n---\n${footerTextRendered}`;
    
    return { subject, html, text };
  }

  async wrapWithEmailTheme(
    subject: string,
    bodyHtml: string,
    plainText: string
  ): Promise<{ subject: string; html: string; text: string }> {
    const customization = await storage.getCustomizationSettings();
    const emailTheme = await this.getEmailTheme();
    const footer = await this.getEmailFooter();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    const allVariables = { siteName };

    const headerHtml = this.generateHeaderHtml({
      siteName: customization.branding.siteName,
      siteNameAccent: customization.branding.siteNameAccent,
      logoUrl: customization.branding.logoUrl || undefined,
      primaryColor: customization.theme?.primaryColor,
    });
    const footerHtmlRendered = renderTemplate(footer.html, allVariables);
    const footerHtml = this.generateFooterHtmlWithTheme(footerHtmlRendered, emailTheme);

    const darkBackdrop = emailTheme.darkBackdropColor || DEFAULT_EMAIL_THEME.darkBackdropColor;
    const darkCanvas = emailTheme.darkCanvasColor || DEFAULT_EMAIL_THEME.darkCanvasColor;
    const darkText = emailTheme.darkTextColor || DEFAULT_EMAIL_THEME.darkTextColor;
    const darkHeading = emailTheme.darkHeadingColor || DEFAULT_EMAIL_THEME.darkHeadingColor;

    const darkModeStyles = `
      @media (prefers-color-scheme: dark) {
        body, .email-backdrop { background-color: ${darkBackdrop} !important; }
        .email-canvas { background-color: ${darkCanvas} !important; }
        .email-heading { color: ${darkHeading} !important; }
        .email-text { color: ${darkText} !important; }
        .email-container { filter: brightness(0.85) !important; }
        .email-footer-text { color: #999999 !important; }
        .email-divider { border-top-color: #3a3a5c !important; }
      }
    `;

    const html = `
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
                  <td style="padding: 0;">
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

    const footerTextRendered = renderTemplate(footer.text, allVariables);
    const text = `${plainText}\n\n---\n${footerTextRendered}`;

    return { subject, html, text };
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
