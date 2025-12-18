/**
 * System Component Status Service
 * Checks component versions against endoflife.date API
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

interface ComponentStatus {
  name: string;
  version: string;
  latestVersion: string | null;
  eolDate: string | null;
  status: 'current' | 'warning' | 'eol' | 'unknown';
  daysUntilEol: number | null;
  cycle: string;
}

interface SystemStatusCache {
  data: ComponentStatus[];
  lastChecked: Date;
  expiresAt: Date;
}

let statusCache: SystemStatusCache | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchEolData(product: string, cycle: string): Promise<{
  eol: string | boolean;
  latest: string;
  support?: string;
} | null> {
  try {
    const response = await fetch(`https://endoflife.date/api/${product}/${cycle}.json`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function calculateStatus(eolValue: string | boolean | null): { status: ComponentStatus['status']; daysUntilEol: number | null; eolDate: string | null } {
  // eol: false means still supported
  if (eolValue === false) {
    return { status: 'current', daysUntilEol: null, eolDate: null };
  }
  
  // eol: true means EOL with no specific date
  if (eolValue === true) {
    return { status: 'eol', daysUntilEol: null, eolDate: null };
  }
  
  // No EOL data available
  if (!eolValue) {
    return { status: 'unknown', daysUntilEol: null, eolDate: null };
  }

  // eol is a date string
  const eol = new Date(eolValue);
  const now = new Date();
  const diffMs = eol.getTime() - now.getTime();
  const daysUntilEol = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilEol < 0) {
    return { status: 'eol', daysUntilEol, eolDate: eolValue };
  } else if (daysUntilEol < 180) { // 6 months
    return { status: 'warning', daysUntilEol, eolDate: eolValue };
  }
  return { status: 'current', daysUntilEol, eolDate: eolValue };
}

function extractMajorMinor(version: string): string {
  const match = version.replace(/^v/, '').match(/^(\d+)(?:\.(\d+))?/);
  if (!match) return version;
  return match[2] ? `${match[1]}.${match[2]}` : match[1];
}

function extractMajor(version: string): string {
  const match = version.replace(/^v/, '').match(/^(\d+)/);
  return match ? match[1] : version;
}

async function getNodeVersion(): Promise<{ version: string; cycle: string }> {
  const version = process.version.replace('v', '');
  const cycle = extractMajor(version);
  return { version, cycle };
}

async function getPostgresVersion(): Promise<{ version: string; cycle: string }> {
  try {
    const result = await db.execute(sql`SELECT version()`);
    const versionString = (result.rows[0] as any)?.version || '';
    const match = versionString.match(/PostgreSQL (\d+)\.(\d+)/);
    if (match) {
      return { version: `${match[1]}.${match[2]}`, cycle: match[1] };
    }
    return { version: 'Unknown', cycle: '' };
  } catch {
    return { version: 'Unknown', cycle: '' };
  }
}

async function getPackageVersion(packageName: string): Promise<string> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const pkgPath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export async function getSystemStatus(forceRefresh = false): Promise<{
  components: ComponentStatus[];
  lastChecked: Date;
  cacheExpiresAt: Date;
}> {
  // Return cached data if still valid
  if (!forceRefresh && statusCache && new Date() < statusCache.expiresAt) {
    return {
      components: statusCache.data,
      lastChecked: statusCache.lastChecked,
      cacheExpiresAt: statusCache.expiresAt
    };
  }

  const components: ComponentStatus[] = [];

  // Node.js
  const nodeInfo = await getNodeVersion();
  const nodeEol = await fetchEolData('nodejs', nodeInfo.cycle);
  const nodeStatus = calculateStatus(nodeEol?.eol ?? null);
  components.push({
    name: 'Node.js',
    version: nodeInfo.version,
    latestVersion: nodeEol?.latest || null,
    eolDate: nodeStatus.eolDate,
    status: nodeStatus.status,
    daysUntilEol: nodeStatus.daysUntilEol,
    cycle: nodeInfo.cycle
  });

  // PostgreSQL
  const pgInfo = await getPostgresVersion();
  if (pgInfo.cycle) {
    const pgEol = await fetchEolData('postgresql', pgInfo.cycle);
    const pgStatus = calculateStatus(pgEol?.eol ?? null);
    components.push({
      name: 'PostgreSQL',
      version: pgInfo.version,
      latestVersion: pgEol?.latest || null,
      eolDate: pgStatus.eolDate,
      status: pgStatus.status,
      daysUntilEol: pgStatus.daysUntilEol,
      cycle: pgInfo.cycle
    });
  }

  // React
  const reactVersion = await getPackageVersion('react');
  if (reactVersion !== 'Unknown') {
    const reactCycle = extractMajor(reactVersion);
    const reactEol = await fetchEolData('react', reactCycle);
    const reactStatus = calculateStatus(reactEol?.eol ?? null);
    components.push({
      name: 'React',
      version: reactVersion,
      latestVersion: reactEol?.latest || null,
      eolDate: reactStatus.eolDate,
      status: reactStatus.status,
      daysUntilEol: reactStatus.daysUntilEol,
      cycle: reactCycle
    });
  }

  // Express
  const expressVersion = await getPackageVersion('express');
  if (expressVersion !== 'Unknown') {
    const expressCycle = extractMajor(expressVersion);
    // Express is not on endoflife.date, mark as current
    components.push({
      name: 'Express',
      version: expressVersion,
      latestVersion: null,
      eolDate: null,
      status: 'current',
      daysUntilEol: null,
      cycle: expressCycle
    });
  }

  // TypeScript
  const tsVersion = await getPackageVersion('typescript');
  if (tsVersion !== 'Unknown') {
    components.push({
      name: 'TypeScript',
      version: tsVersion,
      latestVersion: null,
      eolDate: null,
      status: 'current',
      daysUntilEol: null,
      cycle: extractMajorMinor(tsVersion)
    });
  }

  // Update cache
  const now = new Date();
  statusCache = {
    data: components,
    lastChecked: now,
    expiresAt: new Date(now.getTime() + CACHE_DURATION_MS)
  };

  return {
    components: statusCache.data,
    lastChecked: statusCache.lastChecked,
    cacheExpiresAt: statusCache.expiresAt
  };
}
