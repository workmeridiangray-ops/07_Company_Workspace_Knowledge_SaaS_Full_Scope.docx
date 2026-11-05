import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Icon } from '@/components/ui';
import { SOLUTIONS } from '@/lib/site';
export default async function Solution({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const s = SOLUTIONS.find(x => x.slug === slug); if (!s) notFound();
  return (<div className="mx-auto max-w-3xl px-4 py-10"><PageHeader crumbs={[{ href: '/solutions', label: 'Solutions' }, { label: s.name }]} title={`Fieldnote for ${s.name.toLowerCase()}`} subtitle={s.pitch} />
    <ul className="card divide-y divide-line">{s.points.map(p => <li key={p} className="flex gap-3 p-4"><Icon name="check" className="mt-0.5 text-ok" />{p}</li>)}</ul>
    <div className="mt-6 flex gap-3"><Link href="/signup" className="btn-primary">Start free trial</Link><Link href="/demo" className="btn-secondary">Book a demo</Link></div></div>);
}
export function generateStaticParams() { return SOLUTIONS.map(s => ({ slug: s.slug })); }
