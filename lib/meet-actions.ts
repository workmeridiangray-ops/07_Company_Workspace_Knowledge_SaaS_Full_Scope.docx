'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need } from './action';
import * as M from './svc/meet';
import { sanitizeBlocks, parsePaste } from './blocks';
import type { ActionResult } from '@/components/ActionForm';
const rv = (slug: string) => revalidatePath(`/w/${slug}`, 'layout');
export async function createMeetingAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const mid = M.createMeeting(c, { title: str(fd, 'title', 140), date: str(fd, 'date'), time: str(fd, 'time'), minutes: Number(fd.get('minutes')) || 30, location: str(fd, 'location', 140), attendees: fd.getAll('attendee').map(String), agenda: str(fd, 'agenda', 3000).split('\n'), projectId: str(fd, 'project') || null, templateId: str(fd, 'template') || null }); return { ok: true, redirect: `/w/${slug}/meetings/${mid}` }; });
}
export async function attendanceAction(slug: string, mid: string, uid: string, status: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.setAttendance(c, mid, uid, status as any); rv(slug); return { ok: true }; }); }
export async function addAttendeeAction(slug: string, mid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.addAttendee(c, mid, need(str(fd, 'user'), 'Choose a person.')); rv(slug); return { ok: true }; }); }
export async function addAgendaAction(slug: string, mid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.addAgenda(c, mid, str(fd, 'text', 200)); rv(slug); return { ok: true }; }); }
export async function toggleAgendaAction(slug: string, mid: string, aid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.toggleAgenda(c, mid, aid); rv(slug); return { ok: true }; }); }
export async function meetingStatusAction(slug: string, mid: string, status: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.setMeetingStatus(c, mid, status); rv(slug); return { ok: true }; }); }
export async function addDecisionAction(slug: string, mid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.addDecision(c, mid, { text: str(fd, 'text', 1000), owner: str(fd, 'owner'), sopRef: str(fd, 'sop') || undefined, relatedRecord: str(fd, 'record') || undefined }); rv(slug); return { ok: true, message: 'Decision recorded.' }; }); }
export async function addActionItemAction(slug: string, mid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.addAction(c, mid, { title: str(fd, 'title', 200), assignee: str(fd, 'assignee'), due: str(fd, 'due') || undefined }); rv(slug); return { ok: true, message: 'Action created as a task.' }; }); }
export async function saveTemplateAction(slug: string, tid: string | null, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const kind = str(fd, 'kind', 12) || 'page'; let payload: any = {};
    if (kind === 'database') { try { payload = { name: str(fd, 'title', 80), props: JSON.parse(str(fd, 'props', 8000) || '[]') }; } catch { throw new Error('Properties must be valid JSON.'); } if (!Array.isArray(payload.props) || !payload.props.length) payload.props = [{ id: 'name', name: 'Name', type: 'text', title: true }]; }
    else { payload = { title: str(fd, 'title', 140), body: parsePaste(String(fd.get('body') || '')), agenda: str(fd, 'agenda', 2000).split('\n').map(s => s.trim()).filter(Boolean) }; }
    const id = M.saveTemplate(c, { id: tid || undefined, name: need(str(fd, 'name', 100), 'Name the template.'), kind, description: str(fd, 'description', 300), payload }); rv(slug); return { ok: true, redirect: `/w/${slug}/templates/${id}` };
  });
}
export async function useTemplateAction(slug: string, tid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); const r = M.instantiate(c, tid, { title: str(fd, 'title', 140) || undefined, teamspaceId: str(fd, 'teamspace') || null }); return { ok: true, redirect: `/w/${slug}/${r.redirect}` }; }); }
export async function applyUpdateAction(slug: string, uid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.applyTemplateUpdate(c, uid); rv(slug); return { ok: true }; }); }
export async function dismissUpdateAction(slug: string, uid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); M.dismissTemplateUpdate(c, uid); rv(slug); return { ok: true }; }); }
