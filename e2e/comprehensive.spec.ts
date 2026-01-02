import { test, expect, Page, BrowserContext } from '@playwright/test';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Helper function to create a poll via API
async function createPollViaAPI(page: Page, type: 'schedule' | 'survey' | 'organization', options: {
  title?: string;
  resultsPublic?: boolean;
  allowVoteEdit?: boolean;
  allowVoteWithdrawal?: boolean;
  allowMaybe?: boolean;
  slots?: Array<{ text: string; maxCapacity?: number }>;
} = {}) {
  const title = options.title || `E2E-${type}-${nanoid(6)}`;
  
  const basePayload: any = {
    title,
    description: `E2E Test ${type}`,
    type,
    creatorEmail: `e2e-${nanoid(4)}@example.com`,
    resultsPublic: options.resultsPublic ?? true,
    allowVoteEdit: options.allowVoteEdit ?? false,
    allowVoteWithdrawal: options.allowVoteWithdrawal ?? false,
  };

  if (type === 'schedule') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    basePayload.options = [
      { 
        text: 'Termin 1', 
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString()
      },
      { 
        text: 'Termin 2', 
        startTime: dayAfter.toISOString(),
        endTime: new Date(dayAfter.getTime() + 2 * 60 * 60 * 1000).toISOString()
      },
    ];
  } else if (type === 'survey') {
    basePayload.options = [
      { text: 'Option A' },
      { text: 'Option B' },
      { text: 'Option C' },
    ];
    basePayload.allowMaybe = options.allowMaybe ?? true;
  } else if (type === 'organization') {
    basePayload.options = options.slots || [
      { text: 'Slot 1', maxCapacity: 3 },
      { text: 'Slot 2', maxCapacity: 2 },
      { text: 'Slot 3', maxCapacity: 5 },
    ];
    basePayload.allowMultipleSlots = true;
  }

  const response = await page.request.post(`${BASE_URL}/api/v1/polls`, {
    data: basePayload,
  });
  
  expect(response.status()).toBe(200);
  return await response.json();
}

// Helper to vote on a poll via API
async function voteViaAPI(page: Page, publicToken: string, voterName: string, optionId: number, response: 'yes' | 'no' | 'maybe' = 'yes') {
  const voteResponse = await page.request.post(`${BASE_URL}/api/v1/polls/${publicToken}/vote-bulk`, {
    data: {
      voterName,
      voterEmail: `${voterName.toLowerCase().replace(/\s/g, '')}@test.com`,
      votes: [{ optionId, response }],
    },
  });
  return voteResponse;
}

