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
