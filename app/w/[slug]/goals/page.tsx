import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Empty, Card, Status, Badge, fmtDate } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { createGoalAction, updateGoalAction, confirmGoalAction } from '@/lib/work-actions';
import { goalProgress } from '@/lib/svc/work';
export const metadata: Metadata = { title: 'Goals' };
export const dynamic = 'force-dynamic';
export default async function Goals({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const goals = all<any>(`SELECT g.*, u.name AS owner_name FROM goals g LEFT JOIN users u ON u.id=g.owner WHERE g.ws=? ORDER BY g.confirmed, g.due_date IS NULL, g.due_date`, c.ws.id);
  return (<div><PageHeader title="Goals" subtitle="Progress is measured from linked tasks or a manual figure. A goal counts as achieved only when its owner confirms it - completed checklists alone are not proof." />
    {goals.length === 0 ? <Empty title="No goals yet" icon="goal">Set a goal below, then link tasks to it from the task editor.</Empty> :
      <div className="grid gap-3 lg:grid-cols-2">{goals.map(g => { const pr = goalProgress(c.ws.id, g); const canEdit = g.owner === c.user.id || c.perms.has('content.edit'); const blocked = all<any>(`SELECT title, blocked_reason FROM tasks WHERE goal_id=? AND ws=? AND status='blocked' AND deleted_at IS NULL`, g.id, c.ws.id); return (
        <Card key={g.id}><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{g.title}</h2>{g.confirmed ? <Badge tone="ok">Achieved (confirmed)</Badge> : <Status value={g.status} />}</div>
          <p className="text-sm text-muted">{g.owner_name}{g.due_date ? ` · due ${fmtDate(g.due_date + 'T00:00:00Z', 'UTC')}` : ''}</p>
          <div className="mt-3 h-2.5 rounded-full bg-bg" role="progressbar" aria-valuenow={pr.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.title} progress`}><div className={`h-2.5 rounded-full ${g.confirmed ? 'bg-ok' : 'bg-brand'}`} style={{ width: `${pr.pct}%` }} /></div><p className="mt-1 text-sm">{pr.pct}% · {pr.basis}</p>
          {blocked.length > 0 && <p className="mt-2 text-sm text-bad">Blockers: {blocked.map(b => `${b.title} (${b.blocked_reason})`).join('; ')}</p>}
          {canEdit && <ActionForm action={updateGoalAction.bind(null, slug, g.id)} className="mt-3 flex flex-wrap items-end gap-2">{g.mode === 'manual' && <div><label className="label" htmlFor={`cur-${g.id}`}>Current</label><input id={`cur-${g.id}`} name="current" type="number" step="any" defaultValue={g.current} className="input w-28" /></div>}<div><label className="label" htmlFor={`gs-${g.id}`}>Status</label><select id={`gs-${g.id}`} name="status" defaultValue={g.status} className="input"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select></div><Submit variant="secondary" className="btn-sm">Update</Submit></ActionForm>}
          {canEdit && <div className="mt-2">{g.confirmed ? <ActionButton action={confirmGoalAction.bind(null, slug, g.id, false)} small variant="ghost">Withdraw confirmation</ActionButton> : <ActionButton action={confirmGoalAction.bind(null, slug, g.id, true)} small confirm="Confirm that this goal has really been achieved?">Confirm achieved</ActionButton>}</div>}
        </Card>); })}</div>}
    {c.perms.has('content.create') && <Card title="New goal" className="mt-6"><ActionForm action={createGoalAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-4 sm:items-end" resetOnSuccess><div className="sm:col-span-2"><label className="label" htmlFor="gt">Goal</label><input id="gt" name="title" className="input" required placeholder="e.g. Onboard 5 new clients this quarter" /></div><div><label className="label" htmlFor="gm">Measured by</label><select id="gm" name="mode" className="input"><option value="tasks">Linked tasks</option><option value="manual">A number I update</option></select></div><div><label className="label" htmlFor="gd">Due</label><input id="gd" type="date" name="due" className="input" /></div><div><label className="label" htmlFor="gtg">Target (for numbers)</label><input id="gtg" name="target" type="number" step="any" className="input" /></div><Submit>Create goal</Submit></ActionForm></Card>}</div>);
}
