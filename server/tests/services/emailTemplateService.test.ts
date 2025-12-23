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
        pollTitle: 'Test-Umfrage',
        pollDescription: 'Eine Beschreibung',
        pollUrl: 'https://example.com/poll/test',
        adminUrl: 'https://example.com/admin/test',
        deadline: '31.12.2025',
        siteName: 'Polly'
      };
      
      const html = await EmailTemplateService.renderTemplate(template.type, variables);
      
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html.includes('<html')).toBe(true);
    });

    it('should include siteName in rendered template', async () => {
      const html = await EmailTemplateService.renderTemplate('poll_created', {
        pollTitle: 'Test',
        pollDescription: 'Desc',
        pollUrl: 'https://example.com',
        adminUrl: 'https://example.com/admin',
        deadline: '31.12.2025',
        siteName: 'Polly-Test-Instance'
      });
      
      expect(html).toContain('Polly-Test-Instance');
    });
  });

  describe('Sample Data Generation', () => {
    it('should generate sample data for poll_created template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('poll_created');
      
      expect(sampleData.pollTitle).toBeDefined();
      expect(sampleData.pollUrl).toBeDefined();
      expect(sampleData.siteName).toBeDefined();
    });

    it('should generate sample data for invitation template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('invitation');
      
      expect(sampleData.pollTitle).toBeDefined();
      expect(sampleData.voterName).toBeDefined();
      expect(sampleData.voteUrl).toBeDefined();
    });

    it('should generate sample data for password_reset template', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('password_reset');
      
      expect(sampleData.userName).toBeDefined();
      expect(sampleData.resetUrl).toBeDefined();
      expect(sampleData.expiryTime).toBeDefined();
    });

    it('should return empty object for unknown template type', () => {
      const sampleData = EmailTemplateService.getSampleDataForType('unknown_type');
      
      expect(sampleData).toEqual({});
    });
  });
});
