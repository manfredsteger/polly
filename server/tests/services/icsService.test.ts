import { describe, it, expect } from 'vitest';
import { generatePollIcs, generateUserCalendarFeed, getDefaultCalendarSettings } from '../../services/icsService';
import type { Poll, PollOption, Vote, CalendarSettings } from '../../../shared/schema';

export const testMeta = {
  category: 'services' as const,
  name: 'ICS-Kalender-Service',
  description: 'Prüft Kalender-Export mit Finalisierung und Status-Präfixen',
  severity: 'high' as const,
};

function createMockPoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'test-poll-id',
    title: 'Test Poll',
    description: 'Test description',
    type: 'schedule',
    userId: null,
    creatorEmail: 'creator@test.com',
    adminToken: 'admin-token',
    publicToken: 'public-token',
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
    allowMultipleSlots: false,
    maxSlotsPerUser: null,
    allowVoteEdit: true,
    allowVoteWithdrawal: true,
    resultsPublic: true,
    allowMaybe: true,
    isTestData: true,
    expiresAt: null,
    finalOptionId: null,
    enableExpiryReminder: false,
    expiryReminderHours: 24,
    expiryReminderSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockOption(id: number, text: string, startTime?: Date): PollOption {
  return {
    id,
    pollId: 'test-poll-id',
    text,
    imageUrl: null,
    altText: null,
    startTime: startTime || new Date('2025-01-15T10:00:00Z'),
    endTime: new Date('2025-01-15T11:00:00Z'),
    maxCapacity: null,
    order: id,
    createdAt: new Date(),
  };
}

function createMockVote(optionId: number, response: string = 'yes'): Vote {
  return {
    id: Math.random() * 1000,
    pollId: 'test-poll-id',
    optionId,
    voterName: 'Test Voter',
    voterEmail: 'voter@test.com',
    userId: null,
    voterKey: null,
    voterSource: null,
    response,
    comment: null,
    voterEditToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ICS Service', () => {
  describe('generatePollIcs - finalization filtering', () => {
    it('should export all options when poll is not finalized', () => {
      const poll = createMockPoll({ finalOptionId: null });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
        createMockOption(3, 'Option 3'),
      ];
      const votes: Vote[] = [];

      const ics = generatePollIcs(poll, options, votes, 'https://test.com');

      // Count VEVENT occurrences
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(3);
    });

    it('should export only final option when poll is finalized', () => {
      const poll = createMockPoll({ finalOptionId: 2 });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
        createMockOption(3, 'Option 3'),
      ];
      const votes: Vote[] = [];

      const ics = generatePollIcs(poll, options, votes, 'https://test.com');

      // Should only have 1 event
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(1);
      
      // Should contain the finalized option
      expect(ics).toContain('Option 2');
      expect(ics).not.toContain('Option 1');
      expect(ics).not.toContain('Option 3');
    });

    it('should use Bestätigt prefix for finalized polls', () => {
      const poll = createMockPoll({ finalOptionId: 1 });
      const options = [createMockOption(1, 'Option 1')];
      const votes: Vote[] = [];
      
      const settings = getDefaultCalendarSettings();
      const context = { settings, language: 'de' as const };

      const ics = generatePollIcs(poll, options, votes, 'https://test.com', context);

      expect(ics).toContain('Bestätigt:');
      expect(ics).not.toContain('Vorläufig:');
    });

    it('should use Vorläufig prefix for non-finalized polls', () => {
      const poll = createMockPoll({ finalOptionId: null, isActive: true });
      const options = [createMockOption(1, 'Option 1')];
      const votes: Vote[] = [];
      
      const settings = getDefaultCalendarSettings();
      const context = { settings, language: 'de' as const };

      const ics = generatePollIcs(poll, options, votes, 'https://test.com', context);

      expect(ics).toContain('Vorläufig:');
      expect(ics).not.toContain('Bestätigt:');
    });

    it('should use English prefixes when language is en', () => {
      const poll = createMockPoll({ finalOptionId: 1 });
      const options = [createMockOption(1, 'Option 1')];
      const votes: Vote[] = [];
      
      const settings: CalendarSettings = {
        ...getDefaultCalendarSettings(),
        prefixesLocalized: {
          de: { tentative: 'Vorläufig', confirmed: 'Bestätigt', myChoice: '[Meine Wahl]' },
          en: { tentative: 'Tentative', confirmed: 'Confirmed', myChoice: '[My Choice]' },
        },
      };
      const context = { settings, language: 'en' as const };

      const ics = generatePollIcs(poll, options, votes, 'https://test.com', context);

      expect(ics).toContain('Confirmed:');
    });
  });

  describe('generateUserCalendarFeed - finalization filtering', () => {
    it('should only show final option for finalized polls in user feed', () => {
      const poll = createMockPoll({ finalOptionId: 2 });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
        createMockOption(3, 'Option 3'),
      ];
      const votes = [
        createMockVote(1, 'yes'),
        createMockVote(2, 'yes'),
        createMockVote(3, 'yes'),
      ];

      const participations = [{ poll, options, votes }];
      const ics = generateUserCalendarFeed(participations, 'Test User', 'https://test.com');

      // Should only have 1 event (the finalized option)
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(1);
      
      // Should contain the finalized option even if user didn't vote for it
      expect(ics).toContain('Option 2');
    });

    it('should show user votes when poll is not finalized', () => {
      const poll = createMockPoll({ finalOptionId: null });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
        createMockOption(3, 'Option 3'),
      ];
      const votes = [
        createMockVote(1, 'yes'),
        createMockVote(2, 'yes'),
      ];

      const participations = [{ poll, options, votes }];
      const ics = generateUserCalendarFeed(participations, 'Test User', 'https://test.com');

      // Should have 2 events (user's yes votes)
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(2);
    });
  });

  describe('exportScope settings', () => {
    it('should respect final_only scope when no final option', () => {
      const poll = createMockPoll({ finalOptionId: null });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
      ];
      const votes: Vote[] = [];
      
      const settings: CalendarSettings = {
        ...getDefaultCalendarSettings(),
        exportScope: 'final_only',
      };
      const context = { settings, language: 'de' as const };

      const ics = generatePollIcs(poll, options, votes, 'https://test.com', context);

      // Should have no events when exportScope is final_only but no final option
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(0);
    });

    it('should export final option even with final_only scope', () => {
      const poll = createMockPoll({ finalOptionId: 1 });
      const options = [
        createMockOption(1, 'Option 1'),
        createMockOption(2, 'Option 2'),
      ];
      const votes: Vote[] = [];
      
      const settings: CalendarSettings = {
        ...getDefaultCalendarSettings(),
        exportScope: 'final_only',
      };
      const context = { settings, language: 'de' as const };

      const ics = generatePollIcs(poll, options, votes, 'https://test.com', context);

      // Should have 1 event (the final option)
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(1);
    });
  });
});
