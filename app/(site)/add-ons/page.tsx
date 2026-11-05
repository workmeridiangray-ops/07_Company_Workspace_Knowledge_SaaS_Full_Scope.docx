import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { ADDONS } from '@/lib/site';
export const metadata: Metadata = { title: 'Add-ons' };
export default function AddOns() {
  return (<div className="mx-auto max-w-4xl px-4 py-10"><PageHeader title="Add-ons and services" subtitle="Optional services sold separately from your subscription." />
    <div className="grid gap-4 sm:grid-cols-2">{ADDONS.map(a => (<div key={a.name} className="card p-5"><h2 className="font-semibold">{a.name}</h2><p className="mt-0.5 text-sm font-medium text-brand">{a.price}</p><p className="mt-2 text-muted">{a.body}</p></div>))}</div>
    <p className="mt-6"><Link href="/contact" className="btn-secondary">Ask about an add-on</Link></p></div>);
}