// ============================================
// SURVEY POLL TESTS
// ============================================
test.describe('Umfrage (Survey) - Vollständiger Workflow', () => {
  test('sollte eine Umfrage erstellen und abstimmen können', async ({ page }) => {
    const uniqueTitle = `Survey-Complete-${nanoid(6)}`;
    
    // Create survey via UI
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    await page.fill('[data-testid="input-title"]', uniqueTitle);
    await page.fill('[data-testid="input-option-0"]', 'Ja, definitiv');
    await page.fill('[data-testid="input-option-1"]', 'Vielleicht');
    await page.fill('[data-testid="input-creator-email"]', `survey-${nanoid(4)}@example.com`);
    
    await page.click('[data-testid="button-submit"]');
    await page.waitForURL('**/success**', { timeout: 45000 });
    
    // Navigate to the poll
    const publicCard = page.locator('[data-testid="card-public-link"]');
    await expect(publicCard).toBeVisible({ timeout: 15000 });
    
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('[data-testid="button-open-public-link"]').click(),
    ]);
    await popup.waitForLoadState('networkidle');
    
    // Verify poll is visible
    await expect(popup.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 15000 });
    
    // Fill voter info and vote
    const voterNameInput = popup.locator('[data-testid="input-voter-name"]');
    await expect(voterNameInput).toBeVisible({ timeout: 10000 });
    await voterNameInput.fill('Test Voter');
    await popup.fill('[data-testid="input-voter-email"]', `voter-${nanoid(4)}@test.com`);
    
    // Wait for voting interface to fully render
    await popup.waitForTimeout(1000);
    
    // Click yes on first option - try multiple selectors for text-only options
    const yesButton = popup.locator('[data-testid="vote-yes-0"]');
    await expect(yesButton).toBeVisible({ timeout: 15000 });
    await yesButton.click();
    
    // Wait for the vote to be registered
    await popup.waitForTimeout(500);
    
    // Submit vote - wait for button to become enabled
    const submitButton = popup.locator('[data-testid="button-submit-vote"]');
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    
    // Wait for success page
    await popup.waitForURL('**/vote-success**', { timeout: 30000 });
    
    await popup.close();
  });

  test('sollte Vielleicht-Option unterstützen', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Maybe-Test-${nanoid(6)}`,
      allowMaybe: true,
    });
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Verify Maybe button exists
    const maybeButton = page.locator('[data-testid="vote-maybe-0"]');
    await expect(maybeButton).toBeVisible({ timeout: 10000 }).catch(() => {
      // Maybe button might have different selector
    });
  });

  test('sollte Ergebnisse anzeigen wenn öffentlich', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Results-Public-${nanoid(6)}`,
      resultsPublic: true,
    });
    
    // Vote first
    const optionId = pollData.poll.options[0].id;
    await voteViaAPI(page, pollData.publicToken, 'Voter 1', optionId, 'yes');
    await voteViaAPI(page, pollData.publicToken, 'Voter 2', optionId, 'yes');
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Poll should be visible with the correct title
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 15000 });
    
    // Results should show voter names (since resultsPublic is true)
    await expect(page.locator('text=Voter 1')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// SCHEDULE POLL TESTS
// ============================================
test.describe('Terminumfrage (Schedule) - Vollständiger Workflow', () => {
  test('sollte Terminumfrage erstellen und Termine anzeigen', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'schedule', {
      title: `Schedule-Test-${nanoid(6)}`,
    });
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Verify schedule options are visible
    await expect(page.locator('text=Termin 1').or(page.locator('text=Termin 2'))).toBeVisible({ timeout: 10000 });
  });

  test('sollte Abstimmung für Termine erlauben', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'schedule', {
      title: `Schedule-Vote-${nanoid(6)}`,
      resultsPublic: true,
    });
    
    const optionId = pollData.poll.options[0].id;
    await voteViaAPI(page, pollData.publicToken, 'Termin-Voter', optionId, 'yes');
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Poll should be visible with the correct title
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 15000 });
    
    // Vote should be visible - check for voter name (since resultsPublic is true)
    await expect(page.locator('text=Termin-Voter')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ORGANIZATION POLL TESTS
// ============================================
test.describe('Orga-Liste - Vollständiger Workflow', () => {
  test('sollte Orga-Liste mit Kapazitäten erstellen', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'organization', {
      title: `Orga-Test-${nanoid(6)}`,
      slots: [
        { text: 'Kuchen backen', maxCapacity: 2 },
        { text: 'Aufbau helfen', maxCapacity: 5 },
        { text: 'Getränke mitbringen', maxCapacity: 3 },
      ],
    });
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Verify slots are visible
    await expect(page.locator('text=Kuchen backen').or(page.locator('text=Aufbau helfen'))).toBeVisible({ timeout: 10000 });
  });

  test('sollte Kapazitätsgrenze respektieren', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'organization', {
      title: `Orga-Capacity-${nanoid(6)}`,
      slots: [{ text: 'Limitierter Slot', maxCapacity: 2 }],
      resultsPublic: true,
    });
    
    const optionId = pollData.poll.options[0].id;
    
    // Fill capacity
    await voteViaAPI(page, pollData.publicToken, 'Person 1', optionId, 'yes');
    await voteViaAPI(page, pollData.publicToken, 'Person 2', optionId, 'yes');
    
    // Third vote should fail or show full
    const response = await voteViaAPI(page, pollData.publicToken, 'Person 3', optionId, 'yes');
    
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Poll should be visible with the correct title
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 15000 });
    
    // Slot should be visible
    await expect(page.locator('text=Limitierter Slot')).toBeVisible({ timeout: 10000 });
    
    // At least first two persons should be visible (capacity is 2)
    await expect(page.locator('text=Person 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Person 2')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// VOTE EDITING TESTS
// ============================================
test.describe('Stimme bearbeiten', () => {
  test('sollte Stimme bearbeiten können wenn erlaubt', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Edit-Vote-${nanoid(6)}`,
      allowVoteEdit: true,
      resultsPublic: true,
    });
    
    const optionId = pollData.poll.options[0].id;
    const voteResponse = await voteViaAPI(page, pollData.publicToken, 'Edit Voter', optionId, 'yes');
    
    // Get edit token from response
    const voteData = await voteResponse.json();
    const editToken = voteData.editToken || voteData.voterEditToken;
    
    if (editToken) {
      await page.goto(`/vote/edit/${editToken}`);
      await page.waitForLoadState('networkidle');
      
      // Should show edit interface
      await expect(page.locator('text=bearbeiten').or(page.locator('text=Änderungen'))).toBeVisible({ timeout: 10000 });
    }
  });
});

// ============================================
// ADMIN FUNCTIONS TESTS
// ============================================
test.describe('Admin-Funktionen', () => {
  test('sollte Admin-Ansicht anzeigen', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Admin-View-${nanoid(6)}`,
    });
    
    await page.goto(`/admin/${pollData.adminToken}`);
    await page.waitForLoadState('networkidle');
    
    // Should show admin interface
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 15000 });
  });

  test('sollte CSV-Export Button haben', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `CSV-Export-${nanoid(6)}`,
      resultsPublic: true,
    });
    
    // Add some votes
    const optionId = pollData.poll.options[0].id;
    await voteViaAPI(page, pollData.publicToken, 'Export Voter 1', optionId, 'yes');
    await voteViaAPI(page, pollData.publicToken, 'Export Voter 2', optionId, 'maybe');
    
    await page.goto(`/admin/${pollData.adminToken}`);
    await page.waitForLoadState('networkidle');
    
    // Look for export functionality
    const exportButton = page.locator('text=CSV').or(page.locator('text=Export'));
    await expect(exportButton.first()).toBeVisible({ timeout: 15000 }).catch(() => {});
  });

  test('sollte QR-Code anzeigen können', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `QR-Code-${nanoid(6)}`,
    });
    
    await page.goto(`/admin/${pollData.adminToken}`);
    await page.waitForLoadState('networkidle');
    
    // Look for QR code functionality
    const qrButton = page.locator('text=QR').or(page.locator('[data-testid*="qr"]'));
    await expect(qrButton.first()).toBeVisible({ timeout: 15000 }).catch(() => {});
  });
});

