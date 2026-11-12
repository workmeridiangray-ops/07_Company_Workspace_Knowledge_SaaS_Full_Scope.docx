import Link from 'next/link';
import { requirePlatform } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { PageHeader, Stat, Card, Table, Status, fmtDateTime } from '@/components/ui';
import { inr } from '@/lib/billing';
export default async function Overview() {
  await requirePlatform('overview'); const q = (sql: string) => one<any>(sql)!.n;
  const mrr = all<any>(`SELECT s.interval, p.price_month, p.price_year FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.status='active'`).reduce((a, s) => a + (s.interval === 'year' ? s.price_year / 12 : s.price_month), 0);
  const inc = all<any>(`SELECT * FROM incidents WHERE status!='resolved' ORDER BY created_at DESC`); const recent = all<any>('SELECT w.*, (SELECT COUNT(*) FROM memberships m WHERE m.ws=w.id) AS members FROM workspaces w ORDER BY created_at DESC LIMIT 6');
  return (<div><PageHeader title="Platform overview" />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Businesses" value={q('SELECT COUNT(*) n FROM workspaces')} hint={`${q(`SELECT COUNT(*) n FROM workspaces WHERE status='trial'`)} on trial`} href="/platform/businesses" /><Stat label="Paying (active)" value={q(`SELECT COUNT(*) n FROM subscriptions WHERE status='active'`)} /><Stat label="Monthly recurring revenue" value={inr(mrr)} hint="Excl. GST" /><Stat label="Past due" value={q(`SELECT COUNT(*) n FROM workspaces WHERE status='past_due'`)} href="/platform/billing" /></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat label="Failed jobs" value={q(`SELECT COUNT(*) n FROM jobs WHERE status='failed'`)} href="/platform/ops" /><Stat label="Open tickets" value={q(`SELECT COUNT(*) n FROM support_tickets WHERE status IN ('open','in_progress')`)} href="/platform/support" /><Stat label="Unsent emails" value={q(`SELECT COUNT(*) n FROM outbox WHERE status!='sent'`)} href="/platform/ops" /></div>
    {inc.length > 0 && <Card title="Open incidents" className="mb-5"><ul className="text-sm">{inc.map(i => <li key={i.id} className="flex items-center justify-between py-1"><span>{i.title}</span><Status value={i.status} /></li>)}</ul></Card>}
    <Card title="Newest businesses"><Table head={['Business', 'Status', 'Members', 'Created']} caption="Newest businesses">{recent.map(w => <tr key={w.id}><td className="td"><Link className="link" href={`/platform/businesses/${w.id}`}>{w.name}</Link></td><td className="td"><Status value={w.status} /></td><td className="td">{w.members}</td><td className="td">{fmtDateTime(w.created_at)}</td></tr>)}</Table></Card></div>);
}
