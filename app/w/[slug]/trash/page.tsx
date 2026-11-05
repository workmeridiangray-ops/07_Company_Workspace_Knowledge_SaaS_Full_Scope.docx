import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { pageLevel } from '@/lib/access';
import { PageHeader, Table, Empty, ago } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { restorePageAction, purgePageAction } from '@/lib/page-actions';
export const dynamic = 'force-dynamic';
export default async function Trash({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug);
  const rows = all<any>(`SELECT * FROM pages WHERE ws=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`, c.ws.id).filter(p => p.owner === c.user.id || (pageLevel(c, p) !== 'none' && c.perms.has('content.delete')));
  return (<div><PageHeader title="Trash" subtitle="Deleted pages stay here until you remove them permanently. Restoring never changes who can see other content." />
    {rows.length === 0 ? <Empty title="Trash is empty" icon="trash" /> : <Table head={['Page', 'Deleted', '']} caption="Trashed pages">{rows.map(r => (<tr key={r.id}><td className="td font-medium">{r.title}</td><td className="td">{ago(r.deleted_at)}</td><td className="td text-right"><span className="flex justify-end gap-1"><ActionButton action={restorePageAction.bind(null, slug, r.id)} small>Restore</ActionButton>{c.perms.has('content.delete') && <ActionButton action={purgePageAction.bind(null, slug, r.id)} small variant="ghost" confirm="Delete forever? This cannot be undone.">Delete forever</ActionButton>}</span></td></tr>))}</Table>}</div>);
}
