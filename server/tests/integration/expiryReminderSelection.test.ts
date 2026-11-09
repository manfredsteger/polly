import { afterEach, describe, expect, it } from 'vitest';
import { storage } from '../../storage';
import type { InsertPoll } from '@shared/schema';

describe('expiry reminder database selection', () => {
  const createdIds: string[] = [];
  afterEach(async () => {
    for (const id of createdIds.splice(0)) await storage.deletePoll(id);
  });

  async function create(overrides: Partial<InsertPoll> = {}) {
    const { poll } = await storage.createPoll({
      title: 'Test expiry reminder selection',
      type: 'survey',
      isTestData: true,
      enableExpiryReminder: true,
      expiryReminderHours: 24,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      ...overrides,
    }, []);
    createdIds.push(poll.id);
    return poll.id;
  }

  it('selects only active unsent reminders inside their own future expiry window', async () => {
    const due = await create();
    const shortWindow = await create({ expiryReminderHours: 1 });
    const disabled = await create({ enableExpiryReminder: false });
    const alreadySent = await create({ expiryReminderSent: true });
    const inactive = await create({ isActive: false });
    const noExpiry = await create({ expiresAt: null });
    const expired = await create({ expiresAt: new Date(Date.now() - 60 * 60 * 1000) });
    const tooEarly = await create({ expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) });
    const longWindow = await create({
      expiryReminderHours: 72, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    const selected = new Set((await storage.getPollsNeedingExpiryReminder()).map(p => p.id));
    expect(selected.has(due)).toBe(true);
    expect(selected.has(longWindow)).toBe(true);
    for (const excluded of [shortWindow, disabled, alreadySent, inactive, noExpiry, expired, tooEarly]) {
      expect(selected.has(excluded), `unexpected reminder for ${excluded}`).toBe(false);
    }
  });

  it('removes a successfully handled poll from future reminder checks without changing another poll', async () => {
    const sent = await create();
    const pending = await create();
    await storage.markExpiryReminderSent(sent);
    const selected = new Set((await storage.getPollsNeedingExpiryReminder()).map(p => p.id));
    expect(selected.has(sent)).toBe(false);
    expect(selected.has(pending)).toBe(true);
    expect((await storage.getPoll(sent))?.expiryReminderSent).toBe(true);
    expect((await storage.getPoll(pending))?.expiryReminderSent).toBe(false);
  });
});
