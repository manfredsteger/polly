/**
 * Branding Bootstrap Script
 * 
 * Applies instance-specific branding from branding.local.json on startup.
 * If no local file exists, falls back to branding.default.json (WCAG-compliant defaults).
 * 
 * This ensures:
 * 1. Open-source repo ships with clean WCAG defaults
 * 2. Instance-specific branding (e.g., KITA HUB CD) persists across deploys
 * 3. Admin customizations are stored in database, not git
 */

import fs from 'fs';
import path from 'path';

interface BrandingConfig {
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    scheduleColor?: string;
    surveyColor?: string;
    organizationColor?: string;
  };
  branding?: {
    siteName?: string;
    siteNameAccent?: string;
    logoUrl?: string | null;
  };
  footer?: {
    description?: string;
    copyrightText?: string;
    links?: Array<{ label: string; url: string }>;
  };
  wcag?: {
    enforcementEnabled?: boolean;
    enforceDefaultTheme?: boolean;
  };
}

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LOCAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'branding.local.json');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'branding.default.json');

/**
 * Load branding configuration from file system
 * Priority: branding.local.json > branding.default.json
 */
export function loadBrandingConfig(): { config: BrandingConfig; isLocal: boolean } {
  // Check for local config first (instance-specific, gitignored)
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content) as BrandingConfig;
      console.log('[Branding] Loaded instance-specific config from branding.local.json');
      return { config, isLocal: true };
    } catch (error) {
      console.error('[Branding] Error parsing branding.local.json:', error);
    }
  }

  // Fall back to default config (WCAG-compliant, in git)
  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content) as BrandingConfig;
      console.log('[Branding] Using default WCAG-compliant config from branding.default.json');
      return { config, isLocal: false };
    } catch (error) {
      console.error('[Branding] Error parsing branding.default.json:', error);
    }
  }

  // No config found - return empty (will use database defaults)
  console.log('[Branding] No branding config files found, using database defaults');
  return { config: {}, isLocal: false };
}

/**
 * Apply branding configuration to the database
 * Called during server startup
 */
export async function applyBrandingToDatabase(storage: any): Promise<void> {
  const { config, isLocal } = loadBrandingConfig();
  
  if (Object.keys(config).length === 0) {
    return; // No config to apply
  }

  try {
    // Get current settings from database
    const currentSettings = await storage.getCustomizationSettings();
    
    // Merge config with current settings (config values take precedence)
    const updates: any = {};
    
    if (config.theme) {
      updates.theme = { ...currentSettings.theme, ...config.theme };
    }
    
    if (config.branding) {
      updates.branding = { ...currentSettings.branding, ...config.branding };
    }
    
    if (config.footer) {
      updates.footer = { ...currentSettings.footer, ...config.footer };
    }
    
    if (config.wcag) {
      // If loading from local config, set enforceDefaultTheme to false
      updates.wcag = { 
        ...currentSettings.wcag, 
        ...config.wcag,
        enforceDefaultTheme: !isLocal 
      };
    } else if (isLocal) {
      // If local config exists but no wcag section, still mark as custom
      updates.wcag = { 
        ...currentSettings.wcag, 
        enforceDefaultTheme: false 
      };
    }
    
    if (Object.keys(updates).length > 0) {
      await storage.setCustomizationSettings(updates);
      console.log(`[Branding] Applied ${isLocal ? 'local' : 'default'} branding to database`);
    }
  } catch (error) {
    console.error('[Branding] Error applying branding to database:', error);
  }
}

/**
 * Reset branding to WCAG-compliant defaults
 * Called via: npm run branding:reset
 */
export async function resetBrandingToDefaults(storage: any): Promise<void> {
  if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
    console.error('[Branding] branding.default.json not found');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as BrandingConfig;
    
    // Ensure enforceDefaultTheme is true for defaults
    const updates = {
      theme: config.theme,
      branding: config.branding,
      footer: config.footer,
      wcag: { ...config.wcag, enforceDefaultTheme: true }
    };
    
    await storage.setCustomizationSettings(updates);
    console.log('[Branding] Reset to WCAG-compliant defaults');
    
    // Optionally remove local config file
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      console.log('[Branding] Note: branding.local.json still exists. Remove it to prevent re-application on next startup.');
    }
  } catch (error) {
    console.error('[Branding] Error resetting branding:', error);
    process.exit(1);
  }
}

/**
 * CLI entry point for branding:reset command
 */
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'reset') {
    // This will be called via npm run branding:reset
    console.log('[Branding] Reset command - requires database connection');
    console.log('[Branding] Use: npm run branding:reset');
  } else if (command === 'show') {
    const { config, isLocal } = loadBrandingConfig();
    console.log(`\n[Branding] Current config (${isLocal ? 'local' : 'default'}):\n`);
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log('Usage: npx tsx server/scripts/applyBranding.ts [reset|show]');
  }
}
