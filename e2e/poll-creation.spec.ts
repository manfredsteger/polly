import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';

test.describe('Umfrage erstellen', () => {
  test('sollte eine Terminumfrage erstellen können', async ({ page }) => {
    const uniqueTitle = `Test-Terminumfrage-${nanoid(6)}`;
    
    await page.goto('/');
    
    await page.click('[data-testid="button-create-poll"]');
    await page.waitForURL('**/create-poll**');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    await page.fill('[data-testid="input-description"]', 'Automatisierter Playwright-Test');
    
    // The app uses a CalendarPicker component with data-testid="calendar-picker"
    const calendarPicker = page.locator('[data-testid="calendar-picker"]');
    await expect(calendarPicker).toBeVisible({ timeout: 10000 });
    
    // react-day-picker renders day cells inside table cells (td elements)
    // The day buttons are inside td.rdp-cell elements and have role="gridcell"
    // We need to select a day button in the calendar grid, not navigation buttons
    // Using the table structure: the calendar renders a table with td cells containing day buttons
    const dayCell = calendarPicker.locator('td button:not([aria-disabled="true"])').first();
    await expect(dayCell).toBeVisible({ timeout: 5000 });
    await dayCell.click();
    
    // After clicking a day, a dialog opens to add time slots
    // Wait for the time slot dialog inputs to appear
    const startTimeInput = page.locator('[data-testid="input-start-time"]');
    const dialogVisible = await startTimeInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (dialogVisible) {
      // Fill in time slot and confirm
      await startTimeInput.fill('09:00');
      await page.locator('[data-testid="input-end-time"]').fill('17:00');
      await page.locator('[data-testid="button-add-timeslot"]').click();
    }
    
    // Wait for the option to appear in the list
    await expect(page.locator('[data-testid="option-0"]')).toBeVisible({ timeout: 10000 });
    
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
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
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
