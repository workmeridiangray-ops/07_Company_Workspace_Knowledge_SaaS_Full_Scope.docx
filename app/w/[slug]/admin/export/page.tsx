import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Card, Alert, Table, fmtDateTime } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { requestClosureAction, cancelClosureAction } from '@/lib/admin-actions';
export const metadata: Metadata = { title: 'Export and closure' };
export const dynamic = 'force-dynamic';
export default async function ExportPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'content.export'); const past = all<any>('SELECT e.*, u.name FROM exports e LEFT JOIN users u ON u.id=e.by_user WHERE e.ws=? ORDER BY e.created_at DESC LIMIT 10', c.ws.id);
  const ws = all<any>('SELECT closed_at FROM workspaces WHERE id=?', c.ws.id)[0];
  return (<div className="mx-auto max-w-3xl"><PageHeader title="Export and closure" />
    <Card title="Export your data"><p className="text-sm">A ZIP with <code>manifest.json</code>, pages as Markdown (<code>pages/</code>), SOPs (<code>sops/</code>), each database as CSV (<code>databases/</code>), <code>tasks.csv</code> and original attachments (<code>attachments/</code>). It contains only content you can access.</p><p className="mt-3"><a className="btn-primary" href={`/api/w/${slug}/export/all`}>Download workspace export</a></p></Card>
    {past.length > 0 && <div className="mt-5"><h2 className="mb-2 font-semibold">Previous exports</h2><Table head={['When', 'By', 'Size']} caption="Exports">{past.map(e => <tr key={e.id}><td className="td">{fmtDateTime(e.created_at, c.ws.timezone)}</td><td className="td">{e.name}</td><td className="td">{Math.ceil((e.size || 0) / 1024)} KB</td></tr>)}</Table></div>}
    <Card title="Data retention" className="mt-5"><ul className="list-disc space-y-1 pl-5 text-sm"><li>Deleted pages stay in Trash for 30 days, then are removed permanently.</li><li>Page versions are kept for your plan’s history window (always at least the latest 5).</li><li>After closure we keep your data for 30 days so you can export or reopen. Then content is deleted; invoices and critical audit events are retained for legal traceability.</li><li>Backups containing deleted data expire within 35 days.</li></ul></Card>
    {c.perms.has('workspace.configure') && (c.ws.status === 'closing' ? <Card title="Closure scheduled" className="mt-5"><Alert tone="warn">This workspace will be permanently deleted after {fmtDateTime(ws.closed_at, c.ws.timezone)}.</Alert><div className="mt-3"><ActionButton action={cancelClosureAction.bind(null, slug)} variant="primary">Reopen workspace</ActionButton></div></Card> :
      <Card title="Close this workspace" className="mt-5"><ActionForm action={requestClosureAction.bind(null, slug)} className="space-y-3"><p className="text-sm">Closing cancels your subscription at the end of the paid period and schedules deletion after 30 days. Export first.</p><div><label className="label" htmlFor="cr">Why are you closing?</label><input id="cr" name="reason" className="input" required /></div><div><label className="label" htmlFor="cc">Type “{c.ws.name}” to confirm</label><input id="cc" name="confirm" className="input" required autoComplete="off" /></div><Submit variant="danger" confirm="Schedule closure of this workspace?">Schedule closure</Submit></ActionForm></Card>)}</div>);
}
