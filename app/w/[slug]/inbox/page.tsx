import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { pageLevel, getRecord, getDb } from '@/lib/access';
import { PageHeader, Empty, Badge, ago, Icon } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { markReadAction, markAllReadAction } from '@/lib/inbox-actions';
export const metadata: Metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';
const VERB: Record<string, string> = { mention: 'mentioned you', comment: 'commented', assignment: 'assigned you something', share: 'shared something with you', sop: 'needs your attention on an SOP', reminder: 'reminder', automation: 'automation message' };
export default async function Inbox({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ all?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug); const base = `/w/${slug}`;
  const rows = all<any>(`SELECT n.*, u.name AS actor_name FROM notifications n LEFT JOIN users u ON u.id=n.actor WHERE n.ws=? AND n.user_id=? ${sp.all ? '' : 'AND n.read=0'} ORDER BY n.created_at DESC LIMIT 100`, c.ws.id, c.user.id);
  // Re-check access on every render: a notification never leaks the title of something the user can no longer open.
  const view = rows.map(n => {
    let title = '', href = '', ok = false;
    if (n.resource_type === 'page') { const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=? AND deleted_at IS NULL', n.resource_id, c.ws.id); if (p && pageLevel(c, p) !== 'none') { ok = true; title = p.title; href = p.kind === 'sop' ? `${base}/knowledge/${one<any>('SELECT id FROM sops WHERE page_id=?', p.id)?.id}` : `${base}/pages/${p.id}`; } }
    else if (n.resource_type === 'record') { const g = getRecord(c, n.resource_id, 'view'); if (g) { ok = true; title = `${g.db.name} record`; href = `${base}/records/${n.resource_id}`; } }
    else if (n.resource_type === 'database') { const g = getDb(c, n.resource_id, 'view'); if (g) { ok = true; title = g.db.name; href = `${base}/databases/${n.resource_id}`; } }
    else if (n.resource_type === 'task') { const t = one<any>('SELECT title FROM tasks WHERE id=? AND ws=? AND deleted_at IS NULL', n.resource_id, c.ws.id); if (t) { ok = true; title = t.title; href = `${base}/tasks?open=${n.resource_id}&tab=all`; } }
    else if (n.resource_type === 'meeting') { const m = one<any>('SELECT title FROM meetings WHERE id=? AND ws=?', n.resource_id, c.ws.id); if (m) { ok = true; title = m.title; href = `${base}/meetings/${n.resource_id}`; } }
    else if (n.resource_type === 'sop') { const s = one<any>('SELECT s.id, p.title FROM sops s JOIN pages p ON p.id=s.page_id WHERE s.id=? AND s.ws=?', n.resource_id, c.ws.id); if (s) { ok = true; title = s.title; href = `${base}/knowledge/${s.id}`; } }
    else if (n.resource_type === 'workspace') { ok = true; title = 'Workspace reminder'; href = base; }
    return { ...n, ok, title, href };
  });
  return (<div className="mx-auto max-w-3xl"><PageHeader title="Inbox" subtitle="Mentions, assignments, shares and SOP requests." actions={<><Link className="btn-secondary btn-sm" href={`${base}/inbox${sp.all ? '' : '?all=1'}`}>{sp.all ? 'Unread only' : 'Show read'}</Link><ActionButton action={markAllReadAction.bind(null, slug)} small>Mark all read</ActionButton><Link className="btn-ghost btn-sm" href="/account/notifications">Preferences</Link></>} />
    {view.length === 0 ? <Empty title="You’re all caught up" icon="bell">New mentions and assignments will show up here.</Empty> : <ul className="card divide-y divide-line">{view.map(n => <li key={n.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${n.read ? 'opacity-70' : ''}`}><span className={`h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-brand'}`} aria-label={n.read ? 'Read' : 'Unread'} /><div className="min-w-0 flex-1 text-sm">{n.ok ? <><strong>{n.actor_name || 'Fieldnote'}</strong> {VERB[n.kind] || n.kind} · <Link className="link" href={n.href}>{n.title}</Link></> : <span className="text-muted">{n.actor_name || 'Someone'} {VERB[n.kind] || 'sent an update'} - the content is no longer available to you.</span>}<span className="block text-xs text-muted">{ago(n.created_at)}</span></div>{!n.read && <ActionButton action={markReadAction.bind(null, slug, n.id)} small variant="ghost">Mark read</ActionButton>}</li>)}</ul>}</div>);
}
