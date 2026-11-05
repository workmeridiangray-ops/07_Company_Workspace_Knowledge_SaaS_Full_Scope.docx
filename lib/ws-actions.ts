'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, writableWorkspace, assertCan } from './ctx';
import { guard, str, need, UserError } from './action';
import { all, one, run, insert, id, now, J } from './db';
import { audit } from './audit';
import { entitlementBlock } from './billing';
import type { ActionResult } from '@/components/ActionForm';
const rv = (slug: string) => revalidatePath(`/w/${slug}`, 'layout');

export async function createTeamspaceAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); assertCan(c, 'schema.manage'); writableWorkspace(c); const name = need(str(fd, 'name', 60), 'Name the teamspace.'); const vis = ['open', 'closed', 'private'].includes(str(fd, 'visibility')) ? str(fd, 'visibility') : 'open';
    if (one('SELECT 1 FROM teamspaces WHERE ws=? AND lower(name)=lower(?) AND archived=0', c.ws.id, name)) throw new UserError('A teamspace with that name exists.');
    const tid = id('ts_'); insert('teamspaces', { id: tid, ws: c.ws.id, name, description: str(fd, 'description', 300), icon: 'folder', visibility: vis, archived: 0, created_at: now() }); run('INSERT INTO teamspace_members(teamspace_id,user_id) VALUES(?,?)', tid, c.user.id);
    audit(c, 'teamspace.created', 'teamspace', tid, { visibility: vis }); rv(slug); return { ok: true, redirect: `/w/${slug}/teamspaces/${tid}` };
  });
}
export async function teamspaceMemberAction(slug: string, tid: string, add: boolean, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); assertCan(c, 'schema.manage'); const uid = need(str(fd, 'user'), 'Choose a person.'); if (!one('SELECT 1 FROM teamspaces WHERE id=? AND ws=?', tid, c.ws.id)) throw new UserError('Teamspace not found.'); if (!one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, uid)) throw new UserError('Not a workspace member.');
    if (add) run('INSERT OR IGNORE INTO teamspace_members(teamspace_id,user_id) VALUES(?,?)', tid, uid); else run('DELETE FROM teamspace_members WHERE teamspace_id=? AND user_id=?', tid, uid); audit(c, add ? 'teamspace.member_added' : 'teamspace.member_removed', 'teamspace', tid, { user: uid }); rv(slug); return { ok: true };
  });
}
export async function removeTeamspaceMemberAction(slug: string, tid: string, uid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); assertCan(c, 'schema.manage'); run('DELETE FROM teamspace_members WHERE teamspace_id=? AND user_id=? AND EXISTS (SELECT 1 FROM teamspaces WHERE id=? AND ws=?)', tid, uid, tid, c.ws.id); audit(c, 'teamspace.member_removed', 'teamspace', tid, { user: uid }); rv(slug); return { ok: true }; }); }
export async function archiveTeamspaceAction(slug: string, tid: string, v: boolean): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); assertCan(c, 'schema.manage'); run('UPDATE teamspaces SET archived=? WHERE id=? AND ws=?', v ? 1 : 0, tid, c.ws.id); audit(c, v ? 'teamspace.archived' : 'teamspace.restored', 'teamspace', tid, {}); rv(slug); return { ok: true, redirect: `/w/${slug}/teamspaces` }; }); }
export async function postAnnouncementAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); assertCan(c, 'workspace.configure'); insert('announcements', { id: id('an_'), ws: c.ws.id, title: need(str(fd, 'title', 120), 'Write a headline.'), body: str(fd, 'body', 500), author: c.user.id, created_at: now(), pinned: fd.get('pinned') === 'on' ? 1 : 0 }); rv(slug); return { ok: true, message: 'Announcement posted.' }; });
}
export async function deleteAnnouncementAction(slug: string, aid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); assertCan(c, 'workspace.configure'); run('DELETE FROM announcements WHERE id=? AND ws=?', aid, c.ws.id); rv(slug); return { ok: true }; }); }
export async function deleteFileAction(slug: string, fid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const f = one<any>('SELECT * FROM files WHERE id=? AND ws=? AND deleted_at IS NULL', fid, c.ws.id); if (!f) throw new UserError('File not found.'); if (f.owner !== c.user.id && !c.perms.has('content.delete')) throw new UserError('You can only delete your own files.'); run('UPDATE files SET deleted_at=? WHERE id=?', now(), fid); audit(c, 'file.deleted', 'file', fid, {}); rv(slug); return { ok: true }; });
}
export async function completeSetupAction(slug: string, step: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); assertCan(c, 'workspace.configure'); const s = J<any>(c.ws.setup, {}); s[step] = true; run('UPDATE workspaces SET setup=? WHERE id=?', JSON.stringify(s), c.ws.id); rv(slug); return { ok: true }; });
}
