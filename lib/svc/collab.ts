// Comments, mentions, sharing, links and access requests. One resolver decides what a resource is and who may touch it.
import { all, one, run, insert, id, now, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { getPage, getDb, getRecord, atLeast, type Level } from '../access';
import { audit } from '../audit';
import { notify } from './core';
import { notifyMentions } from './pages';
import { token } from '../security';
import { entitlementBlock } from '../billing';

export type ResType = 'page' | 'record' | 'database';
export function resolve(c: Ctx, type: string, rid: string, need: Level) {
  if (type === 'page') { const g = getPage(c, rid, need); return g ? { owner: g.page.owner as string | null, level: g.level, title: g.page.title as string } : null; }
  if (type === 'record') { const g = getRecord(c, rid, need); return g ? { owner: g.record.owner as string | null, level: g.level, title: 'Record' } : null; }
  if (type === 'database') { const g = getDb(c, rid, need); return g ? { owner: g.db.owner as string | null, level: g.level, title: g.db.name as string } : null; }
  return null;
}
export function addComment(c: Ctx, type: string, rid: string, body: string, parentId?: string | null) {
  writableWorkspace(c); const b = body.trim(); if (!b) throw new Invalid('Write a comment first.'); if (b.length > 4000) throw new Invalid('Comments can be up to 4,000 characters.');
  const r = resolve(c, type, rid, 'comment'); if (!r) throw new Forbidden('content.view');
  if (parentId && !one('SELECT 1 FROM comments WHERE id=? AND ws=? AND resource_id=?', parentId, c.ws.id, rid)) throw new Invalid('That thread no longer exists.');
  const cid = id('cm_'); insert('comments', { id: cid, ws: c.ws.id, resource_type: type, resource_id: rid, parent_id: parentId ?? null, author: c.user.id, body: b, resolved: 0, created_at: now() });
  notifyMentions(c, type, rid, b);
  if (r.owner) notify(c.ws.id, r.owner, 'comment', type, rid, c.user.id);
  if (parentId) { const root = one<any>('SELECT author FROM comments WHERE id=?', parentId); if (root) notify(c.ws.id, root.author, 'comment', type, rid, c.user.id); }
  return cid;
}
export function resolveThread(c: Ctx, commentId: string, value: boolean) {
  const cm = one<any>('SELECT * FROM comments WHERE id=? AND ws=?', commentId, c.ws.id); if (!cm) throw new Invalid('Comment not found.');
  if (!resolve(c, cm.resource_type, cm.resource_id, 'comment')) throw new Forbidden('content.view');
  run('UPDATE comments SET resolved=? WHERE id=? AND ws=?', value ? 1 : 0, commentId, c.ws.id);
}
export function deleteComment(c: Ctx, commentId: string) {
  const cm = one<any>('SELECT * FROM comments WHERE id=? AND ws=?', commentId, c.ws.id); if (!cm) return;
  if (cm.author !== c.user.id && !c.perms.has('content.delete')) throw new Forbidden('content.delete');
  run('UPDATE comments SET deleted_at=? WHERE id=?', now(), commentId);
}
export function listComments(c: Ctx, type: string, rid: string) {
  if (!resolve(c, type, rid, 'view')) return [];
  return all<any>(`SELECT cm.*, u.name AS author_name FROM comments cm JOIN users u ON u.id=cm.author WHERE cm.ws=? AND cm.resource_type=? AND cm.resource_id=? AND cm.deleted_at IS NULL ORDER BY cm.created_at`, c.ws.id, type, rid);
}
export function shareWith(c: Ctx, type: string, rid: string, email: string, level: string, days?: number) {
  assertCan(c, 'content.share'); writableWorkspace(c);
  if (!['view', 'comment', 'edit'].includes(level)) throw new Invalid('Choose view, comment or edit.');
  if (!resolve(c, type, rid, 'edit')) throw new Forbidden('content.share');
  const u = one<any>(`SELECT u.id, u.name, m.is_guest FROM users u JOIN memberships m ON m.user_id=u.id AND m.ws=? AND m.status='active' WHERE u.email=?`, c.ws.id, email.trim().toLowerCase());
  if (!u) throw new Invalid('That person is not in this workspace yet. Invite them as a member or guest from Administration → Members first.');
  if (u.id === c.user.id) throw new Invalid('You already have access.');
  run(`INSERT INTO shares(id,ws,resource_type,resource_id,user_id,level,by_user,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(resource_type,resource_id,user_id) DO UPDATE SET level=excluded.level, expires_at=excluded.expires_at`, id('sh_'), c.ws.id, type, rid, u.id, level, c.user.id, days ? new Date(Date.now() + days * 864e5).toISOString() : null, now());
  notify(c.ws.id, u.id, 'share', type, rid, c.user.id); audit(c, 'share.granted', type, rid, { to: u.id, level, guest: !!u.is_guest });
}
export function unshare(c: Ctx, shareId: string) {
  assertCan(c, 'content.share'); const s = one<any>('SELECT * FROM shares WHERE id=? AND ws=?', shareId, c.ws.id); if (!s) return;
  if (!resolve(c, s.resource_type, s.resource_id, 'edit')) throw new Forbidden('content.share');
  run('DELETE FROM shares WHERE id=?', shareId); audit(c, 'share.revoked', s.resource_type, s.resource_id, { user: s.user_id });
}
export function listShares(c: Ctx, type: string, rid: string) {
  return all<any>(`SELECT s.*, u.name, u.email, m.is_guest FROM shares s JOIN users u ON u.id=s.user_id LEFT JOIN memberships m ON m.user_id=u.id AND m.ws=s.ws WHERE s.ws=? AND s.resource_type=? AND s.resource_id=? ORDER BY s.created_at`, c.ws.id, type, rid);
}
export function createLink(c: Ctx, type: string, rid: string, o: { days?: number; download?: boolean; publicWeb?: boolean; confirmReview?: boolean }) {
  assertCan(c, 'content.share'); writableWorkspace(c);
  if (!resolve(c, type, rid, 'edit')) throw new Forbidden('content.share');
  if (type !== 'page') throw new Invalid('Links can be created for pages.');
  if (o.publicWeb && !o.confirmReview) throw new Invalid('Confirm the public-publishing review before creating a public link.');
  if (o.publicWeb) { const p = one<any>('SELECT kind, record_id FROM pages WHERE id=? AND ws=?', rid, c.ws.id); if (p?.kind === 'sop') throw new Invalid('Controlled SOPs cannot be published to the public web.'); if (p?.record_id) throw new Invalid('Record pages contain private database data and cannot be published publicly.'); }
  const t = token(24); insert('share_links', { id: id('sl_'), ws: c.ws.id, resource_type: type, resource_id: rid, token: t, level: 'view', expires_at: o.days ? new Date(Date.now() + o.days * 864e5).toISOString() : null, allow_download: o.download ? 1 : 0, revoked: 0, is_public: o.publicWeb ? 1 : 0, reviewed_by: o.publicWeb ? c.user.id : null, created_by: c.user.id, created_at: now() });
  audit(c, o.publicWeb ? 'link.public_created' : 'link.created', type, rid, { days: o.days ?? null }); return t;
}
export function revokeLink(c: Ctx, linkId: string) {
  assertCan(c, 'content.share'); const l = one<any>('SELECT * FROM share_links WHERE id=? AND ws=?', linkId, c.ws.id); if (!l) return;
  run('UPDATE share_links SET revoked=1 WHERE id=?', linkId); audit(c, 'link.revoked', l.resource_type, l.resource_id, {});
}
export function listLinks(c: Ctx, type: string, rid: string) { return all<any>('SELECT * FROM share_links WHERE ws=? AND resource_type=? AND resource_id=? ORDER BY created_at DESC', c.ws.id, type, rid); }
export function requestAccess(c: Ctx, type: string, rid: string, message: string) {
  const r = one<any>(`SELECT owner FROM ${type === 'page' ? 'pages' : type === 'record' ? 'records' : 'databases'} WHERE id=? AND ws=?`, rid, c.ws.id); if (!r) throw new Invalid('That item does not exist.');
  if (one(`SELECT 1 FROM access_requests WHERE ws=? AND resource_id=? AND user_id=? AND status='pending'`, c.ws.id, rid, c.user.id)) throw new Invalid('You already asked for access. The owner has been notified.');
  insert('access_requests', { id: id('ar_'), ws: c.ws.id, resource_type: type, resource_id: rid, user_id: c.user.id, message: message.slice(0, 500), status: 'pending', created_at: now() });
  if (r.owner) notify(c.ws.id, r.owner, 'share', type, rid, c.user.id);
  for (const a of all<any>(`SELECT m.user_id FROM memberships m JOIN roles ro ON ro.id=m.role_id WHERE m.ws=? AND ro.name IN ('Owner','Admin') AND m.status='active'`, c.ws.id)) notify(c.ws.id, a.user_id, 'share', type, rid, c.user.id);
}
export function decideAccess(c: Ctx, reqId: string, approve: boolean, level = 'view') {
  assertCan(c, 'content.share'); const r = one<any>('SELECT * FROM access_requests WHERE id=? AND ws=? AND status=\'pending\'', reqId, c.ws.id); if (!r) throw new Invalid('That request was already handled.');
  tx(() => { run('UPDATE access_requests SET status=?, decided_by=? WHERE id=?', approve ? 'approved' : 'declined', c.user.id, reqId);
    if (approve) { run(`INSERT INTO shares(id,ws,resource_type,resource_id,user_id,level,by_user,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(resource_type,resource_id,user_id) DO UPDATE SET level=excluded.level`, id('sh_'), c.ws.id, r.resource_type, r.resource_id, r.user_id, level, c.user.id, now()); notify(c.ws.id, r.user_id, 'share', r.resource_type, r.resource_id, c.user.id); } });
  audit(c, approve ? 'access.approved' : 'access.declined', r.resource_type, r.resource_id, { user: r.user_id });
}
