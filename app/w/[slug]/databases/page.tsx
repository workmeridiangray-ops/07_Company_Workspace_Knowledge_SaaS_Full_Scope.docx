import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { visibleDatabases } from '@/lib/access';
import { all, one } from '@/lib/db';
import { PageHeader, Empty, Icon, Card, Badge } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createDatabaseAction } from '@/lib/data-actions';
import { usage, currentPlan } from '@/lib/billing';
export const metadata: Metadata = { title: 'Databases' };
export const dynamic = 'force-dynamic';
export default async function Databases({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const dbs = visibleDatabases(c);
  const counts = new Map(all<any>('SELECT db_id, COUNT(*) n FROM records WHERE ws=? AND deleted_at IS NULL GROUP BY db_id', c.ws.id).map(r => [r.db_id, r.n]));
  const ts = all<any>('SELECT id,name FROM teamspaces WHERE ws=? AND archived=0', c.ws.id); const archived = all<any>('SELECT * FROM databases WHERE ws=? AND archived=1', c.ws.id);
  const u = usage(c.ws.id); const lim = currentPlan(c.ws.id)?.limits;
  return (
    <div><PageHeader title="Databases" subtitle={`Structured records with relations and views. ${u.databases}${lim ? ` of ${lim.databases}` : ''} databases used.`} />
      {dbs.length === 0 ? <Empty title="No databases yet" icon="db">{c.perms.has('schema.manage') ? 'Create a client list or tracker below to start linking your work.' : 'Nothing has been shared with you yet.'}</Empty> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{dbs.map(d => (<Link key={d.id} href={`/w/${slug}/databases/${d.id}`} className="card block p-4 hover:border-brand"><Icon name="db" className="text-brand" /><h2 className="mt-2 font-semibold">{d.name}</h2><p className="text-sm text-muted">{counts.get(d.id) || 0} records · {JSON.parse(d.props).length} properties</p></Link>))}</div>}
      {c.perms.has('schema.manage') && (<Card title="New database" className="mt-6"><ActionForm action={createDatabaseAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2"><label className="label" htmlFor="dn">Name</label><input id="dn" name="name" className="input" required placeholder="e.g. Clients" /></div>
        <div><label className="label" htmlFor="dt">Start from</label><select id="dt" name="template" className="input"><option value="clients">Clients</option><option value="tracker">Tracker (status, owner, due)</option><option value="blank">Blank</option></select></div>
        <div><label className="label" htmlFor="dts">Teamspace</label><select id="dts" name="teamspace" className="input"><option value="">None</option>{ts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <Submit>Create database</Submit></ActionForm></Card>)}
      {archived.length > 0 && <p className="mt-4 text-sm text-muted">{archived.length} archived: {archived.map(a => a.name).join(', ')}</p>}
    </div>
  );
}
