import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ data: undefined as any, authenticated: false }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === null ? mocks.data : initial) };
});
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()], Link: ({ children }: any) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../client/src/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../client/src/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: mocks.authenticated }) }));
import VoteSuccess from '../../client/src/pages/vote-success';

beforeEach(() => {
  mocks.authenticated = false;
  mocks.data = {
    poll: { title: 'Test' }, publicToken: 'public-token', voterName: 'Guest', voterEmail: 'guest@example.test',
    // Even legacy browser data must not display guest credentials.
    voterEditToken: 'legacy-private-secret', managementLinkByEmail: true, allowVoteEdit: true, confirmationEmailStatus: 'sent',
  };
  vi.stubGlobal('window', { location: { origin: 'https://poll.example.test' } });
});
afterEach(() => vi.unstubAllGlobals());
const render = () => renderToStaticMarkup(React.createElement(VoteSuccess));

describe('Guest success page', () => {
  it('shows email guidance, never guest edit controls or the private link', () => {
    const html = render();
    expect(html.split('voteSuccess.guestManagementEmailSent')).toHaveLength(2);
    expect(html).not.toContain('voteSuccess.checkSpamHint');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('legacy-private-secret');
    expect(html).not.toContain('voteSuccess.editVote');
    expect(html).not.toContain('voteSuccess.showLinks');
  });
  it.each(['failed', 'unavailable', 'skipped'])('does not claim email success when status is %s', status => {
    mocks.data.confirmationEmailStatus = status;
    const html = render();
    expect(html).toContain('voteSuccess.guestManagementEmailFailed');
    expect(html).not.toContain('voteSuccess.guestManagementEmailSent');
    expect(html).not.toContain('voteSuccess.checkSpamHint');
  });
  it.each([false, undefined])('keeps the original email hint when editing permission is %s, including withdrawal-only polls', permission => {
    mocks.data.allowVoteEdit = permission;
    const html = render();
    expect(html).toContain('voteSuccess.checkSpamHint');
    expect(html).not.toContain('voteSuccess.guestManagementEmailSent');
    expect(html).not.toContain('role="status"');
  });
  it('keeps the original hint when neither management action is allowed', () => {
    mocks.data.allowVoteEdit = false;
    mocks.data.managementLinkByEmail = false;
    expect(render()).toContain('voteSuccess.checkSpamHint');
    expect(render()).not.toContain('voteSuccess.guestManagementEmailSent');
  });
  it('explains suppression by the email cooldown', () => {
    mocks.data.confirmationEmailStatus = 'cooldown';
    expect(render()).toContain('voteSuccess.guestManagementEmailCooldown');
  });
  it('preserves private management controls for authenticated owners', () => {
    mocks.authenticated = true;
    mocks.data.managementLinkByEmail = false;
    const html = render();
    expect(html).toContain('voteSuccess.editVote');
    expect(html).toContain('voteSuccess.checkSpamHint');
    expect(html).not.toContain('voteSuccess.guestManagementEmailSent');
  });
  it('does not give a logged-in submitter controls for a guest identity', () => {
    mocks.authenticated = true;
    expect(render()).not.toContain('voteSuccess.editVote');
  });
});
