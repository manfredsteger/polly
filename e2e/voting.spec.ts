import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';

test.describe('Abstimmung', () => {
  test('sollte eine Umfrage erstellen und zur Abstimmung navigieren', async ({ page }) => {
    const uniqueTitle = `Vote-E2E-${nanoid(6)}`;
    
    await page.goto('/');
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    
    await page.fill('[data-testid="input-option-0"]', 'Ja');
    await page.fill('[data-testid="input-option-1"]', 'Nein');
    
    await page.fill('[data-testid="input-creator-email"]', 'e2e-test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // The success page is at /success, not /poll-success
    await page.waitForURL('**/success**', { timeout: 30000 });
    
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 10000 });
    
    const publicLink = page.locator('a[href*="/poll/"]:not([href*="admin"])').first();
    await expect(publicLink).toBeVisible({ timeout: 5000 });
    
    await publicLink.click();
    await page.waitForURL('**/poll/**');
    
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('sollte zur Admin-Ansicht navigieren können', async ({ page }) => {
    const uniqueTitle = `Admin-E2E-${nanoid(6)}`;
    
    await page.goto('/');
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    
    await page.fill('[data-testid="input-option-0"]', 'Stimme zu');
    await page.fill('[data-testid="input-option-1"]', 'Stimme nicht zu');
    
    await page.fill('[data-testid="input-creator-email"]', 'e2e-test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // The success page is at /success, not /poll-success
    await page.waitForURL('**/success**', { timeout: 30000 });
    
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 10000 });
    
    const adminLink = page.locator('a[href*="admin"]').first();
    await expect(adminLink).toBeVisible({ timeout: 5000 });
    
    await adminLink.click();
    await page.waitForURL('**/poll/**');
    
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
  });
});
