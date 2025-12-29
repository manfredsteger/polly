import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

export const testMeta = {
  category: 'ui' as const,
  name: 'Alert-Farbkonsistenz',
  description: 'Prüft ob alle Alert-Boxen die konsistenten polly-alert-* Klassen verwenden statt hardcodierte Farben',
  severity: 'medium' as const,
};

const CLIENT_SRC_DIR = path.join(__dirname, '../../../client/src');

const ALLOWED_HARDCODED_AMBER_PATTERNS = [
  /text-amber-\d+.*Clock/,
  /Clock.*text-amber/,
  /animate-pulse/,
  /text-xs text-amber/,
  /Badge/,
  /border-b/,
  /className="border-b/,
  /polly-alert/,
  /dark:/,
];

describe('Alert Color Consistency', () => {
  it('should use AlertBanner component for warning messages instead of hardcoded amber classes', () => {
    const componentsDir = path.join(CLIENT_SRC_DIR, 'components');
    const pagesDir = path.join(CLIENT_SRC_DIR, 'pages');
    
    const violations: string[] = [];
    
    const checkFile = (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const fileName = path.relative(CLIENT_SRC_DIR, filePath);
      
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        if (line.includes('bg-amber-50') && 
            (line.includes('border') || line.includes('rounded')) &&
            !line.includes('polly-alert')) {
          
          const isAllowed = ALLOWED_HARDCODED_AMBER_PATTERNS.some(pattern => pattern.test(line));
          if (!isAllowed && !line.includes('dark:')) {
            violations.push(`${fileName}:${lineNum} - Hardcodiertes amber Alert ohne Dark Mode: ${line.trim().substring(0, 80)}...`);
          }
        }
      });
    };
    
    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          checkFile(filePath);
        }
      });
    };
    
    walkDir(componentsDir);
    walkDir(pagesDir);
    
    if (violations.length > 0) {
      console.log('Alert-Konsistenz-Verstöße gefunden:');
      violations.forEach(v => console.log('  - ' + v));
    }
    
    expect(violations.length).toBe(0);
  });

  it('should have polly-alert classes defined for all variants in CSS', () => {
    const cssPath = path.join(CLIENT_SRC_DIR, 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    
    const requiredAlertClasses = [
      'polly-alert-error',
      'polly-alert-success',
      'polly-alert-warning',
      'polly-alert-info',
    ];
    
    for (const className of requiredAlertClasses) {
      expect(cssContent).toContain(`.${className}`);
    }
  });

  it('should have dark mode variants for all alert types', () => {
    const cssPath = path.join(CLIENT_SRC_DIR, 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    
    const alertTypes = ['error', 'success', 'warning', 'info'];
    
    for (const type of alertTypes) {
      const classBlock = cssContent.match(new RegExp(`\\.polly-alert-${type}[^}]+}`, 's'));
      expect(classBlock).not.toBeNull();
      
      if (classBlock) {
        expect(classBlock[0]).toContain('dark:');
      }
    }
  });

  it('should have AlertBanner component with all variants', () => {
    const alertBannerPath = path.join(CLIENT_SRC_DIR, 'components/ui/AlertBanner.tsx');
    const content = fs.readFileSync(alertBannerPath, 'utf-8');
    
    expect(content).toContain("'error'");
    expect(content).toContain("'success'");
    expect(content).toContain("'warning'");
    expect(content).toContain("'info'");
    
    expect(content).toContain('polly-alert-');
    expect(content).toContain('data-testid');
  });

  it('should use consistent icon colors in alerts', () => {
    const alertBannerPath = path.join(CLIENT_SRC_DIR, 'components/ui/AlertBanner.tsx');
    const content = fs.readFileSync(alertBannerPath, 'utf-8');
    
    expect(content).toContain('polly-alert-icon');
    
    const cssPath = path.join(CLIENT_SRC_DIR, 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    
    const alertTypes = ['error', 'success', 'warning', 'info'];
    
    for (const type of alertTypes) {
      expect(cssContent).toContain(`.polly-alert-${type} .polly-alert-icon`);
    }
  });
});
