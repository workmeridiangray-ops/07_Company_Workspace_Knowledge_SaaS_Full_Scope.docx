import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { HELP } from '@/lib/site';
export default async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const a = HELP.find(h => h.slug === slug); if (!a) notFound();
  return (<div className="mx-auto max-w-2xl px-4 py-10"><PageHeader crumbs={[{ href: '/help', label: 'Help' }, { label: a.cat }]} title={a.title} /><div className="space-y-4 text-[16px] leading-7">{a.body.map((p, i) => <p key={i}>{p}</p>)}</div></div>);
}
