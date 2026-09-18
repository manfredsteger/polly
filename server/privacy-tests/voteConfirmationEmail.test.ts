import { beforeEach, expect, it, vi } from 'vitest';
import type { EmailTemplate } from '@shared/schema';

vi.mock('../storage', () => ({
  storage: {
    getSetting: vi.fn().mockResolvedValue(undefined),
    getCustomizationSettings: vi.fn().mockResolvedValue({
      branding: { siteName: 'Polly', siteNameAccent: '', logoUrl: '' },
      theme: {},
    }),
  },
}));
import { EmailTemplateService } from '../services/emailTemplateService';

let service: EmailTemplateService;
const editLink = 'https://example.test/edit/private-token';
beforeEach(() => {
  service = new EmailTemplateService();
  vi.spyOn(service, 'getTemplate').mockResolvedValue({
    ...EmailTemplateService.getDefaultTemplate('vote_confirmation'),
    isDefault: true,
  } as EmailTemplate);
});

it.each(['withdraw', 'edit', undefined])('renders the correct HTML and plain-text action for %s', async action => {
  const result = await service.renderEmail('vote_confirmation', {
    voterName: 'Test', pollTitle: 'Test poll', editLink,
    resultsLink: 'https://example.test/poll/public', voteManagementAction: action,
  });
  const label = action === 'withdraw' ? 'Stimme zurückziehen' : 'Stimme bearbeiten';
  expect(result.html).toContain(`${label} →`);
  expect(result.text).toContain(`${label}: ${editLink}`);
  expect(result.html).toContain(`href="${editLink}"`);
  if (action === 'withdraw') {
    expect(result.html).toContain('Über diesen Link können Sie Ihre Stimme zurückziehen.');
    expect(result.html).not.toContain('Auswahl später ändern');
    expect(result.html).not.toContain('Stimme bearbeiten');
    expect(result.text).not.toContain('Stimme bearbeiten');
  }
});

it('omits the management section when no private link is provided', async () => {
  const result = await service.renderEmail('vote_confirmation', { voterName: 'Test', pollTitle: 'Test poll' });
  for (const content of [result.html, result.text]) {
    expect(content).not.toContain('Stimme bearbeiten');
    expect(content).not.toContain('Stimme zurückziehen');
  }
});

it.each([false, true])('renders a safe withdrawal email for organizer=%s without obsolete edit controls', async organizer => {
  const link = organizer ? 'https://example.test/admin/owner-token' : 'https://example.test/poll/public';
  const result = await service.renderVoteWithdrawalEmail('<b>Voter</b>', '<script>Poll</script>', link, organizer);
  expect(result.html).toContain('zurückgezogen');
  expect(result.html).not.toContain('<script>Poll</script>');
  expect(result.html).not.toContain('<b>Voter</b>');
  expect(result.html).toContain(link);
  expect(result.text).toContain(link);
  expect(result.text).toContain('nicht mehr gezählt');
  for (const content of [result.html, result.text]) {
    expect(content).not.toContain('/edit/');
    expect(content).not.toContain('Stimme bearbeiten');
    expect(content).not.toContain('Ergebnisse anzeigen');
    if (!organizer) expect(content).not.toContain('/admin/');
  }
});
