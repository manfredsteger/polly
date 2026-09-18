import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  data: undefined as any,
  mutations: [] as any[],
  toast: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
}));
vi.mock('wouter', () => ({ useParams: () => ({ editToken: 'private-token' }), useLocation: () => ['/', vi.fn()] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mocks.data, isLoading: false }),
  useQueryClient: () => ({ setQueryData: mocks.setQueryData, invalidateQueries: mocks.invalidateQueries }),
  useMutation: (options: unknown) => { mocks.mutations.push(options); return { isPending: false, mutate: vi.fn() }; },
}));
vi.mock('../../client/src/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../client/src/lib/queryClient', () => ({ apiRequest: vi.fn() }));
import VoteEditPage from '../../client/src/pages/vote-edit';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutations = [];
  mocks.data = {
    poll: {
      id: 'poll-1', title: 'Test', type: 'survey', isActive: true,
      allowVoteEdit: true, expiresAt: null, options: [{ id: 10, text: 'One' }],
    },
    votes: [{ optionId: 10, response: 'yes' }], voterName: 'Voter',
    voterEmail: 'voter@example.test', allowVoteWithdrawal: true,
  };
});
function render() { return renderToStaticMarkup(React.createElement(VoteEditPage)); }
function answerButtons(html: string) {
  return html.match(/<button\b[^>]*>common\.(?:yes|maybe|no)<\/button>/g) ?? [];
}

describe('Private edit page permissions', () => {
  it('shows read-only controls and a notice instead of Save when editing is disabled', () => {
    mocks.data.poll.allowVoteEdit = false;
    const html = render();
    expect(html).toContain('voteEdit.editingCurrentlyDisabled');
    expect(html).not.toContain('voteEdit.saveChanges');
    expect(answerButtons(html)).toHaveLength(3);
    expect(answerButtons(html).every(button => button.includes('disabled=""'))).toBe(true);
    const withdrawal = html.match(/<button[^>]*data-testid="button-withdraw-vote"[^>]*>/)?.[0];
    expect(withdrawal).toBeDefined();
    expect(withdrawal).not.toContain('disabled=""');
  });
  it('keeps simple-choice controls read-only as well', () => {
    mocks.data.poll.responseMode = 'simple';
    mocks.data.poll.allowVoteEdit = false;
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*data-testid="button-simple-toggle-10"/);
  });
  it('keeps editing available when allowed', () => {
    const html = render();
    expect(html).toContain('voteEdit.saveChanges');
    expect(html).not.toContain('voteEdit.editingCurrentlyDisabled');
    expect(answerButtons(html).every(button => !button.includes('disabled=""'))).toBe(true);
  });
  it.each(['closed', 'expired'])('blocks editing and withdrawal for a %s poll', state => {
    if (state === 'closed') mocks.data.poll.isActive = false;
    else mocks.data.poll.expiresAt = new Date(Date.now() - 1000).toISOString();
    const html = render();
    expect(html).toContain('voteEdit.pollClosedEditNotAllowed');
    expect(html).not.toContain('voteEdit.saveChanges');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="button-withdraw-vote"/);
  });
  it('hides withdrawal when the organizer disallows it', () => {
    mocks.data.allowVoteWithdrawal = false;
    expect(render()).not.toContain('button-withdraw-vote');
  });
  it.each(['VOTE_EDIT_NOT_ALLOWED', 'POLL_INACTIVE', 'POLL_EXPIRED'])('refreshes permissions and saved answers after %s', async code => {
    render();
    await mocks.mutations[0].onError(new Error(`403: ${JSON.stringify({ errorCode: code })}`));
    expect(mocks.setQueryData).toHaveBeenCalled();
    const updated = mocks.setQueryData.mock.calls[0][1](mocks.data);
    expect(updated.votes).toEqual(mocks.data.votes);
    if (code === 'VOTE_EDIT_NOT_ALLOWED') expect(updated.poll.allowVoteEdit).toBe(false);
    else expect(updated.poll.isActive).toBe(false);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/v1/votes/edit/private-token'] });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: code === 'VOTE_EDIT_NOT_ALLOWED' ? 'voteEdit.changesNotSavedDisabled' : 'voteEdit.changesNotSavedClosed',
    }));
  });
});
