import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { db } from '../../db';
import { aiUsageLogs } from '@shared/schema';
import { and, gte, inArray } from 'drizzle-orm';
import { saveAiSettings } from '../../services/aiService';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'KI-Routen (Stub-Anbieter)',
  description: 'Szenario-Tests für KI-Umfrageerstellung, Rate-Limits, Modellliste, Admin-Einstellungen und Transkription gegen einen lokalen OpenAI-kompatiblen Stub',
  severity: 'high' as const,
};

type StubReply = { status: number; body: unknown };

interface StubState {
  chatReplies: StubReply[];
  chatAuthHeaders: string[];
  modelsReply: StubReply;
  modelsCalls: number;
  transcriptionReplies: StubReply[];
  transcriptionAuthHeaders: string[];
}

const PRIMARY_KEY = 'primary-test-key';
const FALLBACK_KEY = 'fallback-test-key';

const stub: StubState = {
  chatReplies: [],
  chatAuthHeaders: [],
  modelsReply: { status: 200, body: { data: [] } },
  modelsCalls: 0,
  transcriptionReplies: [],
  transcriptionAuthHeaders: [],
};

function chatCompletion(content: string | null) {
  return {
    status: 200,
    body: {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'stub-model',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    },
  };
}

function send(res: http.ServerResponse, reply: StubReply) {
  res.writeHead(reply.status, {
    'content-type': 'application/json',
    // Prevent the OpenAI SDK from retrying stubbed error responses with back-off.
    'x-should-retry': 'false',
  });
  res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
}

let stubServer: http.Server;
let stubBaseUrl: string;
let stubOrigin: string;
let app: Express;
let adminAgent: TestAgent;
let regularUser: CreatedTestUser;
const createdUserIds: number[] = [];
const guestSessionIds: string[] = [];
const testStartedAt = new Date();

const ENV_KEYS = ['AI_API_KEY', 'AI_API_KEY_FALLBACK', 'AI_API_URL', 'AI_MODEL'] as const;
const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
let originalAiSetting: unknown;

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    model: 'stub-model',
    apiUrl: stubBaseUrl,
    apiKey: '',
    apiKeyFallback: '',
    allowedModels: ['alpha-model', 'missing-model'],
    guestLimits: { enabled: true, requestsPerHour: null },
    userLimits: { enabled: true, requestsPerHour: null },
    adminLimits: { enabled: true, requestsPerHour: null },
    ...overrides,
  } as any;
}

