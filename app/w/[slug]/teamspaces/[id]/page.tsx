import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { visiblePages, visibleDatabases } from '@/lib/access';
import { PageHeader, Card, Badge, Icon, Empty } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { teamspaceMemberAction, removeTeamspaceMemberAction, archiveTeamspaceAction } from '@/lib/ws-actions';
export const dynamic = 'force-dynamic';
export default async function Teamspace({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const t = one<any>('SELECT * FROM teamspaces WHERE id=? AND ws=?', id, c.ws.id); if (!t) notFound();
  const members = all<any>('SELECT u.id,u.name FROM teamspace_members m JOIN users u ON u.id=m.user_id WHERE m.teamspace_id=? ORDER BY u.name', id); const isMember = members.some(m => m.id === c.user.id);
  if (t.visibility !== 'open' && !isMember && !c.perms.has('schema.manage')) return <Empty title="This teamspace is closed" icon="lock">Ask a member or an admin to add you.</Empty>;
  const pages = visiblePages(c, 'AND teamspace_id=? AND parent_id IS NULL AND record_id IS NULL AND kind IN (\'page\',\'meeting\')', id); const dbs = visibleDatabases(c).filter(d => d.teamspace_id === id); const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active' ORDER BY u.name`, c.ws.id);
  return (<div><PageHeader crumbs={[{ href: `/w/${slug}/teamspaces`, label: 'Teamspaces' }, { label: t.name }]} title={t.name} subtitle={t.description} actions={<><Badge>{t.visibility}</Badge>{c.perms.has('schema.manage') && <ActionButton action={archiveTeamspaceAction.bind(null, slug, id, true)} small variant="ghost" confirm="Archive this teamspace? Its pages stay accessible by their own rules.">Archive</ActionButton>}</>} />
    <div className="grid gap-5 lg:grid-cols-2"><Card title="Pages" actions={<Link className="link text-sm" href={`/w/${slug}/pages?ts=${id}`}>Open in Pages</Link>}>{pages.length === 0 ? <p className="text-sm text-muted">No pages yet.</p> : <ul className="divide-y divide-line text-sm">{pages.map(p => <li key={p.id}><Link className="flex items-center gap-2 py-2 hover:underline" href={`/w/${slug}/pages/${p.id}`}><Icon name="page" className="text-muted" />{p.title}</Link></li>)}</ul>}</Card>
      <Card title="Databases">{dbs.length === 0 ? <p className="text-sm text-muted">No databases in this teamspace.</p> : <ul className="divide-y divide-line text-sm">{dbs.map(d => <li key={d.id}><Link className="flex items-center gap-2 py-2 hover:underline" href={`/w/${slug}/databases/${d.id}`}><Icon name="db" className="text-muted" />{d.name}</Link></li>)}</ul>}</Card>
      <Card title={`Members (${members.length})`}><ul className="divide-y divide-line text-sm">{members.map(m => <li key={m.id} className="flex items-center justify-between py-1.5">{m.name}{c.perms.has('schema.manage') && <ActionButton action={removeTeamspaceMemberAction.bind(null, slug, id, m.id)} small variant="ghost" confirm={`Remove ${m.name} from this teamspace?`}>Remove</ActionButton>}</li>)}</ul>{c.perms.has('schema.manage') && <ActionForm action={teamspaceMemberAction.bind(null, slug, id, true)} className="mt-3 flex gap-2"><label className="sr-only" htmlFor="tm">Add member</label><select id="tm" name="user" className="input"><option value="">Add a person…</option>{people.filter(p => !members.some(m => m.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><Submit variant="secondary">Add</Submit></ActionForm>}</Card></div></div>);
}
