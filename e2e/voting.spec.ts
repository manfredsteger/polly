import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';

test.describe('Abstimmung', () => {
  test('sollte eine Umfrage erstellen und zur Abstimmung navigieren', async ({ page }) => {
    const uniqueTitle = `Vote-E2E-${nanoid(6)}`;
    
    // Enable console logging for debugging
    page.on('console', msg => console.log('Browser:', msg.text()));
    page.on('pageerror', err => console.log('Page error:', err.message));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    await page.waitForLoadState('networkidle');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    await page.fill('[data-testid="input-option-0"]', 'Ja');
    await page.fill('[data-testid="input-option-1"]', 'Nein');
    await page.fill('[data-testid="input-creator-email"]', 'e2e-test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // Wait for navigation to success page with longer timeout
    await page.waitForURL('**/success**', { timeout: 45000 });
    
    // Verify success heading (supports both German and English)
    await expect(page.getByRole('heading', { name: /erfolgreich erstellt|successfully created/i })).toBeVisible({ timeout: 15000 });
    
    // Wait for the public link card (confirms sessionStorage data loaded)
    const publicCard = page.locator('[data-testid="card-public-link"]');
    await expect(publicCard).toBeVisible({ timeout: 15000 });
    
    // Click the open button to navigate to the poll
    const openButton = page.locator('[data-testid="button-open-public-link"]');
    await expect(openButton).toBeVisible({ timeout: 10000 });
    
    // Use popup handling since the button opens in a new tab
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      openButton.click(),
    ]);
    await popup.waitForLoadState();
    
    await expect(popup.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 15000 });
    await popup.close();
  });

  test('sollte zur Admin-Ansicht navigieren können', async ({ page }) => {
    const uniqueTitle = `Admin-E2E-${nanoid(6)}`;
    
    // Enable console logging for debugging
    page.on('console', msg => console.log('Browser:', msg.text()));
    page.on('pageerror', err => console.log('Page error:', err.message));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    await page.waitForLoadState('networkidle');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    await page.fill('[data-testid="input-option-0"]', 'Stimme zu');
    await page.fill('[data-testid="input-option-1"]', 'Stimme nicht zu');
    await page.fill('[data-testid="input-creator-email"]', 'e2e-test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // Wait for navigation to success page with longer timeout
    await page.waitForURL('**/success**', { timeout: 45000 });
    
    // Verify success heading (supports both German and English)
    await expect(page.getByRole('heading', { name: /erfolgreich erstellt|successfully created/i })).toBeVisible({ timeout: 15000 });
    
    // Wait for the admin link card (confirms sessionStorage data loaded)
    const adminCard = page.locator('[data-testid="card-admin-link"]');
    await expect(adminCard).toBeVisible({ timeout: 15000 });
    
    // Click the open button to navigate to the admin view
    const openButton = page.locator('[data-testid="button-open-admin-link"]');
    await expect(openButton).toBeVisible({ timeout: 10000 });
    
    // Use popup handling since the button opens in a new tab
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      openButton.click(),
    ]);
    await popup.waitForLoadState();
    
    await expect(popup.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 15000 });
    await popup.close();
  });
});
