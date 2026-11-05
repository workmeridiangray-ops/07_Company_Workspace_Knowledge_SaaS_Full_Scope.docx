'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need } from './action';
import * as C from './svc/collab';
import { run } from './db';
import type { ActionResult } from '@/components/ActionForm';

export async function commentAction(slug: string, type: string, rid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.addComment(c, type, rid, String(fd.get('body') || ''), str(fd, 'parent') || null); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true, message: 'Comment posted.' }; });
}
export async function resolveCommentAction(slug: string, cid: string, value: boolean): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.resolveThread(c, cid, value); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
export async function deleteCommentAction(slug: string, cid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.deleteComment(c, cid); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
export async function shareAction(slug: string, type: string, rid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.shareWith(c, type, rid, str(fd, 'email', 254), str(fd, 'level', 10), Number(fd.get('days')) || undefined); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true, message: 'Shared.' }; });
}
export async function unshareAction(slug: string, sid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.unshare(c, sid); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
export async function createLinkAction(slug: string, type: string, rid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const pub = fd.get('public') === 'on';
    const t = C.createLink(c, type, rid, { days: Number(fd.get('days')) || undefined, download: fd.get('download') === 'on', publicWeb: pub, confirmReview: fd.get('review') === 'on' });
    revalidatePath(`/w/${slug}`, 'layout'); return { ok: true, message: `Link created: /s/${t}` };
  });
}
export async function revokeLinkAction(slug: string, lid: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.revokeLink(c, lid); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
export async function requestAccessAction(slug: string, type: string, rid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.requestAccess(c, type, rid, str(fd, 'message', 500)); return { ok: true, message: 'Request sent. You will be notified when it is answered.' }; });
}
export async function decideAccessAction(slug: string, rid: string, approve: boolean, level: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); C.decideAccess(c, rid, approve, level); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; });
}
