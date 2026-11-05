'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard } from './action';
import { run } from './db';
import type { ActionResult } from '@/components/ActionForm';
export async function markReadAction(slug: string, nid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); run('UPDATE notifications SET read=1 WHERE id=? AND user_id=? AND ws=?', nid, c.user.id, c.ws.id); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; }); }
export async function markAllReadAction(slug: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); run('UPDATE notifications SET read=1 WHERE user_id=? AND ws=?', c.user.id, c.ws.id); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; }); }
