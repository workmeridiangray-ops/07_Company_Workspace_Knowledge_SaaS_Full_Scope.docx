import { all, one, run, insert, update, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { getPage, pageLevel, atLeast, movePreview } from '../access';
import { sanitizeBlocks, blocksText, type Block } from '../blocks';
import { audit } from '../audit';
import { emit, notify } from './core';

export function recordRecent(c: Ctx, type: string, rid: string) {
  run('INSERT INTO recents(user_id,ws,resource_type,resource_id,at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,resource_type,resource_id) DO UPDATE SET at=excluded.at', c.user.id, c.ws.id, type, rid, now());
}
export function createPage(c: Ctx, o: { title?: string; teamspaceId?: string | null; parentId?: string | null; kind?: string; body?: Block[]; visibility?: string; draft?: boolean; recordId?: string | null }) {
  assertCan(c, 'content.create'); writableWorkspace(c);
  let teamspace = o.teamspaceId ?? null; let visibility = o.visibility || 'workspace';
  if (o.parentId) { const par = getPage(c, o.parentId, 'edit'); if (!par) throw new Invalid('You cannot add pages under that page.'); teamspace = teamspace ?? par.page.teamspace_id; }
  if (teamspace && !one('SELECT 1 FROM teamspaces WHERE id=? AND ws=? AND archived=0', teamspace, c.ws.id)) throw new Invalid('That teamspace does not exist.');
  if (!['private', 'teamspace', 'workspace'].includes(visibility)) visibility = 'workspace';
  if (o.draft) visibility = 'private';
  const pid = id('pg_'); const body = sanitizeBlocks(o.body ?? [{ type: 'p', text: '' }]); const t = now();
  insert('pages', { id: pid, ws: c.ws.id, teamspace_id: teamspace, parent_id: o.parentId ?? null, title: (o.title || 'Untitled').slice(0, 200), icon: null, body: JSON.stringify(body), kind: o.kind || 'page', owner: c.user.id, visibility, is_draft: o.draft ? 1 : 0, version: 1, archived: 0, created_at: t, updated_at: t, updated_by: c.user.id, record_id: o.recordId ?? null });
  audit(c, 'page.created', 'page', pid, { kind: o.kind || 'page' }); emit(c, 'page.created', { id: pid, title: o.title });
  return pid;
}
export type SaveResult = { ok: true; version: number; savedAt: string } | { ok: false; conflict: true; theirs: { version: number; title: string; body: Block[]; updatedBy: string; updatedAt: string } } | { ok: false; error: string };
export function savePage(c: Ctx, pageId: string, o: { title: string; body: unknown; baseVersion: number }): SaveResult {
  writableWorkspace(c);
  const g = getPage(c, pageId, 'edit'); if (!g) return { ok: false, error: 'You no longer have permission to edit this page.' };
  const p = g.page; if (p.deleted_at) return { ok: false, error: 'This page is in the trash. Restore it to keep editing.' };
  if (p.kind === 'sop' && one<any>('SELECT state FROM sops WHERE page_id=?', pageId)?.state === 'published') return { ok: false, error: 'Published SOPs are read-only. Start a new draft version from the SOP screen.' };
  let body: Block[]; try { body = sanitizeBlocks(o.body); } catch (e: any) { return { ok: false, error: e.message }; }
  const title = (o.title || 'Untitled').slice(0, 200);
  return tx(() => {
    const cur = one<any>('SELECT version, title, body, updated_by, updated_at FROM pages WHERE id=? AND ws=?', pageId, c.ws.id)!;
    if (cur.version !== o.baseVersion) {
      const u = one<any>('SELECT name FROM users WHERE id=?', cur.updated_by);
      return { ok: false as const, conflict: true as const, theirs: { version: cur.version, title: cur.title, body: J<Block[]>(cur.body, []), updatedBy: u?.name || 'Someone', updatedAt: cur.updated_at } };
    }
    const lastSnap = one<any>('SELECT created_at FROM page_versions WHERE page_id=? ORDER BY version DESC LIMIT 1', pageId);
    if (!lastSnap || Date.now() - new Date(lastSnap.created_at).getTime() > 120_000 || cur.updated_by !== c.user.id)
      insert('page_versions', { id: id('pv_'), ws: c.ws.id, page_id: pageId, version: cur.version, title: cur.title, body: cur.body, by_user: cur.updated_by, created_at: cur.updated_at || now(), label: null });
    const nv = cur.version + 1; const t = now();
    run('UPDATE pages SET title=?, body=?, version=?, updated_at=?, updated_by=? WHERE id=? AND ws=?', title, JSON.stringify(body), nv, t, c.user.id, pageId, c.ws.id);
    notifyMentions(c, 'page', pageId, blocksText(body), cur.body);
    return { ok: true as const, version: nv, savedAt: t };
  });
}
const MENTION = /@\[([^\]]+)\]\(u:([\w-]+)\)/g;
export function notifyMentions(c: Ctx, type: string, rid: string, text: string, previousBody?: string) {
  const prev = new Set<string>(); if (previousBody) for (const m of previousBody.matchAll(MENTION)) prev.add(m[2]);
  for (const m of text.matchAll(MENTION)) { if (prev.has(m[2])) continue; const uid = m[2];
    if (one('SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status=\'active\'', c.ws.id, uid)) notify(c.ws.id, uid, 'mention', type, rid, c.user.id); }
}
export function trashPage(c: Ctx, pageId: string) {
  assertCan(c, 'content.delete'); writableWorkspace(c); const g = getPage(c, pageId, 'edit'); if (!g) throw new Forbidden('content.delete');
  const kids = all<any>('SELECT id FROM pages WHERE parent_id=? AND ws=? AND deleted_at IS NULL', pageId, c.ws.id);
  const t = now(); run('UPDATE pages SET deleted_at=? WHERE id=? AND ws=?', t, pageId, c.ws.id);
  for (const k of kids) run('UPDATE pages SET deleted_at=?, parent_id=NULL WHERE id=? AND ws=?', t, k.id, c.ws.id);
  audit(c, 'page.trashed', 'page', pageId, { children: kids.length });
}
export function restorePage(c: Ctx, pageId: string) {
  writableWorkspace(c); const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=?', pageId, c.ws.id); if (!p || !p.deleted_at) throw new Invalid('That page is not in the trash.');
  if (!(p.owner === c.user.id || c.perms.has('content.delete'))) throw new Forbidden('content.delete');
  // never corrupt relations/permissions: a missing parent or teamspace is detached, not resurrected
  let parent = p.parent_id; if (parent && !one('SELECT 1 FROM pages WHERE id=? AND ws=? AND deleted_at IS NULL', parent, c.ws.id)) parent = null;
  run('UPDATE pages SET deleted_at=NULL, parent_id=?, updated_at=? WHERE id=? AND ws=?', parent, now(), pageId, c.ws.id);
  audit(c, 'page.restored', 'page', pageId, { detachedFromParent: parent !== p.parent_id });
}
export function purgePage(c: Ctx, pageId: string) {
  assertCan(c, 'content.delete'); const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=?', pageId, c.ws.id); if (!p || !p.deleted_at) throw new Invalid('Only pages in the trash can be deleted permanently.');
  tx(() => { for (const t of ['page_versions', 'favourites']) run(`DELETE FROM ${t} WHERE page_id=?`, pageId); run(`DELETE FROM comments WHERE ws=? AND resource_type='page' AND resource_id=?`, c.ws.id, pageId); run('DELETE FROM shares WHERE ws=? AND resource_type=\'page\' AND resource_id=?', c.ws.id, pageId); run('DELETE FROM share_links WHERE ws=? AND resource_type=\'page\' AND resource_id=?', c.ws.id, pageId); run('UPDATE pages SET parent_id=NULL WHERE parent_id=? AND ws=?', pageId, c.ws.id); run('DELETE FROM pages WHERE id=? AND ws=?', pageId, c.ws.id); });
  audit(c, 'page.purged', 'page', pageId, {});
}
export function movePage(c: Ctx, pageId: string, teamspaceId: string | null, parentId: string | null) {
  writableWorkspace(c); const g = getPage(c, pageId, 'edit'); if (!g) throw new Forbidden('content.edit');
  if (parentId) {
    if (parentId === pageId) throw new Invalid('A page cannot be moved inside itself.');
    let cur = one<any>('SELECT id,parent_id FROM pages WHERE id=? AND ws=?', parentId, c.ws.id); let n = 0;
    if (!cur) throw new Invalid('That destination page does not exist.');
    while (cur && n++ < 30) { if (cur.id === pageId) throw new Invalid('You cannot move a page inside one of its own sub-pages.'); cur = cur.parent_id ? one<any>('SELECT id,parent_id FROM pages WHERE id=? AND ws=?', cur.parent_id, c.ws.id) : null; }
    if (!getPage(c, parentId, 'edit')) throw new Invalid('You cannot add pages under that page.');
    teamspaceId = one<any>('SELECT teamspace_id FROM pages WHERE id=?', parentId)?.teamspace_id ?? teamspaceId;
  }
  if (teamspaceId && !one('SELECT 1 FROM teamspaces WHERE id=? AND ws=? AND archived=0', teamspaceId, c.ws.id)) throw new Invalid('That teamspace does not exist.');
  const prev = movePreview(c, pageId, parentId, teamspaceId);
  run('UPDATE pages SET teamspace_id=?, parent_id=?, updated_at=? WHERE id=? AND ws=?', teamspaceId, parentId, now(), pageId, c.ws.id);
  // descendants follow the teamspace so inherited access is consistent
  const stack = [pageId]; let guard = 0; while (stack.length && guard++ < 500) { const cur = stack.pop()!; for (const k of all<any>('SELECT id FROM pages WHERE parent_id=? AND ws=?', cur, c.ws.id)) { run('UPDATE pages SET teamspace_id=? WHERE id=? AND ws=?', teamspaceId, k.id, c.ws.id); stack.push(k.id); } }
  audit(c, 'page.moved', 'page', pageId, { teamspaceId, parentId, notes: prev?.notes.length }); return prev;
}
export function setVisibility(c: Ctx, pageId: string, vis: string) {
  assertCan(c, 'content.share'); writableWorkspace(c); if (!['private', 'teamspace', 'workspace'].includes(vis)) throw new Invalid('Choose a valid access level.');
  const g = getPage(c, pageId, 'edit'); if (!g) throw new Forbidden('content.share');
  run('UPDATE pages SET visibility=?, is_draft=? WHERE id=? AND ws=?', vis, vis === 'private' ? g.page.is_draft : 0, pageId, c.ws.id); audit(c, 'page.visibility_changed', 'page', pageId, { from: g.page.visibility, to: vis });
}
export function toggleFavourite(c: Ctx, pageId: string) {
  if (!getPage(c, pageId, 'view')) throw new Forbidden('content.view');
  const ex = one('SELECT 1 FROM favourites WHERE user_id=? AND page_id=?', c.user.id, pageId);
  if (ex) run('DELETE FROM favourites WHERE user_id=? AND page_id=?', c.user.id, pageId); else run('INSERT INTO favourites(user_id,ws,page_id) VALUES(?,?,?)', c.user.id, c.ws.id, pageId);
}
export function listVersions(c: Ctx, pageId: string) {
  if (!getPage(c, pageId, 'view')) return []; return all<any>(`SELECT v.id, v.version, v.title, v.created_at, v.label, u.name AS by_name FROM page_versions v LEFT JOIN users u ON u.id=v.by_user WHERE v.page_id=? AND v.ws=? ORDER BY v.version DESC`, pageId, c.ws.id);
}
export function restoreVersion(c: Ctx, pageId: string, versionId: string) {
  writableWorkspace(c); const g = getPage(c, pageId, 'edit'); if (!g) throw new Forbidden('content.edit');
  const v = one<any>('SELECT * FROM page_versions WHERE id=? AND page_id=? AND ws=?', versionId, pageId, c.ws.id); if (!v) throw new Invalid('That version no longer exists.');
  tx(() => {
    const cur = g.page; insert('page_versions', { id: id('pv_'), ws: c.ws.id, page_id: pageId, version: cur.version, title: cur.title, body: cur.body, by_user: cur.updated_by, created_at: now(), label: 'Before restore' });
    run('UPDATE pages SET title=?, body=?, version=version+1, updated_at=?, updated_by=? WHERE id=? AND ws=?', v.title, v.body, now(), c.user.id, pageId, c.ws.id);
  });
  audit(c, 'page.version_restored', 'page', pageId, { fromVersion: v.version }); // audit history is never rewound
}
/** Line diff between two block lists for the compare screen. */
export function diffBlocks(a: Block[], b: Block[]) {
  const A = a.map(x => `${x.type}|${x.text ?? ''}`), B = b.map(x => `${x.type}|${x.text ?? ''}`);
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: ' ' | '-' | '+'; text: string }[] = []; let i = 0, j = 0;
  while (i < A.length && j < B.length) { if (A[i] === B[j]) { out.push({ op: ' ', text: a[i].text ?? `[${a[i].type}]` }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: '-', text: a[i].text ?? `[${a[i].type}]` }); i++; } else { out.push({ op: '+', text: b[j].text ?? `[${b[j].type}]` }); j++; } }
  while (i < A.length) { out.push({ op: '-', text: a[i].text ?? `[${a[i].type}]` }); i++; } while (j < B.length) { out.push({ op: '+', text: b[j].text ?? `[${b[j].type}]` }); j++; }
  return out;
}
export function pagesTree(c: Ctx, rows: any[]) {
  const by = new Map<string | null, any[]>(); const ids = new Set(rows.map(r => r.id));
  for (const r of rows) { const k = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null; (by.get(k) || by.set(k, []).get(k)!).push(r); }
  const walk = (pid: string | null, depth: number): any[] => (by.get(pid) || []).sort((a, b) => a.title.localeCompare(b.title)).flatMap(r => [{ ...r, depth }, ...walk(r.id, depth + 1)]);
  return walk(null, 0);
}

export function movePageDryRun(c: Ctx, pageId: string, teamspaceId: string | null, parentId: string | null): string[] {
  const g = getPage(c, pageId, 'edit'); if (!g) throw new Forbidden('content.edit');
  return movePreview(c, pageId, parentId, teamspaceId)?.notes ?? [];
}
