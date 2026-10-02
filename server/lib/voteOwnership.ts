import { timingSafeEqual } from 'node:crypto';

export const VOTE_AUTHORIZATION_REQUIRED = 'VOTE_AUTHORIZATION_REQUIRED';

type OwnedVote = { userId: number | null; voterEditToken: string | null };

// Email and display name identify a vote, but do not prove ownership.
export function ownsVote(vote: OwnedVote, userId: number | null, editToken?: unknown): boolean {
  if (userId != null && vote.userId === userId) return true;
  if (typeof editToken !== 'string' || !editToken || !vote.voterEditToken) return false;
  const supplied = Buffer.from(editToken);
  const expected = Buffer.from(vote.voterEditToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function assertVoteOwnership(votes: OwnedVote[], userId: number | null, editToken?: unknown) {
  if (!votes.every(vote => ownsVote(vote, userId, editToken))) {
    throw new Error(VOTE_AUTHORIZATION_REQUIRED);
  }
}
