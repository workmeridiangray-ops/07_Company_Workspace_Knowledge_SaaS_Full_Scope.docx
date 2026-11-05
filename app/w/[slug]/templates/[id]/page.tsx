import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { PageHeader, Card, Badge, Alert, Table, ago } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { TemplateForm } from '@/components/TemplateForm';
import { useTemplateAction, applyUpdateAction, dismissUpdateAction } from '@/lib/meet-actions';
import { outdatedCopies } from '@/lib/svc/meet';
import { diffBlocks } from '@/lib/svc/pages';
import { BlocksView } from '@/components/BlocksView';
export const dynamic = 'force-dynamic';
export default async function Template({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const t = one<any>('SELECT * FROM templates WHERE id=? AND ws=?', id, c.ws.id); if (!t) notFound(); const p = J<any>(t.payload, {});
  const ts = all<any>('SELECT id,name FROM teamspaces WHERE ws=? AND archived=0', c.ws.id); const outdated = outdatedCopies(c, id); const canEdit = c.perms.has('schema.manage');
  const prevVers = all<any>('SELECT version, created_at FROM template_versions WHERE template_id=? ORDER BY version DESC', id);
  return (<div className="mx-auto max-w-4xl"><PageHeader crumbs={[{ href: `/w/${slug}/templates`, label: 'Templates' }, { label: t.name }]} title={t.name} subtitle={t.description} actions={<Badge tone="brand">{t.kind} · v{t.version}</Badge>} />
    <Card title="Create from this template"><ActionForm action={useTemplateAction.bind(null, slug, id)} className="grid gap-3 sm:grid-cols-3 sm:items-end"><div><label className="label" htmlFor="tt">Title (optional)</label><input id="tt" name="title" className="input" /></div>{t.kind !== 'meeting' && <div><label className="label" htmlFor="tts">Teamspace</label><select id="tts" name="teamspace" className="input"><option value="">None</option>{ts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}<Submit>Create {t.kind}</Submit></ActionForm></Card>
    {t.kind !== 'database' && p.body?.length > 0 && <Card title="Preview" className="mt-5"><BlocksView blocks={p.body} fileBase={`/api/w/${slug}/files`} /></Card>}
    {t.kind === 'database' && <Card title="Properties" className="mt-5"><ul className="text-sm">{(p.props || []).map((x: any) => <li key={x.id}>{x.name} <span className="text-muted">({x.type})</span></li>)}</ul></Card>}
    {outdated.length > 0 && <Card title="Update review" className="mt-5"><Alert tone="warn" title={`${outdated.length} copies were made from an older version`}>Nothing changes automatically. Review each copy and apply the update or keep it as is.</Alert><ul className="mt-3 divide-y divide-line text-sm">{outdated.map(u => <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link className="link" href={`/w/${slug}/pages/${u.resource_id}`}>{u.title}</Link> <span className="text-muted">made from v{u.template_version}</span></span><span className="flex gap-1"><ActionButton action={applyUpdateAction.bind(null, slug, u.id)} small confirm="Replace this page's content with the latest template? The current content is saved as a version first.">Apply update</ActionButton><ActionButton action={dismissUpdateAction.bind(null, slug, u.id)} small variant="ghost">Keep as is</ActionButton></span></li>)}</ul></Card>}
    {canEdit && <Card title="Edit template (saves as a new version)" className="mt-5"><TemplateForm slug={slug} template={{ id, name: t.name, kind: t.kind, description: t.description, payload: p }} /></Card>}
    <p className="mt-4 text-sm text-muted">Versions: {prevVers.map(v => `v${v.version} (${ago(v.created_at)})`).join(', ')}</p></div>);
}
