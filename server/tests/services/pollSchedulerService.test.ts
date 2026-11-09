import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { runExpiryReminderCheck, runExpiredPollDeactivation, startPollScheduler } from '../../services/pollSchedulerService';

// All I/O is stubbed: these scenarios must never deliver real emails.
const poll = (id = 'reminder-one', extra = {}) => ({
  id, title: 'Team lunch', publicToken: 'public-token', userId: 42,
  expiresAt: new Date('2026-11-01T12:00:00Z'), type: 'survey',
  options: [{ id: 1, text: 'Monday' }, { id: 2, text: 'Tuesday' }],
  votes: [
    { voterEmail: 'ADA@example.test', optionId: 1, response: 'yes' },
    { voterEmail: 'ada@example.test', optionId: 2, response: 'no' },
    { voterEmail: 'ada@example.test', optionId: 999, response: 'yes' },
    { voterEmail: null, optionId: 2, response: 'yes' },
    { voterEmail: 'bob@example.test', optionId: 2, response: 'yes' },
  ],
  ...extra,
}) as any;

describe('scheduled poll notifications', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://polls.example.test');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getPollsNeedingExpiryReminder').mockResolvedValue([poll()]);
    vi.spyOn(storage, 'getPoll').mockResolvedValue(poll());
    vi.spyOn(storage, 'getVoterEmailsForPoll').mockResolvedValue(['ada@example.test', 'bob@example.test']);
    vi.spyOn(storage, 'getUser').mockResolvedValue({ name: 'Organizer', username: 'owner' } as any);
    vi.spyOn(storage, 'markExpiryReminderSent').mockResolvedValue();
    vi.spyOn(storage, 'deactivateExpiredPolls').mockResolvedValue([]);
    vi.spyOn(storage, 'getNotificationLogs').mockResolvedValue([]);
    vi.spyOn(storage, 'logNotification').mockResolvedValue({} as any);
    vi.spyOn(emailService, 'sendPersonalizedReminders').mockResolvedValue({ sent: 2, failed: 0 } as any);
    vi.spyOn(emailService, 'sendPollEndedEmails').mockResolvedValue(undefined as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sends only each recipient’s yes selections, matching email case-insensitively', async () => {
    await runExpiryReminderCheck();
    expect(emailService.sendPersonalizedReminders).toHaveBeenCalledExactlyOnceWith(
      [{ email: 'ada@example.test', selectedOptions: ['Monday'] },
        { email: 'bob@example.test', selectedOptions: ['Tuesday'] }],
      'Team lunch', 'Organizer', 'https://polls.example.test/poll/public-token', '2026-11-01T12:00:00.000Z',
    );
    expect(storage.markExpiryReminderSent).toHaveBeenCalledWith('reminder-one');
  });
  it('does no work when nothing is due', async () => {
    vi.mocked(storage.getPollsNeedingExpiryReminder).mockResolvedValue([]);
    await runExpiryReminderCheck();
    expect(storage.getPoll).not.toHaveBeenCalled();
    expect(emailService.sendPersonalizedReminders).not.toHaveBeenCalled();
  });
  it.each(['missing poll', 'no voters'])('marks %s handled without sending', async (scenario) => {
    if (scenario === 'missing poll') vi.mocked(storage.getPoll).mockResolvedValue(undefined);
    else vi.mocked(storage.getVoterEmailsForPoll).mockResolvedValue([]);
    await runExpiryReminderCheck();
    expect(storage.markExpiryReminderSent).toHaveBeenCalledWith('reminder-one');
    expect(emailService.sendPersonalizedReminders).not.toHaveBeenCalled();
  });
  it.each([
    [{ username: 'owner' }, 42, 'owner'],
    [{}, 42, ''],
    [undefined, 42, ''],
    [undefined, null, ''],
  ])('handles missing organizer profile/name %#', async (user, userId, sender) => {
    vi.mocked(storage.getUser).mockResolvedValue(user as any);
    vi.mocked(storage.getPollsNeedingExpiryReminder).mockResolvedValue([poll('reminder-one', { userId })]);
    vi.mocked(storage.getPoll).mockResolvedValue(poll('reminder-one', { expiresAt: null }));
    await runExpiryReminderCheck();
    expect(emailService.sendPersonalizedReminders).toHaveBeenCalledWith(
      expect.any(Array), 'Team lunch', sender, expect.any(String), undefined,
    );
    if (!userId) expect(storage.getUser).not.toHaveBeenCalled();
  });
  it('leaves a failed send retryable and continues with the next poll', async () => {
    vi.mocked(storage.getPollsNeedingExpiryReminder).mockResolvedValue([poll(), poll('second')]);
    vi.mocked(emailService.sendPersonalizedReminders).mockRejectedValueOnce(new Error('SMTP unavailable'));
    await runExpiryReminderCheck();
    expect(storage.markExpiryReminderSent).toHaveBeenCalledExactlyOnceWith('second');
    expect(emailService.sendPersonalizedReminders).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalled();
  });
  it('contains selection failures without sending', async () => {
    vi.mocked(storage.getPollsNeedingExpiryReminder).mockRejectedValue(new Error('DB unavailable'));
    await expect(runExpiryReminderCheck()).resolves.toBeUndefined();
    expect(emailService.sendPersonalizedReminders).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it('notifies voters and creator once, excluding successful previous notifications', async () => {
    vi.mocked(storage.deactivateExpiredPolls).mockResolvedValue([
      poll('ended', { creatorEmail: 'bob@example.test', resultsPublic: false, type: 'organization' }),
    ]);
    vi.mocked(storage.getNotificationLogs).mockResolvedValue([
      { type: 'auto_expired_poll_ended', success: true, recipientEmail: 'ADA@example.test' },
      { type: 'auto_expired_poll_ended', success: false, recipientEmail: 'bob@example.test' },
      { type: 'manual_reminder', success: true, recipientEmail: 'bob@example.test' },
    ] as any);
    await runExpiredPollDeactivation();
    expect(emailService.sendPollEndedEmails).toHaveBeenCalledExactlyOnceWith(
      ['bob@example.test'], 'Team lunch', 'https://polls.example.test/poll/public-token', false, 'organization',
    );
    expect(storage.logNotification).toHaveBeenCalledExactlyOnceWith({
      pollId: 'ended', type: 'auto_expired_poll_ended', recipientEmail: 'bob@example.test',
      sentBy: 'system', sentByGuest: false, success: true,
    });
  });
  it('defaults results visibility and survey type and adds a creator who did not vote', async () => {
    vi.mocked(storage.deactivateExpiredPolls).mockResolvedValue([poll('ended', { creatorEmail: 'owner@example.test' })]);
    await runExpiredPollDeactivation();
    expect(emailService.sendPollEndedEmails).toHaveBeenCalledWith(
      ['ada@example.test', 'bob@example.test', 'owner@example.test'], 'Team lunch', expect.any(String), true, 'survey',
    );
    expect(storage.logNotification).toHaveBeenCalledTimes(3);
  });
  it.each(['no recipients', 'already notified'])('does not send when %s', async (scenario) => {
    vi.mocked(storage.deactivateExpiredPolls).mockResolvedValue([poll()]);
    if (scenario === 'no recipients') vi.mocked(storage.getVoterEmailsForPoll).mockResolvedValue(['']);
    else vi.mocked(storage.getNotificationLogs).mockResolvedValue(
      ['ada@example.test', 'bob@example.test'].map(recipientEmail =>
        ({ recipientEmail, type: 'auto_expired_poll_ended', success: true })) as any,
    );
    await runExpiredPollDeactivation();
    expect(emailService.sendPollEndedEmails).not.toHaveBeenCalled();
    expect(storage.logNotification).not.toHaveBeenCalled();
  });
  it('does not log unsuccessful sends and continues after a per-poll error', async () => {
    vi.mocked(storage.deactivateExpiredPolls).mockResolvedValue([poll(), poll('second')]);
    vi.mocked(emailService.sendPollEndedEmails).mockRejectedValueOnce(new Error('SMTP down'));
    await runExpiredPollDeactivation();
    expect(storage.logNotification).toHaveBeenCalledTimes(2);
    expect(vi.mocked(storage.logNotification).mock.calls.every(([log]) => log.pollId === 'second')).toBe(true);
  });
  it('contains deactivation failures', async () => {
    vi.mocked(storage.deactivateExpiredPolls).mockRejectedValue(new Error('DB down'));
    await expect(runExpiredPollDeactivation()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    expect(emailService.sendPollEndedEmails).not.toHaveBeenCalled();
  });
  it('checks immediately at startup and again every minute', async () => {
    vi.useFakeTimers();
    vi.mocked(storage.getPollsNeedingExpiryReminder).mockResolvedValue([]);
    startPollScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.deactivateExpiredPolls).toHaveBeenCalledTimes(1);
    expect(storage.getPollsNeedingExpiryReminder).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(storage.deactivateExpiredPolls).toHaveBeenCalledTimes(2);
    expect(storage.getPollsNeedingExpiryReminder).toHaveBeenCalledTimes(2);
  });
});
