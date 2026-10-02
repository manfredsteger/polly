import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, tx } = vi.hoisted(() => {
  const tx = { execute: vi.fn(), select: vi.fn(), delete: vi.fn(), update: vi.fn(), insert: vi.fn() };
  const db = { select: vi.fn(), transaction: vi.fn() };
  return { db, tx };
});
vi.mock('../db', () => ({ db }));
import { DatabaseStorage } from '../storage';

const storedVote = { id: 1, optionId: 10, userId: null, voterEditToken: 'existing-secret', response: 'yes' };
const template = { voterName: 'Voter', voterEmail: 'voter@example.test', userId: null, isTestData: true };
const selection = { from: () => ({ where: async () => [storedVote] }) };

beforeEach(() => {
  vi.resetAllMocks();
  db.transaction.mockImplementation(async callback => callback(tx));
  tx.select.mockReturnValue(selection);
  tx.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [storedVote] }) }) });
});

describe('Storage checks on votes found after route authorization', () => {
  it('rejects simple-choice replacement when another request created votes before the lock', async () => {
    const storage = new DatabaseStorage();
    await expect(storage.replaceSimpleModeVotes({
      pollId: 'poll-1', lockIdentifier: template.voterEmail, voterEmail: template.voterEmail,
      voteItems: [{ optionId: 11, response: 'yes' }], maxSelections: 1, newVoteTemplate: template,
    })).rejects.toThrow('VOTE_AUTHORIZATION_REQUIRED');
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('allows simple-choice replacement with the existing private token', async () => {
    const storage = new DatabaseStorage();
    const result = await storage.replaceSimpleModeVotes({
      pollId: 'poll-1', lockIdentifier: 'existing-secret', editToken: 'existing-secret',
      voteItems: [{ optionId: 10, response: 'yes' }], maxSelections: 1, newVoteTemplate: template,
    });
    expect(tx.update).toHaveBeenCalled();
    expect(result.editToken).toBe('existing-secret');
  });

  it('blocks the schedule storage fallback from overwriting another guest vote', async () => {
    const storage = new DatabaseStorage();
    db.select.mockReturnValue({ from: () => ({ where: async () => [{ type: 'schedule' }] }) });
    vi.spyOn(storage, 'getUserVoteForOption').mockResolvedValue(storedVote as any);
    const update = vi.spyOn(storage, 'updateVote');
    await expect(storage.createVote({ ...template, pollId: 'poll-1', optionId: 10, response: 'no' }))
      .rejects.toThrow('VOTE_AUTHORIZATION_REQUIRED');
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks the organization storage fallback after its row lock', async () => {
    const storage = new DatabaseStorage();
    db.select.mockReturnValue({ from: () => ({ where: async () => [{ type: 'organization', allowMultipleSlots: true }] }) });
    tx.execute
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [{ id: 10, max_capacity: null }] }) // option row
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: null, voter_edit_token: 'existing-secret' }] });
    await expect(storage.createVote({ ...template, pollId: 'poll-1', optionId: 10, response: 'yes' }))
      .rejects.toThrow('VOTE_AUTHORIZATION_REQUIRED');
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
