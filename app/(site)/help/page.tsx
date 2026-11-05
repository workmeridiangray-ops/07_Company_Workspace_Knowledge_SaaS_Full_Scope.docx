import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Empty } from '@/components/ui';
import { HELP } from '@/lib/site';
export const metadata: Metadata = { title: 'Help centre' };
export default async function Help({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q || '').trim().toLowerCase();
  const list = q ? HELP.filter(h => (h.title + h.body.join(' ')).toLowerCase().includes(q)) : HELP;
  const cats = [...new Set(list.map(h => h.cat))];
  return (<div className="mx-auto max-w-3xl px-4 py-10"><PageHeader title="Help centre" />
    <form role="search" className="mb-6 flex gap-2"><label className="sr-only" htmlFor="q">Search help</label><input id="q" name="q" defaultValue={q} className="input" placeholder="Search help articles" /><button className="btn-primary">Search</button></form>
    {list.length === 0 ? <Empty title="No articles match" icon="search">Try a different word, or <Link href="/contact" className="link">contact us</Link>.</Empty> :
      cats.map(c => (<section key={c} className="mb-6"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{c}</h2><ul className="card divide-y divide-line">{list.filter(h => h.cat === c).map(h => <li key={h.slug}><Link href={`/help/${h.slug}`} className="block px-4 py-3 hover:bg-bg">{h.title}</Link></li>)}</ul></section>))}</div>);
}
