import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';

test.describe('Umfrage erstellen', () => {
  test('sollte eine Terminumfrage erstellen können', async ({ page }) => {
    const uniqueTitle = `Test-Terminumfrage-${nanoid(6)}`;
    
    await page.goto('/');
    
    await page.click('[data-testid="button-create-poll"]');
    await page.waitForURL('**/create-poll**');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    await page.fill('[data-testid="input-description"]', 'Automatisierter Playwright-Test');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    await dateInput.fill(dateStr);
    
    const addButton = page.locator('button:has-text("Termin hinzufügen"), button:has-text("Hinzufügen")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
    }
    
    await expect(page.locator('[data-testid="option-0"]')).toBeVisible({ timeout: 5000 });
    
    await page.fill('[data-testid="input-creator-email"]', 'test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    await page.waitForURL('**/poll-success**', { timeout: 30000 });
    
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 10000 });
    
    const publicLink = page.locator('a[href*="/poll/"]').first();
    await expect(publicLink).toBeVisible({ timeout: 5000 });
  });

  test('sollte eine Umfrage erstellen können', async ({ page }) => {
    const uniqueTitle = `Test-Umfrage-${nanoid(6)}`;
    
    await page.goto('/');
    
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    
    await page.fill('[data-testid="input-option-0"]', 'Option A');
    await page.fill('[data-testid="input-option-1"]', 'Option B');
    
    await page.fill('[data-testid="input-creator-email"]', 'test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    await page.waitForURL('**/poll-success**', { timeout: 30000 });
    
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 10000 });
    
    const publicLink = page.locator('a[href*="/poll/"]').first();
    await expect(publicLink).toBeVisible({ timeout: 5000 });
  });
});
