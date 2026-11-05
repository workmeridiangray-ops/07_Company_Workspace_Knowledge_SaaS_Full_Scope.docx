import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { visiblePages } from '@/lib/access';
import { pagesTree } from '@/lib/svc/pages';
import { all } from '@/lib/db';
import { PageHeader, Empty, Icon, Badge, ago, Card } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createPageAction } from '@/lib/page-actions';
export const metadata: Metadata = { title: 'Pages' };
export default async function Pages({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ts?: string; show?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug);
  const tsList = all<any>('SELECT * FROM teamspaces WHERE ws=? AND archived=0 ORDER BY name', c.ws.id);
  let rows = visiblePages(c, `AND kind IN ('page','meeting') AND record_id IS NULL`); if (sp.ts) rows = rows.filter(r => r.teamspace_id === sp.ts);
  if (sp.show !== 'archived') rows = rows.filter(r => !r.archived);
  const tree = pagesTree(c, rows); const canCreate = c.perms.has('content.create');
  return (
    <div>
      <PageHeader title="Pages" subtitle="Everything you can access, organised by hierarchy." actions={<Link href={`/w/${slug}/trash`} className="btn-secondary btn-sm"><Icon name="trash" size={16} /> Trash</Link>} />
      <div className="mb-4 flex flex-wrap gap-2"><Link href={`/w/${slug}/pages`} className={`btn-sm ${!sp.ts ? 'btn-primary' : 'btn-secondary'}`}>All</Link>{tsList.map(t => <Link key={t.id} href={`/w/${slug}/pages?ts=${t.id}`} className={`btn-sm ${sp.ts === t.id ? 'btn-primary' : 'btn-secondary'}`}>{t.name}</Link>)}</div>
      {canCreate && (<Card title="New page" className="mb-5"><ActionForm action={createPageAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
        <div><label className="label" htmlFor="np-title">Title</label><input id="np-title" name="title" className="input" placeholder="e.g. Q1 client onboarding plan" /></div>
        <div><label className="label" htmlFor="np-ts">Teamspace</label><select id="np-ts" name="teamspace" className="input" defaultValue={sp.ts || ''}><option value="">None (workspace root)</option>{tsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="draft" className="h-4 w-4" /> Personal draft</label><Submit>Create page</Submit></ActionForm></Card>)}
      {tree.length === 0 ? <Empty title="No pages yet" icon="page">{canCreate ? 'Create your first page above, or start from a template.' : 'Nothing has been shared with you yet.'}</Empty> : (
        <ul className="card divide-y divide-line">{tree.map(p => (<li key={p.id}><Link href={`/w/${slug}/pages/${p.id}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-bg" style={{ paddingLeft: 12 + p.depth * 20 }}><Icon name={p.kind === 'meeting' ? 'cal' : 'page'} className="text-muted" /><span className="truncate font-medium">{p.title}</span>{p.is_draft ? <Badge>Personal draft</Badge> : p.visibility === 'private' ? <Badge><Icon name="lock" size={12} className="mr-1" />Private</Badge> : null}<span className="ml-auto whitespace-nowrap text-xs text-muted">{ago(p.updated_at)}</span></Link></li>))}</ul>)}
    </div>
  );
}
