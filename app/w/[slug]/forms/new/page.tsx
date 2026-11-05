import { requireCtx } from '@/lib/ctx';
import { visibleDatabases } from '@/lib/access';
import { PageHeader, Empty } from '@/components/ui';
import { FormBuilder } from '@/components/FormBuilder';
export default async function NewForm({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'automation.manage'); const dbs = visibleDatabases(c);
  return (<div className="mx-auto max-w-3xl"><PageHeader crumbs={[{ href: `/w/${slug}/forms`, label: 'Forms' }, { label: 'New' }]} title="New form" />{dbs.length === 0 ? <Empty title="Create a database first" icon="db" /> : <FormBuilder slug={slug} dbs={dbs} />}</div>);
}
