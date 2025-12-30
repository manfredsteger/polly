/**
 * System Package Service
 * Tracks system-level dependencies for deployment documentation
 * Works in both Replit (reads .replit) and production (reads SYSTEM_PACKAGES.json or env)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface SystemPackage {
  name: string;
  version: string | null;
  channel: string;
  purpose: string;
  hasKnownIssues: boolean;
  notes: string | null;
}

export interface SystemPackageResult {
  packages: SystemPackage[];
  nixChannel: string;
  lastChecked: Date;
  cacheExpiresAt: Date;
}

interface SystemPackageCache {
  data: SystemPackageResult;
  expiresAt: Date;
}

let systemCache: SystemPackageCache | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Purpose descriptions for common packages
const PACKAGE_PURPOSES: Record<string, string> = {
  'chromium': 'PDF-Export (Puppeteer)',
  'libuuid': 'System-Bibliothek (UUID)',
  'glib': 'System-Bibliothek (GLib)',
  'nss': 'Kryptografie (NSS)',
  'nspr': 'System-Bibliothek (NSPR)',
  'atk': 'Barrierefreiheit (ATK)',
  'cups': 'Druckdienste',
  'dbus': 'System-Kommunikation (D-Bus)',
  'expat': 'XML-Parser',
  'fontconfig': 'Schriftarten-Konfiguration',
  'freetype': 'Schriftarten-Rendering',
  'pango': 'Text-Rendering',
  'cairo': 'Grafik-Bibliothek',
  'xorg.libX11': 'X11 Display',
  'xorg.libXcomposite': 'X11 Compositing',
  'xorg.libXdamage': 'X11 Rendering',
  'xorg.libXext': 'X11 Extensions',
  'xorg.libXfixes': 'X11 Fixes',
  'xorg.libXrandr': 'X11 Display-Konfiguration',
  'xorg.libxcb': 'X11 Protocol',
  'xorg.libXrender': 'X11 Rendering',
  'alsa-lib': 'Audio-Bibliothek',
  'nodejs-22': 'JavaScript Runtime',
  'postgresql-16': 'Datenbank',
  'web': 'Web-Modul'
};

// Default packages required for production (used when not running in Replit)
const PRODUCTION_PACKAGES = [
  'nodejs-22',
  'postgresql-16', 
  'chromium',
  'libuuid',
  'glib',
  'nss',
  'nspr',
  'atk',
  'cups',
  'dbus',
  'expat',
  'fontconfig',
  'freetype',
  'pango',
  'cairo',
  'xorg.libX11',
  'xorg.libXcomposite',
  'xorg.libXdamage',
  'xorg.libXext',
  'xorg.libXfixes',
  'xorg.libXrandr',
  'xorg.libxcb',
  'xorg.libXrender',
  'alsa-lib'
];

function parseSystemConfig(): { packages: string[]; modules: string[]; channel: string; source: string } {
  // Priority 1: Check for SYSTEM_PACKAGES.json (production manifest)
  const manifestPath = join(process.cwd(), 'SYSTEM_PACKAGES.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      return {
        packages: manifest.packages || [],
        modules: manifest.modules || [],
        channel: manifest.channel || 'production',
        source: 'SYSTEM_PACKAGES.json'
      };
    } catch {
      // Fall through to next option
    }
  }

  // Priority 2: Check for .replit file (Replit development)
  const replitPath = join(process.cwd(), '.replit');
  if (existsSync(replitPath)) {
    try {
      const replitContent = readFileSync(replitPath, 'utf-8');
      
      // Parse top-level modules = [...] (single line format)
      const modulesMatch = replitContent.match(/^modules\s*=\s*\[([^\]]+)\]/m);
      const modules = modulesMatch 
        ? modulesMatch[1].match(/"([^"]+)"/g)?.map(m => m.replace(/"/g, '')) || []
        : [];
      
      // Parse packages directly - use [^\]] to match single-line array format
      const packagesMatch = replitContent.match(/packages\s*=\s*\[([^\]]+)\]/);
      const packages = packagesMatch
        ? packagesMatch[1].match(/"([^"]+)"/g)?.map(m => m.replace(/"/g, '')) || []
        : [];
      
      // Parse channel from [nix] section
      const channelMatch = replitContent.match(/channel\s*=\s*"([^"]+)"/);
      const channel = channelMatch ? channelMatch[1] : 'stable';
      
      return { packages, modules, channel, source: '.replit' };
    } catch {
      // Fall through to default
    }
  }

  // Priority 3: Use default production package list
  return { 
    packages: PRODUCTION_PACKAGES, 
    modules: [], 
    channel: 'production (default)',
    source: 'built-in default'
  };
}

async function getPackageVersion(packageName: string): Promise<string | null> {
  try {
    // Try to get version using nix-env or from system
    const normalizedName = packageName.replace('xorg.', '');
    
    // For some common packages, try specific version commands
    if (packageName === 'chromium') {
      const { stdout } = await execAsync('chromium --version 2>/dev/null || echo "unknown"', { timeout: 5000 });
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    }
    
    if (packageName.startsWith('nodejs')) {
      const { stdout } = await execAsync('node --version 2>/dev/null || echo "unknown"', { timeout: 5000 });
      return stdout.trim().replace('v', '') || null;
    }
    
    if (packageName.startsWith('postgresql')) {
      const { stdout } = await execAsync('psql --version 2>/dev/null || echo "unknown"', { timeout: 5000 });
      const match = stdout.match(/(\d+\.\d+)/);
      return match ? match[1] : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function getSystemPackages(forceRefresh = false): Promise<SystemPackageResult> {
  if (!forceRefresh && systemCache && new Date() < systemCache.expiresAt) {
    return systemCache.data;
  }

  const now = new Date();
  const config = parseSystemConfig();
  
  const packages: SystemPackage[] = [];
  
  // Add modules as packages
  for (const module of config.modules) {
    const version = await getPackageVersion(module);
    packages.push({
      name: module,
      version,
      channel: config.channel,
      purpose: PACKAGE_PURPOSES[module] || 'System-Modul',
      hasKnownIssues: false,
      notes: null
    });
  }
  
  // Add nix packages
  for (const pkg of config.packages) {
    const version = await getPackageVersion(pkg);
    packages.push({
      name: pkg,
      version,
      channel: config.channel,
      purpose: PACKAGE_PURPOSES[pkg] || 'System-Abhängigkeit',
      hasKnownIssues: false,
      notes: null
    });
  }

  const result: SystemPackageResult = {
    packages,
    nixChannel: config.channel,
    lastChecked: now,
    cacheExpiresAt: new Date(now.getTime() + CACHE_DURATION_MS)
  };

  systemCache = {
    data: result,
    expiresAt: result.cacheExpiresAt
  };

  return result;
}

export function clearSystemPackageCache(): void {
  systemCache = null;
}
