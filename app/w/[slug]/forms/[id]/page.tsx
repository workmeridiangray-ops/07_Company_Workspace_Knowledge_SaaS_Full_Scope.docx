import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { visibleDatabases } from '@/lib/access';
import { PageHeader, Card, Table, Badge, fmtDateTime, Alert } from '@/components/ui';
import { FormBuilder } from '@/components/FormBuilder';
import { dbProps } from '@/lib/svc/data';
export const dynamic = 'force-dynamic';
export default async function FormPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const f = one<any>('SELECT * FROM forms WHERE id=? AND ws=?', id, c.ws.id); if (!f) notFound();
  const dbs = visibleDatabases(c); const db = dbs.find(d => d.id === f.db_id); const subs = all<any>('SELECT * FROM form_submissions WHERE form_id=? AND ws=? ORDER BY created_at DESC LIMIT 25', id, c.ws.id); const url = `/f/${f.token}`;
  return (<div className="mx-auto max-w-4xl"><PageHeader crumbs={[{ href: `/w/${slug}/forms`, label: 'Forms' }, { label: f.name }]} title={f.name} actions={<>{f.is_public ? <Badge tone="warn">Public</Badge> : <Badge>Internal</Badge>}<Link className="btn-secondary btn-sm" href={url} target="_blank">Open form</Link></>} />
    <Alert tone="brand" title="Share link">{f.is_public ? 'Anyone with this link can submit:' : 'Workspace members can submit:'} <code className="break-all">{url}</code></Alert>
    <Card title="Recent submissions" className="mt-5">{subs.length === 0 ? <p className="text-sm text-muted">No submissions yet.</p> : <Table head={['When', 'Record']} caption="Submissions">{subs.map(s => <tr key={s.id}><td className="td">{fmtDateTime(s.created_at, c.ws.timezone)}</td><td className="td"><Link className="link" href={`/w/${slug}/records/${s.record_id}`}>Open record</Link></td></tr>)}</Table>}</Card>
    {c.perms.has('automation.manage') && db && <Card title="Edit form" className="mt-5"><FormBuilder slug={slug} dbs={dbs} form={f} /></Card>}</div>);
}
