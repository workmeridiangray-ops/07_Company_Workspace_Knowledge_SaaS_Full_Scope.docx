import type { Metadata } from 'next';
import Link from 'next/link';
import { all } from '@/lib/db';
import { J } from '@/lib/db';
import { inr } from '@/lib/billing';
import { Icon, PageHeader, Table } from '@/components/ui';
export const metadata: Metadata = { title: 'Pricing' };
export const dynamic = 'force-dynamic';
export default function Pricing() {
  const plans = all<any>('SELECT * FROM plans WHERE active=1 ORDER BY price_month');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="Simple pricing in INR" subtitle="Per workspace, billed monthly or yearly (two months free). 18% GST is added at checkout. Every plan starts with a 14-day trial on Team limits." />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map(p => (
          <div key={p.id} className={`card p-5 ${p.code === 'team' ? 'border-brand ring-1 ring-brand' : ''}`}>
            <h2 className="text-lg font-semibold">{p.name}</h2>{p.code === 'team' && <p className="text-xs font-medium text-brand">Most popular</p>}
            <p className="mt-2 text-3xl font-semibold">{inr(p.price_month)}<span className="text-base font-normal text-muted"> / month</span></p>
            <p className="text-sm text-muted">or {inr(p.price_year)} / year</p>
            <ul className="mt-4 space-y-2 text-sm">{J<string[]>(p.features, []).map(f => <li key={f} className="flex gap-2"><Icon name="check" className="mt-0.5 text-ok" size={16} />{f}</li>)}</ul>
            <Link href={`/signup?plan=${p.code}`} className="btn-primary mt-5 w-full">Start free trial</Link>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">*Fair-use applies to databases on Business. Add-ons: <Link href="/add-ons" className="link">assisted setup, training and extra members</Link>.</p>
      <h2 className="mb-3 mt-10 text-xl font-semibold">Compare plans</h2>
      <Table caption="Plan comparison" head={['Limit', ...plans.map(p => p.name)]}>
        {[['Members', 'members'], ['Guests', 'guests'], ['Storage (GB)', 'storage_mb'], ['Databases', 'databases'], ['Version history (days)', 'history_days']].map(([label, k]) => (
          <tr key={k}><th scope="row" className="td font-medium">{label}</th>{plans.map(p => { const v = J<any>(p.limits, {})[k]; return <td key={p.id} className="td">{k === 'storage_mb' ? v / 1024 : v}</td>; })}</tr>
        ))}
      </Table>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="card p-5"><h2 className="font-semibold">Included at launch</h2><p className="mt-1 text-sm text-muted">English responsive web app, INR subscription billing, one payment provider, transactional email, CSV import/export, documented API and webhook foundations.</p></div>
        <div className="card p-5"><h2 className="font-semibold">Scoped separately</h2><p className="mt-1 text-sm text-muted">Native mobile apps, offline editing, live multi-cursor editing, AI assistants, OCR, enterprise SSO, and bespoke connectors.</p></div>
      </div>
    </div>
  );
}
