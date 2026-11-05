// Resource access resolution. One implementation used by pages, records, search, notifications, exports and jobs.
import { all, one } from './db';
import type { Ctx } from './ctx';

export type Level = 'none' | 'view' | 'comment' | 'edit';
const RANK: Record<Level, number> = { none: 0, view: 1, comment: 2, edit: 3 };
export const atLeast = (have: Level, need: Level) => RANK[have] >= RANK[need];
const maxLevel = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);

function sharedLevel(c: Ctx, type: string, rid: string): Level {
  const s = one<any>(`SELECT level FROM shares WHERE ws=? AND resource_type=? AND resource_id=? AND user_id=? AND (expires_at IS NULL OR expires_at>?)`, c.ws.id, type, rid, c.user.id, new Date().toISOString());
  return (s?.level as Level) || 'none';
}
function teamspaceAllows(c: Ctx, tsId: string | null): boolean {
  if (!tsId) return true;
  const ts = one<any>('SELECT visibility, archived FROM teamspaces WHERE id=? AND ws=?', tsId, c.ws.id);
  if (!ts) return false;
  if (ts.visibility === 'open') return true;
  return !!one('SELECT 1 FROM teamspace_members WHERE teamspace_id=? AND user_id=?', tsId, c.user.id);
}
const baseMemberLevel = (c: Ctx): Level => (c.perms.has('content.edit') ? 'edit' : c.perms.has('content.view') ? 'view' : 'none');

export interface PageLike { id: string; ws: string; teamspace_id: string | null; parent_id: string | null; owner: string | null; visibility: string; deleted_at?: string | null }

/** Effective level on a page: own rules, then ancestors' explicit shares (inheritance). Cross-tenant ids always resolve to 'none'. */
export function pageLevel(c: Ctx, p: (PageLike & { record_id?: string | null }) | undefined | null): Level {
  if (!p || p.ws !== c.ws.id) return 'none';
  if (p.record_id) { // a record opened as a page inherits the record's access, never the page's visibility
    const r = one<any>('SELECT * FROM records WHERE id=? AND ws=?', p.record_id, c.ws.id); const d = r && one<any>('SELECT * FROM databases WHERE id=? AND ws=?', r.db_id, c.ws.id);
    return r && d ? recordLevel(c, r, d) : 'none';
  }
  let lvl: Level = 'none';
  if (p.owner === c.user.id) lvl = 'edit';
  let cur: PageLike | undefined | null = p; let guard = 0;
  while (cur && guard++ < 25) {
    lvl = maxLevel(lvl, sharedLevel(c, 'page', cur.id));
    cur = cur.parent_id ? one<PageLike>('SELECT id,ws,teamspace_id,parent_id,owner,visibility FROM pages WHERE id=? AND ws=?', cur.parent_id, c.ws.id) : null;
  }
  if (!c.isGuest && c.perms.has('content.view')) {
    const vis = p.visibility;
    if (vis === 'workspace' && teamspaceAllows(c, p.teamspace_id)) lvl = maxLevel(lvl, baseMemberLevel(c));
    else if (vis === 'teamspace' && p.teamspace_id && teamspaceAllows(c, p.teamspace_id)) lvl = maxLevel(lvl, baseMemberLevel(c));
  }
  // Role-level permission caps what a share can grant
  if (lvl === 'edit' && !c.perms.has('content.edit') && p.owner !== c.user.id) lvl = c.isGuest ? lvl : 'view';
  return lvl;
}
export function getPage(c: Ctx, pageId: string, need: Level = 'view') {
  const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=?', pageId, c.ws.id);
  if (!p) return null;
  const lvl = pageLevel(c, p);
  return atLeast(lvl, need) ? { page: p, level: lvl } : null;
}
export function pageExists(c: Ctx, pageId: string) { return !!one('SELECT 1 FROM pages WHERE id=? AND ws=?', pageId, c.ws.id); }

