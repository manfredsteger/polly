import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { testModeMiddleware } from '../../routes/common';
import authRouter from '../../routes/auth';
import { apiRateLimiter } from '../../services/apiRateLimiterService';
import { loginRateLimiter } from '../../services/rateLimiterService';
import { errorHandler } from '../../lib/errorHandler';
import { storage } from '../../storage';
import {
  getActiveTestModeSecret,
  isTestModeEnabled,
  isValidTestModeHeader,
  logTestModeStatus,
  MIN_TEST_MODE_SECRET_LENGTH,
} from '../../lib/testMode';

export const testMeta = {
  category: 'security' as const,
  name: 'Testmodus-Freigabe',
  description: 'Der X-Test-Mode-Header wirkt nur mit ENABLE_TEST_MODE=true und einem TEST_MODE_SECRET (≥ 32 Zeichen); der alte öffentliche Standardwert wirkt nie',
  severity: 'critical' as const,
};

const LEGACY_PUBLIC_SECRET = 'polly-e2e-test-mode';
const STRONG_SECRET = 'a'.repeat(24) + nanoid(16); // 40 chars
const SHORT_SECRET = 'b'.repeat(MIN_TEST_MODE_SECRET_LENGTH - 1);

const ENV_KEYS = ['ENABLE_TEST_MODE', 'TEST_MODE_SECRET'] as const;
let savedEnv: Record<string, string | undefined> = {};

