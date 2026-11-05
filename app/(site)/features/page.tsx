import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, PageHeader } from '@/components/ui';
import { FEATURES } from '@/lib/site';
export const metadata: Metadata = { title: 'Features' };
export default function Features() {
  return (<div className="mx-auto max-w-6xl px-4 py-10"><PageHeader title="Features" subtitle="Every capability listed here is in the product today. Items that need separate scoping are called out on the pricing page." />
    <div className="grid gap-4 sm:grid-cols-2">{FEATURES.map(f => (<div key={f.title} className="card p-5"><Icon name={f.icon} className="text-brand" size={22} /><h2 className="mt-3 font-semibold">{f.title}</h2><p className="mt-1 text-muted">{f.body}</p></div>))}</div>
    <div className="mt-8"><Link href="/signup" className="btn-primary">Start free trial</Link></div></div>);
}
