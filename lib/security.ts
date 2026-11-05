import crypto from 'node:crypto';

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString('base64')}$${h.toString('base64')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [v, s, h] = stored.split('$');
  if (v !== 's1' || !s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  const exp = Buffer.from(h, 'base64');
  return exp.length === calc.length && crypto.timingSafeEqual(exp, calc);
}
export const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const code6 = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Include letters and at least one number.';
  return null;
}
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

// ---- TOTP (RFC 6238, SHA-1, 30s, 6 digits) ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret(): string {
  const b = crypto.randomBytes(20); let bits = '', out = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32decode(s: string): Buffer {
  let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; bits += i.toString(2).padStart(5, '0'); }
  const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 30000);
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some(d => {
    const exp = totp(secret, at + d * 30000);
    return crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(c));
  });
}
export function hmac(secret: string, body: string) { return crypto.createHmac('sha256', secret).update(body).digest('hex'); }

// ---- tiny in-memory rate limiter (per process) ----
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const t = Date.now(); const b = buckets.get(key);
  if (!b || b.reset < t) { buckets.set(key, { n: 1, reset: t + windowMs }); return true; }
  b.n++; return b.n <= max;
}
export function clearRateLimits() { buckets.clear(); }
