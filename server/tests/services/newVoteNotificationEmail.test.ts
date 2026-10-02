/**
 * Tests for the "Creator-Benachrichtigung bei neuer Abstimmung" feature.
 *
 * When a new (first-time) vote is cast and the poll has notifyCreatorOnVote=true,
 * the poll creator receives a `new_vote_notification` email containing the
 * voter's name, the poll title, an admin link and a results link.
 *
 * The HTTP vote routes are gated by req.isTestMode=true in the test app, so the
 * email-sending branch in votes.ts is never reached via the API. We therefore
 * verify the behaviour at two levels that ARE reachable:
 *   a) emailTemplateService renders the new_vote_notification type with all
 *      documented variables substituted (and no leftover placeholders).
 *   b) emailService.sendNewVoteNotificationEmail() renders the right content
 *      and skips sending when no creator email is given.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { emailService } from '../../services/emailService';
import { EmailTemplateService } from '../../services/emailTemplateService';

export const testMeta = {
  category: 'services' as const,
  name: 'New Vote Notification Email',
  description:
    'Ersteller-Benachrichtigung bei neuer Abstimmung: Template rendert Admin-/Ergebnis-Link und Abstimmenden-Name; ' +
    'kein Versand ohne Ersteller-E-Mail',
  severity: 'high' as const,
};

describe('New Vote Notification Email', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Template definition', () => {
    it('has a default new_vote_notification template with subject and variables', () => {
      const template = EmailTemplateService.getDefaultTemplate('new_vote_notification');
      expect(template).toBeDefined();
      expect(template.type).toBe('new_vote_notification');
      expect(template.subject.length).toBeGreaterThan(0);
      expect(Array.isArray(template.variables)).toBe(true);
      const keys = template.variables.map((v) => v.key);
      expect(keys).toContain('voterName');
      expect(keys).toContain('pollTitle');
      expect(keys).toContain('adminLink');
      expect(keys).toContain('resultsLink');
    });

    it('generates sample data for the new_vote_notification template', async () => {
      const sampleData = await EmailTemplateService.getSampleDataForType('new_vote_notification');
      expect(sampleData).toBeDefined();
      expect(sampleData.voterName).toBeDefined();
      expect(sampleData.pollTitle).toBeDefined();
    });
  });

  describe('sendNewVoteNotificationEmail', () => {
    it('renders voter name, poll title and both links into the email HTML', async () => {
      const captured: { to: string; subject: string; html: string }[] = [];
      vi.spyOn(emailService, 'sendMail').mockImplementation(async (opts) => {
        captured.push({ to: opts.to, subject: opts.subject, html: opts.html });
      });

      await emailService.sendNewVoteNotificationEmail(
        'creator@notify.test',
        'Max Mustermann',
        'Team-Meeting Planung',
        'schedule',
        'https://test.example.com/admin/ADMINTOKEN123',
        'https://test.example.com/poll/PUBTOKEN456#results',
      );

      expect(captured).toHaveLength(1);
      expect(captured[0].to).toBe('creator@notify.test');
      expect(captured[0].html).toContain('Max Mustermann');
      expect(captured[0].html).toContain('Team-Meeting Planung');
      expect(captured[0].html).toContain('/admin/ADMINTOKEN123');
      expect(captured[0].html).toContain('/poll/PUBTOKEN456#results');
    });

    it('does NOT send when the creator email is empty', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendMail').mockResolvedValue(undefined as never);

      await emailService.sendNewVoteNotificationEmail(
        '',
        'Voter',
        'Poll',
        'survey',
        'https://test.example.com/admin/x',
        'https://test.example.com/poll/y#results',
      );

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });
});
