import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Empty, Badge, Icon } from '@/components/ui';
export const metadata: Metadata = { title: 'Forms' };
export const dynamic = 'force-dynamic';
export default async function Forms({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const list = all<any>(`SELECT f.*, d.name AS dbname, (SELECT COUNT(*) FROM form_submissions s WHERE s.form_id=f.id) AS subs FROM forms f JOIN databases d ON d.id=f.db_id WHERE f.ws=? ORDER BY f.created_at DESC`, c.ws.id);
  return (<div><PageHeader title="Forms" subtitle="Collect submissions straight into a database. Public forms only allow safe field types and ignore duplicate submissions." actions={c.perms.has('automation.manage') && <Link className="btn-primary btn-sm" href={`/w/${slug}/forms/new`}><Icon name="plus" size={16} /> New form</Link>} />
    {list.length === 0 ? <Empty title="No forms yet" icon="form">Build a client intake form that writes to your Clients database.</Empty> : <div className="grid gap-3 sm:grid-cols-2">{list.map(f => <Link key={f.id} href={`/w/${slug}/forms/${f.id}`} className="card block p-4 hover:border-brand"><div className="flex justify-between"><h2 className="font-semibold">{f.name}</h2><span className="flex gap-1">{f.is_public ? <Badge tone="warn">Public</Badge> : <Badge>Internal</Badge>}{!f.active && <Badge tone="bad">Off</Badge>}</span></div><p className="text-sm text-muted">Writes to {f.dbname} · {f.subs} submissions</p></Link>)}</div>}</div>);
}
