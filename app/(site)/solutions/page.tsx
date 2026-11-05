import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { SOLUTIONS } from '@/lib/site';
export const metadata: Metadata = { title: 'Solutions' };
export default function Solutions() {
  return (<div className="mx-auto max-w-6xl px-4 py-10"><PageHeader title="Solutions by industry" subtitle="Start from a template that matches your team." />
    <div className="grid gap-4 sm:grid-cols-2">{SOLUTIONS.map(s => (<Link key={s.slug} href={`/solutions/${s.slug}`} className="card block p-5 hover:border-brand"><h2 className="font-semibold">{s.name}</h2><p className="mt-1 text-muted">{s.pitch}</p></Link>))}</div></div>);
}
