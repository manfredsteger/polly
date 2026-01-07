import { test, expect } from '@playwright/test';

// testType: 'data'

/**
 * Helper to check if a response is valid JSON (not HTML redirect)
 */
function isJsonResponse(response: { headers: () => Record<string, string> }): boolean {
  const contentType = response.headers()['content-type'] || '';
  return contentType.includes('application/json');
}

test.describe('Testdaten-Generierung und Fixtures', () => {
  
  test('sollte Umfragen korrekt erstellen', async ({ request }) => {
    const uniqueTitle = `Test-Poll-${Date.now()}`;
    
    const createResponse = await request.post('/api/v1/polls', {
      data: {
        title: uniqueTitle,
        description: 'Automatisch generierter Datentest',
        type: 'survey',
        creatorEmail: 'datatest@example.com',
        options: [
          { text: 'Option A' },
          { text: 'Option B' }
        ]
      }
    });
    
    // Poll creation is a PUBLIC endpoint - it MUST return JSON
    // HTML response indicates a real backend problem that should fail the test
    expect(
      isJsonResponse(createResponse), 
      `Poll creation API returned non-JSON response (status: ${createResponse.status()}). ` +
      `Expected JSON but got: ${createResponse.headers()['content-type']}`
    ).toBeTruthy();
    
    expect(createResponse.ok(), `Poll creation failed: ${createResponse.status()}`).toBeTruthy();
    const poll = await createResponse.json();
    expect(poll.title).toBe(uniqueTitle);
    expect(poll.type).toBe('survey');
    expect(poll.adminToken).toBeDefined();
    expect(poll.publicToken).toBeDefined();
  });

  test('sollte Admin-Statistiken abrufen können', async ({ request }) => {
    const statsResponse = await request.get('/api/v1/admin/stats');
    const status = statsResponse.status();
    
    // Backend uses requireAdmin middleware which returns 401 JSON
    // Expected responses:
    // - 401: Not authenticated (JSON with error message) - EXPECTED in CI
    // - 403: Forbidden (not admin role) - EXPECTED in CI
    // - 200: Successfully authenticated - verify response
    
    // Assert we get a JSON response (not HTML redirect)
    expect(
      isJsonResponse(statsResponse),
      `Admin stats returned non-JSON (status: ${status}). Backend should return 401 JSON, not redirect.`
    ).toBeTruthy();
    
    if (status === 401) {
      console.log('Admin stats: 401 Unauthorized (expected in CI without auth)');
      const errorBody = await statsResponse.json();
      expect(errorBody.error).toBeDefined();
      return;
    }
    
    if (status === 403) {
      console.log('Admin stats: 403 Forbidden (expected in CI without admin role)');
      const errorBody = await statsResponse.json();
      expect(errorBody.error).toBeDefined();
      return;
    }
    
    // Should be 200 OK with stats
    expect(statsResponse.ok(), `Stats endpoint failed: ${status}`).toBeTruthy();
    const stats = await statsResponse.json();
    expect(typeof stats.polls === 'object' || typeof stats.totalPolls === 'number').toBeTruthy();
  });

  test('sollte Test-Runner-Status abrufen können', async ({ request }) => {
    const testRunsResponse = await request.get('/api/v1/admin/tests/runs');
    const status = testRunsResponse.status();
    
    // Backend uses requireAdmin middleware which returns 401 JSON
    // Expected responses:
    // - 401: Not authenticated (JSON with error message) - EXPECTED in CI
    // - 403: Forbidden (not admin role) - EXPECTED in CI
    // - 200: Successfully authenticated - verify response
    
    // Assert we get a JSON response (not HTML redirect)
    expect(
      isJsonResponse(testRunsResponse),
      `Test runs returned non-JSON (status: ${status}). Backend should return 401 JSON, not redirect.`
    ).toBeTruthy();
    
    if (status === 401) {
      console.log('Test runs: 401 Unauthorized (expected in CI without auth)');
      const errorBody = await testRunsResponse.json();
      expect(errorBody.error).toBeDefined();
      return;
    }
    
    if (status === 403) {
      console.log('Test runs: 403 Forbidden (expected in CI without admin role)');
      const errorBody = await testRunsResponse.json();
      expect(errorBody.error).toBeDefined();
      return;
    }
    
    // Should be 200 OK with test runs
    expect(testRunsResponse.ok(), `Test runs endpoint failed: ${status}`).toBeTruthy();
    const testRuns = await testRunsResponse.json();
    expect(Array.isArray(testRuns)).toBeTruthy();
  });
});
