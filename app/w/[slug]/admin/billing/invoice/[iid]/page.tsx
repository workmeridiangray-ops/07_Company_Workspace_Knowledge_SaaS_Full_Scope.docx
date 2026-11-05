import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { one, J } from '@/lib/db';
import { PageHeader, Status, fmtDate } from '@/components/ui';
import { inr } from '@/lib/billing';
export const dynamic = 'force-dynamic';
export default async function Invoice({ params }: { params: Promise<{ slug: string; iid: string }> }) {
  const { slug, iid } = await params; const c = await requireCtx(slug, 'billing.manage'); const i = one<any>('SELECT * FROM invoices WHERE id=? AND ws=?', iid, c.ws.id); if (!i) notFound(); const b = J<any>(c.ws.billing, {});
  return (<div className="mx-auto max-w-2xl"><PageHeader crumbs={[{ href: `/w/${slug}/admin/billing`, label: 'Billing' }, { label: i.number }]} title={`Tax invoice ${i.number}`} subtitle="Use your browser’s Print or Save as PDF to keep a copy." />
    <div className="card space-y-4 p-6 text-sm"><div className="flex justify-between"><div><p className="font-semibold">Fieldnote</p><p className="text-muted">Issued {fmtDate(i.issued_at, c.ws.timezone)}</p></div><Status value={i.status} /></div><div><p className="text-muted">Billed to</p><p className="font-medium">{b.legalName || c.ws.name}</p>{b.gstin && <p>GSTIN {b.gstin}</p>}{b.address && <p className="whitespace-pre-line">{b.address}</p>}</div>
      <table className="w-full"><thead><tr className="border-b border-line text-left"><th className="py-1">Description</th><th className="py-1 text-right">Amount</th></tr></thead><tbody><tr><td className="py-2">{i.description}</td><td className="py-2 text-right tabular-nums">{inr(i.amount)}</td></tr><tr><td className="py-1 text-muted">GST 18%</td><td className="py-1 text-right tabular-nums">{inr(i.tax)}</td></tr><tr className="border-t border-line font-semibold"><td className="py-2">Total (INR)</td><td className="py-2 text-right tabular-nums">{inr(i.amount + i.tax)}</td></tr></tbody></table><p className="text-xs text-muted">Plan {i.plan_code} v{i.plan_version} · Payment reference {i.reference}</p></div></div>);
}
