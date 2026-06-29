import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { PollResults, Poll, TestRun, TestResult } from '@shared/schema';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { marked } from 'marked';

// Dynamically resolve Chromium path for different environments
function findChromiumPath(): string | undefined {
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Common Chromium paths on different systems
  const possiblePaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  
  // Check if any path exists
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  
  // Try to find chromium using which command
  try {
    const result = execSync('which chromium || which chromium-browser || which google-chrome', { encoding: 'utf8' }).trim();
    if (result) return result;
  } catch {
    // Ignore errors from which command
  }
  
  // Return undefined to let Puppeteer use its bundled browser
  return undefined;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPollTypeName(type: string): string {
  switch (type) {
    case 'schedule': return 'Terminumfrage';
    case 'survey': return 'Umfrage';
    case 'organization': return 'Orga-Liste';
    default: return type;
  }
}

// Configure marked for consistent GFM output
marked.setOptions({ gfm: true, breaks: true } as Parameters<typeof marked.setOptions>[0]);

// ── Allowlist-based HTML sanitizer ─────────────────────────────────────────
// Works at tag level: only whitelisted tags are kept; all attributes are
// stripped except `href` on <a> tags (http/https only). Raw HTML tokens from
// marked and any unknown tags are silently removed.
const SAFE_HTML_TAGS = new Set([
  'p', 'strong', 'b', 'em', 'i', 'del', 's', 'u',
  'code', 'pre', 'kbd', 'samp',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'hr', 'br',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span',
]);
const VOID_TAGS = new Set(['br', 'hr']);
const SAFE_URL_RE = /^https?:\/\//i;

// Tags whose entire element (opening + content + closing) must be removed.
// These can carry executable code or style injection, so content must go too.
const CONTENT_STRIP_TAGS = ['script', 'style', 'template', 'svg', 'math', 'noscript', 'iframe', 'object', 'embed', 'frame'];

function sanitizeAllowlist(html: string): string {
  let out = html;

  // 1. Strip entire dangerous element blocks including their inner content
  for (const tag of CONTENT_STRIP_TAGS) {
    out = out.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'),
      ''
    );
    // Also strip self-closing / lone opening dangerous tags
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // 2. Strip HTML comments
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Allowlist-based tag filter — keep only safe tags, strip all attributes
  //    (except validated href on <a>)
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)\s*>/g,
    (_match, slash, rawTag, attrs, selfClose) => {
      const tag = rawTag.toLowerCase();
      if (!SAFE_HTML_TAGS.has(tag)) return '';   // strip unknown/disallowed tags
      if (slash) return `</${tag}>`;              // safe closing tag

      if (tag === 'a') {
        // Extract href — support double-quoted, single-quoted, or unquoted
        const hrefMatch = attrs.match(
          /\bhref\s*=\s*(?:"([^"]*?)"|'([^']*?)'|([^\s>]*))/i
        );
        const href = hrefMatch
          ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '').trim()
          : '';
        return SAFE_URL_RE.test(href)
          ? `<a href="${href}">`
          : '<a>';  // keep anchor element but drop unsafe href
      }
      return `<${tag}>`;
    }
  );
  return out;
}

function markdownToHtml(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeAllowlist(rawHtml);
}

function getPollStatus(poll: Poll): { label: string; cssClass: string } {
  if (poll.finalOptionId) {
    return { label: '★ Finalisiert', cssClass: 'status-finalized' };
  }
  if (!poll.isActive) {
    return { label: '✕ Abgeschlossen', cssClass: 'status-closed' };
  }
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
    return { label: '⚠ Abgelaufen', cssClass: 'status-expired' };
  }
  return { label: '✓ Aktiv', cssClass: 'status-active' };
}

interface PDFOptions {
  logoUrl?: string;
  siteName?: string;
  siteNameAccent?: string;
  qrCodeDataUrl?: string;
  pollUrl?: string;
  includeParticipantTable?: boolean;
}

