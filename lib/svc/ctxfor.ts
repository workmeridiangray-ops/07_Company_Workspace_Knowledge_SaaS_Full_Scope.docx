import { one, J } from '../db';
import type { Ctx } from '../ctx';
/** Build a request context for a user in a workspace outside an HTTP request (seeding, jobs, tests). Returns null if not an active member. */
export function ctxFor(userId: string, wsId: string): Ctx | null {
  const m = one<any>(`SELECT w.*, m.role_id, m.status AS mstatus, m.is_guest, r.name AS role_name, r.perms FROM workspaces w JOIN memberships m ON m.ws=w.id JOIN roles r ON r.id=m.role_id WHERE w.id=? AND m.user_id=?`, wsId, userId);
  const u = one<any>('SELECT id,email,name,email_verified,totp_enabled,platform_role,suspended,notif_prefs,timezone,title FROM users WHERE id=?', userId);
  if (!m || !u || m.mstatus !== 'active') return null;
  return { user: u, ws: { id: m.id, slug: m.slug, name: m.name, status: m.status, trial_ends: m.trial_ends, timezone: m.timezone, branding: m.branding, billing: m.billing, setup: m.setup }, role: { id: m.role_id, name: m.role_name }, perms: new Set(J<string[]>(m.perms, [])), isGuest: !!m.is_guest, sessionId: 'system' };
}
