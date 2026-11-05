import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { pageLevel, dbLevel } from '@/lib/access';
import { PageHeader, Card, Icon, Empty, ago, Badge, Stat, Status, fmtDate } from '@/components/ui';
import { todayIn } from '@/lib/dates';
export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';
export default async function Home({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const base = `/w/${slug}`; const today = todayIn(c.ws.timezone);
  const favs = all<any>(`SELECT p.* FROM favourites f JOIN pages p ON p.id=f.page_id WHERE f.user_id=? AND f.ws=? AND p.deleted_at IS NULL`, c.user.id, c.ws.id).filter(p => pageLevel(c, p) !== 'none');
  const recents = all<any>(`SELECT r.resource_type, r.resource_id, r.at, p.title FROM recents r JOIN pages p ON p.id=r.resource_id AND r.resource_type='page' WHERE r.user_id=? AND r.ws=? AND p.deleted_at IS NULL ORDER BY r.at DESC LIMIT 12`, c.user.id, c.ws.id).filter(r => { const p = one<any>('SELECT * FROM pages WHERE id=?', r.resource_id); return pageLevel(c, p) !== 'none'; }).slice(0, 6);
  const tasks = all<any>(`SELECT * FROM tasks WHERE ws=? AND assignee=? AND status!='done' AND deleted_at IS NULL ORDER BY due_date IS NULL, due_date LIMIT 8`, c.ws.id, c.user.id);
  const acks = all<any>(`SELECT s.id, p.title FROM sops s JOIN pages p ON p.id=s.page_id WHERE s.ws=? AND s.published_version IS NOT NULL AND s.effective_from<=? AND s.requires_ack=1 AND NOT EXISTS (SELECT 1 FROM sop_acks a WHERE a.sop_id=s.id AND a.version=s.published_version AND a.user_id=?)`, c.ws.id, today, c.user.id).filter(s => { const row = one<any>('SELECT audience FROM sops WHERE id=?', s.id); return row.audience === 'all' || row.audience.split(',').includes(c.role.id); });
  const ann = all<any>('SELECT * FROM announcements WHERE (ws=? OR ws IS NULL) ORDER BY pinned DESC, created_at DESC LIMIT 3', c.ws.id);
  const meetings = all<any>(`SELECT * FROM meetings WHERE ws=? AND starts_at>=? AND status='scheduled' ORDER BY starts_at LIMIT 3`, c.ws.id, new Date().toISOString());
  const drafts = all<any>(`SELECT * FROM pages WHERE ws=? AND owner=? AND is_draft=1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5`, c.ws.id, c.user.id);
  const unread = one<any>('SELECT COUNT(*) n FROM notifications WHERE ws=? AND user_id=? AND read=0', c.ws.id, c.user.id)!.n;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: c.ws.timezone }).format(new Date()));
  return (
    <div>
      <PageHeader title={`${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, ${c.user.name.split(' ')[0]}`} subtitle={`${c.ws.name} · ${c.role.name}`}
        actions={<>{c.perms.has('content.create') && <Link href={`${base}/pages`} className="btn-primary btn-sm"><Icon name="plus" size={16} /> New page</Link>}<Link href={`${base}/search`} className="btn-secondary btn-sm"><Icon name="search" size={16} /> Search</Link></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat label="My open tasks" value={tasks.length} href={`${base}/tasks`} hint={`${tasks.filter(t => t.due_date && t.due_date < today).length} overdue`} /><Stat label="Unread in inbox" value={unread} href={`${base}/inbox`} /><Stat label="SOPs to acknowledge" value={acks.length} href={`${base}/knowledge`} /></div>
      {ann.length > 0 && <div className="mb-5 space-y-2">{ann.map(a => <div key={a.id} className="card border-l-4 border-l-brand p-3"><p className="font-semibold">{a.pinned ? '📌 ' : ''}{a.title}</p><p className="text-sm text-muted">{a.body}</p></div>)}</div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="My work" actions={<Link href={`${base}/tasks`} className="link text-sm">All tasks</Link>}>
          {tasks.length === 0 ? <p className="text-sm text-muted">Nothing assigned to you. Enjoy the quiet.</p> : <ul className="divide-y divide-line">{tasks.map(t => <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm"><Link className="hover:underline" href={`${base}/tasks?open=${t.id}`}>{t.title}</Link><span className="flex items-center gap-2 whitespace-nowrap">{t.due_date && <span className={t.due_date < today ? 'font-medium text-bad' : 'text-muted'}>{t.due_date < today ? 'Overdue ' : ''}{fmtDate(t.due_date + 'T00:00:00Z', 'UTC')}</span>}<Status value={t.status} /></span></li>)}</ul>}</Card>
        <Card title="Recent pages">{recents.length === 0 ? <p className="text-sm text-muted">Pages you open will appear here.</p> : <ul className="divide-y divide-line">{recents.map(r => <li key={r.resource_id}><Link className="flex items-center justify-between py-2 text-sm hover:underline" href={`${base}/pages/${r.resource_id}`}><span className="flex items-center gap-2"><Icon name="page" className="text-muted" />{r.title}</span><span className="text-xs text-muted">{ago(r.at)}</span></Link></li>)}</ul>}</Card>
        <Card title="Favourites">{favs.length === 0 ? <p className="text-sm text-muted">Star a page to pin it here.</p> : <ul className="divide-y divide-line">{favs.map(p => <li key={p.id}><Link className="flex items-center gap-2 py-2 text-sm hover:underline" href={`${base}/pages/${p.id}`}><Icon name="star" className="text-warn" />{p.title}</Link></li>)}</ul>}</Card>
        <Card title="Upcoming meetings" actions={<Link href={`${base}/meetings`} className="link text-sm">Calendar</Link>}>{meetings.length === 0 ? <p className="text-sm text-muted">No meetings scheduled.</p> : <ul className="divide-y divide-line">{meetings.map(m => <li key={m.id}><Link className="flex justify-between py-2 text-sm hover:underline" href={`${base}/meetings/${m.id}`}><span>{m.title}</span><span className="text-muted">{new Date(m.starts_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: c.ws.timezone })}</span></Link></li>)}</ul>}</Card>
        {acks.length > 0 && <Card title="Needs your acknowledgement"><ul className="divide-y divide-line">{acks.map(a => <li key={a.id}><Link className="flex items-center justify-between py-2 text-sm hover:underline" href={`${base}/knowledge/${a.id}`}>{a.title}<Badge tone="warn">Acknowledge</Badge></Link></li>)}</ul></Card>}
        <Card title="My drafts">{drafts.length === 0 ? <p className="text-sm text-muted">Personal drafts are private until you share them.</p> : <ul className="divide-y divide-line">{drafts.map(p => <li key={p.id}><Link className="flex items-center justify-between py-2 text-sm hover:underline" href={`${base}/pages/${p.id}`}>{p.title}<span className="text-xs text-muted">{ago(p.updated_at)}</span></Link></li>)}</ul>}</Card>
      </div>
    </div>
  );
}