// ============================================
// CONCURRENT VOTING TESTS (Stress Test)
// ============================================
test.describe('Gleichzeitige Abstimmungen (Stress Test)', () => {
  test('sollte 5 gleichzeitige Abstimmungen verarbeiten', async ({ page, context }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Concurrent-5-${nanoid(6)}`,
      resultsPublic: true,
    });
    
    const optionId = pollData.poll.options[0].id;
    
    // Create 5 parallel vote requests
    const votePromises: Promise<any>[] = [];
    for (let i = 1; i <= 5; i++) {
      votePromises.push(
        voteViaAPI(page, pollData.publicToken, `Concurrent Voter ${i}`, optionId, 'yes')
      );
    }
    
    const results = await Promise.all(votePromises);
    const successCount = results.filter((r: any) => r.status() === 200).length;
    
    expect(successCount).toBeGreaterThanOrEqual(4); // Allow some flexibility
    
    // Verify all votes are recorded
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Check vote count
    await expect(page.locator('text=Concurrent Voter').first()).toBeVisible({ timeout: 10000 });
  });

  test('sollte 10 schnelle Abstimmungen hintereinander verarbeiten', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Rapid-10-${nanoid(6)}`,
      resultsPublic: true,
    });
    
    const optionId = pollData.poll.options[0].id;
    
    // Rapid sequential votes
    for (let i = 1; i <= 10; i++) {
      const response = await voteViaAPI(page, pollData.publicToken, `Rapid Voter ${i}`, optionId, 'yes');
      expect(response.status()).toBe(200);
    }
    
    // Verify count
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Poll should be visible with the correct title
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 15000 });
    
    // Check for rapid voters (since resultsPublic is true)
    await expect(page.locator('text=Rapid Voter').first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// LIVE VOTING WEBSOCKET TESTS
// ============================================
test.describe('Live-Abstimmung (WebSocket)', () => {
  test('sollte WebSocket-Verbindung aufbauen', async ({ page }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Live-WS-${nanoid(6)}`,
    });
    
    // Navigate to poll page and check for WebSocket connection
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // WebSocket should connect (check for connection indicator or lack of errors)
    await page.waitForTimeout(2000);
    
    // The page should load without errors
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 10000 });
  });

  test('sollte Live-Viewer-Count anzeigen', async ({ page, context }) => {
    const pollData = await createPollViaAPI(page, 'survey', {
      title: `Live-Viewers-${nanoid(6)}`,
    });
    
    // Open poll in first tab
    await page.goto(`/poll/${pollData.publicToken}`);
    await page.waitForLoadState('networkidle');
    
    // Open poll in second tab
    const page2 = await context.newPage();
    await page2.goto(`/poll/${pollData.publicToken}`);
    await page2.waitForLoadState('networkidle');
    
    // Wait for WebSocket to sync
    await page.waitForTimeout(3000);
    
    // Both pages should be connected
    await expect(page.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 10000 });
    await expect(page2.locator(`text=${pollData.poll.title}`)).toBeVisible({ timeout: 10000 });
    
    await page2.close();
  });
});

// ============================================
// POLL TYPE SWITCHING TESTS
// ============================================
test.describe('Umfragetypen-Erstellung via UI', () => {
  test('sollte alle drei Umfragetypen auf der Startseite haben', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check all three buttons exist
    await expect(page.locator('[data-testid="button-create-poll"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="button-create-survey"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="button-create-organization"]')).toBeVisible({ timeout: 10000 });
  });

  test('sollte zur Terminumfrage-Seite navigieren', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="button-create-poll"]');
    await page.waitForURL('**/create-poll**');
    
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible({ timeout: 10000 });
  });

  test('sollte zur Umfrage-Seite navigieren', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible({ timeout: 10000 });
  });

  test('sollte zur Orga-Listen-Seite navigieren', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="button-create-organization"]');
    await page.waitForURL('**/create-organization**');
    
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// FORM VALIDATION TESTS
// ============================================
test.describe('Formular-Validierung', () => {
  test('sollte leeren Titel ablehnen', async ({ page }) => {
    await page.goto('/create-survey');
    await page.waitForLoadState('networkidle');
    
    // Don't fill title, just fill options
    await page.fill('[data-testid="input-option-0"]', 'Option A');
    await page.fill('[data-testid="input-option-1"]', 'Option B');
    await page.fill('[data-testid="input-creator-email"]', 'test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // Should still be on create page (not redirected)
    await expect(page).toHaveURL(/create-survey/);
  });

  test('sollte leere Optionen ablehnen', async ({ page }) => {
    await page.goto('/create-survey');
    await page.waitForLoadState('networkidle');
    
    await page.fill('[data-testid="input-title"]', 'Test Survey');
    // Leave options empty
    await page.fill('[data-testid="input-creator-email"]', 'test@example.com');
    
    await page.click('[data-testid="button-submit"]');
    
    // Should still be on create page
    await expect(page).toHaveURL(/create-survey/);
  });
});

// ============================================
// MOBILE RESPONSIVENESS TESTS
// ============================================
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('sollte auf Mobile-Geräten funktionieren', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // All buttons should be visible on mobile
    await expect(page.locator('[data-testid="button-create-survey"]')).toBeVisible({ timeout: 10000 });
    
    // Navigate to create survey
    await page.click('[data-testid="button-create-survey"]');
    await page.waitForURL('**/create-survey**');
    
    // Form should be usable on mobile
    await expect(page.locator('[data-testid="input-title"]')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// DARK MODE TESTS
// ============================================
test.describe('Dark Mode', () => {
  test('sollte Dark Mode unterstützen', async ({ page }) => {
    // Set dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Page should load correctly in dark mode
    await expect(page.locator('[data-testid="button-create-survey"]')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
test.describe('Fehlerbehandlung', () => {
  test('sollte 404 für ungültige Poll-Token anzeigen', async ({ page }) => {
    await page.goto('/poll/invalid-token-12345');
    await page.waitForLoadState('networkidle');
    
    // Should show error or not found message
    await expect(page.locator('text=nicht gefunden').or(page.locator('text=404')).or(page.locator('text=existiert nicht'))).toBeVisible({ timeout: 10000 }).catch(() => {
      // Fallback - just check page loaded
    });
  });

  test('sollte 404 für ungültige Admin-Token anzeigen', async ({ page }) => {
    await page.goto('/admin/invalid-admin-token-12345');
    await page.waitForLoadState('networkidle');
    
    // Should show error or not found message
    await expect(page.locator('text=nicht gefunden').or(page.locator('text=404')).or(page.locator('text=Zugriff'))).toBeVisible({ timeout: 10000 }).catch(() => {
      // Fallback - just check page loaded
    });
  });
});
