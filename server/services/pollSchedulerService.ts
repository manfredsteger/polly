import { storage } from '../storage';
import { emailService } from './emailService';
import { getBaseUrl } from '../utils/baseUrl';

const CHECK_INTERVAL_MS = 60 * 1000; // every minute

async function runExpiryReminderCheck(): Promise<void> {
  try {
    const pollsToRemind = await storage.getPollsNeedingExpiryReminder();
    if (pollsToRemind.length === 0) return;

    const baseUrl = getBaseUrl();

    for (const poll of pollsToRemind) {
      try {
        const voterEmails = await storage.getVoterEmailsForPoll(poll.id);
        if (voterEmails.length === 0) {
          await storage.markExpiryReminderSent(poll.id);
          continue;
        }

        let senderName = 'Jemand';
        if (poll.userId) {
          const user = await storage.getUser(poll.userId);
          if (user) senderName = user.name || user.username || 'Jemand';
        }

        const pollLink = `${baseUrl}/poll/${poll.publicToken}`;
        const expiresAt = poll.expiresAt ? new Date(poll.expiresAt) : null;

        let sent = 0;
        for (const email of voterEmails) {
          try {
            await emailService.sendReminderEmail(email, senderName, poll.title, pollLink, expiresAt);
            sent++;
          } catch (err) {
            console.error(`[PollScheduler] Failed to send expiry reminder to ${email} for poll ${poll.id}:`, err);
          }
        }

        await storage.markExpiryReminderSent(poll.id);
        console.log(`[PollScheduler] Expiry reminder sent for poll "${poll.title}" (${sent}/${voterEmails.length} emails)`);
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
