import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { EmailTemplateService } from '../../services/emailTemplateService';
import { storage } from '../../storage';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Vorlagen-Service',
  description: 'Prüft Template-Rendering, Variable-Ersetzung und Default-Templates',
  severity: 'high' as const,
};

describe('EmailTemplateService', () => {
  describe('Default Templates', () => {
    it('should have all 8 template types defined', () => {
      const expectedTypes = [
        'poll_created',
        'invitation',
        'vote_confirmation',
        'reminder',
        'password_reset',
        'email_change',
        'password_changed',
        'test_report'
      ];

      for (const type of expectedTypes) {
        const template = EmailTemplateService.getDefaultTemplate(type);
        expect(template).toBeDefined();
        expect(template.type).toBe(type);
        expect(template.subject).toBeDefined();
        expect(template.jsonContent).toBeDefined();
      }
    });

    it('should have German subject lines for all templates', () => {
      const templates = EmailTemplateService.getAllDefaultTemplates();
      
      for (const template of templates) {
        expect(template.subject.length).toBeGreaterThan(0);
        expect(typeof template.subject).toBe('string');
      }
    });

    it('should have documented variables for each template', () => {
      const templates = EmailTemplateService.getAllDefaultTemplates();
      
      for (const template of templates) {
        expect(Array.isArray(template.variables)).toBe(true);
        expect(template.variables.length).toBeGreaterThan(0);
        
        for (const variable of template.variables) {
          expect(variable.key).toBeDefined();
          expect(variable.description).toBeDefined();
        }
      }
    });
  });

  describe('Variable Substitution', () => {
    it('should replace single variables in text', () => {
      const text = 'Hallo {{userName}}, willkommen!';
      const variables = { userName: 'Max' };
      
      const result = EmailTemplateService.substituteVariables(text, variables);
      
      expect(result).toBe('Hallo Max, willkommen!');
    });

    it('should replace multiple variables in text', () => {
      const text = '{{pollTitle}} von {{creatorName}} endet am {{deadline}}';
      const variables = {
        pollTitle: 'Teammeeting',
        creatorName: 'Anna',
        deadline: '25.12.2025'
      };
      
      const result = EmailTemplateService.substituteVariables(text, variables);
      
      expect(result).toBe('Teammeeting von Anna endet am 25.12.2025');
    });

    it('should leave unmatched variables as placeholders', () => {
      const text = 'Hallo {{userName}}, {{unknownVar}}!';
      const variables = { userName: 'Max' };
      
      const result = EmailTemplateService.substituteVariables(text, variables);
      
      expect(result).toBe('Hallo Max, {{unknownVar}}!');
    });

    it('should handle empty variables object', () => {
      const text = 'Hallo {{userName}}!';
      const variables = {};
      
      const result = EmailTemplateService.substituteVariables(text, variables);
      
      expect(result).toBe('Hallo {{userName}}!');
    });

    it('should handle special characters in variable values', () => {
      const text = 'Betreff: {{pollTitle}}';
      const variables = { pollTitle: '<script>alert("XSS")</script>' };
      
      const result = EmailTemplateService.substituteVariables(text, variables);
      
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('HTML Rendering', () => {
    it('should render JSON template to HTML', async () => {
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      const variables = {
        pollType: 'Terminumfrage',
        pollTitle: 'Test-Umfrage',
        publicLink: 'https://example.com/poll/test',
        adminLink: 'https://example.com/admin/test',
        siteName: 'Polly'
      };
      
      const html = await EmailTemplateService.renderTemplate(template.type, variables);
      
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html.includes('<html')).toBe(true);
    });

    it('should include siteName in rendered template', async () => {
      const html = await EmailTemplateService.renderTemplate('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
        siteName: 'Polly-Test-Instance'
      });
      
      expect(html).toContain('Polly-Test-Instance');
    });
  });

  describe('Sample Data Generation', () => {
    it('should generate sample data for poll_created template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('poll_created');
      
      expect(sampleData.pollTitle).toBeDefined();
      expect(sampleData.publicLink).toBeDefined();
      expect(sampleData.adminLink).toBeDefined();
      expect(sampleData.siteName).toBeDefined();
    });

    it('should generate sample data for invitation template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('invitation');
      
      expect(sampleData.pollTitle).toBeDefined();
      expect(sampleData.inviterName).toBeDefined();
      expect(sampleData.publicLink).toBeDefined();
    });

    it('should generate sample data for password_reset template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('password_reset');
      
      expect(sampleData.resetLink).toBeDefined();
      expect(sampleData.siteName).toBeDefined();
    });

    it('should generate sample data for email_change template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('email_change');
      
      expect(sampleData.oldEmail).toBeDefined();
      expect(sampleData.newEmail).toBeDefined();
      expect(sampleData.confirmLink).toBeDefined();
    });

    it('should return empty object for unknown template type', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('unknown_type');
      
      expect(sampleData).toEqual({});
    });
  });

  describe('Text to HTML Conversion', () => {
    it('should convert plain text paragraphs to HTML', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      
      // Save with textContentOverride
      const saved = await service.saveTemplate(
        'poll_created',
        template.jsonContent,
        'Test Subject',
        'Test Name',
        'Erster Absatz.\n\nZweiter Absatz.'
      );
      
      expect(saved.textContent).toBe('Erster Absatz.\n\nZweiter Absatz.');
      expect(saved.htmlContent).toContain('<p');
      expect(saved.htmlContent).toContain('Erster Absatz.');
      expect(saved.htmlContent).toContain('Zweiter Absatz.');
      expect(saved.isDefault).toBe(false);
    });

    it('should escape HTML entities in text content', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      
      const saved = await service.saveTemplate(
        'poll_created',
        template.jsonContent,
        'Test Subject',
        'Test Name',
        'Text mit <script>alert("XSS")</script>'
      );
      
      expect(saved.htmlContent).toContain('&lt;script&gt;');
      expect(saved.htmlContent).not.toContain('<script>');
    });

    it('should convert URLs to clickable links', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      
      const saved = await service.saveTemplate(
        'poll_created',
        template.jsonContent,
        'Test Subject',
        'Test Name',
        'Besuche https://example.com für mehr Info.'
      );
      
      expect(saved.htmlContent).toContain('<a href="https://example.com"');
      expect(saved.htmlContent).toContain('https://example.com</a>');
    });
  });

  describe('Customized Template Rendering (renderEmail)', () => {
    it('should use stored htmlContent for customized templates', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('invitation');
      
      // Save with custom text
      await service.saveTemplate(
        'invitation',
        template.jsonContent,
        'Einladung zu {{pollTitle}}',
        'Einladung',
        'Hallo {{userName}}, du wurdest eingeladen!'
      );
      
      // Render using instance method (includes header/footer)
      const result = await service.renderEmail('invitation', {
        pollTitle: 'Teammeeting',
        userName: 'Max',
        inviterName: 'Anna',
        publicLink: 'https://example.com/poll/123',
        siteName: 'Polly'
      });
      
      expect(result.html).toContain('Hallo Max, du wurdest eingeladen!');
      expect(result.subject).toContain('Teammeeting');
    });

    it('should include header with branding in rendered email', async () => {
      const service = new EmailTemplateService();
      const result = await service.renderEmail('poll_created', {
        pollType: 'Terminumfrage',
        pollTitle: 'Test-Umfrage',
        publicLink: 'https://example.com/poll/test',
        adminLink: 'https://example.com/admin/test',
        siteName: 'Test-Instance'
      });
      
      // Should have header table structure
      expect(result.html).toContain('<table');
      expect(result.html).toContain('Test-Instance');
    });

    it('should include footer in rendered email', async () => {
      const service = new EmailTemplateService();
      const result = await service.renderEmail('poll_created', {
        pollType: 'Terminumfrage',
        pollTitle: 'Test-Umfrage',
        publicLink: 'https://example.com/poll/test',
        adminLink: 'https://example.com/admin/test',
        siteName: 'MeineApp'
      });
      
      // Footer should have footer styling with border-top
      expect(result.html).toContain('border-top');
      // Text version should include siteName
      expect(result.text).toContain('MeineApp');
    });
  });

  describe('Template Reset', () => {
    it('should reset customized template to default', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('vote_confirmation');
      
      // First customize it
      await service.saveTemplate(
        'vote_confirmation',
        template.jsonContent,
        'Custom Subject',
        'Custom Name',
        'Custom content'
      );
      
      // Then reset
      const reset = await service.resetTemplate('vote_confirmation');
      
      expect(reset.isDefault).toBe(true);
      expect(reset.subject).toBe(template.subject);
    });
  });
});
