import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Table, Empty, fmtDateTime } from '@/components/ui';
export const metadata: Metadata = { title: 'Audit trail' };
export const dynamic = 'force-dynamic';
export default async function Audit({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug, 'audit.view'); const pg = Math.max(1, Number(sp.page) || 1); const q = (sp.q || '').trim();
  const rows = all<any>(`SELECT * FROM audit_log WHERE ws=? ${q ? "AND (action LIKE ? OR actor_label LIKE ? OR entity LIKE ?)" : ''} ORDER BY created_at DESC LIMIT 51 OFFSET ?`, c.ws.id, ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []), (pg - 1) * 50);
  return (<div><PageHeader title="Audit trail" subtitle="Append-only. Records who did what and when, never the content of documents." />
    <form role="search" className="mb-4 flex gap-2"><label className="sr-only" htmlFor="aq">Filter</label><input id="aq" name="q" defaultValue={q} className="input" placeholder="Filter by action, person or item type (e.g. role, export, share)" /><button className="btn-secondary">Filter</button></form>
    {rows.length === 0 ? <Empty title="No events" icon="eye" /> : <Table head={['When', 'Who', 'Action', 'Item', 'Details']} caption="Audit events">{rows.slice(0, 50).map(r => <tr key={r.id}><td className="td whitespace-nowrap">{fmtDateTime(r.created_at, c.ws.timezone)}</td><td className="td">{r.actor_label}</td><td className="td"><code className="text-xs">{r.action}</code></td><td className="td text-xs text-muted">{r.entity}</td><td className="td max-w-xs truncate text-xs text-muted" title={r.detail}>{r.detail === '{}' ? '' : r.detail}</td></tr>)}</Table>}
    <div className="mt-3 flex justify-between text-sm">{pg > 1 ? <Link className="link" href={`?page=${pg - 1}&q=${q}`}>← Newer</Link> : <span />}{rows.length > 50 && <Link className="link" href={`?page=${pg + 1}&q=${q}`}>Older →</Link>}</div></div>);
}
