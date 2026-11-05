import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { PageHeader, Empty, Badge, Card, fmtDate, Status, Tabs } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { StatusSelect } from '@/components/TaskBits';
import { createTaskAction, editTaskAction, deleteTaskAction } from '@/lib/work-actions';
import { todayIn, addDays, monthGrid } from '@/lib/dates';
import { openDependency } from '@/lib/svc/work';
import { getPage, getRecord } from '@/lib/access';
export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';
export default async function Tasks({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; view?: string; open?: string; record?: string; page?: string; project?: string; month?: string; q?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug); const base = `/w/${slug}`; const today = todayIn(c.ws.timezone);
  const tab = sp.tab || 'mine'; const view = sp.view || 'list';
  let tasks = all<any>(`SELECT t.*, u.name AS assignee_name, p.name AS project_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee LEFT JOIN projects p ON p.id=t.project_id WHERE t.ws=? AND t.deleted_at IS NULL ORDER BY t.due_date IS NULL, t.due_date, t.created_at`, c.ws.id);
  if (sp.q) tasks = tasks.filter(t => t.title.toLowerCase().includes(sp.q!.toLowerCase()));
  const counts = { mine: tasks.filter(t => t.assignee === c.user.id && t.status !== 'done').length, due: tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date <= addDays(today, 7)).length, blocked: tasks.filter(t => t.status === 'blocked').length, all: tasks.length };
  const shown = tasks.filter(t => tab === 'mine' ? t.assignee === c.user.id && t.status !== 'done' : tab === 'due' ? t.status !== 'done' && t.due_date && t.due_date <= addDays(today, 7) : tab === 'blocked' ? t.status === 'blocked' : tab === 'done' ? t.status === 'done' : true);
  const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active' ORDER BY u.name`, c.ws.id);
  const projects = all<any>('SELECT id,name FROM projects WHERE ws=? AND status=\'active\' ORDER BY name', c.ws.id); const goals = all<any>('SELECT id,title FROM goals WHERE ws=? ORDER BY title', c.ws.id);
  const open = sp.open ? tasks.find(t => t.id === sp.open) : null; const canCreate = c.perms.has('content.create') && !['suspended', 'expired', 'closed'].includes(c.ws.status);
  const linkRecord = sp.record && getRecord(c, sp.record, 'view') ? sp.record : ''; const linkPage = sp.page && getPage(c, sp.page, 'view') ? sp.page : '';
  const tabs = [{ key: 'mine', label: 'My tasks', count: counts.mine }, { key: 'due', label: 'Due soon', count: counts.due }, { key: 'blocked', label: 'Blocked', count: counts.blocked }, { key: 'all', label: 'All', count: counts.all }, { key: 'done', label: 'Done' }].map(t => ({ ...t, href: `${base}/tasks?tab=${t.key}&view=${view}` }));
  const ym = sp.month || today.slice(0, 7);
  return (
    <div>
      <PageHeader title="Tasks" subtitle={`Dates and recurrence use the workspace time zone (${c.ws.timezone}). Today is ${fmtDate(today + 'T00:00:00Z', 'UTC')}.`} actions={<div className="flex gap-1">{['list', 'board', 'calendar'].map(v => <Link key={v} href={`${base}/tasks?tab=${tab}&view=${v}`} className={`btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}>{v[0].toUpperCase() + v.slice(1)}</Link>)}</div>} />
      <Tabs items={tabs} current={tab} />
      {open && (<Card title="Edit task" className="mb-5" actions={<Link href={`${base}/tasks?tab=${tab}&view=${view}`} className="link text-sm">Close</Link>}>
        <ActionForm action={editTaskAction.bind(null, slug, open.id)} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-3"><label className="label" htmlFor="et">Title</label><input id="et" name="title" defaultValue={open.title} className="input" required /></div>
          <div><label className="label" htmlFor="ea">Assignee</label><select id="ea" name="assignee" defaultValue={open.assignee || ''} className="input"><option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ed">Due</label><input id="ed" type="date" name="due" defaultValue={open.due_date || ''} className="input" /></div>
          <div><label className="label" htmlFor="ep">Priority</label><select id="ep" name="priority" defaultValue={open.priority} className="input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div><label className="label" htmlFor="edp">Depends on</label><select id="edp" name="dependsOn" defaultValue={open.depends_on || ''} className="input"><option value="">Nothing</option>{tasks.filter(t => t.id !== open.id).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
          <div><label className="label" htmlFor="eg">Goal</label><select id="eg" name="goal" defaultValue={open.goal_id || ''} className="input"><option value="">None</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></div>
          <div><label className="label" htmlFor="er">Repeats</label><select id="er" name="recur" defaultValue={J<any>(open.recur, {})?.every || ''} className="input"><option value="">Does not repeat</option><option value="day">Daily</option><option value="weekday">Every weekday</option><option value="week">Weekly</option><option value="month">Monthly</option></select></div>
          <Submit>Save task</Submit><ActionButton action={deleteTaskAction.bind(null, slug, open.id)} variant="ghost" confirm="Delete this task?">Delete</ActionButton>
          {open.blocked_reason && <p className="sm:col-span-3 text-sm text-bad">Blocked: {open.blocked_reason}</p>}
          {openDependency(c.ws.id, open) && <p className="sm:col-span-3 text-sm text-warn">Waiting on “{openDependency(c.ws.id, open).title}”.</p>}
          {open.recur && <p className="sm:col-span-3 text-sm text-muted">When completed, the next occurrence is created from the due date, in {c.ws.timezone}.</p>}
        </ActionForm></Card>)}
      {canCreate && (<details className="card mb-5" open={!!(linkRecord || linkPage || sp.project)}><summary className="cursor-pointer px-4 py-3 font-semibold">Add a task</summary><div className="border-t border-line p-4">
        <ActionForm action={createTaskAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-3 sm:items-end" resetOnSuccess>
          <input type="hidden" name="record" value={linkRecord} /><input type="hidden" name="page" value={linkPage} />
          <div className="sm:col-span-3"><label className="label" htmlFor="nt">Title</label><input id="nt" name="title" className="input" required placeholder="e.g. Send revised proposal to Acme" />{(linkRecord || linkPage) && <p className="hint">Linked to the {linkRecord ? 'record' : 'page'} you came from.</p>}</div>
          <div><label className="label" htmlFor="na">Assignee</label><select id="na" name="assignee" defaultValue={c.user.id} className="input"><option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="nd">Due</label><input id="nd" type="date" name="due" className="input" /></div>
          <div><label className="label" htmlFor="np">Priority</label><select id="np" name="priority" defaultValue="medium" className="input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div><label className="label" htmlFor="npj">Project</label><select id="npj" name="project" defaultValue={sp.project || ''} className="input"><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ng">Goal</label><select id="ng" name="goal" className="input"><option value="">None</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></div>
          <div><label className="label" htmlFor="nr">Repeats</label><select id="nr" name="recur" className="input"><option value="">Does not repeat</option><option value="day">Daily</option><option value="weekday">Every weekday</option><option value="week">Weekly</option><option value="month">Monthly</option></select><p className="hint">Needs a due date.</p></div>
          <Submit>Add task</Submit></ActionForm></div></details>)}
      {shown.length === 0 ? <Empty title={tab === 'mine' ? 'Nothing assigned to you' : 'No tasks here'} icon="task">{tab === 'mine' ? 'Tasks assigned to you will appear here.' : 'Try another tab.'}</Empty> :
        view === 'board' ? (<div className="flex gap-3 overflow-x-auto pb-3">{[['todo', 'To do'], ['doing', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']].map(([k, label]) => (<section key={k} aria-label={label} className="w-72 shrink-0 rounded-lg border border-line bg-bg p-2"><h3 className="mb-2 flex justify-between px-1 text-sm font-semibold">{label}<span className="font-normal text-muted">{shown.filter(t => t.status === k).length}</span></h3><ul className="space-y-2">{shown.filter(t => t.status === k).map(t => (<li key={t.id} className="card p-3 text-sm"><Link className="font-medium hover:underline" href={`${base}/tasks?tab=${tab}&view=board&open=${t.id}`}>{t.title}</Link><p className="mt-1 text-xs text-muted">{t.assignee_name || 'Unassigned'}{t.due_date ? ` · ${t.due_date < today && t.status !== 'done' ? 'overdue ' : ''}${fmtDate(t.due_date + 'T00:00:00Z', 'UTC')}` : ''}</p><div className="mt-2"><StatusSelect slug={slug} taskId={t.id} status={t.status} /></div></li>))}</ul></section>))}</div>) :
        view === 'calendar' ? (() => { const { days, month } = monthGrid(ym); const by: Record<string, any[]> = {}; for (const t of shown) if (t.due_date) (by[t.due_date] ||= []).push(t); const mv = (n: number) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
          return (<div><div className="mb-2 flex items-center justify-between"><Link className="btn-secondary btn-sm" href={`${base}/tasks?tab=${tab}&view=calendar&month=${mv(-1)}`}>← Prev</Link><h2 className="font-semibold">{new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><Link className="btn-secondary btn-sm" href={`${base}/tasks?tab=${tab}&view=calendar&month=${mv(1)}`}>Next →</Link></div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-xs">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="bg-bg p-1.5 text-center font-semibold">{d}</div>)}{days.map(d => <div key={d} className={`min-h-[80px] p-1 ${Number(d.slice(5, 7)) === month ? 'bg-surface' : 'bg-bg text-muted'} ${d === today ? 'ring-2 ring-inset ring-brand' : ''}`}><div className="text-right">{Number(d.slice(8))}</div>{(by[d] || []).map(t => <Link key={t.id} href={`${base}/tasks?tab=${tab}&view=calendar&open=${t.id}`} className={`mb-0.5 block truncate rounded px-1 ${t.status === 'done' ? 'bg-okSoft text-ok line-through' : d < today ? 'bg-badSoft text-bad' : 'bg-brandSoft text-brand'}`}>{t.title}</Link>)}</div>)}</div>
            {shown.some(t => !t.due_date) && <p className="mt-2 text-sm text-muted">{shown.filter(t => !t.due_date).length} task(s) have no due date and are not on the calendar.</p>}</div>); })() :
        (<ul className="card divide-y divide-line">{shown.map(t => { const dep = openDependency(c.ws.id, t); const late = t.due_date && t.due_date < today && t.status !== 'done'; return (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><Link href={`${base}/tasks?tab=${tab}&open=${t.id}`} className={`font-medium hover:underline ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{t.title}</Link>
            <p className="text-xs text-muted">{t.assignee_name || 'Unassigned'}{t.project_name ? ` · ${t.project_name}` : ''}{t.recur ? ' · repeats' : ''}{dep ? ` · waiting on “${dep.title}”` : ''}{t.blocked_reason ? ` · blocked: ${t.blocked_reason}` : ''}</p></div>
            {t.priority === 'high' && <Badge tone="bad">High</Badge>}{t.due_date && <span className={`text-sm ${late ? 'font-medium text-bad' : 'text-muted'}`}>{late ? 'Overdue · ' : ''}{fmtDate(t.due_date + 'T00:00:00Z', 'UTC')}</span>}<StatusSelect slug={slug} taskId={t.id} status={t.status} /></li>); })}</ul>)}
    </div>
  );
}
