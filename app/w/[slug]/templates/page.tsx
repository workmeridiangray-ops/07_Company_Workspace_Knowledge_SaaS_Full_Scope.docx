import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Card, Empty, Badge, ago, Icon } from '@/components/ui';
export const metadata: Metadata = { title: 'Templates' };
export const dynamic = 'force-dynamic';
export default async function Templates({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const list = all<any>(`SELECT t.*, (SELECT COUNT(*) FROM template_uses u WHERE u.template_id=t.id) AS uses, (SELECT COUNT(*) FROM template_uses u WHERE u.template_id=t.id AND u.template_version<t.version AND u.resource_type='page') AS outdated FROM templates t WHERE t.ws=? ORDER BY t.kind, t.name`, c.ws.id);
  return (<div><PageHeader title="Template gallery" subtitle="Templates create new pages, databases and meetings. Editing a template never changes copies that already exist." actions={c.perms.has('schema.manage') && <Link className="btn-primary btn-sm" href={`/w/${slug}/templates/new`}><Icon name="plus" size={16} /> New template</Link>} />
    {list.length === 0 ? <Empty title="No templates yet" icon="grid">Create a template from a page layout you reuse.</Empty> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(t => <Link key={t.id} href={`/w/${slug}/templates/${t.id}`} className="card block p-4 hover:border-brand"><div className="flex justify-between"><Badge tone="brand">{t.kind}</Badge><span className="text-xs text-muted">v{t.version}</span></div><h2 className="mt-2 font-semibold">{t.name}</h2><p className="text-sm text-muted">{t.description || 'No description'}</p><p className="mt-2 text-xs text-muted">Used {t.uses}× · updated {ago(t.updated_at)}{t.outdated ? ` · ${t.outdated} copies behind` : ''}</p></Link>)}</div>}</div>);
}
