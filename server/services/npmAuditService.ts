/**
 * npm Audit Service
 * Runs npm audit locally to check for security vulnerabilities
 * Enhanced with impact labels (Frontend/Backend/Development)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export type ImpactArea = 'frontend' | 'backend' | 'development' | 'shared';

export interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url: string;
  vulnerableVersions: string;
  patchedVersions: string | null;
  cve: string | null;
  via: string[];
  isDirect: boolean;
  impactArea: ImpactArea;
  impactLabel: string;
}

export interface AuditResult {
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
  impactSummary: {
    frontend: number;
    backend: number;
    development: number;
    shared: number;
  };
  lastChecked: Date;
  cacheExpiresAt: Date;
}

interface AuditCache {
  data: AuditResult;
  expiresAt: Date;
}

let auditCache: AuditCache | null = null;
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  isDirect: boolean;
  via: (string | { title: string; url: string; cwe?: string[]; cvss?: { score: number }; range?: string })[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

interface NpmAuditOutput {
  auditReportVersion: number;
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
  };
}

// Package classification for impact area determination
const FRONTEND_PACKAGES = new Set([
  'react', 'react-dom', 'wouter', 'framer-motion', 'recharts',
  '@radix-ui', '@tanstack/react-query', 'react-hook-form', 'react-day-picker',
  'react-icons', 'react-image-gallery', 'react-resizable-panels',
  'yet-another-react-lightbox', 'embla-carousel-react', 'input-otp',
  'cmdk', 'vaul', 'lucide-react', 'class-variance-authority', 'clsx',
  'tailwind-merge', 'tailwindcss-animate', 'tw-animate-css', 'next-themes'
]);

const BACKEND_PACKAGES = new Set([
  'express', 'express-session', 'passport', 'passport-local',
  '@neondatabase/serverless', 'drizzle-orm', 'connect-pg-simple',
  'nodemailer', '@sendgrid/mail', 'bcryptjs', 'multer', 'ws',
  'puppeteer', 'pdfkit', 'qrcode', 'canvas', 'openid-client',
  'memorystore', 'matrix-js-sdk', 'supertest'
]);

const DEV_PACKAGES = new Set([
  'drizzle-kit', 'vite', '@vitejs/plugin-react', 'esbuild', 'tsx',
  'typescript', 'postcss', 'autoprefixer', 'tailwindcss',
  '@types/', '@replit/', 'vitest', '@vitest/', '@playwright/test',
  '@esbuild-kit', 'esbuild-register'
]);

const SHARED_PACKAGES = new Set([
  'zod', 'zod-validation-error', 'drizzle-zod', 'date-fns', 'nanoid',
  '@hookform/resolvers'
]);

function getPackageInfo(): { dependencies: Set<string>; devDependencies: Set<string> } {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return {
      dependencies: new Set(Object.keys(packageJson.dependencies || {})),
      devDependencies: new Set(Object.keys(packageJson.devDependencies || {}))
    };
  } catch {
    return { dependencies: new Set(), devDependencies: new Set() };
  }
}

function determineImpactArea(packageName: string, pkgInfo: { dependencies: Set<string>; devDependencies: Set<string> }): { area: ImpactArea; label: string } {
  const normalizedName = packageName.toLowerCase();
  
  // Check if it's a dev dependency first
  if (pkgInfo.devDependencies.has(packageName)) {
    return { area: 'development', label: 'Dev' };
  }
  
  // Check dev package patterns
  for (const devPkg of Array.from(DEV_PACKAGES)) {
    if (normalizedName.startsWith(devPkg) || normalizedName === devPkg) {
      return { area: 'development', label: 'Dev' };
    }
  }
  
  // Check frontend packages
  for (const frontendPkg of Array.from(FRONTEND_PACKAGES)) {
    if (normalizedName.startsWith(frontendPkg) || normalizedName === frontendPkg) {
      return { area: 'frontend', label: 'Frontend' };
    }
  }
  
  // Check backend packages
  for (const backendPkg of Array.from(BACKEND_PACKAGES)) {
    if (normalizedName.startsWith(backendPkg) || normalizedName === backendPkg) {
      return { area: 'backend', label: 'Backend' };
    }
  }
  
  // Check shared packages
  for (const sharedPkg of Array.from(SHARED_PACKAGES)) {
    if (normalizedName.startsWith(sharedPkg) || normalizedName === sharedPkg) {
      return { area: 'shared', label: 'Frontend & Backend' };
    }
  }
  
  // Default based on whether it's in dependencies
  if (pkgInfo.dependencies.has(packageName)) {
    return { area: 'backend', label: 'Backend' };
  }
  
  return { area: 'development', label: 'Dev' };
}

function parseVulnerability(name: string, vuln: NpmAuditVulnerability, pkgInfo: { dependencies: Set<string>; devDependencies: Set<string> }): Vulnerability {
  const viaDetails = vuln.via.find(v => typeof v === 'object') as { 
    title?: string; 
    url?: string; 
    cwe?: string[]; 
    range?: string 
  } | undefined;
  
  const stringVias = vuln.via.filter(v => typeof v === 'string') as string[];
  const { area, label } = determineImpactArea(name, pkgInfo);
  
  // If we have object details, use them
  if (viaDetails && typeof viaDetails === 'object') {
    const cveMatch = viaDetails.url?.match(/CVE-\d{4}-\d+/i);
    
    return {
      name,
      severity: vuln.severity as Vulnerability['severity'],
      title: viaDetails.title || 'Unknown vulnerability',
      url: viaDetails.url || '',
      vulnerableVersions: viaDetails.range || vuln.range || 'Unknown',
      patchedVersions: typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable.version : null,
      cve: cveMatch ? cveMatch[0].toUpperCase() : null,
      via: stringVias,
      isDirect: vuln.isDirect,
      impactArea: area,
      impactLabel: label
    };
  }
  
  // Fallback for string-only via entries (transitive vulnerabilities)
  return {
    name,
    severity: vuln.severity as Vulnerability['severity'],
    title: stringVias.length > 0 ? `${name}: via ${stringVias.join(', ')}` : `${name}: Unknown vulnerability`,
    url: '',
    vulnerableVersions: vuln.range || 'Unknown',
    patchedVersions: typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable.version : null,
    cve: null,
    via: stringVias,
    isDirect: vuln.isDirect,
    impactArea: area,
    impactLabel: label
  };
}

export async function runNpmAudit(forceRefresh = false): Promise<AuditResult> {
  if (!forceRefresh && auditCache && new Date() < auditCache.expiresAt) {
    return auditCache.data;
  }

  const now = new Date();
  const pkgInfo = getPackageInfo();
  
  try {
    const { stdout } = await execAsync('npm audit --json 2>/dev/null || true', {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024
    });

    const auditOutput: NpmAuditOutput = JSON.parse(stdout || '{}');
    
    const vulnerabilities: Vulnerability[] = [];
    
    if (auditOutput.vulnerabilities) {
      for (const [name, vuln] of Object.entries(auditOutput.vulnerabilities)) {
        const parsed = parseVulnerability(name, vuln, pkgInfo);
        vulnerabilities.push(parsed);
      }
    }

    vulnerabilities.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const summary = auditOutput.metadata?.vulnerabilities || {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
      total: 0
    };

    // Calculate impact summary
    const impactSummary = {
      frontend: vulnerabilities.filter(v => v.impactArea === 'frontend').length,
      backend: vulnerabilities.filter(v => v.impactArea === 'backend').length,
      development: vulnerabilities.filter(v => v.impactArea === 'development').length,
      shared: vulnerabilities.filter(v => v.impactArea === 'shared').length
    };

    const result: AuditResult = {
      vulnerabilities,
      summary,
      impactSummary,
      lastChecked: now,
      cacheExpiresAt: new Date(now.getTime() + CACHE_DURATION_MS)
    };

    auditCache = {
      data: result,
      expiresAt: result.cacheExpiresAt
    };

    return result;
  } catch (error) {
    console.error('npm audit error:', error);
    
    const emptyResult: AuditResult = {
      vulnerabilities: [],
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      impactSummary: { frontend: 0, backend: 0, development: 0, shared: 0 },
      lastChecked: now,
      cacheExpiresAt: new Date(now.getTime() + CACHE_DURATION_MS)
    };

    auditCache = {
      data: emptyResult,
      expiresAt: emptyResult.cacheExpiresAt
    };

    return emptyResult;
  }
}

export function clearAuditCache(): void {
  auditCache = null;
}
