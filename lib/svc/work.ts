// Tasks, projects, goals. Dates are workspace-local plain dates; recurrence follows the workspace time zone.
import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { getPage, getRecord } from '../access';
import { audit } from '../audit';
import { emit, notify } from './core';
import { todayIn, nextDue, type Recur } from '../dates';

export const STATUSES = ['todo', 'doing', 'blocked', 'done'] as const;
export interface TaskInput { title: string; assignee?: string | null; due?: string | null; priority?: string; project?: string | null; milestone?: string | null; goal?: string | null; page?: string | null; record?: string | null; dependsOn?: string | null; recur?: Recur; blockedReason?: string | null }
function checkLinks(c: Ctx, i: TaskInput) {
  if (i.assignee && !one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, i.assignee)) throw new Invalid('Assignee must be an active workspace member.');
  if (i.project && !one('SELECT 1 FROM projects WHERE id=? AND ws=?', i.project, c.ws.id)) throw new Invalid('Unknown project.');
  if (i.milestone && !one('SELECT 1 FROM milestones WHERE id=? AND ws=? AND project_id=?', i.milestone, c.ws.id, i.project)) throw new Invalid('That milestone belongs to a different project.');
  if (i.goal && !one('SELECT 1 FROM goals WHERE id=? AND ws=?', i.goal, c.ws.id)) throw new Invalid('Unknown goal.');
  if (i.page && !getPage(c, i.page, 'view')) throw new Invalid('You cannot link to that page.');
  if (i.record && !getRecord(c, i.record, 'view')) throw new Invalid('You cannot link to that record.');
  if (i.due && !/^\d{4}-\d{2}-\d{2}$/.test(i.due)) throw new Invalid('Due date must be a valid date.');
}
export function createTask(c: Ctx, i: TaskInput) {
  assertCan(c, 'content.create'); writableWorkspace(c); const title = i.title.trim(); if (!title) throw new Invalid('Give the task a title.'); if (title.length > 200) throw new Invalid('Task titles can be up to 200 characters.');
  checkLinks(c, i); if (i.assignee && i.assignee !== c.user.id) assertCan(c, 'content.assign');
  if (i.recur && !i.due) throw new Invalid('Recurring tasks need a due date to anchor the schedule.');
  const tid = id('t_'); insert('tasks', { id: tid, ws: c.ws.id, title, status: 'todo', priority: ['low', 'medium', 'high'].includes(i.priority || '') ? i.priority : 'medium', assignee: i.assignee || null, due_date: i.due || null, project_id: i.project || null, milestone_id: i.milestone || null, goal_id: i.goal || null, page_id: i.page || null, record_id: i.record || null, depends_on: i.dependsOn || null, recur: i.recur ? JSON.stringify(i.recur) : null, created_by: c.user.id, created_at: now() });
  if (i.assignee) notify(c.ws.id, i.assignee, 'assignment', 'task', tid, c.user.id); audit(c, 'task.created', 'task', tid, {}); return tid;
}
export function openDependency(ws: string, t: any): any | null {
  if (!t.depends_on) return null; const d = one<any>(`SELECT id,title,status FROM tasks WHERE id=? AND ws=? AND deleted_at IS NULL`, t.depends_on, ws); return d && d.status !== 'done' ? d : null;
}
function wouldCycle(ws: string, taskId: string, dependsOn: string) { let cur: string | null = dependsOn; let n = 0; while (cur && n++ < 50) { if (cur === taskId) return true; cur = one<any>('SELECT depends_on FROM tasks WHERE id=? AND ws=?', cur, ws)?.depends_on ?? null; } return false; }
export function updateTask(c: Ctx, taskId: string, patch: Partial<TaskInput> & { status?: string }) {
  writableWorkspace(c); const t = one<any>('SELECT * FROM tasks WHERE id=? AND ws=? AND deleted_at IS NULL', taskId, c.ws.id); if (!t) throw new Invalid('Task not found.');
  if (!c.perms.has('content.edit') && t.assignee !== c.user.id && t.created_by !== c.user.id) throw new Forbidden('content.edit');
  const next: any = {};
  if (patch.title !== undefined) { if (!patch.title.trim()) throw new Invalid('Give the task a title.'); next.title = patch.title.trim().slice(0, 200); }
  if (patch.assignee !== undefined) { if (patch.assignee && patch.assignee !== c.user.id) assertCan(c, 'content.assign'); checkLinks(c, { title: 'x', assignee: patch.assignee }); next.assignee = patch.assignee || null; if (patch.assignee && patch.assignee !== t.assignee) notify(c.ws.id, patch.assignee, 'assignment', 'task', taskId, c.user.id); }
  if (patch.due !== undefined) { checkLinks(c, { title: 'x', due: patch.due }); next.due_date = patch.due || null; }
  if (patch.priority !== undefined && ['low', 'medium', 'high'].includes(patch.priority)) next.priority = patch.priority;
  if (patch.dependsOn !== undefined) { if (patch.dependsOn) { if (patch.dependsOn === taskId || wouldCycle(c.ws.id, taskId, patch.dependsOn)) throw new Invalid('That dependency would create a loop.'); if (!one('SELECT 1 FROM tasks WHERE id=? AND ws=? AND deleted_at IS NULL', patch.dependsOn, c.ws.id)) throw new Invalid('Unknown dependency.'); } next.depends_on = patch.dependsOn || null; }
  if (patch.project !== undefined || patch.milestone !== undefined) { const pr = patch.project !== undefined ? patch.project : t.project_id; checkLinks(c, { title: 'x', project: pr, milestone: patch.milestone ?? undefined }); next.project_id = pr || null; next.milestone_id = patch.milestone ?? (patch.project !== undefined && patch.project !== t.project_id ? null : t.milestone_id); }
  if (patch.goal !== undefined) { checkLinks(c, { title: 'x', goal: patch.goal }); next.goal_id = patch.goal || null; }
  if (patch.recur !== undefined) next.recur = patch.recur ? JSON.stringify(patch.recur) : null;
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status as any)) throw new Invalid('Unknown status.');
    if (patch.status === 'done') { const dep = openDependency(c.ws.id, t); if (dep) throw new Invalid(`Finish “${dep.title}” first - this task depends on it.`); }
    if (patch.status === 'blocked' && !(patch.blockedReason || t.blocked_reason)) throw new Invalid('Say what is blocking this task.');
    next.status = patch.status; next.blocked_reason = patch.status === 'blocked' ? (patch.blockedReason || t.blocked_reason) : null; next.completed_at = patch.status === 'done' ? now() : null;
  }
  if (!Object.keys(next).length) return;
  tx(() => {
    const keys = Object.keys(next); run(`UPDATE tasks SET ${keys.map(k => k + '=?').join(',')} WHERE id=? AND ws=?`, ...keys.map(k => next[k]), taskId, c.ws.id);
    if (next.status === 'done' && t.status !== 'done') {
      // Recurrence is anchored to the previous due date and evaluated in the workspace time zone; the next occurrence is created once.
      const rec = J<Recur>(t.recur, null);
      if (rec && t.due_date) { const nd = nextDue(t.due_date, rec, todayIn(c.ws.timezone)); if (!one('SELECT 1 FROM tasks WHERE source_task=? AND due_date=? AND ws=?', taskId, nd, c.ws.id)) run(`INSERT INTO tasks(id,ws,title,status,priority,assignee,due_date,project_id,milestone_id,goal_id,page_id,record_id,recur,source_task,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id('t_'), c.ws.id, t.title, 'todo', t.priority, t.assignee, nd, t.project_id, t.milestone_id, t.goal_id, t.page_id, t.record_id, t.recur, taskId, t.created_by, now()); }
      emit(c, 'task.completed', { id: taskId, version: now(), data: { title: t.title } });
    }
  });
  audit(c, 'task.updated', 'task', taskId, { fields: Object.keys(next) });
}
export function deleteTask(c: Ctx, taskId: string) { assertCan(c, 'content.delete'); run('UPDATE tasks SET deleted_at=? WHERE id=? AND ws=?', now(), taskId, c.ws.id); audit(c, 'task.deleted', 'task', taskId, {}); }

// ---- projects / milestones ----
export function createProject(c: Ctx, o: { name: string; description?: string; owner?: string; start?: string; due?: string; record?: string }) {
  assertCan(c, 'content.create'); writableWorkspace(c); if (!o.name.trim()) throw new Invalid('Name the project.');
  if (o.record && !getRecord(c, o.record, 'view')) throw new Invalid('You cannot link to that record.'); if (o.start && o.due && o.due < o.start) throw new Invalid('The due date is before the start date.');
  const pid = id('pj_'); insert('projects', { id: pid, ws: c.ws.id, name: o.name.trim().slice(0, 120), description: (o.description || '').slice(0, 2000), status: 'active', owner: o.owner || c.user.id, start_date: o.start || null, due_date: o.due || null, record_id: o.record || null, created_at: now() }); audit(c, 'project.created', 'project', pid, {}); return pid;
}
export function addMilestone(c: Ctx, projectId: string, name: string, due?: string) { assertCan(c, 'content.edit'); if (!one('SELECT 1 FROM projects WHERE id=? AND ws=?', projectId, c.ws.id)) throw new Invalid('Unknown project.'); if (!name.trim()) throw new Invalid('Name the milestone.'); insert('milestones', { id: id('ms_'), ws: c.ws.id, project_id: projectId, name: name.trim().slice(0, 120), due_date: due || null, done: 0 }); }
export function projectStats(ws: string, projectId: string) {
  const t = all<any>(`SELECT status, due_date FROM tasks WHERE ws=? AND project_id=? AND deleted_at IS NULL`, ws, projectId); const done = t.filter(x => x.status === 'done').length;
  return { total: t.length, done, blocked: t.filter(x => x.status === 'blocked').length, pct: t.length ? Math.round((done / t.length) * 100) : 0 };
}
// ---- goals ----
/** Goal progress is *computed* from linked tasks (or a manual current/target), but a goal is only "achieved" when a human confirms it. */
export function goalProgress(ws: string, g: any) {
  if (g.mode === 'manual') return { pct: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0, basis: `${g.current} of ${g.target}` };
  const t = one<any>(`SELECT COUNT(*) n, SUM(status='done') d FROM tasks WHERE ws=? AND goal_id=? AND deleted_at IS NULL`, ws, g.id); return { pct: t.n ? Math.round(((t.d || 0) / t.n) * 100) : 0, basis: `${t.d || 0} of ${t.n} tasks done` };
}
export function createGoal(c: Ctx, o: { title: string; due?: string; mode?: string; target?: number }) {
  assertCan(c, 'content.create'); writableWorkspace(c); if (!o.title.trim()) throw new Invalid('Give the goal a title.'); const gid = id('g_');
  insert('goals', { id: gid, ws: c.ws.id, title: o.title.trim().slice(0, 160), owner: c.user.id, due_date: o.due || null, mode: o.mode === 'manual' ? 'manual' : 'tasks', target: o.target && o.target > 0 ? o.target : 100, current: 0, status: 'on_track', confirmed: 0, created_at: now() }); audit(c, 'goal.created', 'goal', gid, {}); return gid;
}
export function updateGoal(c: Ctx, goalId: string, o: { current?: number; status?: string; confirm?: boolean }) {
  const g = one<any>('SELECT * FROM goals WHERE id=? AND ws=?', goalId, c.ws.id); if (!g) throw new Invalid('Goal not found.'); if (g.owner !== c.user.id && !c.perms.has('content.edit')) throw new Forbidden('content.edit');
  if (o.current !== undefined) { if (g.mode !== 'manual') throw new Invalid('This goal is measured from its tasks.'); run('UPDATE goals SET current=? WHERE id=?', Math.max(0, o.current), goalId); }
  if (o.status && ['on_track', 'at_risk', 'off_track'].includes(o.status)) run('UPDATE goals SET status=? WHERE id=?', o.status, goalId);
  if (o.confirm !== undefined) { if (o.confirm && g.mode === 'tasks' && goalProgress(c.ws.id, g).pct < 100) throw new Invalid('Not all linked tasks are done yet. Finishing tasks does not by itself prove the goal - confirm once they are.'); run('UPDATE goals SET confirmed=? WHERE id=?', o.confirm ? 1 : 0, goalId); audit(c, o.confirm ? 'goal.confirmed' : 'goal.unconfirmed', 'goal', goalId, {}); }
}
