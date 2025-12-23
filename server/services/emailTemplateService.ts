import { storage } from '../storage';
import { 
  type EmailTemplate, 
  type EmailTemplateType, 
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES
} from '@shared/schema';

// Default email template JSON structures for email-builder-js
// These follow the email-builder-js format with blocks

interface EmailBuilderBlock {
  type: string;
  data: Record<string, unknown>;
}

interface EmailBuilderDocument {
  root: {
    type: 'EmailLayout';
    data: {
      backdropColor: string;
      canvasColor: string;
      textColor: string;
      fontFamily: string;
      childrenIds: string[];
    };
  };
  [blockId: string]: EmailBuilderBlock;
}

// Helper to create a simple email template structure
function createDefaultTemplate(
  type: EmailTemplateType,
  name: string,
  subject: string,
  heading: string,
  bodyParagraphs: string[],
  buttonText?: string,
  buttonVariable?: string,
  footerText?: string
): { name: string; subject: string; jsonContent: EmailBuilderDocument; textContent: string } {
  const blockIds: string[] = [];
  const blocks: Record<string, EmailBuilderBlock> = {};
  
  // Header block
  const headerId = 'header-1';
  blockIds.push(headerId);
  blocks[headerId] = {
    type: 'Heading',
    data: {
      props: {
        text: heading,
        level: 'h2',
      },
      style: {
        color: '#FF6B35',
        fontWeight: 'bold',
        textAlign: 'left',
        padding: { top: 16, bottom: 8, left: 24, right: 24 },
      },
    },
  };

  // Body paragraphs
  bodyParagraphs.forEach((para, index) => {
    const paraId = `text-${index + 1}`;
    blockIds.push(paraId);
    blocks[paraId] = {
      type: 'Text',
      data: {
        props: { text: para },
        style: {
          color: '#333333',
          fontSize: 16,
          padding: { top: 8, bottom: 8, left: 24, right: 24 },
        },
      },
    };
  });

  // Button block if provided
  if (buttonText && buttonVariable) {
    const buttonId = 'button-1';
    blockIds.push(buttonId);
    blocks[buttonId] = {
      type: 'Button',
      data: {
        props: {
          text: buttonText,
          url: `{{${buttonVariable}}}`,
        },
        style: {
          backgroundColor: '#FF6B35',
          color: '#FFFFFF',
          padding: { top: 12, bottom: 12, left: 24, right: 24 },
          borderRadius: 6,
          textAlign: 'center',
          fontWeight: 'bold',
          margin: { top: 16, bottom: 16 },
        },
      },
    };
  }

  // Divider
  const dividerId = 'divider-1';
  blockIds.push(dividerId);
  blocks[dividerId] = {
    type: 'Divider',
    data: {
      style: {
        padding: { top: 24, bottom: 24, left: 24, right: 24 },
      },
    },
  };

  // Footer
  const footerId = 'footer-1';
  blockIds.push(footerId);
  blocks[footerId] = {
    type: 'Text',
    data: {
      props: { text: footerText || 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.' },
      style: {
        color: '#6c757d',
        fontSize: 14,
        padding: { top: 8, bottom: 16, left: 24, right: 24 },
      },
    },
  };

  const jsonContent: EmailBuilderDocument = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F5F5F5',
        canvasColor: '#FFFFFF',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        childrenIds: blockIds,
      },
    },
    ...blocks,
  };

  // Generate plain text version
  let textContent = `${heading}\n\n`;
  textContent += bodyParagraphs.join('\n\n');
  if (buttonText && buttonVariable) {
    textContent += `\n\n${buttonText}: {{${buttonVariable}}}`;
  }
  textContent += `\n\n---\n${footerText || 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'}`;

  return { name, subject, jsonContent, textContent };
}

