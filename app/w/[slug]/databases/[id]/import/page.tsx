import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getDb } from '@/lib/access';
import { dbProps, COMPUTED } from '@/lib/svc/data';
import { PageHeader, Alert } from '@/components/ui';
import { ImportWizard } from '@/components/ImportWizard';
import { all } from '@/lib/db';
import { fmtDateTime } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function ImportPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug, 'integrations.manage'); const g = getDb(c, id, 'edit'); if (!g) notFound();
  const props = dbProps(g.db).filter(p => !COMPUTED.includes(p.type) && !['relation', 'files'].includes(p.type));
  const past = all<any>('SELECT * FROM imports WHERE ws=? AND db_id=? ORDER BY created_at DESC LIMIT 10', c.ws.id, id);
  return (<div><PageHeader crumbs={[{ href: `/w/${slug}/databases`, label: 'Databases' }, { href: `/w/${slug}/databases/${id}`, label: g.db.name }, { label: 'Import' }]} title={`Import into ${g.db.name}`} subtitle="Every row is validated before anything is saved. Dates use YYYY-MM-DD. Select and person columns must match existing options or member emails." />
    <ImportWizard slug={slug} dbId={id} props={props.map(p => ({ id: p.id, name: p.name }))} />
    {past.length > 0 && <section className="mt-8"><h2 className="mb-2 font-semibold">Previous imports</h2><ul className="card divide-y divide-line text-sm">{past.map(i => <li key={i.id} className="flex justify-between p-3"><span>{i.filename}</span><span className="text-muted">{i.ok} of {i.total} rows · {fmtDateTime(i.created_at)}</span></li>)}</ul></section>}</div>);
}
