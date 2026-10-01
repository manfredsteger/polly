import type { PollWithOptions, Vote } from '@shared/schema';

// Explicit allowlists keep newly added database fields private by default.
function pick<T, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;
}

export function publicVote(vote: Vote) {
  return pick(vote, [
    'id', 'pollId', 'optionId', 'voterName', 'userId', 'response',
    'comment', 'freeTextAnswer', 'createdAt', 'updatedAt',
  ]);
}

export function safePollCreator(poll: PollWithOptions) {
  return poll.user ? pick(poll.user, ['name', 'username']) : undefined;
}

export function publicPollResponse(poll: PollWithOptions) {
  const publicFields = pick(poll, [
    'id', 'title', 'description', 'type', 'userId', 'publicToken',
    'isActive', 'isAnonymous', 'allowAnonymousVoting', 'allowMultipleSlots',
    'maxSlotsPerUser', 'allowVoteEdit', 'allowVoteWithdrawal', 'resultsPublic',
    'allowMaybe', 'responseMode', 'maxSelections', 'expiresAt',
    'videoConferenceUrl', 'closingMessage', 'finalOptionId', 'createdAt', 'updatedAt',
  ]);
  return {
    ...publicFields,
    options: poll.options.map(option => pick(option, [
      'id', 'pollId', 'text', 'imageUrl', 'altText', 'startTime', 'endTime',
      'maxCapacity', 'isFreeText', 'order', 'createdAt',
    ])),
    user: safePollCreator(poll),
    votes: poll.resultsPublic ? poll.votes.map(publicVote) : [],
    // Slot availability is needed to book organization polls even when
    // participant identities and answers are private.
    ...(poll.type === 'organization' ? {
      slotCounts: Object.fromEntries(poll.options.map(option => [
        option.id,
        poll.votes.filter(vote => vote.optionId === option.id && vote.response === 'yes').length,
      ])),
    } : {}),
  };
}
