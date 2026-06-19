import { storage } from '../storage';
import { emailService } from './emailService';
import { getBaseUrl } from '../utils/baseUrl';

const CHECK_INTERVAL_MS = 60 * 1000; // every minute
const AUTO_EXPIRED_NOTIFICATION_TYPE = 'auto_expired_poll_ended';

async function runExpiryReminderCheck(): Promise<void> {
  try {
    const pollsToRemind = await storage.getPollsNeedingExpiryReminder();
    if (pollsToRemind.length === 0) return;

    const baseUrl = getBaseUrl();

    for (const poll of pollsToRemind) {
      try {
        const fullPoll = await storage.getPoll(poll.id);
        if (!fullPoll) {
          await storage.markExpiryReminderSent(poll.id);
          continue;
        }

        const voterEmails = await storage.getVoterEmailsForPoll(fullPoll.id);
        if (voterEmails.length === 0) {
          await storage.markExpiryReminderSent(poll.id);
          continue;
        }

        let senderName = 'Jemand';
        if (poll.userId) {
          const user = await storage.getUser(poll.userId);
          if (user) senderName = user.name || user.username || 'Jemand';
        }

        const pollLink = `${baseUrl}/poll/${fullPoll.publicToken}`;
        const expiresAt = fullPoll.expiresAt ? new Date(fullPoll.expiresAt) : null;
        const optionMap = new Map<number, string>(fullPoll.options.map((opt) => [opt.id, opt.text]));
        const personalizedReminders = voterEmails.map((email) => ({
          email,
          selectedOptions: fullPoll.votes
            .filter((vote) => vote.voterEmail?.toLowerCase() === email.toLowerCase() && vote.response === 'yes')
            .map((vote) => optionMap.get(vote.optionId) || '')
            .filter(Boolean),
        }));

        const results = await emailService.sendPersonalizedReminders(
          personalizedReminders,
          fullPoll.title,
          senderName,
          pollLink,
          expiresAt ? expiresAt.toISOString() : undefined
        );

        await storage.markExpiryReminderSent(poll.id);
        console.log(`[PollScheduler] Expiry reminder sent for poll "${fullPoll.title}" (${results.sent}/${voterEmails.length} emails)`);
      } catch (err) {
        console.error(`[PollScheduler] Error processing expiry reminder for poll ${poll.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[PollScheduler] Error in expiry reminder check:', err);
  }
}

async function runExpiredPollDeactivation(): Promise<void> {
  try {
    const deactivated = await storage.deactivateExpiredPolls();
    if (deactivated.length > 0) {
      console.log(`[PollScheduler] Deactivated ${deactivated.length} expired poll(s): ${deactivated.map(p => `"${p.title}"`).join(', ')}`);
      const baseUrl = getBaseUrl();
      for (const poll of deactivated) {
        try {
          const pollLink = `${baseUrl}/poll/${poll.publicToken}`;
          const voterEmails = await storage.getVoterEmailsForPoll(poll.id);
          const recipients = new Set<string>(voterEmails.filter((e) => !!e));
          if (poll.creatorEmail) {
            recipients.add(poll.creatorEmail);
          }

          if (recipients.size === 0) {
            continue;
          }

          const notificationLogs = await storage.getNotificationLogs(poll.id);
          const alreadyNotified = new Set(
            notificationLogs
              .filter((log) => log.type === AUTO_EXPIRED_NOTIFICATION_TYPE && log.success)
              .map((log) => log.recipientEmail.toLowerCase())
          );

          const recipientsToNotify = [...recipients].filter(
            (email) => !alreadyNotified.has(email.toLowerCase())
          );

          if (recipientsToNotify.length === 0) {
            continue;
          }

          const pollType = poll.type === 'organization' ? 'organization' : 'survey';
          await emailService.sendPollEndedEmails(
            recipientsToNotify,
            poll.title,
            pollLink,
            poll.resultsPublic ?? true,
            pollType
          );

          for (const recipientEmail of recipientsToNotify) {
            await storage.logNotification({
              pollId: poll.id,
              type: AUTO_EXPIRED_NOTIFICATION_TYPE,
              recipientEmail,
              sentBy: 'system',
              sentByGuest: false,
              success: true,
            });
          }

          console.log(
            `[PollScheduler] Sent auto-expiry poll-ended notifications for "${poll.title}" (${recipientsToNotify.length} recipient(s))`
          );
        } catch (emailError) {
          console.error(`[PollScheduler] Failed auto-expiry notifications for poll ${poll.id}:`, emailError);
        }
      }
    }
  } catch (err) {
    console.error('[PollScheduler] Error in expired poll deactivation:', err);
  }
}

async function runAll(): Promise<void> {
  await runExpiredPollDeactivation();
  await runExpiryReminderCheck();
}

export function startPollScheduler(): void {
  // Run once immediately on startup to catch anything missed while server was down
  runAll().catch(err => console.error('[PollScheduler] Startup run failed:', err));

  setInterval(() => {
    runAll().catch(err => console.error('[PollScheduler] Interval run failed:', err));
  }, CHECK_INTERVAL_MS);

  console.log('[PollScheduler] Started (interval: 1 min)');
}
