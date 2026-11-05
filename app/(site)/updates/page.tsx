import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { UPDATES } from '@/lib/site';
export const metadata: Metadata = { title: 'Product updates' };
export default function Updates() {
  return (<div className="mx-auto max-w-2xl px-4 py-10"><PageHeader title="Product updates" /><ol className="space-y-5">{UPDATES.map(u => (<li key={u.title} className="card p-5"><time className="text-sm text-muted" dateTime={u.date}>{new Date(u.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</time><h2 className="mt-1 font-semibold">{u.title}</h2><p className="mt-1 text-muted">{u.body}</p></li>))}</ol></div>);
}