function guestSession() {
  const id = `ai-cov-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  guestSessionIds.push(id);
  return id;
}

const validSuggestionJson = JSON.stringify({
  pollType: 'not-a-type',
  title: 'T'.repeat(120),
  description: 'Beschreibung',
  options: ['Option A', { text: 'Freitext?', isFreeText: true }, 42],
  settings: {
    resultsPublic: false,
    allowMaybe: 'yes',
    responseMode: 'simple',
    maxSelections: 2,
    allowVoteEdit: true,
  },
});

describe('AI routes against a local OpenAI-compatible stub', () => {
  beforeAll(async () => {
    stubServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const auth = String(req.headers.authorization || '');
        // Any path prefix is accepted so tests can use distinct base URLs (the models cache is keyed by URL).
        const url = req.url || '';
        if (req.method === 'GET' && url.endsWith('/v1/models')) {
          stub.modelsCalls++;
          return send(res, stub.modelsReply);
        }
        if (req.method === 'POST' && url.endsWith('/v1/chat/completions')) {
          stub.chatAuthHeaders.push(auth);
          return send(res, stub.chatReplies.shift() ?? { status: 500, body: { error: { message: 'no stub reply queued' } } });
        }
        if (req.method === 'POST' && url.endsWith('/v1/audio/transcriptions')) {
          stub.transcriptionAuthHeaders.push(auth);
          return send(res, stub.transcriptionReplies.shift() ?? { status: 500, body: 'no stub reply' });
        }
        send(res, { status: 404, body: { error: { message: 'unknown stub route' } } });
      });
    });
    await new Promise<void>((resolve) => stubServer.listen(0, '127.0.0.1', resolve));
    stubOrigin = `http://127.0.0.1:${(stubServer.address() as AddressInfo).port}`;
    stubBaseUrl = `${stubOrigin}/v1`;

    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.AI_API_KEY = PRIMARY_KEY;
    process.env.AI_API_URL = stubBaseUrl;
    delete process.env.AI_API_KEY_FALLBACK;
    delete process.env.AI_MODEL;

    originalAiSetting = (await storage.getSetting('ai_settings'))?.value;
    await saveAiSettings(baseSettings());

    app = await createTestApp();
    adminAgent = await loginAdminAgent(app);
    regularUser = await createLoggedInUser(app);
    createdUserIds.push(regularUser.id);
  });

  beforeEach(async () => {
    stub.chatReplies = [];
    stub.chatAuthHeaders = [];
    stub.transcriptionReplies = [];
    stub.transcriptionAuthHeaders = [];
    delete process.env.AI_API_KEY_FALLBACK;
    await saveAiSettings(baseSettings());
  });

  afterAll(async () => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    if (originalAiSetting !== undefined) {
      await saveAiSettings(originalAiSetting as any);
    } else {
      // Resets the in-memory caches, then removes the row so defaults apply again.
      await saveAiSettings(baseSettings());
      await storage.deleteSetting('ai_settings');
    }
    const userIds = [...createdUserIds];
    if (guestSessionIds.length > 0) {
      await db.delete(aiUsageLogs).where(inArray(aiUsageLogs.sessionId, guestSessionIds));
    }
    await db.delete(aiUsageLogs).where(gte(aiUsageLogs.createdAt, testStartedAt));
    for (const id of userIds) {
      await storage.deleteUser(id).catch(() => {});
    }
    await new Promise<void>((resolve) => stubServer.close(() => resolve()));
  });

  describe('GET /api/v1/ai/status', () => {
    it('reports configuration and unlimited quota for a guest', async () => {
      const res = await request(app).get('/api/v1/ai/status').set('x-session-id', guestSession());
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ enabled: true, apiConfigured: true, model: 'stub-model', canUse: true, remaining: null, resetAt: null });
      expect(res.body.limits.guest).toEqual({ enabled: true, requestsPerHour: null });
    });

    it('reports AI_DISABLED when the admin explicitly disabled the feature', async () => {
      await saveAiSettings(baseSettings({ enabled: false }));
      const res = await request(app).get('/api/v1/ai/status').set('x-session-id', guestSession());
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.canUse).toBe(false);
      expect(res.body.reason).toBe('AI_DISABLED');
    });
  });

  describe('POST /api/v1/ai/create-poll', () => {
    it('normalises a valid suggestion and logs usage', async () => {
      stub.chatReplies.push(chatCompletion(`Here you go:\n${validSuggestionJson}\nThanks`));
      const res = await regularUser.agent.post('/api/v1/ai/create-poll').send({ description: 'Plan a team lunch', language: 'en' });
      expect(res.status).toBe(200);
      const { suggestion } = res.body;
      expect(suggestion.pollType).toBe('survey');
      expect(suggestion.title).toHaveLength(80);
      expect(suggestion.options).toEqual(['Option A', { text: 'Freitext?', isFreeText: true }, '42']);
      expect(suggestion.settings).toEqual({ resultsPublic: false, allowVoteEdit: true, responseMode: 'simple', maxSelections: 2 });
      expect(res.headers['x-ai-ratelimit-remaining']).toBe('unlimited');
      expect(stub.chatAuthHeaders).toEqual([`Bearer ${PRIMARY_KEY}`]);

      const logs = await db.select().from(aiUsageLogs).where(and(gte(aiUsageLogs.createdAt, testStartedAt), inArray(aiUsageLogs.userId, [regularUser.id])));
      expect(logs.some((l) => l.endpoint === 'create-poll' && l.success)).toBe(true);
    });

    it('rejects invalid input with 400', async () => {
      const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ungültige Eingabe');
    });

    it('refines a previous suggestion and keeps the previous type when the AI returns an invalid one', async () => {
      stub.chatReplies.push(chatCompletion(JSON.stringify({ pollType: 'bogus', title: 'Refined', options: ['Only one'] })));
      const res = await request(app)
        .post('/api/v1/ai/create-poll')
        .set('x-session-id', guestSession())
        .send({
          description: 'Sommerfest helpers',
          refinement: 'Only one slot please',
          previousSuggestion: { pollType: 'organization', title: 'Helpers', description: '', options: ['A', 'B'] },
        });
      expect(res.status).toBe(200);
      expect(res.body.suggestion).toMatchObject({ pollType: 'organization', title: 'Refined', options: ['Only one'], settings: {} });
    });

    it.each([
      ['empty content', chatCompletion(''), 502, 'AI_EMPTY_RESPONSE'],
      ['content without JSON', chatCompletion('I cannot help with that'), 502, 'AI_INVALID_JSON'],
      ['too few options', chatCompletion(JSON.stringify({ title: 'x', options: ['one'] })), 502, 'AI_INVALID_STRUCTURE'],
      ['upstream 401', { status: 401, body: { error: { message: 'bad key' } } }, 502, 'AI_UPSTREAM_AUTH_FAILED'],
      ['upstream 404', { status: 404, body: { error: { message: 'no model' } } }, 502, 'AI_UPSTREAM_NOT_FOUND'],
      ['upstream 422', { status: 422, body: { error: { message: 'bad request' } } }, 502, 'AI_UPSTREAM_BAD_REQUEST'],
      ['upstream 429 without fallback', { status: 429, body: { error: { message: 'slow down' } } }, 503, 'AI_UPSTREAM_RATE_LIMITED'],
      ['upstream 418', { status: 418, body: { error: { message: 'teapot' } } }, 502, 'AI_UPSTREAM_418'],
      ['model loading 503', { status: 503, body: { error: { message: 'loading' } } }, 503, 'AI_MODEL_LOADING'],
    ] as const)('maps %s to a stable error code', async (_label, reply, status, code) => {
      stub.chatReplies.push(reply as StubReply);
      const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'Plan a meeting next week' });
      expect(res.status).toBe(status);
      expect(res.body.code).toBe(code);
    });

    it('retries with the fallback key when the primary key is rate-limited', async () => {
      process.env.AI_API_KEY_FALLBACK = FALLBACK_KEY;
      stub.chatReplies.push({ status: 429, body: { error: { message: 'rate limit' } } });
      stub.chatReplies.push(chatCompletion(validSuggestionJson));
      const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'Plan a meeting next week' });
      expect(res.status).toBe(200);
      expect(stub.chatAuthHeaders).toEqual([`Bearer ${PRIMARY_KEY}`, `Bearer ${FALLBACK_KEY}`]);
    });

    it('also uses the fallback key for refinements', async () => {
      process.env.AI_API_KEY_FALLBACK = FALLBACK_KEY;
      stub.chatReplies.push({ status: 429, body: { error: { message: 'quota exceeded' } } });
      stub.chatReplies.push(chatCompletion(JSON.stringify({ pollType: 'schedule', title: 'R', options: ['01.01.2030 10:00 - 11:00'] })));
      const res = await request(app)
        .post('/api/v1/ai/create-poll')
        .set('x-session-id', guestSession())
        .send({
          description: 'Termin finden',
          refinement: 'Nur ein Termin',
          previousSuggestion: { pollType: 'schedule', title: 'T', description: '', options: ['a'] },
        });
      expect(res.status).toBe(200);
      expect(res.body.suggestion.pollType).toBe('schedule');
      expect(stub.chatAuthHeaders).toHaveLength(2);
    });

    it('returns 429 AI_DISABLED from the middleware when the feature is off', async () => {
      await saveAiSettings(baseSettings({ enabled: false }));
      const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'Plan a meeting' });
      expect(res.status).toBe(429);
      expect(res.body.reason).toBe('AI_DISABLED');
    });

    it('blocks guests when guest access is disabled', async () => {
      await saveAiSettings(baseSettings({ guestLimits: { enabled: false, requestsPerHour: 0 } }));
      const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'Plan a meeting' });
      expect(res.status).toBe(429);
      expect(res.body.reason).toBe('GUEST_NOT_ALLOWED');
    });

    it('enforces the hourly quota per guest session', async () => {
      await saveAiSettings(baseSettings({ guestLimits: { enabled: true, requestsPerHour: 1 } }));
      const session = guestSession();
      stub.chatReplies.push(chatCompletion(validSuggestionJson));
      const first = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', session).send({ description: 'Plan a meeting' });
      expect(first.status).toBe(200);
      expect(first.headers['x-ai-ratelimit-remaining']).toBe('0');

      const second = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', session).send({ description: 'Plan a meeting' });
      expect(second.status).toBe(429);
      expect(second.body.reason).toBe('RATE_LIMIT_EXCEEDED');
      expect(second.body.resetAt).toBeTruthy();
    });

    it('reports AI_NOT_CONFIGURED when no key is available', async () => {
      delete process.env.AI_API_KEY;
      try {
        await saveAiSettings(baseSettings());
        const res = await request(app).post('/api/v1/ai/create-poll').set('x-session-id', guestSession()).send({ description: 'Plan a meeting' });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('AI_NOT_CONFIGURED');
      } finally {
        process.env.AI_API_KEY = PRIMARY_KEY;
      }
    });
  });

  describe('POST /api/v1/ai/apply', () => {
    it('creates a schedule poll and parses date/time options', async () => {
      const res = await adminAgent.post('/api/v1/ai/apply').send({
        suggestion: {
          pollType: 'schedule',
          title: 'AI Schedule',
          options: ['15.07.2030 09:00 - 10:30', 'Irgendwann'],
          settings: { allowMaybe: true },
        },
        settings: { resultsPublic: false },
      });
      expect(res.status).toBe(200);
      expect(res.body.poll.type).toBe('schedule');
      expect(res.body.poll.resultsPublic).toBe(false);
      const [dated, undated] = res.body.poll.options;
      expect(new Date(dated.startTime).getHours()).toBe(9);
      expect(new Date(dated.endTime).getMinutes()).toBe(30);
      expect(undated.startTime).toBeNull();
    });

    it('creates an organization poll and extracts capacity', async () => {
      const res = await request(app).post('/api/v1/ai/apply').send({
        suggestion: {
          pollType: 'organization',
          title: 'AI Orga',
          options: ['Aufbau 08:00 - 10:00 (max. 5)', { text: 'Kuchen (max 2 Personen)' }, '10:00 - 12:00'],
        },
        settings: {},
        creatorEmail: `ai-apply-${Date.now()}@guest.example`,
      });
      expect(res.status).toBe(200);
      expect(res.body.poll.allowMultipleSlots).toBe(false);
      const opts = res.body.poll.options;
      expect(opts.map((o: any) => [o.text, o.maxCapacity])).toEqual([
        ['Aufbau', 5],
        ['Kuchen', 2],
        ['10:00 - 12:00', null],
      ]);
      expect(res.body.publicToken).toBeTruthy();
      expect(res.body.adminToken).toBeTruthy();
    });

    it('creates a survey with free-text options', async () => {
      const res = await regularUser.agent.post('/api/v1/ai/apply').send({
        suggestion: { pollType: 'survey', title: 'AI Survey', options: [{ text: 'Wie war es?', isFreeText: true }, 'Gut'] },
        settings: { allowVoteEdit: true },
      });
      expect(res.status).toBe(200);
      expect(res.body.poll.userId).toBe(regularUser.id);
      expect(res.body.poll.allowVoteEdit).toBe(true);
    });

    it('requires login when a guest uses a registered email', async () => {
      const res = await request(app).post('/api/v1/ai/apply').send({
        suggestion: { pollType: 'survey', title: 'X', options: ['a'] },
        settings: {},
        creatorEmail: regularUser.email.toUpperCase(),
      });
      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('REQUIRES_LOGIN');
    });

    it('rejects guests when guest poll creation is disabled', async () => {
      const original = await storage.getCustomizationSettings();
      await storage.setCustomizationSettings({ ...original, guestAccess: { ...original.guestAccess, allowGuestPollCreation: false } });
      try {
        const res = await request(app).post('/api/v1/ai/apply').send({
          suggestion: { pollType: 'survey', title: 'X', options: ['a'] },
          settings: {},
        });
        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe('GUEST_POLL_CREATION_DISABLED');
      } finally {
        await storage.setCustomizationSettings(original);
      }
    });

    it('validates the payload', async () => {
      const res = await request(app).post('/api/v1/ai/apply').send({ suggestion: { pollType: 'survey', title: '', options: [] }, settings: {} });
      expect(res.status).toBe(400);
    });
  });

  describe('admin endpoints', () => {
    it.each(['/api/v1/ai/admin/settings', '/api/v1/ai/models', '/api/v1/ai/admin/usage'])('GET %s requires an admin', async (path) => {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await regularUser.agent.get(path)).status).toBe(403);
    });

    it('PUT/POST admin endpoints reject non-admins', async () => {
      expect((await regularUser.agent.put('/api/v1/ai/admin/settings').send({})).status).toBe(403);
      expect((await regularUser.agent.post('/api/v1/ai/admin/check')).status).toBe(403);
    });

    it('GET /admin/settings never leaks API keys', async () => {
      await saveAiSettings(baseSettings({ apiKey: 'db-secret', apiKeyFallback: 'db-fallback' }));
      const res = await adminAgent.get('/api/v1/ai/admin/settings');
      expect(res.status).toBe(200);
      expect(res.body.settings.apiKey).toBeUndefined();
      expect(res.body.settings.apiKeyFallback).toBeUndefined();
      expect(res.body).toMatchObject({ apiConfigured: true, hasApiKey: true, hasApiKeyFallback: true, apiKeyViaEnv: true, apiUrlViaEnv: true });
    });

    it('PUT /admin/settings keeps stored keys when omitted and clears them on __CLEAR__', async () => {
      await saveAiSettings(baseSettings({ apiKey: 'keep-me', apiKeyFallback: 'keep-fallback' }));
      const keep = await adminAgent.put('/api/v1/ai/admin/settings').send(baseSettings({ apiKey: '', apiKeyFallback: '' }));
      expect(keep.status).toBe(200);
      expect(keep.body.settings.apiKey).toBeUndefined();
      let stored = (await storage.getSetting('ai_settings'))?.value as any;
      expect(stored.apiKey).toBe('keep-me');
      expect(stored.apiKeyFallback).toBe('keep-fallback');

      const clear = await adminAgent.put('/api/v1/ai/admin/settings').send(baseSettings({ apiKey: '__CLEAR__', apiKeyFallback: '__CLEAR__' }));
      expect(clear.status).toBe(200);
      stored = (await storage.getSetting('ai_settings'))?.value as any;
      expect(stored.apiKey).toBe('');
      expect(stored.apiKeyFallback).toBe('');

      const invalid = await adminAgent.put('/api/v1/ai/admin/settings').send({ enabled: 'nope' });
      expect(invalid.status).toBe(400);
    });

    it('GET /models lists provider models sorted and caches the result', async () => {
      // Use a distinct base URL so the module-level cache from other tests does not interfere.
      process.env.AI_API_URL = `${stubOrigin}/models-list/v1/`;
      try {
        stub.modelsReply = { status: 200, body: { data: [{ id: 'zeta', object: 'model', owned_by: 'x' }, { id: 'alpha-model' }, { nope: true }] } };
        const callsBefore = stub.modelsCalls;
        const first = await adminAgent.get('/api/v1/ai/models');
        expect(first.status).toBe(200);
        expect(first.body.models.map((m: any) => m.id)).toEqual(['alpha-model', 'zeta']);
        expect(first.body.cached).toBe(false);
        const second = await adminAgent.get('/api/v1/ai/models');
        expect(second.body.cached).toBe(true);
        expect(stub.modelsCalls - callsBefore).toBe(1);
      } finally {
        process.env.AI_API_URL = stubBaseUrl;
      }
    });

    it('GET /models maps upstream failures and returns an empty list', async () => {
      process.env.AI_API_URL = `${stubOrigin}/models-error/v1`;
      try {
        stub.modelsReply = { status: 401, body: 'not json' };
        const res = await adminAgent.get('/api/v1/ai/models');
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('AI_UPSTREAM_AUTH_FAILED');
        expect(res.body.models).toEqual([]);
      } finally {
        process.env.AI_API_URL = stubBaseUrl;
      }
    });

    it('POST /admin/check reports primary/fallback status and advertised models', async () => {
      process.env.AI_API_URL = `${stubOrigin}/admin-check/v1`;
      try {
        stub.modelsReply = { status: 200, body: { data: [{ id: 'alpha-model' }, { id: 'stub-model' }] } };
        const ok = await adminAgent.post('/api/v1/ai/admin/check');
        expect(ok.status).toBe(200);
        expect(ok.body.primary).toMatchObject({ configured: true, ok: true, status: 200, modelCount: 2 });
        expect(ok.body.fallback).toMatchObject({ configured: false, ok: false, message: 'No key configured' });
        expect(ok.body.activeModelAdvertised).toBe(true);
        expect(ok.body.allowedModelsAdvertised).toEqual(['alpha-model']);
        expect(ok.body.missingAllowedModels).toEqual(['missing-model']);

        process.env.AI_API_KEY_FALLBACK = FALLBACK_KEY;
        stub.modelsReply = { status: 429, body: { error: { message: 'busy' } } };
        const failing = await adminAgent.post('/api/v1/ai/admin/check');
        expect(failing.status).toBe(200);
        expect(failing.body.primary).toMatchObject({ configured: true, ok: false, status: 429, message: 'busy' });
        expect(failing.body.fallback).toMatchObject({ configured: true, ok: false, status: 429 });
        expect(failing.body.liveModelsAvailable).toBe(false);
      } finally {
        process.env.AI_API_URL = stubBaseUrl;
      }
    });

    it('GET /admin/usage summarises the last 24h', async () => {
      const res = await adminAgent.get('/api/v1/ai/admin/usage');
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.successful + res.body.failed).toBe(res.body.total);
      expect(res.body.uniqueGuests).toBeGreaterThan(0);
      expect(res.body.logs.length).toBeLessThanOrEqual(50);
    });
  });

  describe('POST /api/v1/ai/transcribe', () => {
    const wav = Buffer.alloc(2048, 1);

    it('requires an audio file', async () => {
      const res = await request(app).post('/api/v1/ai/transcribe');
      expect(res.status).toBe(400);
    });

    it('returns empty text for very short recordings without calling the provider', async () => {
      const res = await request(app).post('/api/v1/ai/transcribe').attach('audio', Buffer.alloc(10), { filename: 'a.wav', contentType: 'audio/wav' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, text: '' });
      expect(stub.transcriptionAuthHeaders).toHaveLength(0);
    });

    it('transcribes audio and passes the language through', async () => {
      stub.transcriptionReplies.push({ status: 200, body: { text: '  Hallo Welt  ', language: 'de' } });
      const res = await request(app).post('/api/v1/ai/transcribe').field('language', 'de').attach('audio', wav, { filename: 'a.wav', contentType: 'audio/wav' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, text: 'Hallo Welt', language: 'de' });
    });

    it('filters known Whisper hallucinations', async () => {
      stub.transcriptionReplies.push({ status: 200, body: { text: 'Vielen Dank fürs Zuschauen!' } });
      const res = await request(app).post('/api/v1/ai/transcribe').attach('audio', wav, { filename: 'a.mp3', contentType: 'audio/mpeg' });
      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
    });

    it('retries with the fallback key on 429 and surfaces provider errors', async () => {
      process.env.AI_API_KEY_FALLBACK = FALLBACK_KEY;
      stub.transcriptionReplies.push({ status: 429, body: 'busy' });
      stub.transcriptionReplies.push({ status: 500, body: 'boom' });
      const res = await request(app).post('/api/v1/ai/transcribe').attach('audio', wav, { filename: 'a.wav', contentType: 'audio/wav' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Transkription fehlgeschlagen (500)');
      expect(stub.transcriptionAuthHeaders).toEqual([`Bearer ${PRIMARY_KEY}`, `Bearer ${FALLBACK_KEY}`]);
    });

    it('returns 503 when no API key is configured', async () => {
      delete process.env.AI_API_KEY;
      try {
        await saveAiSettings(baseSettings());
        const res = await request(app).post('/api/v1/ai/transcribe').attach('audio', wav, { filename: 'a.wav', contentType: 'audio/wav' });
        expect(res.status).toBe(503);
      } finally {
        process.env.AI_API_KEY = PRIMARY_KEY;
      }
    });
  });
});
