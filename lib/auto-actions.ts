'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireCtx } from './ctx';
import { guard, str, need, UserError } from './action';
import * as A from './svc/auto';
import { retryJob, processJobs } from './svc/core';
import { getSession } from './ctx';
import type { ActionResult } from '@/components/ActionForm';
const rv = (slug: string) => revalidatePath(`/w/${slug}`, 'layout');

export async function saveFormAction(slug: string, formId: string | null, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const fields = fd.getAll('field').map(String).map(p => ({ prop: p, label: str(fd, 'label_' + p, 100) || '', required: fd.get('req_' + p) === 'on' }));
    const fid = A.saveForm(c, { id: formId || undefined, name: str(fd, 'name', 100), dbId: str(fd, 'db'), fields, isPublic: fd.get('public') === 'on', active: fd.get('active') !== null, success: str(fd, 'success', 300) }); rv(slug); return { ok: true, redirect: `/w/${slug}/forms/${fid}` };
  });
}
export async function submitFormAction(token: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    if (str(fd, 'website')) return { ok: true, message: 'Thank you.' }; const h = await headers(); const ip = (h.get('x-forwarded-for') || 'local').split(',')[0].trim(); const s = await getSession();
    const data: Record<string, any> = {}; for (const [k, v] of fd.entries()) { if (!k.startsWith('f_')) continue; const key = k.slice(2); if (data[key] !== undefined) data[key] = [].concat(data[key], v as any); else data[key] = String(v); }
    for (const k of fd.getAll('multi').map(String)) { data[k] = fd.getAll('f_' + k).map(String); } for (const k of fd.getAll('bool').map(String)) data[k] = fd.get('f_' + k) === 'on';
    const r = A.submitForm(token, data, str(fd, 'nonce', 80), ip, s && !s.expired && !s.pending2fa ? s.user : undefined); return { ok: true, message: r.message, data: { done: true } };
  });
}
export async function saveAutomationAction(slug: string, aid: string | null, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const conditions: any[] = []; for (let i = 0; i < 3; i++) { const p = str(fd, `cp${i}`); if (p) conditions.push({ prop: p, op: str(fd, `co${i}`) || 'eq', value: str(fd, `cv${i}`) }); }
    const actions: any[] = []; for (let i = 0; i < 3; i++) { const t = str(fd, `at${i}`); if (!t) continue; if (t === 'create_task') actions.push({ type: t, title: str(fd, `atitle${i}`, 200), assignee: str(fd, `aassign${i}`) || null }); else if (t === 'set_property') actions.push({ type: t, prop: str(fd, `aprop${i}`), value: str(fd, `aval${i}`) }); else if (t === 'notify') actions.push({ type: t, user: str(fd, `aassign${i}`) }); else if (t === 'reminder') actions.push({ type: t, days: Number(fd.get(`adays${i}`)) || 1, text: str(fd, `atitle${i}`, 200), user: str(fd, `aassign${i}`) || undefined }); }
    const id = A.saveAutomation(c, { id: aid || undefined, name: str(fd, 'name', 100), event: str(fd, 'event'), db: str(fd, 'db') || undefined, conditions, actions }); rv(slug); return { ok: true, redirect: `/w/${slug}/automations/${id}` };
  });
}
export async function testAutomationAction(slug: string, aid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); const r = A.testAutomation(c, aid); rv(slug); return { ok: true, message: 'Test passed - nothing was changed. Would do: ' + r.log.join('; ') }; }); }
export async function toggleAutomationAction(slug: string, aid: string, active: boolean): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); A.setAutomationActive(c, aid, active); rv(slug); return { ok: true }; }); }
export async function createWebhookAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); const r = A.createWebhook(c, str(fd, 'url', 500), fd.getAll('event').map(String)); rv(slug); return { ok: true, message: `Webhook created. Signing secret (shown once): ${r.secret}` }; }); }
export async function testWebhookAction(slug: string, wid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); A.testWebhook(c, wid); await processJobs(5); rv(slug); return { ok: true, message: 'Test event sent - see the delivery log.' }; }); }
export async function deleteWebhookAction(slug: string, wid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); A.deleteWebhook(c, wid); rv(slug); return { ok: true }; }); }
export async function createApiKeyAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); const raw = A.createApiKey(c, str(fd, 'name', 60), str(fd, 'scopes')); rv(slug); return { ok: true, message: `Key created. Copy it now - it is never shown again: ${raw}` }; }); }
export async function revokeApiKeyAction(slug: string, kid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); A.revokeApiKey(c, kid); rv(slug); return { ok: true }; }); }
export async function registerConnectionAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); A.registerConnection(c, Object.fromEntries(['provider', 'objects', 'direction', 'schedule', 'source_of_truth', 'failure_owner'].map(k => [k, str(fd, k, 200)]))); rv(slug); return { ok: true, message: 'Connection registered and waiting for approval by platform support.' }; }); }
export async function retryJobAction(slug: string, jid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug, 'integrations.manage'); if (!retryJob(jid, c.ws.id)) throw new UserError('That job cannot be retried.'); await processJobs(5); rv(slug); return { ok: true }; }); }