function setGate(enable: string | undefined, secret: string | undefined) {
  if (enable === undefined) delete process.env.ENABLE_TEST_MODE;
  else process.env.ENABLE_TEST_MODE = enable;
  if (secret === undefined) delete process.env.TEST_MODE_SECRET;
  else process.env.TEST_MODE_SECRET = secret;
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** Minimal app: only the real test-mode middleware decides req.isTestMode. */
function buildProbeApp(): Express {
  const app = express();
  app.use(testModeMiddleware);
  app.get('/probe', (req: Request, res: Response) => {
    res.json({ isTestMode: req.isTestMode === true });
  });
  return app;
}

async function probe(app: Express, header?: string | string[]) {
  const req = request(app).get('/probe');
  if (header !== undefined) req.set('X-Test-Mode', header as string);
  const res = await req;
  return res.body.isTestMode as boolean;
}

describe('Test-mode gate – configuration', () => {
  it('is disabled when neither variable is set', () => {
    expect(getActiveTestModeSecret({})).toBeNull();
    expect(isTestModeEnabled({})).toBe(false);
  });

  it('is disabled without ENABLE_TEST_MODE even with a strong secret', () => {
    expect(isTestModeEnabled({ TEST_MODE_SECRET: STRONG_SECRET })).toBe(false);
  });

  it('only accepts the exact value "true" for ENABLE_TEST_MODE', () => {
    for (const value of ['1', 'yes', 'TRUE', 'True', ' true', 'false', '']) {
      expect(isTestModeEnabled({ ENABLE_TEST_MODE: value, TEST_MODE_SECRET: STRONG_SECRET })).toBe(false);
    }
  });

  it('is disabled without a secret', () => {
    expect(isTestModeEnabled({ ENABLE_TEST_MODE: 'true' })).toBe(false);
    expect(isTestModeEnabled({ ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: '' })).toBe(false);
  });

  it('is disabled with a secret shorter than 32 characters', () => {
    expect(isTestModeEnabled({ ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: SHORT_SECRET })).toBe(false);
  });

  it('is enabled with ENABLE_TEST_MODE=true and a secret of exactly 32 characters', () => {
    const exact = 'c'.repeat(MIN_TEST_MODE_SECRET_LENGTH);
    expect(getActiveTestModeSecret({ ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: exact })).toBe(exact);
  });

  it('never accepts the legacy public default, whatever the configuration', () => {
    const envs = [
      {},
      { ENABLE_TEST_MODE: 'true' },
      { ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: LEGACY_PUBLIC_SECRET },
      { ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: STRONG_SECRET },
      { TEST_MODE_SECRET: LEGACY_PUBLIC_SECRET },
    ];
    for (const env of envs) {
      expect(isValidTestModeHeader(LEGACY_PUBLIC_SECRET, env)).toBe(false);
    }
  });

  it('rejects wrong, prefix, longer, empty and multi-value headers', () => {
    const env = { ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: STRONG_SECRET };
    expect(isValidTestModeHeader(STRONG_SECRET, env)).toBe(true);
    expect(isValidTestModeHeader(undefined, env)).toBe(false);
    expect(isValidTestModeHeader('', env)).toBe(false);
    expect(isValidTestModeHeader(STRONG_SECRET.slice(0, -1), env)).toBe(false);
    expect(isValidTestModeHeader(STRONG_SECRET + 'x', env)).toBe(false);
    expect(isValidTestModeHeader(STRONG_SECRET.slice(0, -1) + 'Z', env)).toBe(false);
    expect(isValidTestModeHeader([STRONG_SECRET, STRONG_SECRET], env)).toBe(false);
  });
});

describe('Test-mode gate – middleware', () => {
  const app = buildProbeApp();

  it('ignores the header without ENABLE_TEST_MODE, even with the correct secret', async () => {
    setGate(undefined, STRONG_SECRET);
    expect(await probe(app, STRONG_SECRET)).toBe(false);
  });

  it('ignores the header without a secret', async () => {
    setGate('true', undefined);
    expect(await probe(app, LEGACY_PUBLIC_SECRET)).toBe(false);
    expect(await probe(app, '')).toBe(false);
  });

  it('ignores the header when the secret is too short, even if it matches', async () => {
    setGate('true', SHORT_SECRET);
    expect(await probe(app, SHORT_SECRET)).toBe(false);
  });

  it('ignores the legacy public default value', async () => {
    setGate(undefined, undefined);
    expect(await probe(app, LEGACY_PUBLIC_SECRET)).toBe(false);
    setGate('true', STRONG_SECRET);
    expect(await probe(app, LEGACY_PUBLIC_SECRET)).toBe(false);
  });

  it('activates test mode only for the matching header when the gate is open', async () => {
    setGate('true', STRONG_SECRET);
    expect(await probe(app, STRONG_SECRET)).toBe(true);
    expect(await probe(app, 'wrong-secret')).toBe(false);
    expect(await probe(app)).toBe(false);
  });
});

describe('Test-mode gate – rate limiting stays enforced', () => {
  const LIMITER = `test-mode-gate-${nanoid(6)}`;
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(testModeMiddleware);
    app.get(
      '/limited',
      apiRateLimiter.createMiddleware(LIMITER, { windowMs: 60_000, maxRequests: 2, message: 'limited' }),
      (_req, res) => res.json({ ok: true }),
    );
    app.use(errorHandler);
  });

  beforeEach(() => apiRateLimiter.clearAll(LIMITER));
  afterAll(() => apiRateLimiter.clearAll(LIMITER));

  async function burst(header: string | undefined, count: number) {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const req = request(app).get('/limited');
      if (header !== undefined) req.set('X-Test-Mode', header);
      statuses.push((await req).status);
    }
    return statuses;
  }

  it('blocks with the legacy header when test mode is not configured', async () => {
    setGate(undefined, undefined);
    expect(await burst(LEGACY_PUBLIC_SECRET, 3)).toEqual([200, 200, 429]);
  });

  it('blocks with the correct secret when ENABLE_TEST_MODE is missing', async () => {
    setGate(undefined, STRONG_SECRET);
    expect(await burst(STRONG_SECRET, 3)).toEqual([200, 200, 429]);
  });

  it('blocks with a too-short secret', async () => {
    setGate('true', SHORT_SECRET);
    expect(await burst(SHORT_SECRET, 3)).toEqual([200, 200, 429]);
  });

  it('is bypassed only when the gate is open and the header matches', async () => {
    setGate('true', STRONG_SECRET);
    expect(await burst(STRONG_SECRET, 4)).toEqual([200, 200, 200, 200]);
    apiRateLimiter.clearAll(LIMITER);
    expect(await burst('wrong', 3)).toEqual([200, 200, 429]);
  });
});

describe('Test-mode gate – login to test accounts stays blocked', () => {
  const MemoryStore = createMemoryStore(session);
  const password = 'GateTest123!';
  const username = `gate_${nanoid(8)}`;
  const email = `${username}@test.local`;
  let userId: number | undefined;
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-mode-gate-session-secret',
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86_400_000 }),
    }));
    app.use(testModeMiddleware);
    app.use('/api/v1/auth', authRouter);
    app.use(errorHandler);

    const user = await storage.createUser({
      email,
      username,
      name: 'Test Mode Gate User',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'user',
      provider: 'local',
      isTestData: true,
    });
    userId = user.id;
  });

  // Each case starts without lockout from earlier failed attempts.
  beforeEach(() => loginRateLimiter.clearAll());

  afterAll(async () => {
    loginRateLimiter.clearAll();
    if (userId !== undefined) await storage.deleteUser(userId);
  });

  function login(header?: string) {
    const req = request(app).post('/api/v1/auth/login');
    if (header !== undefined) req.set('X-Test-Mode', header);
    return req.send({ usernameOrEmail: username, password });
  }

  it('rejects the test account without any header', async () => {
    setGate(undefined, undefined);
    expect((await login()).status).toBe(401);
  });

  it('rejects the test account with the legacy public header value', async () => {
    setGate(undefined, undefined);
    expect((await login(LEGACY_PUBLIC_SECRET)).status).toBe(401);
  });

  it('rejects the test account with the correct secret when ENABLE_TEST_MODE is missing', async () => {
    setGate(undefined, STRONG_SECRET);
    expect((await login(STRONG_SECRET)).status).toBe(401);
  });

  it('rejects the test account when the secret is too short', async () => {
    setGate('true', SHORT_SECRET);
    expect((await login(SHORT_SECRET)).status).toBe(401);
  });

  it('allows the test account only when the gate is open and the header matches', async () => {
    setGate('true', STRONG_SECRET);
    expect((await login('wrong')).status).toBe(401);
    const ok = await login(STRONG_SECRET);
    expect(ok.status).toBe(200);
    expect(ok.body.user?.username).toBe(username);
  });
});

