import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { PollResults, TestRun, TestResult } from '@shared/schema';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

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

interface PDFOptions {
  logoUrl?: string;
  siteName?: string;
  siteNameAccent?: string;
  qrCodeDataUrl?: string;
  pollUrl?: string;
}

function generateHTMLTemplate(results: PollResults, options: PDFOptions = {}): string {
  // Guard against empty stats/options
  const hasStats = results.stats && results.stats.length > 0;
  const hasOptions = results.options && results.options.length > 0;
  
  const bestOption = hasStats 
    ? results.stats.reduce((best, current) => current.score > best.score ? current : best, results.stats[0])
    : null;
  const bestOptionData = bestOption ? results.options.find(opt => opt.id === bestOption.optionId) : null;
  
  // Site branding
  const siteName = options.siteName || 'Poll';
  const siteNameAccent = options.siteNameAccent || 'y';

  // Generate options HTML with safe handling for empty data
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
          ${isBest ? '<span class="best-badge">* Beste Option</span>' : ''}
        </div>
        ${option.startTime && option.endTime ? `
          <div class="option-time">
            <span class="meta-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span> ${formatDateTime(option.startTime)} - ${formatDateTime(option.endTime)}
          </div>
        ` : ''}
        <div class="vote-bars">
          <div class="vote-bar-container">
            <div class="vote-bar yes-bar" style="width: ${yesPercent}%"></div>
            <span class="vote-label yes-label"><span class="check-icon">&#10003;</span> Ja: ${stat.yesCount} (${yesPercent}%)</span>
          </div>
          <div class="vote-bar-container">
            <div class="vote-bar maybe-bar" style="width: ${maybePercent}%"></div>
            <span class="vote-label maybe-label">? Vielleicht: ${stat.maybeCount} (${maybePercent}%)</span>
          </div>
          <div class="vote-bar-container">
            <div class="vote-bar no-bar" style="width: ${noPercent}%"></div>
            <span class="vote-label no-label"><span class="x-icon">&#10007;</span> Nein: ${stat.noCount} (${noPercent}%)</span>
          </div>
        </div>
        <div class="option-score">
          Gesamtwertung: <strong>${stat.score}</strong>
        </div>
      </div>
    `;
  }).join('') : '<div class="empty-state">Keine Optionen vorhanden</div>';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Polly - ${results.poll.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #1a1a2e;
      line-height: 1.6;
      padding: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #4361ee;
    }
    
    .header-top {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .header-logo {
      height: 48px;
      width: auto;
      object-fit: contain;
    }
    
    .header h1 {
      font-size: 28px;
      color: #4361ee;
      margin-bottom: 0;
    }
    
    .header h1 .accent {
      color: #f97316;
    }
    
    .meta-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      vertical-align: middle;
      margin-right: 4px;
    }
    
    .meta-icon svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    .header .subtitle {
      font-size: 22px;
      color: #333;
      font-weight: 600;
    }
    
    .header .description {
      font-size: 14px;
      color: #666;
      margin-top: 12px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .meta-info {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    
    .meta-item {
      background: #f8f9fa;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
    }
    
    .meta-item strong {
      color: #4361ee;
    }
    
    .section-title {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e9ecef;
    }
    
    .options-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .option-card {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      padding: 20px;
      page-break-inside: avoid;
    }
    
    .option-card.best-option {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 2px solid #4caf50;
    }
    
    .option-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .option-number {
      width: 28px;
      height: 28px;
      background: #4361ee;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    
    .option-title {
      font-size: 16px;
      font-weight: 600;
      flex: 1;
    }
    
    .best-badge {
      background: #4caf50;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .option-time {
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
      padding-left: 40px;
    }
    
    .vote-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .vote-bar-container {
      position: relative;
      height: 24px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .vote-bar {
      height: 100%;
      transition: width 0.3s ease;
    }
    
    .yes-bar { background: #4caf50; }
    .maybe-bar { background: #ff9800; }
    .no-bar { background: #f44336; }
    
    .vote-label {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      font-weight: 500;
      color: #333;
      text-shadow: 0 0 2px white;
    }
    
    .option-score {
      text-align: right;
      font-size: 14px;
      color: #666;
    }
    
    .option-score strong {
      color: #4361ee;
      font-size: 16px;
    }
    
    .summary-box {
      margin-top: 30px;
      padding: 24px;
      background: linear-gradient(135deg, #4361ee 0%, #3730a3 100%);
      border-radius: 12px;
      color: white;
      text-align: center;
    }
    
    .summary-box h3 {
      font-size: 16px;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    
    .summary-box .winner {
      font-size: 22px;
      font-weight: bold;
    }
    
    .summary-box .winner-time {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 8px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .option-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Logo" class="header-logo" />` : ''}
      <h1>${siteName}<span class="accent">${siteNameAccent}</span></h1>
    </div>
    <div class="subtitle">${results.poll.title}</div>
    ${results.poll.description ? `<div class="description">${results.poll.description}</div>` : ''}
  </div>
  
  <div class="meta-info">
    <div class="meta-item">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg></span> <strong>${getPollTypeName(results.poll.type)}</strong>
    </div>
    <div class="meta-item">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span> Erstellt: <strong>${formatDate(results.poll.createdAt)}</strong>
    </div>
    <div class="meta-item">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></span> Teilnehmer: <strong>${results.participantCount}</strong>
    </div>
    <div class="meta-item">
      <span class="meta-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span> Rücklaufquote: <strong>${Math.round(results.responseRate)}%</strong>
    </div>
  </div>
  
  ${options.qrCodeDataUrl ? `
  <div class="qr-section" style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 12px;">
    <div style="font-size: 14px; color: #666; margin-bottom: 12px;">QR-Code zum Teilen der Umfrage</div>
    <img src="${options.qrCodeDataUrl}" alt="QR Code" style="width: 150px; height: 150px; display: block; margin: 0 auto;" />
    ${options.pollUrl ? `<div style="font-size: 11px; color: #999; margin-top: 8px; word-break: break-all;">${options.pollUrl}</div>` : ''}
  </div>
  ` : ''}
  
  <h2 class="section-title">Ergebnisse</h2>
  
  <div class="options-grid">
    ${optionsHtml}
  </div>
  
  ${bestOptionData ? `
    <div class="summary-box">
      <h3><svg viewBox="0 0 24 24" style="width:16px;height:16px;display:inline;vertical-align:middle;fill:#fbbf24;stroke:none;margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Beste Option</h3>
      <div class="winner">${bestOptionData.text}</div>
      ${bestOptionData.startTime && bestOptionData.endTime ? `
        <div class="winner-time">
          <span class="meta-icon"><svg viewBox="0 0 24 24" style="stroke:white;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span> ${formatDateTime(bestOptionData.startTime)} - ${formatDateTime(bestOptionData.endTime)}
        </div>
      ` : ''}
    </div>
  ` : ''}
  
  <div class="footer">
    Erstellt mit ${siteName}${siteNameAccent} | Exportiert am ${formatDateTime(new Date())}
  </div>
</body>
</html>
`;
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
