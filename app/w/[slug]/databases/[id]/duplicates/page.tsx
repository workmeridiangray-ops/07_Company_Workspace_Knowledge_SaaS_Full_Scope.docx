import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCtx } from '@/lib/ctx';
import { getDb } from '@/lib/access';
import { findDuplicates, titleProp, dbProps } from '@/lib/svc/data';
import { PageHeader, Empty, Card } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { mergeAction } from '@/lib/data-actions';
export const dynamic = 'force-dynamic';
export default async function Dups({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const g = getDb(c, id, 'view'); if (!g) notFound();
  const groups = findDuplicates(c, id); const tp = titleProp(dbProps(g.db)); const canMerge = g.level === 'edit' && c.perms.has('content.delete');
  return (<div><PageHeader crumbs={[{ href: `/w/${slug}/databases`, label: 'Databases' }, { href: `/w/${slug}/databases/${id}`, label: g.db.name }, { label: 'Duplicate review' }]} title="Duplicate review" subtitle="Records sharing the same title. Merging keeps one record, fills its empty fields from the others, re-points links and tasks, and moves the rest to trash." />
    {groups.length === 0 ? <Empty title="No duplicates found" icon="check" /> : <div className="space-y-4">{groups.map((grp, i) => (<Card key={i} title={String(grp[0].d[tp.id])}><ul className="divide-y divide-line text-sm">{grp.map(r => (<li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link className="link" href={`/w/${slug}/records/${r.id}`}>Open</Link> · created {new Date(r.created_at).toLocaleDateString('en-IN')}</span>{canMerge && <ActionButton action={mergeAction.bind(null, slug, r.id, grp.filter(x => x.id !== r.id).map(x => x.id))} small confirm="Keep this record and merge the others into it?">Keep this one, merge others</ActionButton>}</li>))}</ul></Card>))}</div>}</div>);
}
