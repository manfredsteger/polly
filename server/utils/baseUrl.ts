let _warnedOnce = false;

export function getBaseUrl(): string {
  const explicit = process.env.APP_URL || process.env.BASE_URL || process.env.VITE_APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
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
