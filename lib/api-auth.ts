import { getSession, loadMembership, type Ctx } from './ctx';
import { J } from './db';
/** Build a Ctx for route handlers (no redirects). Returns null if the caller is not an active member. */
export async function apiCtx(slug: string): Promise<Ctx | null> {
  const s = await getSession(); if (!s || s.expired || s.pending2fa) return null;
  const m = loadMembership(s.user.id, slug); if (!m || m.mstatus !== 'active' || m.status === 'closed') return null;
  return { user: s.user, ws: { id: m.id, slug: m.slug, name: m.name, status: m.status, trial_ends: m.trial_ends, timezone: m.timezone, branding: m.branding, billing: m.billing, setup: m.setup }, role: { id: m.role_id, name: m.role_name }, perms: new Set<string>(J<string[]>(m.perms, [])), isGuest: !!m.is_guest, sessionId: s.sessionId };
}
