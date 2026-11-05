'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need, UserError } from './action';
import * as P from './svc/pages';
import { one, run, all, id, now, insert } from './db';
import { getPage } from './access';
import { entitlementBlock } from './billing';
import { audit } from './audit';
import type { ActionResult } from '@/components/ActionForm';

/** Called by the editor (not a form). Returns conflict details instead of overwriting. */
export async function savePageAction(slug: string, pageId: string, title: string, body: unknown, baseVersion: number): Promise<P.SaveResult> {
  const c = await requireCtx(slug);
  try { return P.savePage(c, pageId, { title, body, baseVersion }); } catch (e: any) { return { ok: false, error: e?.message || 'Could not save.' }; }
}
export async function createPageAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const draft = fd.get('draft') === 'on';
    const pid = P.createPage(c, { title: str(fd, 'title', 200) || 'Untitled', teamspaceId: str(fd, 'teamspace') || null, parentId: str(fd, 'parent') || null, visibility: str(fd, 'visibility') || 'workspace', draft });
    return { ok: true, redirect: `/w/${slug}/pages/${pid}` };
  });
}
export async function trashPageAction(slug: string, pid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.trashPage(c, pid); revalidatePath(`/w/${slug}`); return { ok: true, redirect: `/w/${slug}/pages` }; });
}
export async function restorePageAction(slug: string, pid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.restorePage(c, pid); revalidatePath(`/w/${slug}/trash`); return { ok: true, redirect: `/w/${slug}/pages/${pid}` }; });
}
export async function purgePageAction(slug: string, pid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.purgePage(c, pid); return { ok: true, redirect: `/w/${slug}/trash` }; });
}
export async function movePageAction(slug: string, pid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const dest = str(fd, 'dest');
    let ts: string | null = null, parent: string | null = null; if (dest.startsWith('ts:')) ts = dest.slice(3); else if (dest.startsWith('pg:')) parent = dest.slice(3);
    if (fd.get('confirm') !== 'yes') { const pre = P.movePageDryRun(c, pid, ts, parent); return { ok: true, message: 'Review before moving: ' + pre.join(' ') + ' Tick the box and submit again to confirm.', data: { needConfirm: true } }; }
    P.movePage(c, pid, ts, parent); return { ok: true, redirect: `/w/${slug}/pages/${pid}` };
  });
}
export async function visibilityAction(slug: string, pid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.setVisibility(c, pid, str(fd, 'visibility')); return { ok: true, message: 'Access updated.' }; });
}
export async function favouriteAction(slug: string, pid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.toggleFavourite(c, pid); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
export async function restoreVersionAction(slug: string, pid: string, vid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); P.restoreVersion(c, pid, vid); return { ok: true, redirect: `/w/${slug}/pages/${pid}` }; });
}
