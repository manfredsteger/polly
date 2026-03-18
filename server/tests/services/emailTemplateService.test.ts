import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { EmailTemplateService, jsonToHtml, ensureButtonTextContrast } from '../../services/emailTemplateService';
import type { EmailTheme } from '../../services/emailTemplateService';
import { storage } from '../../storage';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Vorlagen-Service',
  description: 'Prüft Template-Rendering, Variable-Ersetzung und Default-Templates',
  severity: 'high' as const,
};

describe('EmailTemplateService', () => {
  let origCustomization: any;
  let origTheme: any;
  const modifiedTemplateTypes = [
    'poll_created', 'invitation', 'vote_confirmation',
    'reminder', 'password_reset',
  ] as const;
  const origTemplates: Record<string, any> = {};

  beforeAll(async () => {
    origCustomization = await storage.getCustomizationSettings();
    const service = new EmailTemplateService();
    origTheme = await service.getEmailTheme();
    for (const type of modifiedTemplateTypes) {
      origTemplates[type] = await service.getTemplate(type);
    }
  });

  afterAll(async () => {
    await storage.setCustomizationSettings(origCustomization);
    const service = new EmailTemplateService();
    await service.setEmailTheme(origTheme);
    for (const type of modifiedTemplateTypes) {
      const orig = origTemplates[type];
      if (orig && !orig.isDefault) {
        await service.saveTemplate(
          type,
          orig.jsonContent,
          orig.subject,
          orig.name,
          orig.textContent
        );
      } else {
        await service.resetTemplate(type);
      }
    }
  });
  describe('Default Templates', () => {
    it('should have all 9 template types defined', () => {
      const expectedTypes = [
        'poll_created',
        'invitation',
        'vote_confirmation',
        'reminder',
        'password_reset',
        'email_change',
        'password_changed',
        'test_report',
        'welcome'
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
      expect(html.includes('<div')).toBe(true);
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
      
      expect(result.html).toContain('<table');
      expect(result.html).toContain('email-header');
      expect(result.html).toContain('email-footer');
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
      
      expect(result.html).toContain('border-top');
      expect(result.html).toContain('email-footer');
      expect(result.html).toContain('Datenschutz');
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

  describe('End-to-End: Customized Template Email Sending', () => {
    it('should render customized template content when preparing email for sending', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('reminder');
      
      // Step 1: Customize the template with new text content
      const customText = 'WICHTIG: {{senderName}} erinnert Sie an die Umfrage "{{pollTitle}}".\n\nBitte stimmen Sie jetzt ab: {{pollLink}}';
      await service.saveTemplate(
        'reminder',
        template.jsonContent,
        'Dringende Erinnerung: {{pollTitle}}',
        'Erinnerung',
        customText
      );
      
      // Step 2: Render the email (simulates what happens before sending)
      const rendered = await service.renderEmail('reminder', {
        senderName: 'Max Mustermann',
        pollTitle: 'Teammeeting Dezember',
        pollLink: 'https://polly.example.com/poll/abc123',
        siteName: 'Polly'
      });
      
      // Step 3: Verify the rendered email contains customized content
      expect(rendered.subject).toBe('Dringende Erinnerung: Teammeeting Dezember');
      expect(rendered.html).toContain('WICHTIG: Max Mustermann erinnert Sie an die Umfrage');
      expect(rendered.html).toContain('Teammeeting Dezember');
      expect(rendered.html).toContain('https://polly.example.com/poll/abc123');
      
      // Step 4: Verify text version also has customized content
      expect(rendered.text).toContain('Max Mustermann');
      expect(rendered.text).toContain('Teammeeting Dezember');
    });

    it('should include header branding and footer in customized email', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('password_reset');
      
      // Customize template
      await service.saveTemplate(
        'password_reset',
        template.jsonContent,
        'Passwort für {{siteName}} zurücksetzen',
        'Passwort Reset',
        'Klicken Sie hier um Ihr Passwort zurückzusetzen: {{resetLink}}'
      );
      
      // Render email
      const rendered = await service.renderEmail('password_reset', {
        resetLink: 'https://polly.example.com/reset/xyz789',
        siteName: 'MeineOrganisation'
      });
      
      // Should have subject with substituted variables
      expect(rendered.subject).toBe('Passwort für MeineOrganisation zurücksetzen');
      
      // Should have customized body content
      expect(rendered.html).toContain('Klicken Sie hier um Ihr Passwort zurückzusetzen');
      expect(rendered.html).toContain('https://polly.example.com/reset/xyz789');
      
      // Should have header structure (table for email layout)
      expect(rendered.html).toContain('<table');
      
      // Should have footer with border-top
      expect(rendered.html).toContain('border-top');
    });

    it('should preserve customized content across save and render cycles', async () => {
      const service = new EmailTemplateService();
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      
      const customContent = 'Ihre neue Umfrage "{{pollTitle}}" ist bereit!\n\nTeilnehmer-Link: {{publicLink}}\nAdmin-Link: {{adminLink}}';
      
      // Save customized template
      await service.saveTemplate(
        'poll_created',
        template.jsonContent,
        'Neue {{pollType}}: {{pollTitle}}',
        'Umfrage erstellt',
        customContent
      );
      
      // First render
      const firstRender = await service.renderEmail('poll_created', {
        pollType: 'Terminumfrage',
        pollTitle: 'Weihnachtsfeier',
        publicLink: 'https://polly.example.com/poll/xmas',
        adminLink: 'https://polly.example.com/admin/xmas',
        siteName: 'Polly'
      });
      
      // Second render (should be consistent)
      const secondRender = await service.renderEmail('poll_created', {
        pollType: 'Terminumfrage',
        pollTitle: 'Weihnachtsfeier',
        publicLink: 'https://polly.example.com/poll/xmas',
        adminLink: 'https://polly.example.com/admin/xmas',
        siteName: 'Polly'
      });
      
      // Both renders should have identical HTML
      expect(firstRender.html).toBe(secondRender.html);
      expect(firstRender.subject).toBe(secondRender.subject);
      
      // Should contain customized content
      expect(firstRender.html).toContain('Ihre neue Umfrage');
      expect(firstRender.html).toContain('Weihnachtsfeier');
      expect(firstRender.subject).toContain('Neue Terminumfrage: Weihnachtsfeier');
    });
  });

  describe('Email Theme Import and Validation', () => {
    let savedCustomization: any;
    beforeEach(async () => {
      savedCustomization = await storage.getCustomizationSettings();
    });
    afterEach(async () => {
      await storage.setCustomizationSettings(savedCustomization);
    });

    it('should extract valid theme colors from emailbuilder.js JSON', () => {
      const service = new EmailTemplateService();
      const emailBuilderJson = {
        root: {
          type: 'EmailLayout',
          data: {
            backdropColor: '#F0F0F0',
            canvasColor: '#FFFFFF',
            textColor: '#222222',
            fontFamily: 'Helvetica, Arial, sans-serif',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(emailBuilderJson);
      
      expect(theme.backdropColor).toBe('#F0F0F0');
      expect(theme.canvasColor).toBe('#FFFFFF');
      expect(theme.textColor).toBe('#222222');
      expect(theme.fontFamily).toBe('Helvetica, Arial, sans-serif');
    });

    it('should extract button styles from blocks', () => {
      const service = new EmailTemplateService();
      const emailBuilderJson = {
        root: {
          type: 'EmailLayout',
          data: {
            backdropColor: '#F5F5F5',
            childrenIds: ['button-1']
          }
        },
        'button-1': {
          type: 'Button',
          data: {
            style: {
              backgroundColor: '#0066CC',
              color: '#FFFFFF',
              borderRadius: 8
            }
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(emailBuilderJson);
      
      expect(theme.buttonBackgroundColor).toBe('#0066CC');
      expect(theme.buttonTextColor).toBe('#FFFFFF');
      expect(theme.buttonBorderRadius).toBe(8);
      expect(theme.linkColor).toBe('#0066CC');
    });

    it('should reject malicious color values with script injection', () => {
      const service = new EmailTemplateService();
      const maliciousJson = {
        root: {
          type: 'EmailLayout',
          data: {
            backdropColor: '<script>alert("xss")</script>',
            canvasColor: 'javascript:alert(1)',
            textColor: '#333333',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(maliciousJson);
      
      expect(theme.backdropColor).toBeUndefined();
      expect(theme.canvasColor).toBeUndefined();
      expect(theme.textColor).toBe('#333333');
    });

    it('should reject malicious font family with attribute injection', () => {
      const service = new EmailTemplateService();
      const maliciousJson = {
        root: {
          type: 'EmailLayout',
          data: {
            fontFamily: 'Arial" onmouseover="alert(1)',
            backdropColor: '#F5F5F5',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(maliciousJson);
      
      expect(theme.fontFamily).toBeUndefined();
      expect(theme.backdropColor).toBe('#F5F5F5');
    });

    it('should reject font family with semicolons and braces', () => {
      const service = new EmailTemplateService();
      const maliciousJson = {
        root: {
          type: 'EmailLayout',
          data: {
            fontFamily: 'Arial; color: red; background: url(evil.js)',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(maliciousJson);
      
      expect(theme.fontFamily).toBeUndefined();
    });

    it('should accept valid rgb and rgba colors', () => {
      const service = new EmailTemplateService();
      const jsonWithRgb = {
        root: {
          type: 'EmailLayout',
          data: {
            backdropColor: 'rgb(240, 240, 240)',
            canvasColor: 'rgba(255, 255, 255, 0.9)',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(jsonWithRgb);
      
      expect(theme.backdropColor).toBe('rgb(240, 240, 240)');
      expect(theme.canvasColor).toBe('rgba(255, 255, 255, 0.9)');
    });

    it('should accept named colors', () => {
      const service = new EmailTemplateService();
      const jsonWithNamedColors = {
        root: {
          type: 'EmailLayout',
          data: {
            backdropColor: 'white',
            canvasColor: 'transparent',
            textColor: 'black',
            childrenIds: []
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(jsonWithNamedColors);
      
      expect(theme.backdropColor).toBe('white');
      expect(theme.canvasColor).toBe('transparent');
      expect(theme.textColor).toBe('black');
    });

    it('should clamp border radius to valid range', () => {
      const service = new EmailTemplateService();
      const jsonWithInvalidRadius = {
        root: {
          type: 'EmailLayout',
          data: {
            childrenIds: ['button-1']
          }
        },
        'button-1': {
          type: 'Button',
          data: {
            style: {
              backgroundColor: '#FF6B35',
              borderRadius: 150
            }
          }
        }
      };
      
      const theme = service.extractThemeFromEmailBuilder(jsonWithInvalidRadius);
      
      expect(theme.buttonBorderRadius).toBeUndefined();
    });

    it('should return empty theme for invalid JSON structure', () => {
      const service = new EmailTemplateService();
      
      const emptyTheme1 = service.extractThemeFromEmailBuilder(null);
      const emptyTheme2 = service.extractThemeFromEmailBuilder('invalid string');
      const emptyTheme3 = service.extractThemeFromEmailBuilder({ notRoot: {} });
      
      expect(Object.keys(emptyTheme1).length).toBe(0);
      expect(Object.keys(emptyTheme2).length).toBe(0);
      expect(Object.keys(emptyTheme3).length).toBe(0);
    });

    it('should reset theme using primary color from branding settings', async () => {
      const service = new EmailTemplateService();
      
      await storage.setCustomizationSettings({
        theme: { primaryColor: '#123456', secondaryColor: '#654321' }
      });
      
      const resetTheme = await service.resetEmailTheme();
      
      expect(resetTheme.headingColor).toBe('#123456');
      expect(resetTheme.linkColor).toBe('#123456');
      expect(resetTheme.buttonBackgroundColor).toBe('#123456');
      expect(resetTheme.secondaryButtonBackgroundColor).toBe('#654321');
      expect(resetTheme.backdropColor).toBe('#F5F5F5');
      expect(resetTheme.canvasColor).toBe('#FFFFFF');
    });

    it('should use default orange when primary color not set', async () => {
      const service = new EmailTemplateService();
      
      await storage.setCustomizationSettings({ theme: { primaryColor: '', secondaryColor: '' } });
      
      const resetTheme = await service.resetEmailTheme();
      
      expect(resetTheme.headingColor).toBe('#FF6B35');
      expect(resetTheme.buttonBackgroundColor).toBe('#FF6B35');
      expect(resetTheme.secondaryButtonBackgroundColor).toBe('#4A90A4');
    });

    it('should include dark mode colors in reset theme', async () => {
      const service = new EmailTemplateService();
      
      const resetTheme = await service.resetEmailTheme();
      
      expect(resetTheme.darkBackdropColor).toBeDefined();
      expect(resetTheme.darkCanvasColor).toBeDefined();
      expect(resetTheme.darkTextColor).toBeDefined();
      expect(resetTheme.darkHeadingColor).toBeDefined();
    });
  });

  describe('Container Block Rendering', () => {
    it('should render Container block with background color', () => {
      const doc = {
        root: {
          type: 'EmailLayout' as const,
          data: {
            backdropColor: '#F5F5F5',
            canvasColor: '#FFFFFF',
            textColor: '#333333',
            fontFamily: 'Arial, sans-serif',
            childrenIds: ['container-1'],
          },
        },
        'container-1': {
          type: 'Container',
          data: {
            childrenIds: ['text-1'],
            style: {
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              padding: { top: 20, right: 24, bottom: 20, left: 24 },
              margin: { top: 12, right: 0, bottom: 12, left: 0 },
            },
          },
        },
        'text-1': {
          type: 'Text',
          data: {
            props: { text: 'Container content' },
            style: { fontSize: 16 },
          },
        },
      };

      const html = jsonToHtml(doc);
      
      expect(html).toContain('email-container');
      expect(html).toContain('#f8f9fa');
      expect(html).toContain('Container content');
      expect(html).toContain('border-radius: 8px');
    });

    it('should render nested children inside Container', () => {
      const doc = {
        root: {
          type: 'EmailLayout' as const,
          data: {
            backdropColor: '#F5F5F5',
            canvasColor: '#FFFFFF',
            textColor: '#333333',
            fontFamily: 'Arial',
            childrenIds: ['c1'],
          },
        },
        'c1': {
          type: 'Container',
          data: {
            childrenIds: ['h1', 'b1'],
            style: { backgroundColor: '#e8f4f8' },
          },
        },
        'h1': {
          type: 'Heading',
          data: { props: { text: 'Box Heading', level: 'h3' }, style: {} },
        },
        'b1': {
          type: 'Button',
          data: {
            props: { text: 'Click me', url: 'https://example.com', buttonType: 'secondary' },
            style: {},
          },
        },
      };

      const html = jsonToHtml(doc);
      
      expect(html).toContain('Box Heading');
      expect(html).toContain('Click me');
      expect(html).toContain('email-btn-secondary');
      expect(html).toContain('#e8f4f8');
    });
  });

  describe('Button Types', () => {
    it('should use primary button color by default', () => {
      const doc = {
        root: {
          type: 'EmailLayout' as const,
          data: { backdropColor: '#F5F5F5', canvasColor: '#FFF', textColor: '#333', fontFamily: 'Arial', childrenIds: ['btn'] },
        },
        'btn': {
          type: 'Button',
          data: { props: { text: 'Primary', url: '#' }, style: {} },
        },
      };

      const html = jsonToHtml(doc);
      expect(html).toContain('email-btn-primary');
      expect(html).toContain('#FF6B35');
    });

    it('should use secondary button color for secondary type', () => {
      const theme: EmailTheme = {
        backdropColor: '#F5F5F5', canvasColor: '#FFF', textColor: '#333',
        headingColor: '#000', linkColor: '#000', buttonBackgroundColor: '#FF0000',
        buttonTextColor: '#FFF', buttonBorderRadius: 6, fontFamily: 'Arial',
        secondaryButtonBackgroundColor: '#00FF00', secondaryButtonTextColor: '#000',
        darkBackdropColor: '#111', darkCanvasColor: '#222', darkTextColor: '#EEE', darkHeadingColor: '#FFF',
      };

      const doc = {
        root: {
          type: 'EmailLayout' as const,
          data: { backdropColor: '#F5F5F5', canvasColor: '#FFF', textColor: '#333', fontFamily: 'Arial', childrenIds: ['btn'] },
        },
        'btn': {
          type: 'Button',
          data: { props: { text: 'Secondary', url: '#', buttonType: 'secondary' }, style: {} },
        },
      };

      const html = jsonToHtml(doc, theme);
      expect(html).toContain('email-btn-secondary');
      expect(html).toContain('#00FF00');
    });

    it('should allow explicit style.backgroundColor override', () => {
      const doc = {
        root: {
          type: 'EmailLayout' as const,
          data: { backdropColor: '#F5F5F5', canvasColor: '#FFF', textColor: '#333', fontFamily: 'Arial', childrenIds: ['btn'] },
        },
        'btn': {
          type: 'Button',
          data: { props: { text: 'Custom', url: '#' }, style: { backgroundColor: '#ABCDEF' } },
        },
      };

      const html = jsonToHtml(doc);
      expect(html).toContain('#ABCDEF');
    });
  });

  describe('Dark Mode Support', () => {
    it('should include dark mode CSS in rendered email', async () => {
      const service = new EmailTemplateService();
      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('prefers-color-scheme: dark');
      expect(result.html).toContain('color-scheme');
      expect(result.html).toContain('class="shell"');
      expect(result.html).toContain('.shell');
    });

    it('should include MSO conditional comments for Outlook', async () => {
      const service = new EmailTemplateService();
      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('[if mso]');
    });
  });

  describe('Logo Sizing', () => {
    let savedCustomization: any;
    beforeEach(async () => {
      savedCustomization = await storage.getCustomizationSettings();
    });
    afterEach(async () => {
      await storage.setCustomizationSettings(savedCustomization);
    });

    it('should use proper logo sizing constraints', async () => {
      const service = new EmailTemplateService();
      
      await storage.setCustomizationSettings({
        branding: {
          siteName: 'Test',
          siteNameAccent: '',
          logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('height: 36px');
      expect(result.html).toContain('max-width: 100px');
    });
  });

  describe('Header Design (no colored header bar)', () => {
    let savedCustomization: any;
    beforeEach(async () => {
      savedCustomization = await storage.getCustomizationSettings();
    });
    afterEach(async () => {
      await storage.setCustomizationSettings(savedCustomization);
    });

    it('should NOT have a colored header bar background', async () => {
      const service = new EmailTemplateService();

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).not.toMatch(/background-color:\s*#FF6B35/i);
      expect(result.html).not.toContain('color: #FFFFFF; font-size: 22px');
    });

    it('should show siteName as subtle muted text when logo is set', async () => {
      const service = new EmailTemplateService();

      await storage.setCustomizationSettings({
        branding: {
          siteName: 'Poll',
          siteNameAccent: 'y',
          logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('hdr-site');
      expect(result.html).toContain('color: #6b7280');
    });

    it('should include logo as base64 data URI when logoUrl is set', async () => {
      const service = new EmailTemplateService();
      const testDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      
      await storage.setCustomizationSettings({
        branding: {
          siteName: 'Polly',
          siteNameAccent: 'Vote',
          logoUrl: testDataUri,
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain(testDataUri);
      expect(result.html).toContain('PollyVote');
    });

    it('should embed logo from /uploads/ relative path as base64', async () => {
      const service = new EmailTemplateService();
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      try { await fs.mkdir(uploadsDir, { recursive: true }); } catch {}
      const testLogoPath = path.join(uploadsDir, 'test-logo-email.png');
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x01, 0x49, 0x48, 0x44, 0x52
      ]);
      await fs.writeFile(testLogoPath, pngHeader);

      try {
        await storage.setCustomizationSettings({
          branding: {
            siteName: 'Polly',
            siteNameAccent: 'Vote',
            logoUrl: '/uploads/test-logo-email.png',
          }
        });

        const result = await service.renderEmail('poll_created', {
          pollType: 'Umfrage',
          pollTitle: 'Test',
          publicLink: 'https://example.com',
          adminLink: 'https://example.com/admin',
        });

        expect(result.html).toContain('data:image/png;base64,');
        expect(result.html).toContain('<img');
      } finally {
        await fs.unlink(testLogoPath).catch(() => {});
      }
    });

    it('should fall back to text header when logo URL is unreachable', async () => {
      const service = new EmailTemplateService();
      
      await storage.setCustomizationSettings({
        branding: {
          siteName: 'Polly',
          siteNameAccent: 'Vote',
          logoUrl: 'https://nonexistent.invalid/logo.png',
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).not.toContain('<img');
      expect(result.html).toContain('font-size: 18px');
      expect(result.html).toContain('Polly');
    });

    it('should have dark mode class for header text', async () => {
      const service = new EmailTemplateService();

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('.hdr-site');
    });

    it('should render only logo without text span when siteName is empty', async () => {
      const service = new EmailTemplateService();

      await storage.setCustomizationSettings({
        branding: {
          siteName: '',
          siteNameAccent: '',
          logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('<img');
      expect(result.html).toContain('alt="Logo"');
      expect(result.html).not.toContain('class="hdr-site"');
      expect(result.html).not.toContain('class="hdr-accent"');
    });

    it('should not render empty accent span when siteNameAccent is empty', async () => {
      const service = new EmailTemplateService();

      await storage.setCustomizationSettings({
        branding: {
          siteName: 'Polly',
          siteNameAccent: '',
          logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }
      });

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('alt="Polly"');
      expect(result.html).toContain('class="hdr-site"');
      expect(result.html).not.toContain('class="hdr-accent"');
    });

    it('should preserve branding after full test cycle', async () => {
      const before = await storage.getCustomizationSettings();

      const service = new EmailTemplateService();
      await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      const after = await storage.getCustomizationSettings();
      expect(after.branding.logoUrl).toBe(before.branding.logoUrl);
      expect(after.branding.siteName).toBe(before.branding.siteName);
      expect(after.branding.siteNameAccent).toBe(before.branding.siteNameAccent);
      expect(after.theme.primaryColor).toBe(before.theme.primaryColor);
      expect(after.theme.secondaryColor).toBe(before.theme.secondaryColor);
    });
  });

  describe('poll_created Template Structure', () => {
    it('should have admin and public containers', () => {
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      const json = template.jsonContent as Record<string, unknown>;
      
      expect(json['admin-box']).toBeDefined();
      expect(json['public-box']).toBeDefined();
      
      const adminBox = json['admin-box'] as { type: string; data: Record<string, unknown> };
      expect(adminBox.type).toBe('Container');
      
      const publicBox = json['public-box'] as { type: string; data: Record<string, unknown> };
      expect(publicBox.type).toBe('Container');
    });

    it('should have primary button in admin box and secondary in public box', () => {
      const template = EmailTemplateService.getDefaultTemplate('poll_created');
      const json = template.jsonContent as Record<string, unknown>;
      
      const adminBtn = json['ab-btn'] as { type: string; data: { props: Record<string, unknown> } };
      expect(adminBtn.type).toBe('Button');
      
      const publicBtn = json['pb-btn'] as { type: string; data: { props: Record<string, unknown> } };
      expect(publicBtn.type).toBe('Button');
      expect(publicBtn.data.props.buttonType).toBe('secondary');
    });
  });

  describe('Button Text Contrast Auto-Correction', () => {
    let savedCustomization: any;
    let savedEmailTheme: any;
    beforeEach(async () => {
      savedCustomization = await storage.getCustomizationSettings();
      const svc = new EmailTemplateService();
      savedEmailTheme = await svc.getEmailTheme();
    });
    afterEach(async () => {
      await storage.setCustomizationSettings(savedCustomization);
      const svc = new EmailTemplateService();
      await svc.setEmailTheme(savedEmailTheme);
    });

    it('should keep white text on sufficiently dark backgrounds', () => {
      expect(ensureButtonTextContrast('#7A3800', '#FFFFFF')).toBe('#FFFFFF');
      expect(ensureButtonTextContrast('#123456', '#FFFFFF')).toBe('#FFFFFF');
      expect(ensureButtonTextContrast('#000000', '#FFFFFF')).toBe('#FFFFFF');
    });

    it('should pick best contrast for medium-luminance backgrounds', () => {
      expect(ensureButtonTextContrast('#FF6B35', '#FFFFFF')).toBe('#1a1a1a');
      expect(ensureButtonTextContrast('#4A90A4', '#FFFFFF')).toBe('#1a1a1a');
    });

    it('should switch to dark text on light backgrounds', () => {
      expect(ensureButtonTextContrast('#FDE4D2', '#FFFFFF')).toBe('#1a1a1a');
      expect(ensureButtonTextContrast('#FFFFFF', '#FFFFFF')).toBe('#1a1a1a');
      expect(ensureButtonTextContrast('#F0F0F0', '#FFFFFF')).toBe('#1a1a1a');
    });

    it('should handle shorthand hex colors (#fff)', () => {
      expect(ensureButtonTextContrast('#fff', '#FFFFFF')).toBe('#1a1a1a');
      expect(ensureButtonTextContrast('#000', '#FFFFFF')).toBe('#FFFFFF');
    });

    it('should handle rgb() and named colors', () => {
      expect(ensureButtonTextContrast('rgb(253, 228, 210)', '#FFFFFF')).toBe('#1a1a1a');
      expect(ensureButtonTextContrast('white', '#000000')).toBe('#000000');
    });

    it('should auto-correct rgb() colors', () => {
      expect(ensureButtonTextContrast('rgb(255,0,0)', '#FFFFFF')).toBe('#1a1a1a');
    });

    it('should return preferred color for truly invalid input', () => {
      expect(ensureButtonTextContrast('invalid', '#FFFFFF')).toBe('#FFFFFF');
      expect(ensureButtonTextContrast('', '#FFFFFF')).toBe('#FFFFFF');
    });

    it('should auto-correct secondary button text in rendered email', async () => {
      const service = new EmailTemplateService();

      await service.resetTemplate('poll_created');
      await storage.setCustomizationSettings({
        theme: { primaryColor: '#7A3800', secondaryColor: '#FDE4D2' }
      });
      await service.resetEmailTheme();

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('btn-secondary');
      expect(result.html).toContain('#FDE4D2');
    });
  });

  describe('V3 Dark Mode Shell', () => {
    it('should include V3 dark mode CSS with shell and header classes', async () => {
      const service = new EmailTemplateService();
      await service.resetTemplate('poll_created');

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('.shell');
      expect(result.html).toContain('.email-header');
      expect(result.html).toContain('.btn-primary');
      expect(result.html).toContain('.btn-secondary');
      expect(result.html).toContain('.email-footer');
    });

    it('should include V3 body structure with tag, headline and sections', async () => {
      const service = new EmailTemplateService();
      await service.resetTemplate('poll_created');

      const result = await service.renderEmail('poll_created', {
        pollType: 'Umfrage',
        pollTitle: 'Test',
        publicLink: 'https://example.com',
        adminLink: 'https://example.com/admin',
      });

      expect(result.html).toContain('survey-tag');
      expect(result.html).toContain('headline');
      expect(result.html).toContain('link-label');
      expect(result.html).toContain('sec-divider');
      expect(result.html).toContain('notice');
    });
  });
});
