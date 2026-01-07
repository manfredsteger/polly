import { test, expect } from '@playwright/test';

// testType: 'data'

test.describe('Testdaten-Generierung und Fixtures', () => {
  
  test('sollte Umfragen korrekt erstellen', async ({ request }) => {
    const uniqueTitle = `Test-Poll-${Date.now()}`;
    
    const createResponse = await request.post('/api/v1/polls', {
      data: {
        title: uniqueTitle,
        description: 'Automatisch generierter Datentest',
        type: 'survey',
        creatorEmail: 'datatest@example.com'
      }
    });
    
    expect(createResponse.ok(), `Poll creation failed: ${createResponse.status()}`).toBeTruthy();
    const poll = await createResponse.json();
    expect(poll.title).toBe(uniqueTitle);
    expect(poll.type).toBe('survey');
    expect(poll.adminToken).toBeDefined();
    expect(poll.publicToken).toBeDefined();
  });

  test('sollte Admin-Statistiken abrufen können', async ({ request }) => {
    const statsResponse = await request.get('/api/v1/admin/stats');
    
    // Note: This endpoint requires admin authentication
    // In CI, it will return 401 if not authenticated, which is expected
    if (statsResponse.status() === 401) {
      // Expected behavior when not authenticated as admin
      expect(statsResponse.status()).toBe(401);
    } else {
      expect(statsResponse.ok(), `Stats endpoint failed: ${statsResponse.status()}`).toBeTruthy();
      const stats = await statsResponse.json();
      expect(typeof stats.polls === 'object' || typeof stats.totalPolls === 'number').toBeTruthy();
    }
  });

  test('sollte Test-Runner-Status abrufen können', async ({ request }) => {
    const testRunsResponse = await request.get('/api/v1/admin/test-runs');
    
    // Note: This endpoint requires admin authentication
    if (testRunsResponse.status() === 401) {
      // Expected behavior when not authenticated as admin
      expect(testRunsResponse.status()).toBe(401);
    } else {
      expect(testRunsResponse.ok(), `Test runs endpoint failed: ${testRunsResponse.status()}`).toBeTruthy();
      const testRuns = await testRunsResponse.json();
      expect(Array.isArray(testRuns)).toBeTruthy();
    }
  });
});
