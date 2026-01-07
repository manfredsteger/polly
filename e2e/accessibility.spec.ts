import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BLOCKING_IMPACTS = ['critical', 'serious'];

function filterBlockingViolations(violations: any[]): any[] {
  return violations.filter(v => BLOCKING_IMPACTS.includes(v.impact));
}

function formatViolations(violations: any[]): string {
  return violations.map(v => 
    `  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes.length} elements)`
  ).join('\n');
}

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  
  test('Startseite sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /:\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('Terminumfrage-Erstellung sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    await page.goto('/create-poll');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /create-poll:\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('Umfrage-Erstellung sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    await page.goto('/create-survey');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /create-survey:\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('Orga-Listen-Erstellung sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    await page.goto('/create-organization');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /create-organization:\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('Login-Seite sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    await page.goto('/anmelden');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /anmelden:\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('Registrierungs-Seite sollte keine kritischen A11y-Probleme haben', async ({ page }) => {
    // Registration is part of login page (tabs) - navigate there and click register tab
    await page.goto('/anmelden');
    await page.waitForLoadState('networkidle');
    
    // Click register tab if available
    const registerTab = page.locator('[data-testid="tab-register"]');
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await page.waitForTimeout(300);
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const blocking = filterBlockingViolations(results.violations);
    
    if (results.violations.length > 0) {
      console.log('A11y issues on /anmelden (register tab):\n' + formatViolations(results.violations));
    }

    expect(blocking, `Critical/Serious violations found:\n${formatViolations(blocking)}`).toHaveLength(0);
  });

  test('A11y-Gesamtbericht: Alle Seiten prüfen', async ({ page }) => {
    const pagesToTest = [
      { url: '/', name: 'Startseite' },
      { url: '/create-poll', name: 'Terminumfrage' },
      { url: '/create-survey', name: 'Umfrage' },
      { url: '/create-organization', name: 'Orga-Liste' },
      { url: '/anmelden', name: 'Login' }
    ];

    const report: { page: string; url: string; critical: number; serious: number; moderate: number; minor: number; violations: any[] }[] = [];

    for (const { url, name } of pagesToTest) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const counts = {
        critical: results.violations.filter(v => v.impact === 'critical').length,
        serious: results.violations.filter(v => v.impact === 'serious').length,
        moderate: results.violations.filter(v => v.impact === 'moderate').length,
        minor: results.violations.filter(v => v.impact === 'minor').length,
      };

      report.push({
        page: name,
        url,
        ...counts,
        violations: results.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length
        }))
      });
    }

    console.log('\n=== ACCESSIBILITY REPORT ===\n');
    console.log('| Seite | Critical | Serious | Moderate | Minor |');
    console.log('|-------|----------|---------|----------|-------|');
    for (const r of report) {
      console.log(`| ${r.page} | ${r.critical} | ${r.serious} | ${r.moderate} | ${r.minor} |`);
    }
    console.log('');

    const totalCritical = report.reduce((sum, r) => sum + r.critical, 0);
    const totalSerious = report.reduce((sum, r) => sum + r.serious, 0);

    if (totalCritical > 0 || totalSerious > 0) {
      console.log('BLOCKING ISSUES FOUND:');
      for (const r of report) {
        const blocking = r.violations.filter(v => BLOCKING_IMPACTS.includes(v.impact));
        if (blocking.length > 0) {
          console.log(`\n${r.page} (${r.url}):`);
          for (const v of blocking) {
            console.log(`  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes} elements)`);
          }
        }
      }
    }

    // Detailed error message for CI debugging
    const blockingDetails = report
      .flatMap(r => r.violations.filter(v => BLOCKING_IMPACTS.includes(v.impact)).map(v => `${r.page}: [${v.impact}] ${v.id} - ${v.description}`))
      .join('\n');
    
    expect(totalCritical, `${totalCritical} critical violations:\n${blockingDetails}`).toBe(0);
    expect(totalSerious, `${totalSerious} serious violations:\n${blockingDetails}`).toBe(0);
  });
});
