import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Card, Empty, Status } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createMeetingAction } from '@/lib/meet-actions';
import { monthGrid, todayIn, utcToZoned } from '@/lib/dates';
export const metadata: Metadata = { title: 'Meetings' };
export const dynamic = 'force-dynamic';
export default async function Meetings({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug); const base = `/w/${slug}`; const today = todayIn(c.ws.timezone); const ym = sp.month || today.slice(0, 7);
  const ms = all<any>(`SELECT * FROM meetings WHERE ws=? ORDER BY starts_at`, c.ws.id).filter(m => m.organizer === c.user.id || JSON.parse(m.attendees).some((a: any) => a.user === c.user.id) || c.perms.has('content.edit'));
  const by: Record<string, any[]> = {}; for (const m of ms) (by[utcToZoned(m.starts_at, c.ws.timezone).date] ||= []).push(m);
  const { days, month } = monthGrid(ym); const mv = (n: number) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
  const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active' ORDER BY u.name`, c.ws.id); const projects = all<any>('SELECT id,name FROM projects WHERE ws=?', c.ws.id); const tpls = all<any>(`SELECT id,name FROM templates WHERE ws=? AND kind='meeting'`, c.ws.id);
  const upcoming = ms.filter(m => m.status === 'scheduled' && m.starts_at >= new Date().toISOString()).slice(0, 8);
  return (<div><PageHeader title="Meetings" subtitle={`Times shown in ${c.ws.timezone}.`} />
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div><div className="mb-2 flex items-center justify-between"><Link className="btn-secondary btn-sm" href={`${base}/meetings?month=${mv(-1)}`}>← Prev</Link><h2 className="font-semibold">{new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><Link className="btn-secondary btn-sm" href={`${base}/meetings?month=${mv(1)}`}>Next →</Link></div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-xs">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="bg-bg p-1.5 text-center font-semibold">{d}</div>)}{days.map(d => <div key={d} className={`min-h-[76px] p-1 ${Number(d.slice(5, 7)) === month ? 'bg-surface' : 'bg-bg text-muted'} ${d === today ? 'ring-2 ring-inset ring-brand' : ''}`}><div className="text-right">{Number(d.slice(8))}</div>{(by[d] || []).map(m => <Link key={m.id} href={`${base}/meetings/${m.id}`} className={`mb-0.5 block truncate rounded px-1 ${m.status === 'cancelled' ? 'bg-bg text-muted line-through' : 'bg-brandSoft text-brand'}`}>{utcToZoned(m.starts_at, c.ws.timezone).time} {m.title}</Link>)}</div>)}</div></div>
      <div className="space-y-5"><Card title="Upcoming">{upcoming.length === 0 ? <p className="text-sm text-muted">Nothing scheduled.</p> : <ul className="divide-y divide-line text-sm">{upcoming.map(m => <li key={m.id}><Link className="block py-2 hover:underline" href={`${base}/meetings/${m.id}`}>{m.title}<span className="block text-xs text-muted">{new Date(m.starts_at).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: c.ws.timezone })}</span></Link></li>)}</ul>}</Card>
        {c.perms.has('content.create') && <Card title="Schedule a meeting"><ActionForm action={createMeetingAction.bind(null, slug)} className="space-y-3"><div><label className="label" htmlFor="mt">Title</label><input id="mt" name="title" className="input" required /></div><div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="md">Date</label><input id="md" type="date" name="date" defaultValue={today} className="input" required /></div><div><label className="label" htmlFor="mti">Time</label><input id="mti" type="time" name="time" defaultValue="10:00" className="input" required /></div></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="mm">Minutes</label><input id="mm" type="number" name="minutes" defaultValue={30} min={5} max={480} className="input" /></div><div><label className="label" htmlFor="ml">Location / link</label><input id="ml" name="location" className="input" /></div></div>
          <fieldset><legend className="label">Attendees</legend><div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">{people.filter(p => p.id !== c.user.id).map(p => <label key={p.id} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-sm"><input type="checkbox" name="attendee" value={p.id} />{p.name}</label>)}</div></fieldset>
          <div><label className="label" htmlFor="ma">Agenda (one item per line)</label><textarea id="ma" name="agenda" rows={3} className="input" /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="mp">Project</label><select id="mp" name="project" className="input"><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><label className="label" htmlFor="mtp">Template</label><select id="mtp" name="template" className="input"><option value="">None</option>{tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
          <Submit>Schedule</Submit></ActionForm></Card>}</div></div></div>);
}
