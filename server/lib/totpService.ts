/**
 * TOTP (RFC 6238) implementation using Node.js crypto — no external dependencies.
 * Compatible with Google Authenticator, Aegis, Authy, etc.
 */
import { createHmac, randomBytes } from 'crypto';
import QRCode from 'qrcode';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_CHARS[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(encoded: string): Buffer {
  const upper = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

const STEP = 30;
const WINDOW = 1; // accept 1 step before/after for clock drift

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotpToken(token: string, secret: string): boolean {
  const t = Math.floor(Date.now() / 1000 / STEP);
  const clean = token.replace(/\s/g, '');
  for (let i = -WINDOW; i <= WINDOW; i++) {
    if (hotp(secret, t + i) === clean) return true;
  }
  return false;
}

export function generateTotpForTest(secret: string): string {
  const t = Math.floor(Date.now() / 1000 / STEP);
  return hotp(secret, t);
}

export async function generateTotpQrCode(email: string, secret: string, siteName: string): Promise<string> {
  const issuer = encodeURIComponent(siteName);
  const account = encodeURIComponent(email);
  const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return QRCode.toDataURL(uri);
}