// Default templates for each type
const DEFAULT_TEMPLATES: Record<EmailTemplateType, ReturnType<typeof createDefaultTemplate>> = {
  poll_created: createDefaultTemplate(
    'poll_created',
    'Umfrage erstellt',
    '[{{siteName}}] Ihre {{pollType}} wurde erstellt: {{pollTitle}}',
    '{{pollType}} erfolgreich erstellt!',
    [
      'Ihre {{pollType}} "{{pollTitle}}" wurde erfolgreich erstellt.',
      'Teilen Sie den folgenden Link mit Ihren Teilnehmern:',
      '{{publicLink}}',
      'Als Administrator können Sie die Umfrage über diesen Link verwalten:',
      '{{adminLink}}',
    ],
    'Umfrage öffnen',
    'publicLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.\nOpen-Source Abstimmungsplattform für Teams'
  ),
  
  invitation: createDefaultTemplate(
    'invitation',
    'Einladung zur Umfrage',
    '[{{siteName}}] {{inviterName}} lädt Sie ein: {{pollTitle}}',
    '📣 Einladung zur Abstimmung',
    [
      'Hallo,',
      '{{inviterName}} lädt Sie ein, an der Umfrage "{{pollTitle}}" teilzunehmen.',
      '{{message}}',
    ],
    'Jetzt abstimmen',
    'publicLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  vote_confirmation: createDefaultTemplate(
    'vote_confirmation',
    'Abstimmungsbestätigung',
    '[{{siteName}}] Vielen Dank für Ihre Teilnahme - {{pollTitle}}',
    'Vielen Dank für Ihre Teilnahme!',
    [
      'Hallo {{voterName}},',
      'vielen Dank für Ihre Teilnahme an der {{pollType}} "{{pollTitle}}".',
      'Ihre Auswahl wurde erfolgreich gespeichert.',
      'Mit diesem Link können Sie jederzeit zur Umfrage zurückkehren:',
      '{{publicLink}}',
      'Hier können Sie die aktuellen Ergebnisse einsehen:',
      '{{resultsLink}}',
    ],
    'Ergebnisse anzeigen',
    'resultsLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  reminder: createDefaultTemplate(
    'reminder',
    'Erinnerung',
    '[{{siteName}}] Erinnerung: {{pollTitle}}',
    '📣 Erinnerung zur Abstimmung',
    [
      'Hallo,',
      '{{senderName}} erinnert Sie freundlich an die Teilnahme an der Umfrage "{{pollTitle}}".',
      'Ihre Stimme ist wichtig! Bitte nehmen Sie sich kurz Zeit, um abzustimmen.',
      '{{expiresAt}}',
    ],
    'Jetzt abstimmen',
    'pollLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  password_reset: createDefaultTemplate(
    'password_reset',
    'Passwort zurücksetzen',
    '[{{siteName}}] Passwort zurücksetzen',
    'Passwort zurücksetzen',
    [
      'Hallo,',
      'Sie haben angefordert, Ihr Passwort für Ihren {{siteName}} Account zurückzusetzen.',
      'Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben:',
      'Dieser Link ist 1 Stunde gültig.',
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.',
    ],
    'Passwort zurücksetzen',
    'resetLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  email_change: createDefaultTemplate(
    'email_change',
    'E-Mail-Adresse ändern',
    '[{{siteName}}] E-Mail-Adresse bestätigen',
    'E-Mail-Adresse bestätigen',
    [
      'Hallo,',
      'Sie haben angefordert, Ihre E-Mail-Adresse für Ihren {{siteName}} Account zu ändern.',
      'Alte E-Mail: {{oldEmail}}',
      'Neue E-Mail: {{newEmail}}',
      'Klicken Sie auf den folgenden Button, um Ihre neue E-Mail-Adresse zu bestätigen:',
      'Dieser Link ist 24 Stunden gültig.',
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
    ],
    'E-Mail bestätigen',
    'confirmLink',
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  password_changed: createDefaultTemplate(
    'password_changed',
    'Passwort geändert',
    '[{{siteName}}] Ihr Passwort wurde geändert',
    'Passwort erfolgreich geändert',
    [
      'Hallo,',
      'Ihr Passwort für Ihren {{siteName}} Account wurde erfolgreich geändert.',
      'Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie bitte umgehend den Administrator.',
    ],
    undefined,
    undefined,
    'Diese E-Mail wurde automatisch von {{siteName}} erstellt.'
  ),
  
  test_report: createDefaultTemplate(
    'test_report',
    'Testbericht',
    '[{{siteName}}] Testbericht #{{testRunId}}: {{status}}',
    '{{status}} Automatischer Testbericht',
    [
      'Der automatische Testlauf #{{testRunId}} wurde abgeschlossen.',
      'Gesamte Tests: {{totalTests}}',
      'Bestanden: {{passed}}',
      'Fehlgeschlagen: {{failed}}',
      'Übersprungen: {{skipped}}',
      'Dauer: {{duration}}',
      'Gestartet: {{startedAt}}',
    ],
    undefined,
    undefined,
    'Diese E-Mail wurde automatisch vom {{siteName}} Testsystem erstellt.'
  ),
};

// HTML escape helper to prevent XSS
function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Template rendering - replace variables with actual values
// Note: leaves unmatched variables as-is (does not remove them)
export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  }
  
  return result;
}

