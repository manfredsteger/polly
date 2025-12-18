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
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // The login form uses data-testid="input-login-email" for the username/email field
    await expect(page.locator('[data-testid="input-login-email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="input-login-password"]')).toBeVisible({ timeout: 10000 });
  });
});
