import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
  isAppError,
  normalizeError,
} from '../../lib/errors';
import { asyncHandler, errorHandler, notFoundHandler } from '../../lib/errorHandler';
import { logger } from '../../lib/logger';

export const testMeta = {
  category: 'unit' as const,
  name: 'Fehlerbehandlung & Logging',
  description: 'Fehlerklassen, zentrale Fehlerantworten und Log-Level des Servers',
  severity: 'high' as const,
};

function appWith(handler: express.RequestHandler) {
  const app = express();
  app.get('/boom', handler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('error classes', () => {
  it('map each error to its HTTP status and machine-readable code', () => {
    const cases: Array<[AppError, number, string]> = [
      [new ValidationError('bad', { field: 'x' }), 400, 'VALIDATION_ERROR'],
      [new AuthenticationError(), 401, 'UNAUTHORIZED'],
      [new AuthorizationError(), 403, 'FORBIDDEN'],
      [new NotFoundError('Umfrage'), 404, 'NOT_FOUND'],
      [new ConflictError('taken'), 409, 'CONFLICT'],
      [new ConflictError('taken', 'EMAIL_TAKEN'), 409, 'EMAIL_TAKEN'],
      [new RateLimitError(), 429, 'RATE_LIMIT_EXCEEDED'],
      [new ServiceUnavailableError(), 503, 'SERVICE_UNAVAILABLE'],
      [new AppError('x'), 500, 'INTERNAL_ERROR'],
    ];
    for (const [error, status, code] of cases) {
      expect(error.statusCode).toBe(status);
      expect(error.code).toBe(code);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(isAppError(error)).toBe(true);
    }
    expect(new NotFoundError('Umfrage').message).toBe('Umfrage nicht gefunden');
    expect(new NotFoundError().message).toBe('Ressource nicht gefunden');
  });

  it('serializes details only when present', () => {
    expect(new ValidationError('bad', { field: 'x' }).toJSON()).toEqual({ error: 'bad', code: 'VALIDATION_ERROR', details: { field: 'x' } });
    expect(new AuthorizationError().toJSON()).toEqual({ error: 'Keine Berechtigung', code: 'FORBIDDEN' });
  });

  it('normalizes unknown failures to non-operational server errors', () => {
    const known = new ConflictError('taken');
    expect(normalizeError(known)).toBe(known);
    const fromError = normalizeError(new TypeError('oops'));
    expect(fromError).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', isOperational: false, message: 'oops' });
    expect(normalizeError('string thrown')).toMatchObject({ statusCode: 500, code: 'UNKNOWN_ERROR', isOperational: false });
    expect(isAppError(new Error('plain'))).toBe(false);
  });
});

describe('central error handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('answers expected errors with their status, code and details and logs a warning', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const app = appWith(asyncHandler(async () => {
      throw new ValidationError('Titel fehlt', { field: 'title' });
    }));
    const res = await request(app).get('/boom').set('X-Forwarded-For', '203.0.113.9, 10.0.0.1');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Titel fehlt', code: 'VALIDATION_ERROR', errorCode: 'VALIDATION_ERROR', details: { field: 'title' } });
    expect(warn).toHaveBeenCalledWith('ERROR', 'Titel fehlt', expect.objectContaining({ ip: '203.0.113.9', path: '/boom', statusCode: 400 }));
  });

  it('logs unexpected crashes with stack but only exposes the stack in development', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const app = appWith(asyncHandler(async () => {
      throw new Error('db exploded');
    }));

    vi.stubEnv('NODE_ENV', 'production');
    const prod = await request(app).get('/boom');
    expect(prod.status).toBe(500);
    expect(prod.body.stack).toBeUndefined();
    expect(error.mock.calls[0][2]).toHaveProperty('stack');

    vi.stubEnv('NODE_ENV', 'development');
    const dev = await request(app).get('/boom');
    expect(dev.body.stack).toContain('db exploded');
  });

  it('turns unknown routes into a 404 with the route name', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const res = await request(appWith((_req, res) => res.send('ok'))).post('/nowhere');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', error: 'Route POST /nowhere nicht gefunden' });
  });

  it('passes successful async handlers through untouched', async () => {
    const res = await request(appWith(asyncHandler(async (_req, res) => { res.json({ ok: true }); }))).get('/boom');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  function capture() {
    return {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  }

  it('routes each level and helper to the matching console channel with a structured prefix', () => {
    const out = capture();
    (logger as any).minLevel = 'debug';
    logger.debug('CAT', 'dbg');
    logger.info('CAT', 'inf', { userId: 7 });
    logger.warn('CAT', 'wrn');
    logger.error('CAT', 'err');
    logger.security('blocked');
    logger.auth('login');
    logger.db('select');
    logger.request('GET', '/a', 200, 5);
    logger.request('GET', '/b', 404, 5);
    logger.request('GET', '/c', 503, 5);

    expect(out.debug.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^\[.+\] \[DEBUG\] \[CAT\] dbg$/),
      expect.stringContaining('[DB] select'),
    ]);
    expect(out.info.mock.calls[0][0]).toMatch(/\[INFO\] \[CAT\] inf \{"userId":7\}$/);
    expect(out.info.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([
      expect.stringContaining('[AUTH] login'),
      expect.stringContaining('[HTTP] GET /a 200 5ms'),
    ]));
    expect(out.warn.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([
      expect.stringContaining('[SECURITY] blocked'),
      expect.stringContaining('[HTTP] GET /b 404 5ms'),
    ]));
    expect(out.error.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([
      expect.stringContaining('[CAT] err'),
      expect.stringContaining('[HTTP] GET /c 503 5ms'),
    ]));
  });

  it('suppresses messages below the configured level', () => {
    const out = capture();
    const previous = (logger as any).minLevel;
    (logger as any).minLevel = 'warn';
    try {
      logger.debug('CAT', 'hidden');
      logger.info('CAT', 'hidden');
      logger.warn('CAT', 'shown');
      expect(out.debug).not.toHaveBeenCalled();
      expect(out.info).not.toHaveBeenCalled();
      expect(out.warn).toHaveBeenCalledTimes(1);
    } finally {
      (logger as any).minLevel = previous;
    }
  });
});