describe('Test-mode gate – deployment and CI configuration', () => {
  const root = resolve(__dirname, '../../..');
  const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
  // Repository-only files are not shipped in the runtime Docker image, where the
  // admin test runner executes this suite; skip those checks there.
  const inRepo = (...files: string[]) => files.every((f) => existsSync(resolve(root, f)));

  it.skipIf(!inRepo('docker-compose.yml'))('docker-compose.yml does not preset ENABLE_TEST_MODE or TEST_MODE_SECRET', () => {
    const compose = read('docker-compose.yml');
    expect(compose).not.toContain(LEGACY_PUBLIC_SECRET);
    expect(compose).not.toMatch(/^\s*(ENABLE_TEST_MODE|TEST_MODE_SECRET)\s*:/m);
  });

  it.skipIf(!inRepo('.env.example'))('.env.example documents both variables without example values', () => {
    const example = read('.env.example');
    expect(example).not.toContain(LEGACY_PUBLIC_SECRET);
    expect(example).toMatch(/^# ENABLE_TEST_MODE=$/m);
    expect(example).toMatch(/^# TEST_MODE_SECRET=$/m);
    expect(example).not.toMatch(/^\s*(ENABLE_TEST_MODE|TEST_MODE_SECRET)=\S/m);
  });

  const ciFiles = ['e2e/comprehensive.spec.ts', '.github/workflows/ci.yml', '.gitlab-ci.yml', 'Makefile', 'playwright.config.ts'];

  it.skipIf(!inRepo(...ciFiles))('E2E specs, CI pipelines and Makefile never hard-code the legacy value', () => {
    for (const file of ciFiles) {
      expect(read(file), file).not.toContain(LEGACY_PUBLIC_SECRET);
    }
  });

  it.skipIf(!inRepo('.github/workflows/ci.yml', '.gitlab-ci.yml'))('CI pipelines generate a random TEST_MODE_SECRET per run and enable test mode', () => {
    const github = read('.github/workflows/ci.yml');
    expect(github).toMatch(/openssl rand -hex 32/);
    expect(github).toMatch(/TEST_MODE_SECRET=\$secret/);
    expect(github).toMatch(/ENABLE_TEST_MODE: 'true'/);

    const gitlab = read('.gitlab-ci.yml');
    expect(gitlab).toMatch(/export TEST_MODE_SECRET=.*randomBytes\(32\)/);
    expect(gitlab).toMatch(/ENABLE_TEST_MODE: "true"/);
  });
});

describe('Test-mode gate – startup warning', () => {
  it('warns loudly when test mode is active in production', () => {
    const warn = vi.fn();
    const messages = logTestModeStatus(
      { NODE_ENV: 'production', ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: STRONG_SECRET },
      { warn },
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('[SECURITY] Test mode is enabled');
    expect(warn).toHaveBeenCalledWith(messages[0]);
  });

  it('warns that a misconfigured gate stays closed', () => {
    const warn = vi.fn();
    const messages = logTestModeStatus({ NODE_ENV: 'production', ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: SHORT_SECRET }, { warn });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('ignored');
    expect(messages[0]).not.toContain('Test mode is enabled');
  });

  it('stays silent when test mode is off, or on outside production', () => {
    const warn = vi.fn();
    expect(logTestModeStatus({ NODE_ENV: 'production' }, { warn })).toEqual([]);
    expect(logTestModeStatus({ NODE_ENV: 'production', TEST_MODE_SECRET: STRONG_SECRET }, { warn })).toEqual([]);
    expect(logTestModeStatus({ NODE_ENV: 'test', ENABLE_TEST_MODE: 'true', TEST_MODE_SECRET: STRONG_SECRET }, { warn })).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});
