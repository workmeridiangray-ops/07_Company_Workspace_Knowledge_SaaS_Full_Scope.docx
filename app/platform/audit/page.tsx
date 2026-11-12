import { requirePlatform } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Table, fmtDateTime } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function PAudit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePlatform('audit'); const q = ((await searchParams).q || '').trim(); const rows = all<any>(`SELECT a.*, w.name AS wname FROM audit_log a LEFT JOIN workspaces w ON w.id=a.ws WHERE (?='' OR a.action LIKE ? OR a.actor_label LIKE ? OR w.name LIKE ?) ORDER BY a.created_at DESC LIMIT 200`, q, `%${q}%`, `%${q}%`, `%${q}%`);
  return (<div><PageHeader title="Platform audit log" subtitle="Append-only across all businesses. Charges and critical events stay traceable even after a business is closed." /><form role="search" className="mb-4 flex gap-2"><label className="sr-only" htmlFor="pq">Filter</label><input id="pq" name="q" defaultValue={q} className="input" placeholder="Filter by action, person or business" /><button className="btn-secondary">Filter</button></form>
    <Table head={['When', 'Business', 'Who', 'Action', 'Details']} caption="Audit">{rows.map(r => <tr key={r.id}><td className="td whitespace-nowrap">{fmtDateTime(r.created_at)}</td><td className="td">{r.wname || '-'}</td><td className="td">{r.actor_label}</td><td className="td"><code className="text-xs">{r.action}</code></td><td className="td max-w-xs truncate text-xs text-muted" title={r.detail}>{r.detail === '{}' ? '' : r.detail}</td></tr>)}</Table></div>);
}
