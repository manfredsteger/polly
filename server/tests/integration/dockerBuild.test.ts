import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const PROJECT_ROOT = path.join(__dirname, '../../..');

describe('Docker Build Configuration Tests', () => {
  describe('Required Files', () => {
    it('should have Dockerfile in project root', () => {
      const dockerfilePath = path.join(PROJECT_ROOT, 'Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);
    });

    it('should have docker-compose.yml in project root', () => {
      const composePath = path.join(PROJECT_ROOT, 'docker-compose.yml');
      const composeYamlPath = path.join(PROJECT_ROOT, 'docker-compose.yaml');
      expect(existsSync(composePath) || existsSync(composeYamlPath)).toBe(true);
    });

    it('should have .dockerignore in project root', () => {
      const dockerignorePath = path.join(PROJECT_ROOT, '.dockerignore');
      expect(existsSync(dockerignorePath)).toBe(true);
    });

    it('should have docker-entrypoint.sh in project root', () => {
      const entrypointPath = path.join(PROJECT_ROOT, 'docker-entrypoint.sh');
      expect(existsSync(entrypointPath)).toBe(true);
    });
  });

  describe('Dockerfile Quality', () => {
    let dockerfile: string;

    beforeAll(() => {
      dockerfile = readFileSync(path.join(PROJECT_ROOT, 'Dockerfile'), 'utf-8');
    });

    it('should use multi-stage build', () => {
      expect(dockerfile).toContain('AS deps');
      expect(dockerfile).toContain('AS builder');
      expect(dockerfile).toContain('AS production');
    });

    it('should use non-root user for security', () => {
      expect(dockerfile).toMatch(/USER\s+(nodejs|node)/);
    });

    it('should have HEALTHCHECK configured', () => {
      expect(dockerfile).toContain('HEALTHCHECK');
    });

    it('should set NODE_ENV to production', () => {
      expect(dockerfile).toContain('NODE_ENV=production');
    });

    it('should clean npm cache to reduce size', () => {
      expect(dockerfile).toContain('npm cache clean');
    });

    it('should configure Puppeteer to skip Chromium download', () => {
      expect(dockerfile).toContain('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true');
    });

    it('should use system Chromium instead of bundled', () => {
      expect(dockerfile).toContain('PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium');
    });

    it('should skip Puppeteer Chromium download to save space', () => {
      expect(dockerfile).toContain('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true');
    });
  });

  describe('docker-entrypoint.sh Quality', () => {
    let entrypoint: string;

    beforeAll(() => {
      entrypoint = readFileSync(path.join(PROJECT_ROOT, 'docker-entrypoint.sh'), 'utf-8');
    });

    it('should wait for database to be ready', () => {
      expect(entrypoint).toContain('pg_isready');
    });

    it('should run database migrations', () => {
      expect(entrypoint).toContain('drizzle-kit push');
    });

    it('should run database health check', () => {
      expect(entrypoint).toContain('dbHealthCheck');
    });

    it('should fail on migration errors', () => {
      expect(entrypoint).toContain('exit 1');
    });

    it('should seed admin user', () => {
      expect(entrypoint).toContain('seed-admin');
    });
  });

  describe('.dockerignore Quality', () => {
    let dockerignore: string;

    beforeAll(() => {
      dockerignore = readFileSync(path.join(PROJECT_ROOT, '.dockerignore'), 'utf-8');
    });

    it('should exclude node_modules', () => {
      expect(dockerignore).toContain('node_modules');
    });

    it('should exclude .git directory', () => {
      expect(dockerignore).toContain('.git');
    });

    it('should exclude test files', () => {
      expect(dockerignore).toMatch(/\*\*?\/?\*\.test\.ts/);
    });

    it('should exclude dist directory', () => {
      expect(dockerignore).toContain('dist');
    });

    it('should exclude Dockerfile itself', () => {
      expect(dockerignore).toContain('Dockerfile');
    });
  });

  describe('Database Health Check Script', () => {
    it('should exist in server/scripts', () => {
      const healthCheckPath = path.join(PROJECT_ROOT, 'server/scripts/dbHealthCheck.ts');
      expect(existsSync(healthCheckPath)).toBe(true);
    });

    it('should check for required tables', () => {
      const healthCheck = readFileSync(
        path.join(PROJECT_ROOT, 'server/scripts/dbHealthCheck.ts'),
        'utf-8'
      );
      expect(healthCheck).toContain('users');
      expect(healthCheck).toContain('polls');
    });

    it('should check for critical auth columns', () => {
      const healthCheck = readFileSync(
        path.join(PROJECT_ROOT, 'server/scripts/dbHealthCheck.ts'),
        'utf-8'
      );
      expect(healthCheck).toContain('password_hash');
      expect(healthCheck).toContain('last_login_at');
    });
  });

  describe('Docker Smoke Test Script', () => {
    it('should exist in server/scripts', () => {
      const smokeTestPath = path.join(PROJECT_ROOT, 'server/scripts/dockerSmokeTest.ts');
      expect(existsSync(smokeTestPath)).toBe(true);
    });

    it('should test login flow', () => {
      const smokeTest = readFileSync(
        path.join(PROJECT_ROOT, 'server/scripts/dockerSmokeTest.ts'),
        'utf-8'
      );
      expect(smokeTest).toContain('login');
      expect(smokeTest).toContain('/api/v1/login');
    });

    it('should test authenticated endpoints', () => {
      const smokeTest = readFileSync(
        path.join(PROJECT_ROOT, 'server/scripts/dockerSmokeTest.ts'),
        'utf-8'
      );
      expect(smokeTest).toContain('/api/v1/me');
    });
  });
});

describe('Image Size Estimation', () => {
  it('should have reasonable number of dependencies', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')
    );
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    
    expect(depCount).toBeLessThan(150);
  });

  it('should exclude large dev dependencies via dockerignore', () => {
    const dockerignore = readFileSync(
      path.join(PROJECT_ROOT, '.dockerignore'),
      'utf-8'
    );
    
    expect(dockerignore).toContain('test');
    expect(dockerignore).toContain('coverage');
  });
});
