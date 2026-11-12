// Request context: session -> user -> workspace membership -> permissions. Every data function takes a Ctx.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, all, run, insert, id, now, J, update } from './db';
import { sha, token } from './security';
import { Perm, PLATFORM_PERMS } from './perm';

export interface User { id: string; email: string; name: string; email_verified: number; totp_enabled: number; platform_role: string | null; suspended: number; notif_prefs: string; timezone: string; title: string }
export interface Ctx { user: User; ws: Workspace; role: { id: string; name: string }; perms: Set<string>; isGuest: boolean; sessionId: string; supportAccess?: boolean }
export interface Workspace { id: string; slug: string; name: string; status: string; trial_ends: string | null; timezone: string; branding: string; billing: string; setup: string }

const COOKIE = 'wk_session';
const SESSION_DAYS = 14;

export async function createSession(userId: string, pending2fa = false) {
  const t = token(); const h = await headers().catch(() => null);
  const sid = id('s_');
  insert('sessions', {
    id: sid, user_id: userId, token_hash: sha(t), created_at: now(), last_seen: now(),
    expires_at: new Date(Date.now() + (pending2fa ? 10 * 60_000 : SESSION_DAYS * 864e5)).toISOString(),
    ua: (h?.get('user-agent') || '').slice(0, 200), ip: (h?.get('x-forwarded-for') || '').split(',')[0].slice(0, 60), revoked: 0, pending_2fa: pending2fa ? 1 : 0,
  });
  (await cookies()).set(COOKIE, t, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1', path: '/', maxAge: SESSION_DAYS * 86400 });
  return sid;
}
export async function destroySession() {
  const c = await cookies(); const t = c.get(COOKIE)?.value;
  if (t) run('UPDATE sessions SET revoked=1 WHERE token_hash=?', sha(t));
  c.delete(COOKIE);
}
export interface SessionInfo { sessionId: string; user: User; pending2fa: boolean; expired?: boolean }
export async function getSession(): Promise<SessionInfo | null> {
  const t = (await cookies()).get(COOKIE)?.value; if (!t) return null;
  const s = one<any>('SELECT * FROM sessions WHERE token_hash=?', sha(t)); if (!s) return null;
  if (s.revoked || new Date(s.expires_at) < new Date()) return { sessionId: s.id, user: null as any, pending2fa: false, expired: true };
  const user = one<User>('SELECT id,email,name,email_verified,totp_enabled,platform_role,suspended,notif_prefs,timezone,title FROM users WHERE id=?', s.user_id);
  if (!user || user.suspended) return null;
  if (Date.now() - new Date(s.last_seen).getTime() > 60_000) run('UPDATE sessions SET last_seen=? WHERE id=?', now(), s.id);
  return { sessionId: s.id, user, pending2fa: !!s.pending_2fa };
}
export async function requireUser(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.expired) redirect('/session-expired');
  if (s.pending2fa) redirect('/two-factor');
  return s;
}
export async function requirePlatform(area: string) {
  const s = await requireUser();
  const role = s.user.platform_role;
  if (!role || !(PLATFORM_PERMS[role] || []).includes(area)) redirect('/denied');
  return { ...s, role };
}

export function loadMembership(userId: string, slug: string) {
  return one<any>(`SELECT w.*, m.role_id, m.status AS mstatus, m.is_guest, r.name AS role_name, r.perms
    FROM workspaces w JOIN memberships m ON m.ws=w.id JOIN roles r ON r.id=m.role_id WHERE w.slug=? AND m.user_id=?`, slug, userId);
}
/** Resolve the workspace context for /w/[slug]. Redirects on missing/suspended access. Never trusts the URL for authorization. */
export async function requireCtx(slug: string, need?: Perm): Promise<Ctx> {
  const s = await requireUser();
  const m = loadMembership(s.user.id, slug);
  if (!m) redirect('/denied?why=workspace');
  if (m.mstatus !== 'active') redirect('/denied?why=suspended');
  if (m.status === 'closed') redirect('/denied?why=closed');
  const perms = new Set<string>(J<string[]>(m.perms, []));
  const ws: Workspace = { id: m.id, slug: m.slug, name: m.name, status: m.status, trial_ends: m.trial_ends, timezone: m.timezone, branding: m.branding, billing: m.billing, setup: m.setup };
  if (need && !perms.has(need)) redirect(`/w/${slug}/denied?need=${encodeURIComponent(need)}`);
  return { user: s.user, ws, role: { id: m.role_id, name: m.role_name }, perms, isGuest: !!m.is_guest, sessionId: s.sessionId };
}
export const can = (c: Ctx, p: Perm) => c.perms.has(p);
export function assertCan(c: Ctx, p: Perm) { if (!c.perms.has(p)) throw new Forbidden(p); }
export class Forbidden extends Error { constructor(public perm: string) { super(`Not allowed: ${perm}`); } }
export class Invalid extends Error {}
export function writableWorkspace(c: Ctx) {
  const live = one<{ status: string }>('SELECT status FROM workspaces WHERE id=?', c.ws.id)?.status ?? c.ws.status; // never trust a stale snapshot
  if (['suspended', 'closed', 'closing', 'expired'].includes(live)) throw new Invalid('This workspace is read-only because of its account status.');
}
export function userWorkspaces(userId: string) {
  return all<any>(`SELECT w.id,w.slug,w.name,w.status,r.name AS role_name FROM memberships m JOIN workspaces w ON w.id=m.ws JOIN roles r ON r.id=m.role_id
    WHERE m.user_id=? AND m.status='active' AND w.status!='closed' ORDER BY w.name`, userId);
}
