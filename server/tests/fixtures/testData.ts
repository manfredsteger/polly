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
  allowVoteWithdrawal: boolean;
  allowVoteEdit: boolean;
  creatorEmail: string;
}> = {}) {
  const pollType = overrides.type || 'survey';
  
  // For organization polls, add maxCapacity to options
  const options = pollType === 'organization'
    ? [
        { text: 'Slot 1', maxCapacity: 3 },
        { text: 'Slot 2', maxCapacity: 2 },
        { text: 'Slot 3', maxCapacity: 5 },
      ]
    : [
        { text: 'Option 1' },
        { text: 'Option 2' },
        { text: 'Option 3' },
      ];
  
  return {
    title: overrides.title || `Test Poll ${nanoid(6)}`,
    description: overrides.description || 'Test description',
    type: pollType,
    isActive: overrides.isActive ?? true,
    resultsPublic: overrides.resultsPublic ?? true,
    allowVoteWithdrawal: overrides.allowVoteWithdrawal ?? true,
    allowVoteEdit: overrides.allowVoteEdit ?? true,
    creatorEmail: overrides.creatorEmail || `creator-${nanoid(8)}@example.com`,
    options,
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
