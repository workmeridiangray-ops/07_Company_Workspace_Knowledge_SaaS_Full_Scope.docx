import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getPage, pageExists } from '@/lib/access';
import { recordRecent } from '@/lib/svc/pages';
import { one, all, J } from '@/lib/db';
import Editor from '@/components/Editor';
import { Comments, SharePanel } from '@/components/Collab';
import { PageHeader, Icon, Badge, Alert, Card } from '@/components/ui';
import { ActionButton, ActionForm, Submit } from '@/components/ActionForm';
import { trashPageAction, favouriteAction, movePageAction, visibilityAction, restorePageAction } from '@/lib/page-actions';
import { requestAccessAction } from '@/lib/collab-actions';
import { visiblePages } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: 'Page' }; }
export default async function PageView({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug);
  const g = getPage(c, id, 'view');
  if (!g) {
    if (!pageExists(c, id)) notFound();
    // exists in this workspace but not accessible: offer an access request (reveals nothing else)
    return (<div className="mx-auto max-w-lg"><PageHeader title="You don’t have access to this page" subtitle="Ask the owner to share it with you." />
      <ActionForm action={requestAccessAction.bind(null, slug, 'page', id)} className="card space-y-3 p-5"><label className="label" htmlFor="msg">Message (optional)</label><textarea id="msg" name="message" rows={3} className="input" /><Submit>Request access</Submit></ActionForm></div>);
  }
  const { page, level } = g; recordRecent(c, 'page', id);
  const ts = page.teamspace_id ? one<any>('SELECT id,name FROM teamspaces WHERE id=?', page.teamspace_id) : null;
  const parent = page.parent_id ? one<any>('SELECT id,title FROM pages WHERE id=? AND ws=?', page.parent_id, c.ws.id) : null;
  const children = visiblePages(c, 'AND parent_id=?', id);
  const fav = !!one('SELECT 1 FROM favourites WHERE user_id=? AND page_id=?', c.user.id, id);
  const sop = page.kind === 'sop' ? one<any>('SELECT * FROM sops WHERE page_id=?', id) : null;
  const locked = sop && sop.state !== 'draft' ? `SOP ${sop.state} - read only` : page.deleted_at ? 'In trash' : undefined;
  const readOnly = level === 'view' || level === 'comment' || !!locked || ['suspended', 'expired', 'closed', 'closing'].includes(c.ws.status);
  const canShare = c.perms.has('content.share') && level === 'edit';
  const tsAll = all<any>('SELECT id,name FROM teamspaces WHERE ws=? AND archived=0 ORDER BY name', c.ws.id);
  const movable = visiblePages(c, 'AND id!=?', id).filter(p => p.kind === 'page').slice(0, 200);
  const crumbs = [{ href: `/w/${slug}/pages`, label: 'Pages' }, ...(ts ? [{ href: `/w/${slug}/teamspaces/${ts.id}`, label: ts.name }] : []), ...(parent ? [{ href: `/w/${slug}/pages/${parent.id}`, label: parent.title }] : []), { label: page.title || 'Untitled' }];
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-muted"><ol className="flex flex-wrap gap-1">{crumbs.map((x, i) => <li key={i} className="flex gap-1">{i > 0 && <span aria-hidden>/</span>}{x.href ? <Link className="hover:underline" href={x.href}>{x.label}</Link> : <span aria-current="page">{x.label}</span>}</li>)}</ol></nav>
      {page.deleted_at && <div className="mb-3"><Alert tone="warn" title="This page is in the trash">It is hidden from lists and search. <ActionButton action={restorePageAction.bind(null, slug, id)} small>Restore</ActionButton></Alert></div>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {page.is_draft ? <Badge>Personal draft</Badge> : <Badge>{page.visibility === 'private' ? 'Private' : page.visibility === 'teamspace' ? 'Teamspace' : 'Workspace'}</Badge>}
        {sop && <Link href={`/w/${slug}/knowledge/${sop.id}`} className="inline-flex"><Badge tone="brand">SOP · {sop.state}</Badge></Link>}
        <span className="ml-auto flex flex-wrap gap-1">
          <ActionButton action={favouriteAction.bind(null, slug, id)} small variant="ghost">{fav ? '★ Favourited' : '☆ Favourite'}</ActionButton>
          <Link className="btn-ghost btn-sm" href={`/w/${slug}/pages/${id}/history`}><Icon name="history" size={16} /> History</Link>
          {c.perms.has('content.export') && <a className="btn-ghost btn-sm" href={`/api/w/${slug}/export/page/${id}`}><Icon name="download" size={16} /> Export</a>}
          {!page.deleted_at && level === 'edit' && c.perms.has('content.delete') && <ActionButton action={trashPageAction.bind(null, slug, id)} small variant="ghost" confirm="Move this page and its sub-pages to the trash?">Move to trash</ActionButton>}
        </span>
      </div>
      <Editor slug={slug} pageId={id} initialTitle={page.title} initialBlocks={J(page.body, [])} initialVersion={page.version} readOnly={readOnly} locked={locked} />
      {children.length > 0 && <Card title="Sub-pages" className="mt-6"><ul className="divide-y divide-line">{children.map(k => <li key={k.id}><Link className="flex items-center gap-2 py-2 hover:underline" href={`/w/${slug}/pages/${k.id}`}><Icon name="page" className="text-muted" />{k.title}</Link></li>)}</ul></Card>}
      <div className="mx-auto max-w-3xl">
        <Comments ctx={c} type="page" rid={id} canComment={level !== 'view'} />
        {level === 'edit' && !page.deleted_at && (
          <details className="card mt-6"><summary className="cursor-pointer px-4 py-3 font-semibold">Share and access</summary><div className="space-y-5 border-t border-line p-4">
            {canShare ? <SharePanel ctx={c} type="page" rid={id} canShare /> : <p className="text-sm text-muted">You can edit this page but not change who can see it.</p>}
            {canShare && <ActionForm action={visibilityAction.bind(null, slug, id)} className="flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="vis">Default visibility</label><select id="vis" name="visibility" className="input" defaultValue={page.visibility}><option value="private">Private (only me and people I share with)</option><option value="teamspace">Teamspace members</option><option value="workspace">Everyone in the workspace</option></select></div><Submit variant="secondary">Update</Submit></ActionForm>}
          </div></details>)}
        {level === 'edit' && !page.deleted_at && (
          <details className="card mt-3"><summary className="cursor-pointer px-4 py-3 font-semibold">Move page</summary><div className="border-t border-line p-4">
            <ActionForm action={movePageAction.bind(null, slug, id)} className="space-y-3"><div><label className="label" htmlFor="dest">Destination</label><select id="dest" name="dest" className="input"><option value="ts:">Workspace root (no teamspace)</option>{tsAll.map(t => <option key={t.id} value={`ts:${t.id}`}>Teamspace: {t.name}</option>)}{movable.map(p => <option key={p.id} value={`pg:${p.id}`}>Inside page: {p.title}</option>)}</select></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="mt-1 h-4 w-4" /> I reviewed the permission changes shown after pressing Move, and want to proceed.</label>
              <Submit variant="secondary">Move</Submit><p className="hint">First press shows exactly which access changes; tick the box and press again to confirm. Links keep working.</p></ActionForm></div></details>)}
      </div>
    </div>
  );
}
