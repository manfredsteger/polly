import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT_SRC = path.resolve(__dirname, '../../../client/src');
const LOCALES_DIR = path.join(CLIENT_SRC, 'locales');

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key] as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'ui') continue;
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      if (entry.name === 'i18n.ts' || entry.name === 'vite-env.d.ts') continue;
      results.push(fullPath);
    }
  }
  return results;
}

const HARDCODED_GERMAN_PATTERNS = [
  />\s*Passwort\b/,
  />\s*Benutzername\b/,
  />\s*Anmelden\b/,
  />\s*Abmelden\b/,
  />\s*Erstellen\b/,
  />\s*Löschen\b/,
  />\s*Bearbeiten\b/,
  />\s*Speichern\b/,
  />\s*Einstellungen\b/,
  />\s*Übersicht\b/,
  />\s*Teilnehmer\b/,
  />\s*Stimmen\b/,
  />\s*Ergebnisse\b/,
  />\s*Eintragungen\b/,
  />\s*Abstimmung\b/,
  />\s*Umfrage\b/,
  />\s*Terminplanung\b/,
  />\s*Organisation\b/,
  />\s*Fehlgeschlagen\b/,
  />\s*Punkte\b/,
  />\s*Detaillierte\s/,
  />\s*Gesamte?\b/,
  />\s*Beliebteste\b/,
  />\s*Bewertung\b/,
  />\s*Aktuelles Passwort\b/,
  />\s*Neues Passwort\b/,
  />\s*Wird geändert\b/,
  />\s*Passwort ändern\b/,
  />\s*Noch keine\b/,
  />\s*voll\b/,
  />\s*Slots und\b/,
  />\s*Fehler\b/,
];

