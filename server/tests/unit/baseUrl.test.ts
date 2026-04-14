import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBaseUrl, validateEmailUrl, warnIfLocalhostInProduction, resetWarningFlags } from '../../utils/baseUrl';

describe('getBaseUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.BASE_URL;
    delete process.env.VITE_APP_URL;
    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('should return valid APP_URL', () => {
    process.env.APP_URL = 'https://poll.example.com';
    expect(getBaseUrl()).toBe('https://poll.example.com');
  });

  it('should strip trailing slashes from APP_URL', () => {
    process.env.APP_URL = 'https://poll.example.com/';
    expect(getBaseUrl()).toBe('https://poll.example.com');
  });

  it('should reject malformed APP_URL and fall back', () => {
    process.env.APP_URL = 'not-a-url';
    const base = getBaseUrl();
    expect(base).toContain('localhost');
  });

  it('should reject x-webdoc:// protocol in APP_URL', () => {
    process.env.APP_URL = 'x-webdoc://some-path';
    const base = getBaseUrl();
    expect(base).not.toContain('x-webdoc');
  });

  it('should accept http:// APP_URL', () => {
    process.env.APP_URL = 'http://internal.corp:8080';
    expect(getBaseUrl()).toBe('http://internal.corp:8080');
  });
});

describe('validateEmailUrl', () => {
  beforeEach(() => {
    process.env.APP_URL = 'https://poll.example.com';
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it('should pass through valid https URL', () => {
    expect(validateEmailUrl('https://poll.example.com/poll/abc')).toBe('https://poll.example.com/poll/abc');
  });

  it('should pass through valid http URL', () => {
    expect(validateEmailUrl('http://internal.corp/poll/abc')).toBe('http://internal.corp/poll/abc');
  });

  it('should prepend base URL to relative paths', () => {
    expect(validateEmailUrl('/poll/abc')).toBe('https://poll.example.com/poll/abc');
  });

  it('should reject javascript: protocol', () => {
    const result = validateEmailUrl('javascript:alert(1)');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('https://');
  });

  it('should reject x-webdoc:// protocol', () => {
    const result = validateEmailUrl('x-webdoc://some-path');
    expect(result).not.toContain('x-webdoc');
    expect(result).toContain('https://');
  });

  it('should return base URL for empty string', () => {
    const result = validateEmailUrl('');
    expect(result).toContain('https://');
  });

  it('should handle URLs with whitespace', () => {
    const result = validateEmailUrl('  https://poll.example.com/poll/abc  ');
    expect(result).toContain('https://poll.example.com/poll/abc');
  });

  it('should reject malformed absolute URLs', () => {
    const result = validateEmailUrl('https://');
    expect(result).toContain('poll.example.com');
  });
});

describe('warnIfLocalhostInProduction', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('should warn when APP_URL is localhost in production', () => {
    delete process.env.APP_URL;
    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.NODE_ENV = 'production';
    resetWarningFlags();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfLocalhostInProduction();
    const localhostWarnings = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('localhost') && args[0].includes('production')
    );
    expect(localhostWarnings.length).toBeGreaterThanOrEqual(1);
    warnSpy.mockRestore();
  });
});
