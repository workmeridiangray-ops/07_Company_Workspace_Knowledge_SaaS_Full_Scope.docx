import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { PageHeader, Card, Stat, Empty, Alert, ago } from '@/components/ui';
import { usage, currentPlan } from '@/lib/billing';
import { usageReport } from '@/lib/svc/lifecycle';
export const metadata: Metadata = { title: 'Usage and content' };
export const dynamic = 'force-dynamic';
export default async function Usage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'audit.view'); const u = usage(c.ws.id); const cp = currentPlan(c.ws.id); const r = usageReport(c); const L = cp?.limits;
  const bar = (v: number, max?: number) => <div className="mt-2 h-2 rounded-full bg-bg" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max || 100} aria-label="Usage"><div className={`h-2 rounded-full ${max && v / max > 0.9 ? 'bg-bad' : 'bg-brand'}`} style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;
  return (<div><PageHeader title="Usage and content health" subtitle="Plan consumption and housekeeping. These figures describe product use and content - they are not a measure of anyone’s productivity." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="card p-4"><p className="text-sm text-muted">Members</p><p className="text-2xl font-semibold">{u.members}{L && <span className="text-base font-normal text-muted"> / {L.members}</span>}</p>{bar(u.members, L?.members)}</div><div className="card p-4"><p className="text-sm text-muted">Guests</p><p className="text-2xl font-semibold">{u.guests}{L && <span className="text-base font-normal text-muted"> / {L.guests}</span>}</p>{bar(u.guests, L?.guests)}</div><div className="card p-4"><p className="text-sm text-muted">Storage</p><p className="text-2xl font-semibold">{u.storage_mb} MB</p>{bar(u.storage_mb, L?.storage_mb)}</div><div className="card p-4"><p className="text-sm text-muted">Databases</p><p className="text-2xl font-semibold">{u.databases}{L && <span className="text-base font-normal text-muted"> / {L.databases}</span>}</p>{bar(u.databases, L?.databases)}</div></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat label="Pages" value={u.pages} /><Stat label="Records" value={u.records} /><Stat label="People signed in, last 30 days" value={r.active} /></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`Pages without an active owner (${r.noOwner.length})`}>{r.noOwner.length === 0 ? <p className="text-sm text-muted">Every page has an active owner.</p> : <ul className="divide-y divide-line text-sm">{r.noOwner.map(p => <li key={p.id}><Link className="block py-1.5 hover:underline" href={`/w/${slug}/pages/${p.id}`}>{p.title}</Link></li>)}</ul>}</Card>
      <Card title={`SOPs due for review (${r.reviewDue.length})`}>{r.reviewDue.length === 0 ? <p className="text-sm text-muted">No SOPs are overdue.</p> : <ul className="divide-y divide-line text-sm">{r.reviewDue.map(s => <li key={s.id}><Link className="block py-1.5 hover:underline" href={`/w/${slug}/knowledge/${s.id}`}>{s.title}</Link></li>)}</ul>}</Card>
      <Card title={`Stale pages - not edited in 90 days (${r.stale.length})`}>{r.stale.length === 0 ? <p className="text-sm text-muted">Nothing stale.</p> : <ul className="divide-y divide-line text-sm">{r.stale.map(p => <li key={p.id} className="flex justify-between py-1.5"><Link className="hover:underline" href={`/w/${slug}/pages/${p.id}`}>{p.title}</Link><span className="text-muted">{ago(p.updated_at)}</span></li>)}</ul>}</Card>
      <Card title="Template usage">{r.templates.length === 0 ? <p className="text-sm text-muted">No templates yet.</p> : <ul className="divide-y divide-line text-sm">{r.templates.map(t => <li key={t.name} className="flex justify-between py-1.5">{t.name}<span className="text-muted">{t.uses} uses</span></li>)}</ul>}</Card></div></div>);
}
