#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import { existsSync } from 'fs';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
}

function runTest(name: string, testFn: () => { success: boolean; error?: string; details?: string }) {
  try {
    const result = testFn();
    results.push({ name, ...result });
    const icon = result.success ? '✅' : '❌';
    log(`${icon} ${name}`);
    if (!result.success && result.error) {
      log(`   Error: ${result.error}`);
    }
    if (result.details) {
      log(`   ${result.details}`);
    }
  } catch (error: any) {
    results.push({ name, success: false, error: error.message });
    log(`❌ ${name}`);
    log(`   Error: ${error.message}`);
  }
}

function checkDockerInstalled(): { success: boolean; error?: string; details?: string } {
  try {
    const version = execSync('docker --version', { encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, details: version.trim() };
  } catch {
    return { success: true, details: 'Docker not available (optional for pre-build checks)' };
  }
}

function checkDockerfileExists(): { success: boolean; error?: string } {
  if (existsSync('Dockerfile')) {
    return { success: true };
  }
  return { success: false, error: 'Dockerfile not found in project root' };
}

function checkDockerComposeExists(): { success: boolean; error?: string; details?: string } {
  if (existsSync('docker-compose.yml') || existsSync('docker-compose.yaml')) {
    return { success: true, details: 'docker-compose.yml found' };
  }
  return { success: true, details: 'docker-compose.yml not found (optional)' };
}

function checkDockerignoreExists(): { success: boolean; error?: string; details?: string } {
  if (existsSync('.dockerignore')) {
    return { success: true, details: '.dockerignore found' };
  }
  return { success: false, error: '.dockerignore not found - builds may be slower/larger' };
}

function checkEntrypointExists(): { success: boolean; error?: string } {
  if (existsSync('docker-entrypoint.sh')) {
    return { success: true };
  }
  return { success: false, error: 'docker-entrypoint.sh not found' };
}

function validateDockerfile(): { success: boolean; error?: string; details?: string } {
  try {
    const dockerfile = execSync('cat Dockerfile', { encoding: 'utf-8' });
    
    const checks = {
      hasMultiStage: dockerfile.includes('AS deps') && dockerfile.includes('AS production'),
      hasNonRootUser: dockerfile.includes('USER nodejs') || dockerfile.includes('USER node'),
      hasHealthcheck: dockerfile.includes('HEALTHCHECK'),
      hasProdOnlyDeps: dockerfile.includes('--omit=dev') || dockerfile.includes('rm -rf node_modules'),
      hasCleanup: dockerfile.includes('npm cache clean') || dockerfile.includes('rm -rf'),
    };
    
    const issues: string[] = [];
    if (!checks.hasMultiStage) issues.push('No multi-stage build detected');
    if (!checks.hasNonRootUser) issues.push('No non-root user configured');
    if (!checks.hasHealthcheck) issues.push('No HEALTHCHECK defined');
    
    if (issues.length > 0) {
      return { success: false, error: issues.join(', ') };
    }
    
    return { 
      success: true, 
      details: 'Multi-stage build, non-root user, healthcheck configured' 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function checkRequiredFiles(): { success: boolean; error?: string; details?: string } {
  const requiredFiles = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'drizzle.config.ts',
    'server/index.ts',
    'shared/schema.ts',
  ];
  
  const missing = requiredFiles.filter(f => !existsSync(f));
  
  if (missing.length > 0) {
    return { success: false, error: `Missing required files: ${missing.join(', ')}` };
  }
  
  return { success: true, details: `All ${requiredFiles.length} required files present` };
}

function checkDbHealthCheckScript(): { success: boolean; error?: string } {
  if (existsSync('server/scripts/dbHealthCheck.ts')) {
    return { success: true };
  }
  return { success: false, error: 'Database health check script not found' };
}

function estimateImageSize(): { success: boolean; error?: string; details?: string } {
  try {
    const packageJson = execSync('cat package.json', { encoding: 'utf-8' });
    const pkg = JSON.parse(packageJson);
    const depCount = Object.keys(pkg.dependencies || {}).length;
    
    const estimatedNodeModules = depCount * 5;
    const chromiumSize = 350;
    const baseImageSize = 200;
    const estimatedTotal = estimatedNodeModules + chromiumSize + baseImageSize;
    
    return {
      success: estimatedTotal < 2000,
      details: `Estimated size: ~${estimatedTotal}MB (${depCount} dependencies + Chromium + base image)`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  log('🐳 Docker Build Verification');
  log('============================');
  log('');
  
  runTest('Docker installed', checkDockerInstalled);
  runTest('Dockerfile exists', checkDockerfileExists);
  runTest('docker-compose.yml exists', checkDockerComposeExists);
  runTest('.dockerignore exists', checkDockerignoreExists);
  runTest('docker-entrypoint.sh exists', checkEntrypointExists);
  runTest('Dockerfile validation', validateDockerfile);
  runTest('Required source files', checkRequiredFiles);
  runTest('Database health check script', checkDbHealthCheckScript);
  runTest('Estimated image size', estimateImageSize);
  
  log('');
  log('============================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    log('');
    log('❌ BUILD VERIFICATION FAILED');
    log('Fix the issues above before building Docker image.');
    process.exit(1);
  }
  
  log('');
  log('✅ BUILD VERIFICATION PASSED');
  log('');
  log('To build the image:');
  log('  docker build -t polly:latest .');
  log('');
  log('To run with docker-compose:');
  log('  docker-compose up -d');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