export function generateHTMLTemplate(results: PollResults, options: PDFOptions = {}): string {
  const hasStats = results.stats && results.stats.length > 0;

  const bestOption = hasStats
    ? results.stats.reduce((best, current) => current.score > best.score ? current : best, results.stats[0])
    : null;
  const bestOptionData = bestOption ? results.options.find(opt => opt.id === bestOption.optionId) : null;

  const siteName = options.siteName || 'Poll';
  const siteNameAccent = options.siteNameAccent || 'y';
  const poll = results.poll;

  // ── Markdown rendering ──────────────────────────────────────────────────
  const descriptionHtml = poll.description ? markdownToHtml(poll.description) : '';

  // ── Status ──────────────────────────────────────────────────────────────
  const { label: statusLabel, cssClass: statusCssClass } = getPollStatus(poll);

  // ── Letterhead values ───────────────────────────────────────────────────
  const startDateStr = formatDate(poll.createdAt);
  const endDateStr = poll.expiresAt ? formatDate(poll.expiresAt) : '—';
  const resultsVisibilityStr = poll.resultsPublic ? 'Öffentlich' : 'Nur Ersteller';
  const voteEditStr = poll.allowVoteEdit ? 'Bearbeitbar' : 'Fest';
  const anonymousStr = poll.allowAnonymousVoting ? 'Erlaubt' : 'Nur registrierte Nutzer';
  const maybeStr = poll.allowMaybe !== false ? 'Aktiviert' : 'Deaktiviert';
  const orgSlotInfo = poll.type === 'organization'
    ? (poll.maxSlotsPerUser ? `Max. ${poll.maxSlotsPerUser} Slot${poll.maxSlotsPerUser !== 1 ? 's' : ''}/Person` : 'Unbegrenzt')
    : null;

  // ── Voter matrix table HTML ─────────────────────────────────────────────
  let voterMatrixHtml = '';
  if (options.includeParticipantTable && results.votes && results.votes.length > 0) {
    // Deduplicate votes: keep latest per (voterKey, optionId)
    const deduped = new Map<string, typeof results.votes[0]>();
    for (const vote of results.votes) {
      const voterKey = vote.userId ? `user_${vote.userId}` : `email_${vote.voterEmail || vote.voterName}`;
      const key = `${voterKey}__${vote.optionId}`;
      const existing = deduped.get(key);
      if (!existing || (vote.updatedAt && existing.updatedAt && vote.updatedAt > existing.updatedAt) || (!existing.updatedAt && vote.id > existing.id)) {
        deduped.set(key, vote);
      }
    }

    // Build participant map
    const participantMap = new Map<string, { name: string; responses: Map<number, string> }>();
    for (const vote of deduped.values()) {
      const voterKey = vote.userId ? `user_${vote.userId}` : `email_${vote.voterEmail || vote.voterName}`;
      if (!participantMap.has(voterKey)) {
        participantMap.set(voterKey, { name: vote.voterName || vote.voterEmail || '–', responses: new Map() });
      }
      participantMap.get(voterKey)!.responses.set(vote.optionId, vote.response);
    }

    const participants = Array.from(participantMap.values());

    const responseSymbol = (r?: string) => {
      if (r === 'yes') return '<span class="vm-yes">&#10003;</span>';
      if (r === 'maybe') return '<span class="vm-maybe">?</span>';
      if (r === 'no') return '<span class="vm-no">&#10007;</span>';
      return '<span class="vm-empty">–</span>';
    };

    const headerCells = results.options.map(opt => `<th class="vm-th">${opt.text}</th>`).join('');
    const bodyRows = participants.map(p => {
      const cells = results.options.map(opt => `<td class="vm-td">${responseSymbol(p.responses.get(opt.id))}</td>`).join('');
      return `<tr><td class="vm-name">${p.name}</td>${cells}</tr>`;
    }).join('');

    voterMatrixHtml = `
    <div style="margin-top: 28px;">
      <h2 class="section-title">Teilnehmerliste</h2>
      <div class="vm-wrapper">
        <table class="vm-table">
          <thead>
            <tr>
              <th class="vm-th vm-name-th">Teilnehmer</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ── Options HTML ────────────────────────────────────────────────────────
  const optionsHtml = hasStats ? results.stats.map((stat, index) => {
    const option = results.options.find(opt => opt.id === stat.optionId);
    if (!option) return '';

    const isBest = bestOption && stat.optionId === bestOption.optionId;
    const total = stat.yesCount + stat.maybeCount + stat.noCount;
    const yesPercent = total > 0 ? Math.round((stat.yesCount / total) * 100) : 0;
    const maybePercent = total > 0 ? Math.round((stat.maybeCount / total) * 100) : 0;
    const noPercent = total > 0 ? Math.round((stat.noCount / total) * 100) : 0;

    return `
      <div class="option-card ${isBest ? 'best-option' : ''}">
        <div class="option-header">
          <span class="option-number">${index + 1}</span>
          <span class="option-title">${option.text}</span>
          ${isBest ? '<span class="best-badge">&#9733; Beste Option</span>' : ''}
        </div>
        ${option.startTime && option.endTime ? `
          <div class="option-time">
            <span class="meta-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span>
            ${formatDateTime(option.startTime)} – ${formatDateTime(option.endTime)}
          </div>
        ` : ''}
        <div class="vote-bars">
          <div class="vote-bar-container">
            <div class="vote-bar yes-bar" style="width: ${yesPercent}%"></div>
            <span class="vote-label">&#10003; Ja: ${stat.yesCount} (${yesPercent}%)</span>
          </div>
          <div class="vote-bar-container">
            <div class="vote-bar maybe-bar" style="width: ${maybePercent}%"></div>
            <span class="vote-label">? Vielleicht: ${stat.maybeCount} (${maybePercent}%)</span>
          </div>
          <div class="vote-bar-container">
            <div class="vote-bar no-bar" style="width: ${noPercent}%"></div>
            <span class="vote-label">&#10007; Nein: ${stat.noCount} (${noPercent}%)</span>
          </div>
        </div>
        <div class="option-score">Gesamtwertung: <strong>${stat.score}</strong></div>
      </div>
    `;
  }).join('') : '<div class="empty-state">Keine Optionen vorhanden</div>';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}${siteNameAccent} – ${poll.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #1a1a2e;
      line-height: 1.6;
      padding: 30px 40px;
      font-size: 14px;
    }

    /* ── Document header (brand bar + title) ── */
    .doc-header {
      border-bottom: 3px solid #4361ee;
      padding-bottom: 14px;
      margin-bottom: 0;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .brand-left { display: flex; align-items: center; gap: 10px; }
    .brand-logo { height: 30px; width: auto; object-fit: contain; }
    .brand-name { font-size: 18px; font-weight: 700; color: #4361ee; line-height: 1; }
    .brand-name .accent { color: #f97316; }
    .export-timestamp { font-size: 10px; color: #bbb; }
    .poll-title { font-size: 22px; font-weight: 700; color: #1a1a2e; line-height: 1.25; margin-bottom: 3px; }
    .poll-link { font-size: 11px; color: #4361ee; word-break: break-all; }
    .poll-link a { color: #4361ee; text-decoration: none; }

    /* ── Letterhead / info block ── */
    .letterhead {
      background: #f8f9fa;
      border: 1px solid #dde2f0;
      border-top: none;
      padding: 14px 20px 12px;
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .lh-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px 16px;
    }
    .lh-item { display: flex; flex-direction: column; gap: 2px; }
    .lh-label {
      font-size: 9px;
      font-weight: 700;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .lh-value { font-size: 12px; font-weight: 500; color: #1a1a2e; }
    .lh-status-active    { color: #16a34a; font-weight: 700; }
    .lh-status-expired   { color: #ea580c; font-weight: 700; }
    .lh-status-closed    { color: #6b7280; font-weight: 700; }
    .lh-status-finalized { color: #4361ee; font-weight: 700; }
    .lh-divider { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }
    .lh-video { font-size: 11px; color: #4361ee; word-break: break-all; }
    .lh-video-label { color: #aaa; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 4px; }

    /* ── SVG icon helper ── */
    .meta-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 14px; height: 14px; vertical-align: middle; margin-right: 3px;
    }
    .meta-icon svg {
      width: 12px; height: 12px; fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }

    /* ── Description (markdown rendered) ── */
    .description-section {
      margin-bottom: 22px;
      padding: 14px 18px;
      border-left: 3px solid #dde2f0;
      background: #fafbff;
      page-break-inside: avoid;
    }
    .description-section h1 { font-size: 16px; font-weight: 700; color: #1a1a2e; margin: 8px 0 4px; }
    .description-section h2 { font-size: 15px; font-weight: 700; color: #1a1a2e; margin: 7px 0 3px; }
    .description-section h3 { font-size: 14px; font-weight: 700; color: #1a1a2e; margin: 6px 0 3px; }
    .description-section h4,
    .description-section h5,
    .description-section h6 { font-size: 13px; font-weight: 700; color: #444; margin: 5px 0 2px; }
    .description-section p  { font-size: 13px; color: #333; margin-bottom: 6px; line-height: 1.65; }
    .description-section ul,
    .description-section ol { font-size: 13px; color: #333; padding-left: 18px; margin-bottom: 6px; }
    .description-section li { margin-bottom: 2px; line-height: 1.55; }
    .description-section strong { font-weight: 700; color: #1a1a2e; }
    .description-section em { font-style: italic; }
    .description-section blockquote {
      border-left: 3px solid #4361ee; padding: 5px 12px; margin: 6px 0;
      color: #555; font-style: italic; background: #f0f3ff; font-size: 13px;
    }
    .description-section hr { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }
    .description-section a { color: #4361ee; text-decoration: underline; }
    .description-section code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; font-family: monospace; }
    .description-section pre { background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px; font-family: monospace; margin-bottom: 6px; }
    .description-section table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
    .description-section th { background: #f0f3ff; padding: 5px 8px; text-align: left; border: 1px solid #dde2f0; font-weight: 700; }
    .description-section td { padding: 4px 8px; border: 1px solid #e5e7eb; }

    /* ── Meta stats bar ── */
    .meta-stats { display: flex; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }
    .meta-stat {
      background: #f0f3ff; padding: 8px 14px; border-radius: 8px;
      font-size: 13px; display: flex; align-items: center; gap: 5px;
    }
    .meta-stat strong { color: #4361ee; }

    /* ── QR section ── */
    .qr-section {
      text-align: center; margin-bottom: 22px; padding: 14px;
      background: #f8f9fa; border-radius: 10px;
    }

    /* ── Section title ── */
    .section-title {
      font-size: 16px; color: #1a1a2e; font-weight: 700;
      margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e9ecef;
    }

    /* ── Options ── */
    .options-grid { display: flex; flex-direction: column; gap: 14px; }
    .option-card {
      background: #f8f9fa; border: 1px solid #e9ecef;
      border-radius: 10px; padding: 16px; page-break-inside: avoid;
    }
    .option-card.best-option {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 2px solid #4caf50;
    }
    .option-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .option-number {
      width: 26px; height: 26px; background: #4361ee; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; flex-shrink: 0;
    }
    .option-title { font-size: 14px; font-weight: 600; flex: 1; }
    .best-badge {
      background: #4caf50; color: white; padding: 3px 10px;
      border-radius: 20px; font-size: 11px; font-weight: 600;
    }
    .option-time { font-size: 12px; color: #666; margin-bottom: 10px; padding-left: 36px; }
    .vote-bars { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .vote-bar-container {
      position: relative; height: 22px; background: #e9ecef;
      border-radius: 4px; overflow: hidden;
    }
    .vote-bar { height: 100%; }
    .yes-bar { background: #4caf50; }
    .maybe-bar { background: #ff9800; }
    .no-bar { background: #f44336; }
    .vote-label {
      position: absolute; left: 7px; top: 50%; transform: translateY(-50%);
      font-size: 11px; font-weight: 500; color: #333;
      text-shadow: 0 0 2px white, 0 0 3px white;
    }
    .option-score { text-align: right; font-size: 13px; color: #666; }
    .option-score strong { color: #4361ee; font-size: 14px; }
    .empty-state { color: #999; font-style: italic; font-size: 13px; text-align: center; padding: 30px; }

    /* ── Summary box ── */
    .summary-box {
      margin-top: 22px; padding: 20px;
      background: linear-gradient(135deg, #4361ee 0%, #3730a3 100%);
      border-radius: 10px; color: white; text-align: center;
    }
    .summary-box h3 { font-size: 13px; margin-bottom: 6px; opacity: 0.9; }
    .summary-box .winner { font-size: 19px; font-weight: 700; }
    .summary-box .winner-time { font-size: 12px; opacity: 0.9; margin-top: 5px; }

    /* ── Footer ── */
    .footer {
      margin-top: 32px; padding-top: 14px;
      border-top: 1px solid #e9ecef;
      text-align: center; font-size: 10px; color: #bbb;
    }
    .footer a { color: #bbb; text-decoration: none; }

    /* ── Voter matrix table ── */
    .vm-wrapper { overflow-x: auto; }
    .vm-table {
      width: 100%; border-collapse: collapse;
      font-size: 12px; table-layout: auto;
    }
    .vm-table thead tr { background: #f0f3ff; }
    .vm-th {
      padding: 6px 10px; border: 1px solid #dde2f0;
      font-weight: 700; color: #1a1a2e; text-align: center;
      font-size: 11px; white-space: normal; word-break: break-word;
      max-width: 90px;
    }
    .vm-name-th { text-align: left; min-width: 110px; max-width: 160px; }
    .vm-table tbody tr:nth-child(even) { background: #f8f9fa; }
    .vm-td { padding: 5px 8px; border: 1px solid #e5e7eb; text-align: center; }
    .vm-name { padding: 5px 10px; border: 1px solid #e5e7eb; font-weight: 500; color: #1a1a2e; word-break: break-word; }
    .vm-yes   { color: #16a34a; font-weight: 700; font-size: 14px; }
    .vm-maybe { color: #d97706; font-weight: 700; font-size: 14px; }
    .vm-no    { color: #dc2626; font-weight: 700; font-size: 14px; }
    .vm-empty { color: #bbb; font-size: 12px; }

    @media print {
      body { padding: 20px 30px; }
      .option-card, .description-section, .letterhead { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="doc-header">
    <div class="brand-bar">
      <div class="brand-left">
        ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Logo" class="brand-logo" />` : ''}
        <span class="brand-name">${siteName}<span class="accent">${siteNameAccent}</span></span>
      </div>
      <span class="export-timestamp">Exportiert: ${formatDateTime(new Date())}</span>
    </div>
    <div class="poll-title">${poll.title}</div>
    ${options.pollUrl ? `<div class="poll-link"><a href="${options.pollUrl}">${options.pollUrl}</a></div>` : ''}
  </div>

  <div class="letterhead">
    <div class="lh-grid">
      <div class="lh-item">
        <span class="lh-label">Status</span>
        <span class="lh-value lh-${statusCssClass}">${statusLabel}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Umfragetyp</span>
        <span class="lh-value">${getPollTypeName(poll.type)}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Gestartet am</span>
        <span class="lh-value">${startDateStr}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Endet am</span>
        <span class="lh-value">${endDateStr}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Ergebnisse</span>
        <span class="lh-value">${resultsVisibilityStr}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Abstimmung</span>
        <span class="lh-value">${voteEditStr}</span>
      </div>
      <div class="lh-item">
        <span class="lh-label">Anonyme Teilnahme</span>
        <span class="lh-value">${anonymousStr}</span>
      </div>
      ${poll.type === 'schedule' ? `
      <div class="lh-item">
        <span class="lh-label">"Vielleicht"-Option</span>
        <span class="lh-value">${maybeStr}</span>
      </div>` : ''}
      ${orgSlotInfo ? `
      <div class="lh-item">
        <span class="lh-label">Slots pro Person</span>
        <span class="lh-value">${orgSlotInfo}</span>
      </div>` : ''}
    </div>
    ${poll.videoConferenceUrl ? `
    <hr class="lh-divider" />
    <div class="lh-video">
      <span class="lh-video-label">Videokonferenz</span>
      <a href="${poll.videoConferenceUrl}" style="color:#4361ee;">${poll.videoConferenceUrl}</a>
    </div>` : ''}
  </div>

  ${descriptionHtml ? `<div class="description-section">${descriptionHtml}</div>` : ''}

  <div class="meta-stats">
    <div class="meta-stat">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></span>
      Teilnehmer: <strong>${results.participantCount}</strong>
    </div>
    <div class="meta-stat">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span>
      Rücklaufquote: <strong>${Math.round(results.responseRate)}%</strong>
    </div>
  </div>

  ${options.qrCodeDataUrl ? `
  <div class="qr-section">
    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">QR-Code zum Teilen der Umfrage</div>
    <img src="${options.qrCodeDataUrl}" alt="QR Code" style="width: 130px; height: 130px; display: block; margin: 0 auto;" />
    ${options.pollUrl ? `<div style="font-size: 10px; color: #999; margin-top: 6px; word-break: break-all;">${options.pollUrl}</div>` : ''}
  </div>` : ''}

  <h2 class="section-title">Ergebnisse</h2>

  <div class="options-grid">
    ${optionsHtml}
  </div>

  ${bestOptionData ? `
  <div class="summary-box">
    <h3>&#9733; Beste Option</h3>
    <div class="winner">${bestOptionData.text}</div>
    ${bestOptionData.startTime && bestOptionData.endTime ? `
    <div class="winner-time">
      ${formatDateTime(bestOptionData.startTime)} – ${formatDateTime(bestOptionData.endTime)}
    </div>` : ''}
  </div>` : ''}

  ${voterMatrixHtml}

  <div class="footer">
    Erstellt mit <a href="https://github.com/manfredsteger/polly">${siteName}${siteNameAccent}</a>&nbsp;&nbsp;|&nbsp;&nbsp;Exportiert am ${formatDateTime(new Date())}
  </div>
</body>
</html>`;
}

export class PDFService {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      // Dynamically find Chromium path, falls back to bundled browser if not found
      const chromiumPath = findChromiumPath();
      
      const launchOptions: LaunchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      };
      
      // Only set executablePath if we found a system Chromium
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
      }
      
      this.browser = await puppeteer.launch(launchOptions);
    }
    return this.browser;
  }

  private async resetBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }
  }

  async generatePollResultsPDF(results: PollResults, options: PDFOptions = {}): Promise<Buffer> {
    let browser: Browser;
    let page: Page | null = null;
    
    try {
      browser = await this.getBrowser();
    } catch (launchError) {
      // Reset browser on launch failure and retry once
      await this.resetBrowser();
      browser = await this.getBrowser();
    }
    
    try {
      page = await browser.newPage();
      const html = generateHTMLTemplate(results, options);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      await this.resetBrowser();
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generateTestReportPDF(testRun: TestRun, results: TestResult[]): Promise<Buffer> {
    let browser: Browser;
    let page: Page | null = null;
    
    try {
      browser = await this.getBrowser();
    } catch (launchError) {
      await this.resetBrowser();
      browser = await this.getBrowser();
    }
    
    try {
      page = await browser.newPage();
      const html = generateTestReportHTMLTemplate(testRun, results);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      await this.resetBrowser();
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }
}

function generateTestReportHTMLTemplate(testRun: TestRun, results: TestResult[]): string {
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  
  const successRate = results.length > 0 
    ? Math.round((passedCount / results.length) * 100) 
    : 0;
  
  const categories = Array.from(new Set(results.map(r => r.category)));
  
  const statusIcon = testRun.status === 'completed' && failedCount === 0 
    ? '&#10003;' 
    : testRun.status === 'failed' || failedCount > 0 
    ? '&#10007;' 
    : '&#9888;';
  
  const statusClass = testRun.status === 'completed' && failedCount === 0 
    ? 'status-passed' 
    : testRun.status === 'failed' || failedCount > 0 
    ? 'status-failed' 
    : 'status-running';

  const resultsByCategory = categories.map(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.status === 'passed').length;
    const categoryFailed = categoryResults.filter(r => r.status === 'failed').length;
    
    return `
      <div class="category-section">
        <h3 class="category-title">${getCategoryName(category)} (${categoryPassed}/${categoryResults.length})</h3>
        <div class="tests-list">
          ${categoryResults.map(result => `
            <div class="test-item ${result.status}">
              <span class="test-status-icon">${result.status === 'passed' ? '&#10003;' : result.status === 'failed' ? '&#10007;' : '&#8722;'}</span>
              <span class="test-name">${result.testName}</span>
              <span class="test-duration">${result.duration ? `${result.duration}ms` : '-'}</span>
            </div>
            ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Test-Report #${testRun.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 40px; 
      color: #1a1a1a; 
      background: white;
      line-height: 1.5;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      padding-bottom: 20px; 
      border-bottom: 3px solid #f97316;
    }
    .title { font-size: 28px; font-weight: bold; color: #1a1a1a; margin-bottom: 5px; }
    .subtitle { font-size: 14px; color: #666; }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: bold;
      margin: 15px 0;
    }
    .status-passed { background: #dcfce7; color: #166534; }
    .status-failed { background: #fee2e2; color: #991b1b; }
    .status-running { background: #fef3c7; color: #92400e; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin: 25px 0;
    }
    .summary-card {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-value { font-size: 32px; font-weight: bold; }
    .summary-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .passed .summary-value { color: #166534; }
    .failed .summary-value { color: #991b1b; }
    .skipped .summary-value { color: #92400e; }
    .category-section { margin: 25px 0; }
    .category-title { 
      font-size: 16px; 
      font-weight: bold; 
      padding: 10px 15px; 
      background: #f3f4f6; 
      border-left: 4px solid #f97316;
      margin-bottom: 10px;
    }
    .tests-list { padding: 0 15px; }
    .test-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .test-item.passed .test-status-icon { color: #166534; }
    .test-item.failed .test-status-icon { color: #991b1b; }
    .test-item.skipped .test-status-icon { color: #92400e; }
    .test-status-icon { width: 24px; font-size: 14px; font-weight: bold; }
    .test-name { flex: 1; font-size: 13px; }
    .test-duration { font-size: 12px; color: #6b7280; }
    .test-error { 
      margin-left: 24px; 
      padding: 8px 12px; 
      background: #fee2e2; 
      color: #991b1b; 
      font-size: 12px; 
      border-radius: 4px;
      margin-bottom: 8px;
      font-family: monospace;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      text-align: center; 
      font-size: 11px; 
      color: #9ca3af; 
    }
    @media print {
      body { padding: 0; }
      .test-item { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Polly - Test-Report</div>
    <div class="subtitle">Automatisierte Backend-Tests</div>
    <div class="status-badge ${statusClass}">
      ${statusIcon} ${testRun.status === 'completed' && failedCount === 0 ? 'Alle Tests bestanden' : testRun.status === 'failed' || failedCount > 0 ? 'Fehlgeschlagene Tests' : 'In Bearbeitung'}
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-value">${results.length}</div>
      <div class="summary-label">Gesamt</div>
    </div>
    <div class="summary-card passed">
      <div class="summary-value">${passedCount}</div>
      <div class="summary-label">Bestanden</div>
    </div>
    <div class="summary-card failed">
      <div class="summary-value">${failedCount}</div>
      <div class="summary-label">Fehlgeschlagen</div>
    </div>
    <div class="summary-card skipped">
      <div class="summary-value">${skippedCount}</div>
      <div class="summary-label">Übersprungen</div>
    </div>
  </div>

  <div class="meta-info" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; font-size: 13px; color: #4b5563;">
    <div><strong>Test-Lauf ID:</strong> #${testRun.id}</div>
    <div><strong>Auslöser:</strong> ${testRun.triggeredBy === 'manual' ? 'Manuell' : 'Geplant'}</div>
    <div><strong>Gestartet:</strong> ${formatDateTime(testRun.startedAt)}</div>
    <div><strong>Dauer:</strong> ${testRun.duration ? `${(testRun.duration / 1000).toFixed(2)}s` : '-'}</div>
    <div><strong>Erfolgsrate:</strong> ${successRate}%</div>
    <div><strong>Kategorien:</strong> ${categories.length}</div>
  </div>

  <h2 style="font-size: 18px; margin: 30px 0 15px; color: #1a1a1a;">Test-Ergebnisse nach Kategorie</h2>
  
  ${resultsByCategory}
  
  <div class="footer">
    Generiert am ${formatDateTime(new Date())} | Polly Automated Testing
  </div>
</body>
</html>
`;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    auth: 'Authentifizierung',
    api: 'API',
    polls: 'Umfragen',
    security: 'Sicherheit',
    database: 'Datenbank',
    fixtures: 'Test-Fixtures',
    other: 'Sonstige',
  };
  return names[category] || category;
}

export const pdfService = new PDFService();

export async function generateTestReportPDF(testRun: TestRun, results: TestResult[]): Promise<Buffer> {
  return pdfService.generateTestReportPDF(testRun, results);
}
