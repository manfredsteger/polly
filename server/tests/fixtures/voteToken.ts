import { storage } from '../../storage';

// Database-backed tests obtain private links from fixtures, never from the
// guest HTTP response. Production guests receive these credentials by email.
export async function getSubmittedVoteToken(response: { body: { votes?: Array<{ id: number; pollId: string }> } }): Promise<string> {
  const submitted = response.body.votes?.[0];
  if (!submitted) throw new Error('Test submission did not return a vote');
  const poll = await storage.getPoll(submitted.pollId);
  const token = poll?.votes.find(vote => vote.id === submitted.id)?.voterEditToken;
  if (!token) throw new Error('Test vote has no persisted private token');
  return token;
}
