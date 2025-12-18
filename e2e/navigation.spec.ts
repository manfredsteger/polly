import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('sollte die Startseite laden', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('[data-testid="button-create-poll"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-create-survey"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-create-organization"]')).toBeVisible();
  });

  test('sollte zur Terminumfrage-Erstellung navigieren', async ({ page }) => {
    await page.goto('/');
    
    await page.click('[data-testid="button-create-poll"]');
    
    await page.waitForURL('**/create-poll**');
    
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-creator-email"]')).toBeVisible();
  });

  test('sollte zur Umfrage-Erstellung navigieren', async ({ page }) => {
    await page.goto('/');
    
    await page.click('[data-testid="button-create-survey"]');
    
    await page.waitForURL('**/create-survey**');
    
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible();
  });

  test('sollte Login-Seite anzeigen können', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"], input[name="email"], [data-testid*="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"], [data-testid*="password"]')).toBeVisible();
  });
});
