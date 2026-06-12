import { describe, expect, it } from 'vitest';
import { shouldEnablePollResultsQuery } from '../../../client/src/pages/pollQueryGuards';

export const testMeta = {
  category: 'ui' as const,
  name: 'Invalid Poll Results Polling Guard',
  description: 'Prevents repeated results polling when a poll token is invalid and the poll query never resolves successfully',
  severity: 'medium' as const,
};

describe('Poll results polling guard', () => {
  it('disables results polling when there is no token', () => {
    expect(shouldEnablePollResultsQuery(undefined, { id: 'poll-1' })).toBe(false);
  });

  it('disables results polling when the poll lookup failed', () => {
    expect(shouldEnablePollResultsQuery('missing-token', undefined)).toBe(false);
  });

  it('enables results polling after the poll loads successfully', () => {
    expect(shouldEnablePollResultsQuery('valid-token', { id: 'poll-1' })).toBe(true);
  });
});
