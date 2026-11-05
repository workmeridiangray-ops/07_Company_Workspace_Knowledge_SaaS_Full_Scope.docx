import { notFound } from 'next/navigation';
import { PageHeader, Alert } from '@/components/ui';
import { LEGAL } from '@/lib/site';
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const l = LEGAL[(await params).slug]; if (!l) notFound();
  return (<div className="mx-auto max-w-2xl px-4 py-10"><PageHeader title={l.title} subtitle="Last updated 1 November 2026" />
    <div className="mb-6"><Alert tone="warn" title="Draft for legal review">This text is a working draft. Have counsel approve it before you take payments.</Alert></div>
    <div className="space-y-5">{l.sections.map(([h, b]) => <section key={h}><h2 className="text-lg font-semibold">{h}</h2><p className="mt-1 leading-7">{b}</p></section>)}</div></div>);
}
export function generateStaticParams() { return Object.keys(LEGAL).map(slug => ({ slug })); }
