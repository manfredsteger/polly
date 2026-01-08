/**
 * Branding Persistence System
 * 
 * Architecture:
 * 1. Database is the source of truth for runtime settings
 * 2. branding.local.json persists admin customizations across server restarts
 * 3. branding.default.json provides WCAG-compliant fallback for fresh installs
 * 
 * Startup flow:
 * - If DB has customizations → use them (branding.local.json is backup only)
 * - If DB is empty but branding.local.json exists → bootstrap from file
 * - If both empty → use branding.default.json (fresh install)
 * 
 * Save flow:
 * - Admin saves in panel → write to DB AND branding.local.json
 * 
 * Reset flow:
 * - Load branding.default.json → write to DB, delete branding.local.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BrandingConfig {
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    scheduleColor?: string;
    surveyColor?: string;
    organizationColor?: string;
    successColor?: string;
    warningColor?: string;
    errorColor?: string;
    infoColor?: string;
    accentColor?: string;
    mutedColor?: string;
    neutralColor?: string;
    defaultThemeMode?: string;
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
    supportLinks?: Array<{ label: string; url: string }>;
  };
  wcag?: {
    enforcementEnabled?: boolean;
    enforceDefaultTheme?: boolean;
  };
  matrix?: {
    enabled?: boolean;
    homeserverUrl?: string;
    botUserId?: string;
    botAccessToken?: string;
    searchEnabled?: boolean;
  };
}

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LOCAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'branding.local.json');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'branding.default.json');

/**
 * Check if branding.local.json exists
 */
export function hasLocalBrandingConfig(): boolean {
  return fs.existsSync(LOCAL_CONFIG_PATH);
}

/**
 * Load branding.default.json (WCAG-compliant defaults)
 */
export function loadDefaultBrandingConfig(): BrandingConfig {
  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
      return JSON.parse(content) as BrandingConfig;
    } catch (error) {
      console.error('[Branding] Error parsing branding.default.json:', error);
    }
  }
  return {};
}

/**
 * Load branding.local.json (instance-specific customizations)
 */
export function loadLocalBrandingConfig(): BrandingConfig | null {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf-8');
      return JSON.parse(content) as BrandingConfig;
    } catch (error) {
      console.error('[Branding] Error parsing branding.local.json:', error);
    }
  }
  return null;
}

/**
 * Write current settings to branding.local.json
 * Called after every admin customization to persist changes
 */
export function writeBrandingToLocalFile(settings: BrandingConfig): void {
  try {
    const config: BrandingConfig = {
      theme: settings.theme,
      branding: settings.branding,
      footer: settings.footer,
      wcag: settings.wcag,
    };
    
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(LOCAL_CONFIG_PATH, content, 'utf-8');
    console.log('[Branding] Saved customizations to branding.local.json');
  } catch (error) {
    console.error('[Branding] Error writing branding.local.json:', error);
  }
}

/**
 * Delete branding.local.json (used during reset to defaults)
 */
export function deleteLocalBrandingConfig(): boolean {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      fs.unlinkSync(LOCAL_CONFIG_PATH);
      console.log('[Branding] Deleted branding.local.json');
      return true;
    } catch (error) {
      console.error('[Branding] Error deleting branding.local.json:', error);
      return false;
    }
  }
  return true; // File doesn't exist, nothing to delete
}

/**
 * Check if database has customization settings
 */
async function isDatabaseEmpty(storage: any): Promise<boolean> {
  try {
    const settings = await storage.getCustomizationSettings();
    // Check if theme has any non-default values (indicating prior customization)
    const hasTheme = settings.theme && Object.keys(settings.theme).length > 0;
    const hasBranding = settings.branding && Object.keys(settings.branding).length > 0;
    return !hasTheme && !hasBranding;
  } catch {
    return true; // Treat errors as empty
  }
}

/**
 * Bootstrap branding on server startup
 * Only applies file-based config if database is empty (fresh install or reset)
 */
export async function bootstrapBranding(storage: any): Promise<void> {
  const dbEmpty = await isDatabaseEmpty(storage);
  
  if (!dbEmpty) {
    console.log('[Branding] Database has existing customizations - skipping file bootstrap');
    return;
  }
  
  // Database is empty - check for local config first
  const localConfig = loadLocalBrandingConfig();
  if (localConfig) {
    console.log('[Branding] Bootstrapping from branding.local.json');
    await applyConfigToDatabase(storage, localConfig, true);
    return;
  }
  
  // No local config - use defaults
  const defaultConfig = loadDefaultBrandingConfig();
  if (Object.keys(defaultConfig).length > 0) {
    console.log('[Branding] Bootstrapping from branding.default.json (fresh install)');
    await applyConfigToDatabase(storage, defaultConfig, false);
  }
}

/**
 * Apply a config object to the database
 */
async function applyConfigToDatabase(storage: any, config: BrandingConfig, isLocal: boolean): Promise<void> {
  try {
    const currentSettings = await storage.getCustomizationSettings();
    
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
    
    // Set WCAG enforcement based on whether this is a custom or default config
    updates.wcag = { 
      ...currentSettings.wcag, 
      ...(config.wcag || {}),
      enforceDefaultTheme: !isLocal 
    };
    
    if (Object.keys(updates).length > 0) {
      await storage.setCustomizationSettings(updates);
      console.log(`[Branding] Applied ${isLocal ? 'local' : 'default'} branding to database`);
    }
  } catch (error) {
    console.error('[Branding] Error applying config to database:', error);
  }
}

/**
 * Reset branding to WCAG-compliant defaults
 * - Loads branding.default.json into database
 * - Deletes branding.local.json
 * - Sets enforceDefaultTheme to true
 */
export async function resetBrandingToDefaults(storage: any): Promise<{ success: boolean; message: string }> {
  const defaultConfig = loadDefaultBrandingConfig();
  
  if (Object.keys(defaultConfig).length === 0) {
    return { success: false, message: 'branding.default.json not found or empty' };
  }
  
  try {
    // Apply defaults with enforceDefaultTheme = true
    const updates = {
      theme: defaultConfig.theme,
      branding: defaultConfig.branding,
      footer: defaultConfig.footer,
      wcag: { 
        ...(defaultConfig.wcag || {}), 
        enforceDefaultTheme: true,
        enforcementEnabled: true
      }
    };
    
    await storage.setCustomizationSettings(updates);
    
    // Delete local config to prevent re-application on restart
    deleteLocalBrandingConfig();
    
    console.log('[Branding] Reset to WCAG-compliant defaults');
    return { success: true, message: 'Branding reset to WCAG-compliant defaults' };
  } catch (error) {
    console.error('[Branding] Error resetting branding:', error);
    return { success: false, message: 'Error resetting branding' };
  }
}

/**
 * CLI entry point for branding commands
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const command = process.argv[2];
  
  if (command === 'show') {
    const localConfig = loadLocalBrandingConfig();
    const defaultConfig = loadDefaultBrandingConfig();
    
    console.log('\n[Branding] Local config (branding.local.json):');
    console.log(localConfig ? JSON.stringify(localConfig, null, 2) : '  (not found)');
    
    console.log('\n[Branding] Default config (branding.default.json):');
    console.log(Object.keys(defaultConfig).length > 0 ? JSON.stringify(defaultConfig, null, 2) : '  (not found)');
  } else {
    console.log('Usage: npx tsx server/scripts/applyBranding.ts show');
    console.log('       To reset, use the Admin Panel or API: POST /api/v1/admin/branding/reset');
  }
}
