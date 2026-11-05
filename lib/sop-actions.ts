'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need } from './action';
import * as S from './svc/sop';
import type { ActionResult } from '@/components/ActionForm';
const rv = (slug: string) => revalidatePath(`/w/${slug}`, 'layout');
export async function createSopAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const sid = S.createSop(c, { title: str(fd, 'title', 160), audience: fd.getAll('audience').map(String).filter(Boolean), reviewDays: Number(fd.get('review')) || 365, requiresAck: fd.get('ack') !== null }); return { ok: true, redirect: `/w/${slug}/knowledge/${sid}` }; });
}
export async function submitSopAction(slug: string, sid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.submitForReview(c, sid, str(fd, 'note', 500)); rv(slug); return { ok: true, message: 'Submitted for review.' }; }); }
export async function returnSopAction(slug: string, sid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.returnToDraft(c, sid, str(fd, 'reason', 500)); rv(slug); return { ok: true, message: 'Returned to the author.' }; }); }
export async function publishSopAction(slug: string, sid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.publish(c, sid, { effectiveFrom: str(fd, 'effective') || undefined, changeNote: str(fd, 'note', 500) }); rv(slug); return { ok: true, message: 'Published. The audience has been asked to acknowledge.' }; }); }
export async function ackSopAction(slug: string, sid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.acknowledge(c, sid); rv(slug); return { ok: true }; }); }
export async function reviseSopAction(slug: string, sid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.startRevision(c, sid); rv(slug); return { ok: true }; }); }
export async function retireSopAction(slug: string, sid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.retire(c, sid, str(fd, 'reason', 500)); rv(slug); return { ok: true, message: 'Retired.' }; }); }
export async function reviewedSopAction(slug: string, sid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); S.reviewed(c, sid); rv(slug); return { ok: true }; }); }
export async function remindSopAction(slug: string, sid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); const n = S.remind(c, sid); return { ok: true, message: `Reminder sent to ${n} people.` }; }); }
