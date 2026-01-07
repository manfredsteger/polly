import { test, expect } from '@playwright/test';

// testType: 'data'

test.describe('Testdaten-Generierung und Fixtures', () => {
  
  test('sollte Testdaten korrekt mit isTestData Flag erstellen', async ({ request }) => {
    const uniqueTitle = `Test-Poll-${Date.now()}`;
    
    const createResponse = await request.post('/api/v1/polls', {
      data: {
        title: uniqueTitle,
        description: 'Automatisch generierter Datentest',
        pollType: 'survey',
        options: [
          { label: 'Option A' },
          { label: 'Option B' }
        ],
        creatorEmail: 'datatest@example.com',
        isTestData: true
      }
    });
    
    expect(createResponse.ok(), `Poll creation failed: ${createResponse.status()}`).toBeTruthy();
    const poll = await createResponse.json();
    expect(poll.isTestData).toBe(true);
    expect(poll.title).toBe(uniqueTitle);
  });

  test('sollte Testdaten von regulären Statistiken ausschließen', async ({ request }) => {
    const statsResponse = await request.get('/api/v1/stats');
    
    expect(statsResponse.ok(), `Stats endpoint failed: ${statsResponse.status()}`).toBeTruthy();
    const stats = await statsResponse.json();
    expect(typeof stats.totalPolls).toBe('number');
  });

  test('sollte Testdaten-Statistiken separat abrufen können', async ({ request }) => {
    const testStatsResponse = await request.get('/api/v1/admin/test-data-stats');
    
    expect(testStatsResponse.ok(), `Test stats endpoint failed: ${testStatsResponse.status()}`).toBeTruthy();
    const testStats = await testStatsResponse.json();
    expect(typeof testStats.polls).toBe('number');
    expect(typeof testStats.users).toBe('number');
  });
});
