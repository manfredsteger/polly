let _warnedOnce = false;
let _warnedLocalhostOnce = false;

function isValidHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getBaseUrl(): string {
  const explicit = process.env.APP_URL || process.env.BASE_URL || process.env.VITE_APP_URL;
  if (explicit) {
    const trimmed = explicit.trim().replace(/\/+$/, '');
    if (isValidHttpUrl(trimmed)) {
      return trimmed;
    }
    console.warn(`[Config] APP_URL "${trimmed.slice(0, 80)}" is not a valid HTTP(S) URL — ignoring. Set APP_URL to your public URL (e.g. https://poll.example.com).`);
  }

  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  if (!_warnedOnce) {
    console.warn('[Config] APP_URL is not set — falling back to http://localhost. Set APP_URL to your public URL (e.g. https://poll.example.com).');
    _warnedOnce = true;
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

export function validateEmailUrl(url: string): string {
  if (!url) return getBaseUrl();

  const trimmed = url.trim();

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        console.warn(`[Email URL] Rejected non-http(s) protocol: ${parsed.protocol}`);
        return getBaseUrl();
      }
      return parsed.href.replace(/\/+$/, '');
    } catch {
      console.warn(`[Email URL] Malformed URL rejected: ${trimmed.slice(0, 80)}`);
      return getBaseUrl();
    }
  }

  const dangerousProtocols = /^(javascript|data|vbscript|file|ftp):/i;
  if (dangerousProtocols.test(trimmed)) {
    console.warn(`[Email URL] Rejected dangerous protocol: ${trimmed.slice(0, 80)}`);
    return getBaseUrl();
  }

  if (trimmed.includes('://') && !trimmed.startsWith('http')) {
    console.warn(`[Email URL] Rejected non-http(s) URL: ${trimmed.slice(0, 80)}`);
    return getBaseUrl();
  }

  const base = getBaseUrl();
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function warnIfLocalhostInProduction(): void {
  if (_warnedLocalhostOnce) return;
  const base = getBaseUrl();
  const isProduction = process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true';
  if (isProduction && (base.includes('localhost') || base.includes('127.0.0.1'))) {
    console.warn('[Config] WARNING: APP_URL points to localhost in production! Email links will be broken. Set APP_URL to your public URL (e.g. https://poll.example.com).');
    _warnedLocalhostOnce = true;
  }
}

export function resetWarningFlags(): void {
  _warnedOnce = false;
  _warnedLocalhostOnce = false;
}