export function dbLevel(c: Ctx, d: any): Level {
  if (!d || d.ws !== c.ws.id) return 'none';
  let lvl: Level = d.owner === c.user.id ? 'edit' : 'none';
  lvl = maxLevel(lvl, sharedLevel(c, 'database', d.id));
  if (!c.isGuest && c.perms.has('content.view')) {
    if ((d.visibility === 'workspace' || d.visibility === 'teamspace') && teamspaceAllows(c, d.teamspace_id)) lvl = maxLevel(lvl, baseMemberLevel(c));
  }
  return lvl;
}
export function getDb(c: Ctx, dbId: string, need: Level = 'view') {
  const d = one<any>('SELECT * FROM databases WHERE id=? AND ws=?', dbId, c.ws.id);
  if (!d) return null; const lvl = dbLevel(c, d); return atLeast(lvl, need) ? { db: d, level: lvl } : null;
}
export function recordLevel(c: Ctx, r: any, d: any): Level {
  if (!r || r.ws !== c.ws.id || r.db_id !== d.id) return 'none';
  return maxLevel(dbLevel(c, d), sharedLevel(c, 'record', r.id));
}
export function getRecord(c: Ctx, recId: string, need: Level = 'view') {
  const r = one<any>('SELECT * FROM records WHERE id=? AND ws=?', recId, c.ws.id); if (!r) return null;
  const d = one<any>('SELECT * FROM databases WHERE id=? AND ws=?', r.db_id, c.ws.id); if (!d) return null;
  const lvl = recordLevel(c, r, d); return atLeast(lvl, need) ? { record: r, db: d, level: lvl } : null;
}
export function visiblePages(c: Ctx, where = '', ...p: any[]) {
  const rows = all<any>(`SELECT * FROM pages WHERE ws=? AND deleted_at IS NULL ${where}`, c.ws.id, ...p);
  return rows.filter(r => pageLevel(c, r) !== 'none');
}
export function visibleDatabases(c: Ctx) {
  return all<any>('SELECT * FROM databases WHERE ws=? AND archived=0 ORDER BY name', c.ws.id).filter(d => dbLevel(c, d) !== 'none');
}
/** Inherited-permission preview for moving a page into a new parent/teamspace. */
export function movePreview(c: Ctx, pageId: string, newParent: string | null, newTeamspace: string | null) {
  const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=?', pageId, c.ws.id); if (!p) return null;
  const before = { teamspace: p.teamspace_id, parent: p.parent_id };
  const sh = all<any>(`SELECT s.user_id,u.name,s.level FROM shares s JOIN users u ON u.id=s.user_id WHERE s.ws=? AND s.resource_type='page' AND s.resource_id=?`, c.ws.id, pageId);
  const ts = newTeamspace ? one<any>('SELECT name,visibility FROM teamspaces WHERE id=? AND ws=?', newTeamspace, c.ws.id) : null;
  const oldTs = before.teamspace ? one<any>('SELECT name,visibility FROM teamspaces WHERE id=? AND ws=?', before.teamspace, c.ws.id) : null;
  const notes: string[] = [];
  if ((oldTs?.visibility ?? 'open') !== (ts?.visibility ?? 'open')) notes.push(`Teamspace access changes from ${oldTs ? oldTs.name + ' (' + oldTs.visibility + ')' : 'workspace-wide'} to ${ts ? ts.name + ' (' + ts.visibility + ')' : 'workspace-wide'}.`);
  if (newParent) { const par = one<any>('SELECT title FROM pages WHERE id=? AND ws=?', newParent, c.ws.id); if (par) notes.push(`It will inherit explicit shares from "${par.title}".`); }
  if (sh.length) notes.push(`${sh.length} existing explicit share${sh.length > 1 ? 's' : ''} stay with the page (${sh.map(s => s.name).join(', ')}).`);
  if (!notes.length) notes.push('No access changes. Links to this page keep working.');
  return { notes, shares: sh };
}
