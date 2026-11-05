'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need, UserError } from './action';
import * as W from './svc/work';
import type { ActionResult } from '@/components/ActionForm';
const rv = (slug: string) => revalidatePath(`/w/${slug}`, 'layout');
function recurFrom(fd: FormData): W.TaskInput['recur'] { const e = str(fd, 'recur'); return e ? { every: e as any, interval: Math.max(1, Number(fd.get('interval')) || 1) } : null; }
export async function createTaskAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); W.createTask(c, { title: str(fd, 'title', 200), assignee: str(fd, 'assignee') || null, due: str(fd, 'due') || null, priority: str(fd, 'priority'), project: str(fd, 'project') || null, milestone: str(fd, 'milestone') || null, goal: str(fd, 'goal') || null, page: str(fd, 'page') || null, record: str(fd, 'record') || null, dependsOn: str(fd, 'dependsOn') || null, recur: recurFrom(fd) }); rv(slug); return { ok: true, message: 'Task added.' }; });
}
export async function taskStatusAction(slug: string, taskId: string, status: string, _p?: any, fd?: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); W.updateTask(c, taskId, { status, blockedReason: fd ? str(fd, 'reason', 300) : undefined }); rv(slug); return { ok: true }; });
}
export async function blockTaskAction(slug: string, taskId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); W.updateTask(c, taskId, { status: 'blocked', blockedReason: need(str(fd, 'reason', 300), 'Say what is blocking this task.') }); rv(slug); return { ok: true }; });
}
export async function editTaskAction(slug: string, taskId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); W.updateTask(c, taskId, { title: str(fd, 'title', 200), assignee: str(fd, 'assignee') || null, due: str(fd, 'due') || null, priority: str(fd, 'priority'), dependsOn: str(fd, 'dependsOn') || null, goal: str(fd, 'goal') || null, recur: recurFrom(fd) }); rv(slug); return { ok: true, message: 'Saved.' }; });
}
export async function deleteTaskAction(slug: string, taskId: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); W.deleteTask(c, taskId); rv(slug); return { ok: true }; }); }
export async function createProjectAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const pid = W.createProject(c, { name: str(fd, 'name', 120), description: str(fd, 'description', 2000), start: str(fd, 'start') || undefined, due: str(fd, 'due') || undefined, record: str(fd, 'record') || undefined }); return { ok: true, redirect: `/w/${slug}/projects/${pid}` }; });
}
export async function addMilestoneAction(slug: string, pid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); W.addMilestone(c, pid, str(fd, 'name', 120), str(fd, 'due') || undefined); rv(slug); return { ok: true, message: 'Milestone added.' }; }); }
export async function toggleMilestoneAction(slug: string, mid: string, done: boolean): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const { run, one } = await import('./db'); if (!c.perms.has('content.edit')) throw new UserError('You do not have permission.'); if (!one('SELECT 1 FROM milestones WHERE id=? AND ws=?', mid, c.ws.id)) throw new UserError('Not found.'); run('UPDATE milestones SET done=? WHERE id=? AND ws=?', done ? 1 : 0, mid, c.ws.id); rv(slug); return { ok: true }; });
}
export async function setProjectStatusAction(slug: string, pid: string, status: string): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug, 'content.edit'); if (!['active', 'on_hold', 'completed', 'cancelled'].includes(status)) throw new UserError('Unknown status.'); const { run } = await import('./db'); run('UPDATE projects SET status=? WHERE id=? AND ws=?', status, pid, c.ws.id); rv(slug); return { ok: true }; });
}
export async function createGoalAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); W.createGoal(c, { title: str(fd, 'title', 160), due: str(fd, 'due') || undefined, mode: str(fd, 'mode'), target: Number(fd.get('target')) || undefined }); rv(slug); return { ok: true, message: 'Goal created.' }; }); }
export async function updateGoalAction(slug: string, gid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); W.updateGoal(c, gid, { current: fd.has('current') ? Number(fd.get('current')) : undefined, status: str(fd, 'status') || undefined }); rv(slug); return { ok: true, message: 'Goal updated.' }; }); }
export async function confirmGoalAction(slug: string, gid: string, value: boolean): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); W.updateGoal(c, gid, { confirm: value }); rv(slug); return { ok: true }; }); }
