import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Empty, Badge, Icon, Card } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createTeamspaceAction } from '@/lib/ws-actions';
export const metadata: Metadata = { title: 'Teamspaces' };
export const dynamic = 'force-dynamic';
export default async function Teamspaces({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug);
  const list = all<any>(`SELECT t.*, (SELECT COUNT(*) FROM teamspace_members m WHERE m.teamspace_id=t.id) AS members, (SELECT COUNT(*) FROM pages p WHERE p.teamspace_id=t.id AND p.deleted_at IS NULL) AS pages FROM teamspaces t WHERE t.ws=? AND t.archived=0 ORDER BY t.name`, c.ws.id).filter(t => t.visibility === 'open' || all('SELECT 1 FROM teamspace_members WHERE teamspace_id=? AND user_id=?', t.id, c.user.id).length > 0 || c.perms.has('schema.manage'));
  return (<div><PageHeader title="Teamspaces" subtitle="Departments or client groups. Open teamspaces are visible to every member; closed ones list only their members." />
    {list.length === 0 ? <Empty title="No teamspaces" icon="building" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(t => <Link key={t.id} href={`/w/${slug}/teamspaces/${t.id}`} className="card block p-4 hover:border-brand"><div className="flex items-start justify-between"><Icon name="building" className="text-brand" /><Badge>{t.visibility}</Badge></div><h2 className="mt-2 font-semibold">{t.name}</h2><p className="text-sm text-muted">{t.description || 'No description'}</p><p className="mt-2 text-xs text-muted">{t.members} members · {t.pages} pages</p></Link>)}</div>}
    {c.perms.has('schema.manage') && <Card title="New teamspace" className="mt-6"><ActionForm action={createTeamspaceAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-4 sm:items-end"><div><label className="label" htmlFor="tn">Name</label><input id="tn" name="name" className="input" required /></div><div className="sm:col-span-2"><label className="label" htmlFor="td">Description</label><input id="td" name="description" className="input" /></div><div><label className="label" htmlFor="tv">Access</label><select id="tv" name="visibility" className="input"><option value="open">Open to all members</option><option value="closed">Closed (members only)</option><option value="private">Private</option></select></div><Submit>Create teamspace</Submit></ActionForm></Card>}</div>);
}
