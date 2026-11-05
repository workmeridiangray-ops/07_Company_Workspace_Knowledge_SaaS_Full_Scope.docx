import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Empty, Card, Status, fmtDate } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createProjectAction } from '@/lib/work-actions';
import { projectStats } from '@/lib/svc/work';
import { visibleRecords } from '@/lib/svc/data';
import { visibleDatabases } from '@/lib/access';
import { RecordFields } from '@/components/RecordFields';
export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';
export default async function Projects({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const list = all<any>(`SELECT p.*, u.name AS owner_name FROM projects p LEFT JOIN users u ON u.id=p.owner WHERE p.ws=? ORDER BY p.status='active' DESC, p.due_date IS NULL, p.due_date`, c.ws.id);
  const recs = visibleDatabases(c).flatMap(d => { const { props, rows } = visibleRecords(c, d.id); const tp = props.find(p => p.title) || props[0]; return rows.slice(0, 100).map(r => ({ id: r.id, name: `${d.name}: ${r.d[tp.id] ?? 'Untitled'}` })); });
  return (<div><PageHeader title="Projects" subtitle="Plans with owners, milestones and linked work." />
    {list.length === 0 ? <Empty title="No projects yet" icon="flag">Create your first project below and link it to a client record.</Empty> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(p => { const s = projectStats(c.ws.id, p.id); return (<Link key={p.id} href={`/w/${slug}/projects/${p.id}`} className="card block p-4 hover:border-brand"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{p.name}</h2><Status value={p.status} /></div><p className="mt-1 text-sm text-muted">{p.owner_name}{p.due_date ? ` · due ${fmtDate(p.due_date + 'T00:00:00Z', 'UTC')}` : ''}</p><div className="mt-3 h-2 rounded-full bg-bg" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}><div className="h-2 rounded-full bg-brand" style={{ width: `${s.pct}%` }} /></div><p className="mt-1 text-xs text-muted">{s.done} of {s.total} tasks done{s.blocked ? ` · ${s.blocked} blocked` : ''}</p></Link>); })}</div>}
    {c.perms.has('content.create') && <Card title="New project" className="mt-6"><ActionForm action={createProjectAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-3 sm:items-end"><div className="sm:col-span-2"><label className="label" htmlFor="pn">Name</label><input id="pn" name="name" className="input" required /></div><div><label className="label" htmlFor="pr">Linked record (e.g. client)</label><select id="pr" name="record" className="input"><option value="">None</option>{recs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div><label className="label" htmlFor="ps">Start</label><input id="ps" type="date" name="start" className="input" /></div><div><label className="label" htmlFor="pd">Due</label><input id="pd" type="date" name="due" className="input" /></div><div className="sm:col-span-3"><label className="label" htmlFor="pdesc">Description</label><textarea id="pdesc" name="description" rows={2} className="input" /></div><Submit>Create project</Submit></ActionForm></Card>}</div>);
}
