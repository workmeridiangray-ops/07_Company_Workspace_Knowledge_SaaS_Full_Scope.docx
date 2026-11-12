import Link from 'next/link';
import { requirePlatform } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Table, Status, Badge, fmtDateTime, Empty, Card } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { ticketAction } from '@/lib/platform-actions';
export const dynamic = 'force-dynamic';
export default async function Support() {
  await requirePlatform('support'); const t = all<any>(`SELECT t.*, w.name AS wname FROM support_tickets t LEFT JOIN workspaces w ON w.id=t.ws ORDER BY t.status IN ('resolved','closed'), t.priority='urgent' DESC, t.created_at DESC LIMIT 100`); const sa = all<any>(`SELECT s.*, w.name AS wname, u.name AS uname FROM support_access s JOIN workspaces w ON w.id=s.ws JOIN users u ON u.id=s.staff_user ORDER BY s.created_at DESC LIMIT 15`);
  return (<div><PageHeader title="Support queue" subtitle="Tickets and website enquiries (demo requests and contact messages have no business attached)." />
    {t.length === 0 ? <Empty title="Inbox zero" icon="check" /> : <ul className="space-y-3">{t.map(x => <li key={x.id} className="card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{x.subject} {x.priority === 'urgent' && <Badge tone="bad">Urgent</Badge>}</p><p className="text-xs text-muted">{x.wname ? <Link className="link" href={`/platform/businesses/${x.ws}`}>{x.wname}</Link> : 'Website enquiry'} · {fmtDateTime(x.created_at)}</p></div><Status value={x.status === 'in_progress' ? 'doing' : x.status} /></div><p className="mt-2 whitespace-pre-wrap text-sm">{x.body}</p><ActionForm action={ticketAction.bind(null, x.id)} className="mt-3 flex gap-2"><label className="sr-only" htmlFor={`ts-${x.id}`}>Status</label><select id={`ts-${x.id}`} name="status" defaultValue={x.status} className="input w-40">{['open', 'in_progress', 'resolved', 'closed'].map(s => <option key={s}>{s}</option>)}</select><Submit variant="secondary" className="btn-sm">Update</Submit></ActionForm></li>)}</ul>}
    <Card title="Support access requests" className="mt-6">{sa.length === 0 ? <p className="text-sm text-muted">None.</p> : <Table head={['Business', 'Staff', 'Reason', 'State']} caption="Access requests">{sa.map(a => <tr key={a.id}><td className="td">{a.wname}</td><td className="td">{a.uname}</td><td className="td">{a.reason}</td><td className="td"><Status value={a.status === 'approved' && new Date(a.expires_at) < new Date() ? 'expired' : a.status} /></td></tr>)}</Table>}</Card></div>);
}
