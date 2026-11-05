import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { PageHeader, Card, Status, Badge, fmtDate, Empty } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { addMilestoneAction, toggleMilestoneAction, setProjectStatusAction } from '@/lib/work-actions';
import { projectStats } from '@/lib/svc/work';
import { getRecord } from '@/lib/access';
import { StatusSelect } from '@/components/TaskBits';
import { todayIn } from '@/lib/dates';
export const dynamic = 'force-dynamic';
export default async function Project({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const p = one<any>('SELECT p.*, u.name AS owner_name FROM projects p LEFT JOIN users u ON u.id=p.owner WHERE p.id=? AND p.ws=?', id, c.ws.id); if (!p) notFound();
  const ms = all<any>('SELECT * FROM milestones WHERE project_id=? AND ws=? ORDER BY due_date IS NULL, due_date', id, c.ws.id); const tasks = all<any>(`SELECT t.*, u.name AS aname FROM tasks t LEFT JOIN users u ON u.id=t.assignee WHERE t.project_id=? AND t.ws=? AND t.deleted_at IS NULL ORDER BY t.due_date IS NULL, t.due_date`, id, c.ws.id);
  const s = projectStats(c.ws.id, id); const rec = p.record_id ? getRecord(c, p.record_id, 'view') : null; const today = todayIn(c.ws.timezone); const canEdit = c.perms.has('content.edit');
  return (<div><PageHeader crumbs={[{ href: `/w/${slug}/projects`, label: 'Projects' }, { label: p.name }]} title={p.name} subtitle={p.description} actions={<><Status value={p.status} />{canEdit && <ActionButton action={setProjectStatusAction.bind(null, slug, id, p.status === 'completed' ? 'active' : 'completed')} small>{p.status === 'completed' ? 'Reopen' : 'Mark completed'}</ActionButton>}<Link className="btn-primary btn-sm" href={`/w/${slug}/tasks?project=${id}&tab=all`}>Add task</Link></>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-4"><Card><p className="text-sm text-muted">Owner</p><p className="font-semibold">{p.owner_name}</p></Card><Card><p className="text-sm text-muted">Dates</p><p className="font-semibold">{p.start_date ? fmtDate(p.start_date + 'T00:00:00Z', 'UTC') : '-'} → {p.due_date ? fmtDate(p.due_date + 'T00:00:00Z', 'UTC') : '-'}</p></Card><Card><p className="text-sm text-muted">Progress</p><p className="font-semibold">{s.pct}% ({s.done}/{s.total})</p></Card><Card><p className="text-sm text-muted">Linked record</p><p className="font-semibold">{rec ? <Link className="link" href={`/w/${slug}/records/${p.record_id}`}>{rec.db.name}</Link> : p.record_id ? 'Restricted' : '-'}</p></Card></div>
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <Card title={`Tasks (${tasks.length})`}>{tasks.length === 0 ? <Empty title="No tasks yet" icon="task" /> : <ul className="divide-y divide-line">{tasks.map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><Link className="font-medium hover:underline" href={`/w/${slug}/tasks?open=${t.id}&tab=all`}>{t.title}</Link><span className="block text-xs text-muted">{t.aname || 'Unassigned'}{t.due_date ? ` · ${t.due_date < today && t.status !== 'done' ? 'overdue ' : ''}${fmtDate(t.due_date + 'T00:00:00Z', 'UTC')}` : ''}{t.blocked_reason ? ` · blocked: ${t.blocked_reason}` : ''}</span></span><StatusSelect slug={slug} taskId={t.id} status={t.status} /></li>)}</ul>}</Card>
      <Card title="Milestones">{ms.length === 0 ? <p className="text-sm text-muted">No milestones yet.</p> : <ul className="divide-y divide-line text-sm">{ms.map(m => <li key={m.id} className="flex items-center justify-between py-2"><span className={m.done ? 'text-muted line-through' : ''}>{m.name}{m.due_date && <span className="ml-2 text-xs text-muted">{fmtDate(m.due_date + 'T00:00:00Z', 'UTC')}</span>}</span>{canEdit && <ActionButton action={toggleMilestoneAction.bind(null, slug, m.id, !m.done)} small variant="ghost">{m.done ? 'Reopen' : 'Done'}</ActionButton>}</li>)}</ul>}
        {canEdit && <ActionForm action={addMilestoneAction.bind(null, slug, id)} className="mt-3 space-y-2" resetOnSuccess><label className="label" htmlFor="mn">New milestone</label><input id="mn" name="name" className="input" required /><label className="label" htmlFor="md">Due</label><input id="md" type="date" name="due" className="input" /><Submit variant="secondary">Add milestone</Submit></ActionForm>}</Card></div></div>);
}
