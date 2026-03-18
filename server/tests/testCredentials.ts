function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set as an environment variable. ` +
      `No hardcoded fallbacks — set it in your .env or Replit Secrets.`
    );
  }
  return value;
}

export const ADMIN_USERNAME = requireEnv('ADMIN_USERNAME');
export const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
export const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