const HARDCODED_GERMAN_JSX_PATTERNS = [
  /["']\s*Ja\s*["']/,
  /["']\s*Nein\s*["']/,
  /["']\s*Vielleicht\s*["']/,
  />\s*Ja\s*</,
  />\s*Nein\s*</,
  />\s*Vielleicht\s*</,
  /["']Interner Fehler["']/,
  /["']Fehler beim["']/,
  /["']Passwörter stimmen["']/,
  /["']Passwort muss["']/,
];

const ALLOWED_HARDCODED = [
  /PROMPTS_DE/,
  /PROMPTS_EN/,
  /console\./,
  /\/\//,
  /\/\*/,
  /\*\//,
  /import /,
  /data-testid/,
  /className/,
  /aria-label=\{t\(/,
  /placeholder=\{t\(/,
  /title=\{t\(/,
];

function isAllowedLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return true;
  if (trimmed.startsWith('import ')) return true;
  if (trimmed.includes('console.')) return true;
  if (trimmed.includes('PROMPTS_DE') || trimmed.includes('PROMPTS_EN')) return true;
  return false;
}

describe('i18n Hardcoded Strings Prevention', () => {

  describe('Translation file parity (de.json ↔ en.json)', () => {
    const deJson = readJson(path.join(LOCALES_DIR, 'de.json'));
    const enJson = readJson(path.join(LOCALES_DIR, 'en.json'));
    const deKeys = new Set(flattenKeys(deJson));
    const enKeys = new Set(flattenKeys(enJson));

    it('should have valid JSON in both locale files', () => {
      expect(deJson).toBeTruthy();
      expect(enJson).toBeTruthy();
    });

    it('should have all English keys present in German translations', () => {
      const missingInDe = [...enKeys].filter(k => !deKeys.has(k));
      if (missingInDe.length > 0) {
        throw new Error(
          `${missingInDe.length} key(s) missing in de.json:\n  - ${missingInDe.slice(0, 20).join('\n  - ')}` +
          (missingInDe.length > 20 ? `\n  ... and ${missingInDe.length - 20} more` : '')
        );
      }
    });

    it('should have all German keys present in English translations', () => {
      const missingInEn = [...deKeys].filter(k => !enKeys.has(k));
      if (missingInEn.length > 0) {
        throw new Error(
          `${missingInEn.length} key(s) missing in en.json:\n  - ${missingInEn.slice(0, 20).join('\n  - ')}` +
          (missingInEn.length > 20 ? `\n  ... and ${missingInEn.length - 20} more` : '')
        );
      }
    });

    it('should not have empty translation values in de.json', () => {
      const emptyKeys = flattenKeys(deJson).filter(key => {
        const parts = key.split('.');
        let val: unknown = deJson;
        for (const p of parts) val = (val as Record<string, unknown>)[p];
        return typeof val === 'string' && val.trim() === '';
      });
      if (emptyKeys.length > 0) {
        throw new Error(`Empty values in de.json:\n  - ${emptyKeys.slice(0, 10).join('\n  - ')}`);
      }
    });

    it('should not have empty translation values in en.json', () => {
      const allowedEmpty = new Set([
        'common.ui.timePicker.suffix',
        'ui.timePicker.suffix',
      ]);
      const emptyKeys = flattenKeys(enJson).filter(key => {
        if (allowedEmpty.has(key)) return false;
        const parts = key.split('.');
        let val: unknown = enJson;
        for (const p of parts) val = (val as Record<string, unknown>)[p];
        return typeof val === 'string' && val.trim() === '';
      });
      if (emptyKeys.length > 0) {
        throw new Error(`Empty values in en.json:\n  - ${emptyKeys.slice(0, 10).join('\n  - ')}`);
      }
    });
  });

  describe('No hardcoded German UI text in components', () => {
    const criticalFiles = [
      'components/ai/AiChatWidget.tsx',
      'components/ai/AiPollCreator.tsx',
      'components/admin/settings/AiSettingsPanel.tsx',
      'components/admin/settings/SessionTimeoutPanel.tsx',
      'components/ResultsChart.tsx',
      'components/SimpleImageVoting.tsx',
      'App.tsx',
    ];

    for (const relFile of criticalFiles) {
      const filePath = path.join(CLIENT_SRC, relFile);
      if (!fs.existsSync(filePath)) continue;

      it(`${relFile}: should not contain hardcoded German labels in JSX`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const violations: string[] = [];

        lines.forEach((line, idx) => {
          if (isAllowedLine(line)) return;

          for (const pattern of HARDCODED_GERMAN_PATTERNS) {
            if (pattern.test(line)) {
              violations.push(`Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
            }
          }
          for (const pattern of HARDCODED_GERMAN_JSX_PATTERNS) {
            if (pattern.test(line)) {
              violations.push(`Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
            }
          }
        });

        if (violations.length > 0) {
          throw new Error(
            `Found ${violations.length} hardcoded German string(s) in ${relFile}:\n  ${violations.join('\n  ')}`
          );
        }
      });
    }
  });

  describe('No hardcoded locale strings (de-DE) without dynamic selection', () => {
    const filesToCheck = findTsxFiles(path.join(CLIENT_SRC, 'components'));
    filesToCheck.push(...findTsxFiles(path.join(CLIENT_SRC, 'pages')));

    const hardcodedLocalePattern = /toLocale(?:Date|Time)String\(\s*['"]de-DE['"]/;
    const dynamicLocalePattern = /i18n\.language/;

    for (const filePath of filesToCheck) {
      const relPath = path.relative(CLIENT_SRC, filePath);

      it(`${relPath}: should not use hardcoded 'de-DE' locale without dynamic fallback`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const violations: string[] = [];

        lines.forEach((line, idx) => {
          if (isAllowedLine(line)) return;
          if (hardcodedLocalePattern.test(line) && !dynamicLocalePattern.test(line)) {
            violations.push(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
          }
        });

        if (violations.length > 0) {
          throw new Error(
            `Found hardcoded 'de-DE' locale without dynamic language selection in ${relPath}:\n  ${violations.join('\n  ')}`
          );
        }
      });
    }
  });

  describe('All t() keys used in critical components exist in locale files', () => {
    const deJson = readJson(path.join(LOCALES_DIR, 'de.json'));
    const enJson = readJson(path.join(LOCALES_DIR, 'en.json'));
    const deKeys = new Set(flattenKeys(deJson));
    const enKeys = new Set(flattenKeys(enJson));

    const criticalFiles = [
      'components/ai/AiChatWidget.tsx',
      'components/ai/AiPollCreator.tsx',
      'components/admin/settings/AiSettingsPanel.tsx',
      'components/admin/settings/SessionTimeoutPanel.tsx',
      'components/ResultsChart.tsx',
      'components/SimpleImageVoting.tsx',
      'App.tsx',
    ];

    const tCallPattern = /(?<![a-zA-Z])t\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]+)['"]/g;

    for (const relFile of criticalFiles) {
      const filePath = path.join(CLIENT_SRC, relFile);
      if (!fs.existsSync(filePath)) continue;

      it(`${relFile}: all t() keys should exist in de.json`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        const missingKeys: string[] = [];
        let match;
        const regex = new RegExp(tCallPattern.source, 'g');
        while ((match = regex.exec(content)) !== null) {
          const key = match[1];
          if (!deKeys.has(key)) {
            missingKeys.push(key);
          }
        }
        if (missingKeys.length > 0) {
          throw new Error(
            `${missingKeys.length} t() key(s) missing in de.json:\n  - ${[...new Set(missingKeys)].join('\n  - ')}`
          );
        }
      });

      it(`${relFile}: all t() keys should exist in en.json`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        const missingKeys: string[] = [];
        let match;
        const regex = new RegExp(tCallPattern.source, 'g');
        while ((match = regex.exec(content)) !== null) {
          const key = match[1];
          if (!enKeys.has(key)) {
            missingKeys.push(key);
          }
        }
        if (missingKeys.length > 0) {
          throw new Error(
            `${missingKeys.length} t() key(s) missing in en.json:\n  - ${[...new Set(missingKeys)].join('\n  - ')}`
          );
        }
      });
    }
  });

  describe('Components using user-visible text must import useTranslation', () => {
    const criticalFiles = [
      'components/ai/AiChatWidget.tsx',
      'components/ai/AiPollCreator.tsx',
      'components/admin/settings/AiSettingsPanel.tsx',
      'components/admin/settings/SessionTimeoutPanel.tsx',
      'components/ResultsChart.tsx',
      'components/SimpleImageVoting.tsx',
      'App.tsx',
    ];

    for (const relFile of criticalFiles) {
      const filePath = path.join(CLIENT_SRC, relFile);
      if (!fs.existsSync(filePath)) continue;

      it(`${relFile}: should import useTranslation from react-i18next`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes("t('") || content.includes('t("')) {
          expect(content).toContain("useTranslation");
          expect(content).toContain("react-i18next");
        }
      });
    }
  });

  describe('No German fallback strings in t() calls', () => {
    const tsxFiles = findTsxFiles(path.join(CLIENT_SRC, 'components'));
    tsxFiles.push(...findTsxFiles(path.join(CLIENT_SRC, 'pages')));
    tsxFiles.push(path.join(CLIENT_SRC, 'App.tsx'));

    const germanFallbackPattern = /t\([^)]+,\s*['"][A-ZÄÖÜ][a-zäöüß]/;

    for (const filePath of tsxFiles) {
      if (!fs.existsSync(filePath)) continue;
      const relPath = path.relative(CLIENT_SRC, filePath);

      it(`${relPath}: should not have German fallback text in t() calls`, () => {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const violations: string[] = [];

        lines.forEach((line, idx) => {
          if (isAllowedLine(line)) return;
          if (germanFallbackPattern.test(line)) {
            violations.push(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
          }
        });

        if (violations.length > 0) {
          throw new Error(
            `Found t() calls with hardcoded German fallback text in ${relPath}:\n  ${violations.join('\n  ')}`
          );
        }
      });
    }
  });
});
