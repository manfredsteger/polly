#!/usr/bin/env node
/**
 * render-mermaid.mjs
 *
 * Rendert alle Mermaid-Diagramme aus docs/email-flows.md zu statischen PNG-Bildern.
 * Die Bilder landen in docs/assets/email-flows/ und werden in der Markdown-Datei
 * eingebettet (der Mermaid-Quellcode bleibt in den <details>-Blöcken als Quelle erhalten).
 *
 * Nutzung (nach Änderungen an den Mermaid-Diagrammen):
 *   node scripts/render-mermaid.mjs
 *
 * Voraussetzungen: puppeteer + chromium (bereits im Projekt für den PDF-Export vorhanden)
 * und das npm-Paket "mermaid". Es wird kein erneuter Chromium-Download ausgelöst.
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs', 'email-flows.md');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'email-flows');
const MERMAID_PATH = path.join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

// Chromium-Pfad analog zur PDF-Export-Logik (server/services/pdfService.ts)
function findChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const possiblePaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of possiblePaths) if (existsSync(p)) return p;
  try {
    const result = execSync('which chromium || which chromium-browser || which google-chrome', { encoding: 'utf8' }).trim();
    if (result) return result;
  } catch { /* ignore */ }
  return undefined;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, '') // führende Nummerierung "1. " entfernen
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Mermaid-Blöcke + zugehörige Überschrift aus der Markdown-Datei extrahieren.
// Optionaler expliziter Dateiname per "%% render-as: mein-dateiname" als erste Zeile
// im Mermaid-Block – überschreibt die automatische Benennung via Überschrift+Zähler.
function extractBlocks(md) {
  const lines = md.split('\n');
  const blocks = [];
  let lastHeading = 'diagram';
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { lastHeading = h[1].trim(); continue; }
    if (line.trim() === '```mermaid') {
      const code = [];
      idx++;
      while (idx < lines.length && lines[idx].trim() !== '```') {
        code.push(lines[idx]);
        idx++;
      }
      const codeStr = code.join('\n');
      const customMatch = codeStr.match(/^%%\s*render-as:\s*(\S+)/m);
      const customFile = customMatch ? customMatch[1] : null;
      blocks.push({ heading: lastHeading, code: codeStr, customFile });
    }
  }
  return blocks;
}

async function main() {
  if (!existsSync(MD_PATH)) throw new Error(`Markdown nicht gefunden: ${MD_PATH}`);
  if (!existsSync(MERMAID_PATH)) throw new Error(`mermaid.min.js nicht gefunden: ${MERMAID_PATH} (npm-Paket "mermaid" installieren)`);

  const md = readFileSync(MD_PATH, 'utf8');
  const blocks = extractBlocks(md);
  if (blocks.length === 0) throw new Error('Keine ```mermaid-Blöcke in der Datei gefunden.');

  mkdirSync(OUT_DIR, { recursive: true });

  const executablePath = findChromiumPath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<style>html,body{margin:0;background:#ffffff;}' +
        '#container{padding:24px;display:inline-block;background:#ffffff;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}</style>' +
        '</head><body><div id="container"></div></body></html>',
      { waitUntil: 'load' }
    );
    await page.addScriptTag({ path: MERMAID_PATH });
    await page.evaluate(() => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        deterministicIds: true, // stabile SVG-IDs -> weniger Diff-Rauschen
      });
    });
    // Vor dem Rendern sicherstellen, dass alle Fonts geladen sind (stabilere Pixel-Ausgabe)
    await page.evaluate(async () => { await document.fonts.ready; });

    const results = [];
    let n = 0;       // Zähler nur für Blöcke ohne expliziten Dateinamen
    let renderId = 0; // immer aufsteigend für eindeutige Render-IDs
    for (const block of blocks) {
      renderId++;
      const rid = String(renderId).padStart(2, '0');

      let fileName;
      if (block.customFile) {
        // Expliziter Dateiname via "%% render-as: ..." – kein Zähler-Präfix
        fileName = block.customFile.endsWith('.png') ? block.customFile : `${block.customFile}.png`;
      } else {
        n++;
        const idx = String(n).padStart(2, '0');
        const slug = slugify(block.heading) || `diagram-${idx}`;
        fileName = `${idx}-${slug}.png`;
      }
      const outPath = path.join(OUT_DIR, fileName);

      const svg = await page.evaluate(async (code, id) => {
        const { svg } = await window.mermaid.render(id, code);
        return svg;
      }, block.code, `mmd-${rid}`);

      await page.evaluate((svgMarkup) => {
        const c = document.getElementById('container');
        c.innerHTML = svgMarkup;
        const el = c.querySelector('svg');
        if (el && el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width) {
          const vb = el.viewBox.baseVal;
          el.removeAttribute('style');
          el.setAttribute('width', String(vb.width));
          el.setAttribute('height', String(vb.height));
        }
      }, svg);

      const container = await page.$('#container');
      const buf = await container.screenshot({ type: 'png' });
      writeFileSync(outPath, buf);

      const rel = path.relative(ROOT, outPath).split(path.sep).join('/');
      results.push({ heading: block.heading, file: rel });
      console.log(`✓ ${rel}  ←  "${block.heading}"`);
    }

    console.log(`\nFertig: ${results.length} Diagramm(e) gerendert nach docs/assets/email-flows/.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Render-Fehler:', err);
  process.exit(1);
});