// Substitute variables with HTML escaping (for safe HTML content)
export function substituteVariables(
  template: string,
  variables: Record<string, string | undefined>,
  escapeHtml: boolean = true
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const safeValue = escapeHtml ? htmlEscape(value) : value;
      result = result.replace(regex, safeValue);
    }
  }
  
  return result;
}

// Convert email-builder JSON to HTML
export function jsonToHtml(jsonContent: EmailBuilderDocument): string {
  const root = jsonContent.root;
  if (!root || root.type !== 'EmailLayout') {
    return '<div>Template-Fehler: Ungültiges Format</div>';
  }

  const { backdropColor, canvasColor, textColor, fontFamily, childrenIds } = root.data;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: ${backdropColor}; font-family: ${fontFamily}; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: ${canvasColor}; color: ${textColor}; }
    .button { display: inline-block; text-decoration: none; }
    .divider { border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="email-container">
`;

  for (const blockId of childrenIds) {
    const block = jsonContent[blockId];
    if (!block) continue;

    const blockData = block.data as Record<string, unknown>;
    const props = (blockData.props || {}) as Record<string, unknown>;
    const style = (blockData.style || {}) as Record<string, unknown>;

    switch (block.type) {
      case 'Heading': {
        const level = props.level || 'h2';
        const text = props.text || '';
        const color = style.color || textColor;
        const padding = style.padding as Record<string, number> | undefined;
        const paddingStyle = padding 
          ? `padding: ${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px;`
          : '';
        html += `<${level} style="color: ${color}; ${paddingStyle} margin: 0;">${text}</${level}>\n`;
        break;
      }
      case 'Text': {
        const text = props.text || '';
        const color = style.color || textColor;
        const fontSize = style.fontSize || 16;
        const padding = style.padding as Record<string, number> | undefined;
        const paddingStyle = padding 
          ? `padding: ${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px;`
          : '';
        html += `<p style="color: ${color}; font-size: ${fontSize}px; ${paddingStyle} margin: 0;">${text}</p>\n`;
        break;
      }
      case 'Button': {
        const text = props.text || 'Click';
        const url = props.url || '#';
        const bgColor = style.backgroundColor || '#FF6B35';
        const color = style.color || '#FFFFFF';
        const borderRadius = style.borderRadius || 6;
        const padding = style.padding as Record<string, number> | undefined;
        const margin = style.margin as Record<string, number> | undefined;
        const paddingStyle = padding 
          ? `padding: ${padding.top || 12}px ${padding.right || 24}px ${padding.bottom || 12}px ${padding.left || 24}px;`
          : 'padding: 12px 24px;';
        const marginStyle = margin
          ? `margin: ${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px;`
          : '';
        html += `<div style="text-align: center; ${marginStyle}">
          <a href="${url}" class="button" style="background-color: ${bgColor}; color: ${color}; ${paddingStyle} border-radius: ${borderRadius}px; font-weight: bold; text-decoration: none;">${text}</a>
        </div>\n`;
        break;
      }
      case 'Divider': {
        const padding = style.padding as Record<string, number> | undefined;
        const paddingStyle = padding 
          ? `padding: ${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px;`
          : '';
        html += `<div style="${paddingStyle}"><hr class="divider" style="margin: 0; border: none; border-top: 1px solid #e9ecef;"></div>\n`;
        break;
      }
      case 'Image': {
        const src = props.src || '';
        const alt = props.alt || '';
        const width = style.width || '100%';
        html += `<div style="text-align: center;"><img src="${src}" alt="${alt}" style="max-width: ${width}; height: auto;"></div>\n`;
        break;
      }
    }
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

// Sample data generators for each template type (for preview and testing)
// NOTE: Variable names MUST match exactly with the placeholders in DEFAULT_TEMPLATES
const SAMPLE_DATA: Record<EmailTemplateType, Record<string, string>> = {
  poll_created: {
    pollType: 'Terminumfrage',
    pollTitle: 'Teammeeting Q1 2025',
    publicLink: 'https://polly.example.com/poll/abc123',
    adminLink: 'https://polly.example.com/admin/abc123',
    siteName: 'Polly',
  },
  invitation: {
    inviterName: 'Max Mustermann',
    pollTitle: 'Teammeeting Q1 2025',
    message: 'Bitte wähle die Termine aus, an denen du Zeit hast.',
    publicLink: 'https://polly.example.com/poll/abc123',
    siteName: 'Polly',
  },
  vote_confirmation: {
    voterName: 'Anna Schmidt',
    pollType: 'Terminumfrage',
    pollTitle: 'Teammeeting Q1 2025',
    publicLink: 'https://polly.example.com/poll/abc123',
    resultsLink: 'https://polly.example.com/poll/abc123/results',
    siteName: 'Polly',
  },
  reminder: {
    senderName: 'Max Mustermann',
    pollTitle: 'Teammeeting Q1 2025',
    expiresAt: 'Die Umfrage endet am 31.12.2025 um 23:59 Uhr.',
    pollLink: 'https://polly.example.com/poll/abc123',
    siteName: 'Polly',
  },
  password_reset: {
    resetLink: 'https://polly.example.com/auth/reset-password?token=xyz789',
    siteName: 'Polly',
  },
  email_change: {
    oldEmail: 'alte-email@example.com',
    newEmail: 'neue-email@example.com',
    confirmLink: 'https://polly.example.com/auth/confirm-email?token=xyz789',
    siteName: 'Polly',
  },
  password_changed: {
    siteName: 'Polly',
  },
  test_report: {
    testRunId: '42',
    status: 'Bestanden',
    totalTests: '24',
    passed: '22',
    failed: '1',
    skipped: '1',
    duration: '12.5 Sekunden',
    startedAt: new Date().toLocaleString('de-DE'),
    siteName: 'Polly',
  },
};

export class EmailTemplateService {
  // Static method: Get default template by type
  static getDefaultTemplate(type: EmailTemplateType): {
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  } {
    const defaultData = DEFAULT_TEMPLATES[type];
    if (!defaultData) {
      throw new Error(`Unknown template type: ${type}`);
    }
    return {
      type,
      name: defaultData.name,
      subject: defaultData.subject,
      jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
      textContent: defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type],
    };
  }

  // Static method: Get all default templates
  static getAllDefaultTemplates(): Array<{
    type: EmailTemplateType;
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
    variables: { key: string; description: string }[];
  }> {
    return EMAIL_TEMPLATE_TYPES.map(type => EmailTemplateService.getDefaultTemplate(type));
  }

  // Static method: Substitute variables (with optional HTML escaping)
  static substituteVariables(
    template: string,
    variables: Record<string, string | undefined>,
    escapeHtml: boolean = true
  ): string {
    return substituteVariables(template, variables, escapeHtml);
  }

  // Static method: Get sample data for preview/testing
  static getSampleDataForType(type: string): Record<string, string> {
    return SAMPLE_DATA[type as EmailTemplateType] || {};
  }

  // Static method: Render template to HTML
  static async renderTemplate(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>
  ): Promise<string> {
    const defaultData = DEFAULT_TEMPLATES[type];
    if (!defaultData) {
      throw new Error(`Unknown template type: ${type}`);
    }
    
    // Substitute variables in JSON content first
    const jsonStr = substituteVariables(
      JSON.stringify(defaultData.jsonContent),
      variables,
      true
    );
    const renderedJson = JSON.parse(jsonStr) as EmailBuilderDocument;
    
    return jsonToHtml(renderedJson);
  }

  // Get all templates (from DB or defaults)
  async getAllTemplates(): Promise<EmailTemplate[]> {
    const dbTemplates = await storage.getEmailTemplates();
    const result: EmailTemplate[] = [];

    for (const type of EMAIL_TEMPLATE_TYPES) {
      const dbTemplate = dbTemplates.find(t => t.type === type);
      if (dbTemplate) {
        result.push(dbTemplate);
      } else {
        // Return default template as a pseudo-template
        const defaultData = DEFAULT_TEMPLATES[type];
        result.push({
          id: 0,
          type,
          name: defaultData.name,
          subject: defaultData.subject,
          jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
          htmlContent: null,
          textContent: defaultData.textContent,
          variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
          isDefault: true,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        });
      }
    }

    return result;
  }

  // Get a specific template
  async getTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    const dbTemplate = await storage.getEmailTemplate(type);
    
    if (dbTemplate) {
      return dbTemplate;
    }

    // Return default template
    const defaultData = DEFAULT_TEMPLATES[type];
    return {
      id: 0,
      type,
      name: defaultData.name,
      subject: defaultData.subject,
      jsonContent: defaultData.jsonContent as unknown as Record<string, unknown>,
      htmlContent: null,
      textContent: defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
      isDefault: true,
      isActive: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
  }

  // Save/update a template
  async saveTemplate(
    type: EmailTemplateType,
    jsonContent: Record<string, unknown>,
    subject?: string,
    name?: string
  ): Promise<EmailTemplate> {
    const defaultData = DEFAULT_TEMPLATES[type];
    
    // Generate HTML from JSON
    const htmlContent = jsonToHtml(jsonContent as EmailBuilderDocument);
    
    // Generate text content from JSON (simplified extraction)
    let textContent = '';
    const root = (jsonContent as EmailBuilderDocument).root;
    if (root && root.data.childrenIds) {
      for (const blockId of root.data.childrenIds) {
        const block = (jsonContent as EmailBuilderDocument)[blockId];
        if (block) {
          const props = (block.data as Record<string, unknown>).props as Record<string, unknown> | undefined;
          if (props?.text) {
            textContent += props.text + '\n\n';
          }
        }
      }
    }

    return await storage.upsertEmailTemplate({
      type,
      name: name || defaultData.name,
      subject: subject || defaultData.subject,
      jsonContent,
      htmlContent,
      textContent: textContent.trim() || defaultData.textContent,
      variables: EMAIL_TEMPLATE_VARIABLES[type] as unknown as unknown[],
      isDefault: false,
      isActive: true,
    });
  }

  // Reset template to default
  async resetTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    await storage.resetEmailTemplate(type);
    return this.getTemplate(type);
  }

  // Render a template with variables
  async renderEmail(
    type: EmailTemplateType,
    variables: Record<string, string | undefined>
  ): Promise<{ subject: string; html: string; text: string }> {
    const template = await this.getTemplate(type);
    
    // Get branding settings for siteName
    const customization = await storage.getCustomizationSettings();
    const siteName = `${customization.branding.siteName}${customization.branding.siteNameAccent}`;
    
    // Add siteName to variables if not provided
    const allVariables = { siteName, ...variables };
    
    // Render subject
    const subject = renderTemplate(template.subject, allVariables);
    
    // Render HTML
    let html: string;
    if (template.htmlContent) {
      html = renderTemplate(template.htmlContent, allVariables);
    } else {
      const renderedJson = JSON.parse(
        renderTemplate(JSON.stringify(template.jsonContent), allVariables)
      ) as EmailBuilderDocument;
      html = jsonToHtml(renderedJson);
    }
    
    // Render text
    const text = renderTemplate(template.textContent || '', allVariables);
    
    return { subject, html, text };
  }

  // Get available variables for a template type
  getVariables(type: EmailTemplateType): { key: string; description: string }[] {
    return EMAIL_TEMPLATE_VARIABLES[type];
  }

  // Get default template data
  getDefaultTemplate(type: EmailTemplateType): {
    name: string;
    subject: string;
    jsonContent: Record<string, unknown>;
    textContent: string;
  } {
    return DEFAULT_TEMPLATES[type];
  }
}

export const emailTemplateService = new EmailTemplateService();
