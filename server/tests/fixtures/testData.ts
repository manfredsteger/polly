import { nanoid } from 'nanoid';

export function createTestUser(overrides: Partial<{
  email: string;
  name: string;
  password: string;
  role: string;
}> = {}) {
  return {
    email: overrides.email || `test-${nanoid(8)}@example.com`,
    name: overrides.name || `Test User ${nanoid(4)}`,
    password: overrides.password || 'TestPassword123!',
    role: overrides.role || 'user',
  };
}

export function createTestPoll(overrides: Partial<{
  title: string;
  description: string;
  type: 'schedule' | 'survey' | 'organization';
  isActive: boolean;
  resultsPublic: boolean;
}> = {}) {
  return {
    title: overrides.title || `Test Poll ${nanoid(6)}`,
    description: overrides.description || 'Test description',
    type: overrides.type || 'survey',
    isActive: overrides.isActive ?? true,
    resultsPublic: overrides.resultsPublic ?? true,
    options: [
      { text: 'Option 1' },
      { text: 'Option 2' },
      { text: 'Option 3' },
    ],
  };
}

export function createTestVote(overrides: Partial<{
  voterName: string;
  voterEmail: string;
  response: 'yes' | 'maybe' | 'no';
}> = {}) {
  return {
    voterName: overrides.voterName || `Voter ${nanoid(4)}`,
    voterEmail: overrides.voterEmail || `voter-${nanoid(8)}@example.com`,
    response: overrides.response || 'yes',
  };
}

export const testMeta = {
  fixtures: {
    category: 'fixtures',
    name: 'Test-Fixtures',
    description: 'Hilfsfunktionen zum Erstellen von Testdaten',
    severity: 'info' as const,
  },
};
