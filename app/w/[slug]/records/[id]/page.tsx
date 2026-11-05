import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getRecord, pageExists } from '@/lib/access';
import * as D from '@/lib/svc/data';
import { all, one, J } from '@/lib/db';
import { PageHeader, Card, Badge, Alert, Status, fmtDate, ago } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { RecordFields } from '@/components/RecordFields';
import { updateRecordAction, recordLifecycleAction, openRecordPageAction } from '@/lib/data-actions';
import { Comments, SharePanel } from '@/components/Collab';
import { recordRecent } from '@/lib/svc/pages';
import { requestAccessAction } from '@/lib/collab-actions';
export const dynamic = 'force-dynamic';
export default async function RecordPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const g = getRecord(c, id, 'view');
  if (!g) { if (!one('SELECT 1 FROM records WHERE id=? AND ws=?', id, c.ws.id)) notFound(); return (<div className="mx-auto max-w-lg"><PageHeader title="You don’t have access to this record" subtitle="Ask the owner to share it." /><ActionForm action={requestAccessAction.bind(null, slug, 'record', id)} className="card space-y-3 p-5"><label className="label" htmlFor="m">Message (optional)</label><textarea id="m" name="message" rows={3} className="input" /><Submit>Request access</Submit></ActionForm></div>); }
  const { record, db, level } = g; const props = D.dbProps(db); const tp = D.titleProp(props); const data = J<any>(record.data, {});
  const row = { ...record, d: { ...data } }; D.computeValues(c, props, [row]); recordRecent(c, 'record', id);
  const canEdit = level === 'edit' && !['suspended', 'expired', 'closed', 'closing'].includes(c.ws.status) && !record.deleted_at;
  const users = new Map(all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=?`, c.ws.id).map(u => [u.id, u.name]));
  const tasks = all<any>(`SELECT * FROM tasks WHERE ws=? AND record_id=? AND deleted_at IS NULL ORDER BY status='done', due_date`, c.ws.id, id);
  const backlinks = all<any>('SELECT r.id, r.data, r.db_id FROM records r WHERE r.ws=? AND r.deleted_at IS NULL', c.ws.id).filter(r => r.id !== id && Object.values(J<any>(r.data, {})).some(v => Array.isArray(v) && v.includes(id)));
  const notePage = one<any>('SELECT id FROM pages WHERE record_id=? AND ws=?', id, c.ws.id);
  const computed = props.filter(p => D.COMPUTED.includes(p.type));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader crumbs={[{ href: `/w/${slug}/databases`, label: 'Databases' }, { href: `/w/${slug}/databases/${db.id}`, label: db.name }, { label: String(data[tp.id] ?? 'Record') }]} title={String(data[tp.id] ?? 'Untitled')}
        actions={<>{record.archived ? <Badge>Archived</Badge> : null}{record.deleted_at ? <Badge tone="bad">In trash</Badge> : null}<ActionButton action={openRecordPageAction.bind(null, slug, id)} small>{notePage ? 'Open notes page' : 'Add notes page'}</ActionButton></>} />
      {record.deleted_at && <div className="mb-3"><Alert tone="warn" title="This record is in the trash">{c.perms.has('content.delete') && <ActionButton action={recordLifecycleAction.bind(null, slug, id, 'restore')} small>Restore</ActionButton>}</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card title="Properties">
          {canEdit ? (<ActionForm action={updateRecordAction.bind(null, slug, id)} className="space-y-4"><input type="hidden" name="version" value={record.version} /><div className="grid gap-4 sm:grid-cols-2"><RecordFields c={c} props={props} values={data} /></div><Submit>Save changes</Submit><p className="hint">If someone else saves first, you will be asked to reload instead of overwriting their change.</p></ActionForm>) :
            (<dl className="grid gap-3 sm:grid-cols-2">{props.filter(p => !D.COMPUTED.includes(p.type)).map(p => <div key={p.id}><dt className="text-sm text-muted">{p.name}</dt><dd>{D.displayValue(c, p, data[p.id], users) || <span className="text-muted">-</span>}</dd></div>)}</dl>)}
          {computed.length > 0 && <dl className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">{computed.map(p => <div key={p.id}><dt className="text-sm text-muted">{p.name} <Badge>computed</Badge></dt><dd>{D.displayValue(c, p, row.d[p.id], users) || <span className="text-muted">-</span>}</dd></div>)}</dl>}
        </Card>
        <div className="space-y-5">
          <Card title="Tasks">{tasks.length === 0 ? <p className="text-sm text-muted">No tasks linked.</p> : <ul className="divide-y divide-line text-sm">{tasks.map(t => <li key={t.id} className="flex justify-between py-1.5"><Link className="hover:underline" href={`/w/${slug}/tasks?open=${t.id}`}>{t.title}</Link><Status value={t.status} /></li>)}</ul>}<Link className="link mt-2 block text-sm" href={`/w/${slug}/tasks?record=${id}`}>Add a task for this record</Link></Card>
          <Card title="Linked from">{backlinks.length === 0 ? <p className="text-sm text-muted">No other records link here.</p> : <ul className="space-y-1 text-sm">{backlinks.slice(0, 20).map(b => { const rdb = one<any>('SELECT * FROM databases WHERE id=?', b.db_id); const rtp = D.titleProp(D.dbProps(rdb)); const ok = getRecord(c, b.id, 'view'); return <li key={b.id}>{ok ? <Link className="link" href={`/w/${slug}/records/${b.id}`}>{String(J<any>(b.data, {})[rtp.id] ?? 'Untitled')}</Link> : <span className="text-muted">Restricted record</span>} <span className="text-muted">· {rdb.name}</span></li>; })}</ul>}</Card>
          <Card title="Details"><dl className="space-y-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Created</dt><dd>{fmtDate(record.created_at, c.ws.timezone)}</dd></div><div className="flex justify-between"><dt className="text-muted">Updated</dt><dd>{ago(record.updated_at)}</dd></div><div className="flex justify-between"><dt className="text-muted">Version</dt><dd>{record.version}</dd></div></dl>
            {canEdit && <div className="mt-3 flex flex-wrap gap-2"><ActionButton action={recordLifecycleAction.bind(null, slug, id, record.archived ? 'unarchive' : 'archive')} small>{record.archived ? 'Unarchive' : 'Archive'}</ActionButton>{c.perms.has('content.delete') && <ActionButton action={recordLifecycleAction.bind(null, slug, id, 'trash')} small variant="ghost" confirm="Move this record to the trash?">Move to trash</ActionButton>}</div>}</Card>
        </div>
      </div>
      <Comments ctx={c} type="record" rid={id} canComment={level !== 'view'} />
      {level === 'edit' && c.perms.has('content.share') && <details className="card mt-4"><summary className="cursor-pointer px-4 py-3 font-semibold">Share this record</summary><div className="border-t border-line p-4"><SharePanel ctx={c} type="record" rid={id} canShare /></div></details>}
    </div>
  );
}
