import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getDb, pageExists, recordLevel, atLeast } from '@/lib/access';
import * as D from '@/lib/svc/data';
import { all, one, J } from '@/lib/db';
import { PageHeader, Empty, Icon, Badge, Card, Table, LinkButton } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { Board, CalendarGrid } from '@/components/DataViews';
import { RecordFields } from '@/components/RecordFields';
import { createRecordAction, saveViewAction, deleteViewAction, archiveDbAction } from '@/lib/data-actions';
import { recordRecent } from '@/lib/svc/pages';
import { todayIn, monthGrid, addDays } from '@/lib/dates';
import { layoutTimeline, defaultFrom, ticks } from '@/lib/timeline';
export const dynamic = 'force-dynamic';
type SP = { from?: string; span?: string; fprop?: string; fop?: string; fval?: string; view?: string; q?: string; f?: string; sort?: string; dir?: string; type?: string; density?: string; month?: string; archived?: string; imported?: string };
export default async function DatabaseView({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<SP> }) {
  const { slug, id } = await params; const sp = await searchParams; const c = await requireCtx(slug); const g = getDb(c, id, 'view');
  if (!g) { if (!one('SELECT 1 FROM databases WHERE id=? AND ws=?', id, c.ws.id)) notFound(); return <Empty title="You don’t have access to this database" icon="lock">Ask a workspace owner to share it with you.</Empty>; }
  const base = `/w/${slug}`, canEdit = g.level === 'edit' && !['suspended', 'expired', 'closed', 'closing'].includes(c.ws.status), canSchema = c.perms.has('schema.manage') && g.level === 'edit';
  const views = D.listViews(c, id); const saved = views.find(v => v.id === sp.view) || views[0]; const cfg0 = J<D.ViewCfg>(saved?.config, {});
  // Temporary state (URL) is kept separate from the saved view; it never mutates the saved view.
  const type = sp.type || saved?.type || 'table'; const cfg: D.ViewCfg = { ...cfg0, density: (sp.density as any) || cfg0.density };
  if (sp.sort) cfg.sorts = [{ prop: sp.sort, dir: sp.dir === 'desc' ? 'desc' : 'asc' }];
  const tmpFilters = [...(sp.f || '').split(';').filter(Boolean).map(s => { const [prop, op, ...v] = s.split(':'); return { prop, op, value: v.join(':') }; }), ...(sp.fprop ? [{ prop: sp.fprop, op: sp.fop || 'contains', value: sp.fval || '' }] : [])];
  const { props, rows } = D.visibleRecords(c, id, sp.archived === '1'); D.computeValues(c, props, rows);
  const list = D.applyView(props, rows, cfg, tmpFilters, sp.q || ''); const tp = D.titleProp(props);
  const users = new Map(all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=?`, c.ws.id).map(u => [u.id, u.name]));
  recordRecent(c, 'database', id);
  const shown = props.filter(p => !(cfg.hidden || []).includes(p.id)); const cell = (r: any, p: D.Prop) => D.displayValue(c, p, r.d[p.id], users);
  const today = todayIn(c.ws.timezone); const ym = sp.month || today.slice(0, 7);
  const qs = (o: Record<string, string | undefined>) => { const u = new URLSearchParams(); const m: any = { view: sp.view, q: sp.q, f: sp.f, sort: sp.sort, dir: sp.dir, type: sp.type, density: sp.density, archived: sp.archived, ...o }; for (const [k, v] of Object.entries(m)) if (v) u.set(k, String(v)); return `?${u}`; };
  const selectProps = props.filter(p => p.type === 'select'); const dateProps = props.filter(p => p.type === 'date');
  const groupId = cfg.group && selectProps.some(p => p.id === cfg.group) ? cfg.group : selectProps[0]?.id; const groupProp = props.find(p => p.id === groupId);
  const dateId = cfg.dateProp && dateProps.some(p => p.id === cfg.dateProp) ? cfg.dateProp : dateProps[0]?.id;
  const cardOf = (r: any) => ({ id: r.id, title: String(r.d[tp.id] ?? 'Untitled'), sub: shown.filter(p => p.id !== tp.id && p.id !== groupId && ['people', 'date', 'number'].includes(p.type)).slice(0, 2).map(p => cell(r, p)).filter(Boolean).join(' · ') });
  const unsafeDrag = (id: string) => true;
  return (
    <div>
      <PageHeader crumbs={[{ href: `${base}/databases`, label: 'Databases' }, { label: g.db.name }]} title={g.db.name} subtitle={`${rows.length} record${rows.length === 1 ? '' : 's'}${sp.archived === '1' ? ' (including archived)' : ''}`}
        actions={<>{canSchema && <LinkButton href={`${base}/databases/${id}/schema`} small><Icon name="settings" size={16} /> Schema</LinkButton>}{canEdit && c.perms.has('integrations.manage') && <LinkButton href={`${base}/databases/${id}/import`} small>Import CSV</LinkButton>}{c.perms.has('content.export') && <a className="btn-secondary btn-sm" href={`/api/w/${slug}/export/db/${id}`}><Icon name="download" size={16} /> Export CSV</a>}<LinkButton href={`${base}/databases/${id}/duplicates`} small>Duplicates</LinkButton></>} />
      {sp.imported && <div className="mb-3 rounded-lg border border-ok/30 bg-okSoft px-3 py-2 text-sm" role="status">Imported {sp.imported} records.</div>}
      <nav aria-label="Views" className="mb-3 flex flex-wrap items-center gap-1 border-b border-line pb-2">
        {views.map(v => <Link key={v.id} href={`?view=${v.id}`} aria-current={saved?.id === v.id ? 'page' : undefined} className={`btn-sm ${saved?.id === v.id ? 'btn-primary' : 'btn-ghost'}`}><Icon name={v.type === 'board' ? 'board' : v.type === 'calendar' ? 'cal' : v.type === 'list' ? 'list' : v.type === 'timeline' ? 'clock' : 'grid'} size={14} /> {v.name}{!v.shared && <span className="sr-only"> (personal)</span>}{!v.shared && <Icon name="lock" size={12} />}</Link>)}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />{(['table', 'board', 'calendar', 'list', 'timeline'] as const).map(t => <Link key={t} href={qs({ type: t })} aria-label={`Show as ${t} (temporary)`} className={`btn-sm ${type === t ? 'btn-secondary' : 'btn-ghost'}`}>{t[0].toUpperCase() + t.slice(1)}</Link>)}
      </nav>
      <form method="get" className="card mb-3 grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:items-end" aria-label="Filters and sorting">
        <input type="hidden" name="view" value={saved?.id || ''} /><input type="hidden" name="type" value={sp.type || ''} />
        <div><label className="label" htmlFor="q">Search {tp.name.toLowerCase()}</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Search…" /></div>
        <div><label className="label" htmlFor="fp">Filter</label><div className="flex gap-1"><select id="fp" name="fprop" defaultValue={sp.fprop || ''} className="input"><option value="">Property</option>{props.filter(p => !['files'].includes(p.type)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
        <div><label className="label" htmlFor="fop">Operator</label><select id="fop" name="fop" defaultValue={sp.fop || 'contains'} className="input"><option value="contains">contains</option><option value="eq">is</option><option value="neq">is not</option><option value="gt">&gt;</option><option value="lt">&lt;</option><option value="notempty">is set</option><option value="empty">is empty</option></select></div>
        <div><label className="label" htmlFor="fv">Value</label><input id="fv" name="fval" defaultValue={sp.fval} className="input" placeholder="value" /></div>
        <div><label className="label" htmlFor="so">Sort</label><select id="so" name="sort" defaultValue={sp.sort || ''} className="input"><option value="">Default</option>{props.filter(p => p.type !== 'files').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="flex gap-1"><button className="btn-primary" type="submit">Apply</button><Link href={`?view=${saved?.id || ''}`} className="btn-ghost">Reset</Link></div>
      </form>
      {(tmpFilters.length > 0 || sp.sort || sp.q) && <p className="mb-2 text-sm text-muted">Temporary filters active (your saved view is unchanged). </p>}
      <FilterRedirect />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">{list.length} shown</span>
        <Link className="link" href={qs({ density: cfg.density === 'compact' ? 'comfortable' : 'compact' })}>{cfg.density === 'compact' ? 'Comfortable rows' : 'Compact rows'}</Link>
        <Link className="link" href={qs({ archived: sp.archived === '1' ? undefined : '1' })}>{sp.archived === '1' ? 'Hide archived' : 'Show archived'}</Link>
        {saved && (saved.shared ? canSchema : saved.owner === c.user.id) && views.length > 1 && <ActionButton action={deleteViewAction.bind(null, slug, id, saved.id)} small variant="ghost" confirm="Delete this saved view? Records are not affected.">Delete view</ActionButton>}
        {c.ws.status === 'active' || c.ws.status === 'trial' ? null : <Badge tone="warn">Read-only</Badge>}</div>

      {list.length === 0 ? (rows.length === 0 ? <Empty title={`No ${g.db.name.toLowerCase()} yet`} icon="db">{canEdit ? 'Add the first record below, or import a CSV.' : 'There are no records you can see.'}</Empty> : <Empty title="No records match" icon="search" action={<Link href={`?view=${saved?.id || ''}`} className="btn-secondary btn-sm">Clear filters</Link>}>Try removing a filter.</Empty>) :
       type === 'board' && groupProp ? <Board slug={slug} propId={groupProp.id} propName={groupProp.name} canEdit={canEdit && rows.every(() => true)} columns={(groupProp.options || []).map(o => ({ id: o.id, name: o.name }))} cards={list.reduce((a: any, r) => { (a[r.d[groupProp.id] || ''] ||= []).push(cardOf(r)); return a; }, {})} /> :
       type === 'board' ? <Empty title="Board needs a select property" icon="board">Add a Status-style select property in Schema to group cards.</Empty> :
       type === 'timeline' && dateProps.length ? (() => {
          const sId = dateProps.some(p => p.id === cfg0.startProp) ? cfg0.startProp! : dateProps[0].id; const eId = dateProps.some(p => p.id === cfg0.endProp) ? cfg0.endProp : dateProps.find(p => p.id !== sId)?.id;
          const items = list.map(r => ({ id: r.id, title: String(r.d[tp.id] ?? 'Untitled'), start: r.d[sId] || null, end: (eId && r.d[eId]) || null })); const span = [30, 60, 90, 180].includes(Number(sp.span)) ? Number(sp.span) : 60;
          const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || '') ? sp.from! : defaultFrom(items, today); const L = layoutTimeline(items, from, span); const tk = ticks(from, span); const todayLeft = today >= from && today <= L.to ? ((Date.parse(today) - Date.parse(from)) / 864e5 / span) * 100 : null;
          const step = Math.round(span / 2); const sName = props.find(p => p.id === sId)!.name, eName = eId ? props.find(p => p.id === eId)!.name : null;
          return (<div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><Link className="btn-secondary btn-sm" href={qs({ from: addDays(from, -step) })}>← Earlier</Link><Link className="btn-secondary btn-sm" href={qs({ from: defaultFrom([], today) })}>This week</Link><Link className="btn-secondary btn-sm" href={qs({ from: addDays(from, step) })}>Later →</Link></div><p className="text-sm text-muted">{from} → {L.to} · bars use {sName}{eName ? ` → ${eName}` : ''}</p><div className="flex gap-1">{[30, 60, 90, 180].map(n => <Link key={n} href={qs({ span: String(n) })} className={`btn-sm ${span === n ? 'btn-primary' : 'btn-secondary'}`} aria-label={`Show ${n} days`}>{n}d</Link>)}</div></div>
            <div className="card overflow-x-auto"><div className="min-w-[720px]" role="table" aria-label="Timeline"><div className="grid grid-cols-[180px_1fr] border-b border-line bg-bg text-xs" role="row"><div className="px-3 py-2 font-semibold" role="columnheader">{tp.name}</div><div className="relative h-8" role="columnheader" aria-label="Dates">{tk.map((t, i) => <span key={i} className={`absolute top-1 -translate-x-0 whitespace-nowrap pl-1 ${t.major ? 'font-semibold' : 'text-muted'}`} style={{ left: `${t.left}%` }}>{t.label}</span>)}</div></div>
              {L.placed.length === 0 ? <p className="p-6 text-center text-sm text-muted">Nothing is scheduled in this window. Use Earlier / Later, or pick a longer span.</p> : L.placed.map(b => (<div key={b.id} role="row" className="grid grid-cols-[180px_1fr] border-b border-line last:border-0 hover:bg-bg"><Link role="cell" href={`${base}/records/${b.id}`} className="truncate px-3 py-2 text-sm font-medium hover:underline" title={b.title}>{b.title}</Link><div role="cell" className="relative h-9" aria-label={`${b.title}: ${b.start} to ${b.end}`}>{todayLeft !== null && <span className="absolute inset-y-0 w-px bg-brand/50" style={{ left: `${todayLeft}%` }} aria-hidden />}<Link href={`${base}/records/${b.id}`} className={`absolute top-1.5 flex h-6 items-center overflow-hidden whitespace-nowrap bg-brand px-2 text-xs text-white hover:bg-brandDark ${b.clippedL ? 'rounded-l-none' : 'rounded-l'} ${b.clippedR ? 'rounded-r-none' : 'rounded-r'}`} style={{ left: `${b.left}%`, width: `${b.width}%` }}>{b.width > 8 ? `${b.start.slice(5)} → ${b.end.slice(5)}` : ''}<span className="sr-only">{b.title}, {b.start} to {b.end}</span></Link></div></div>))}</div></div>
            {(L.undated.length > 0 || L.outside.length > 0) && <p className="mt-2 text-sm text-muted">{L.undated.length > 0 && `${L.undated.length} without dates (not shown). `}{L.outside.length > 0 && `${L.outside.length} outside this window.`}</p>}</div>); })() :
       type === 'timeline' ? <Empty title="Timeline needs a date property" icon="clock">Add a Start (and optionally End) date property in Schema.</Empty> :
       type === 'calendar' && dateId ? (() => { const { days, month, year } = monthGrid(ym); const items: Record<string, any[]> = {}; for (const r of list) { const dv = r.d[dateId]; if (dv) (items[dv] ||= []).push(cardOf(r)); } const prev = D_add(ym, -1), next = D_add(ym, 1); const noDate = list.filter(r => !r.d[dateId]).length;
          return (<div><div className="mb-2 flex items-center justify-between"><Link className="btn-secondary btn-sm" href={qs({ month: prev })}>← Prev</Link><h2 className="font-semibold">{new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><Link className="btn-secondary btn-sm" href={qs({ month: next })}>Next →</Link></div><CalendarGrid slug={slug} propId={dateId} propName={props.find(p => p.id === dateId)!.name} days={days} month={month} items={items} canEdit={canEdit} today={today} />{noDate > 0 && <p className="mt-2 text-sm text-muted">{noDate} record(s) have no date and are not shown on the calendar.</p>}</div>); })() :
       type === 'calendar' ? <Empty title="Calendar needs a date property" icon="cal">Add a date property in Schema.</Empty> :
       type === 'list' ? <ul className="card divide-y divide-line">{list.map(r => <li key={r.id}><Link href={`${base}/records/${r.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-4 hover:bg-bg ${cfg.density === 'compact' ? 'py-1.5' : 'py-3'}`}><span className="font-medium">{String(r.d[tp.id] ?? 'Untitled')}{r.archived ? <Badge>Archived</Badge> : null}</span><span className="text-sm text-muted">{shown.filter(p => p.id !== tp.id).slice(0, 3).map(p => cell(r, p)).filter(Boolean).join(' · ')}</span></Link></li>)}</ul> :
       <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><caption className="sr-only">{g.db.name} records</caption><thead className="border-b border-line bg-bg"><tr>{shown.map(p => <th key={p.id} scope="col" className={`th ${p.type === 'number' || p.type === 'rollup' ? 'text-right' : ''}`}><Link href={qs({ sort: p.id, dir: sp.sort === p.id && sp.dir !== 'desc' ? 'desc' : 'asc' })} aria-label={`Sort by ${p.name}`}>{p.name}{sp.sort === p.id ? (sp.dir === 'desc' ? ' ↓' : ' ↑') : ''}</Link></th>)}</tr></thead>
         <tbody className="divide-y divide-line">{list.map(r => (<tr key={r.id} className={`hover:bg-bg ${r.archived ? 'opacity-60' : ''}`}>{shown.map(p => <td key={p.id} className={`px-3 ${cfg.density === 'compact' ? 'py-1' : 'py-2.5'} ${p.type === 'number' || p.type === 'rollup' ? 'text-right tabular-nums' : ''}`}>{p.id === tp.id ? <Link className="font-medium text-brand hover:underline" href={`${base}/records/${r.id}`}>{cell(r, p) || 'Untitled'}</Link> : p.type === 'select' && r.d[p.id] ? <Badge tone="brand">{cell(r, p)}</Badge> : cell(r, p)}</td>)}</tr>))}</tbody></table></div>}

      {canEdit && (<Card title={`Add to ${g.db.name}`} className="mt-6"><ActionForm action={createRecordAction.bind(null, slug, id)} className="space-y-3" resetOnSuccess>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><RecordFields c={c} props={props} /></div>
        <div className="flex flex-wrap items-center gap-3"><Submit>Add record</Submit><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="open" className="h-4 w-4" /> Open after adding</label></div></ActionForm></Card>)}

      {canSchema && (<details className="card mt-4"><summary className="cursor-pointer px-4 py-3 font-semibold">Save current layout as a view</summary><div className="border-t border-line p-4">
        <ActionForm action={saveViewAction.bind(null, slug, id)} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div><label className="label" htmlFor="vn">Name</label><input id="vn" name="name" className="input" required /></div>
          <div><label className="label" htmlFor="vt">Layout</label><select id="vt" name="type" defaultValue={type} className="input"><option value="table">Table</option><option value="board">Board</option><option value="calendar">Calendar</option><option value="list">List</option><option value="timeline">Timeline</option></select></div>
          <div><label className="label" htmlFor="vst">Timeline start</label><select id="vst" name="startProp" className="input" defaultValue={dateId}>{dateProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ven">Timeline end (optional)</label><select id="ven" name="endProp" className="input"><option value="">None</option>{dateProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="vg">Group by (board)</label><select id="vg" name="group" className="input" defaultValue={groupId}>{selectProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="vd">Date (calendar)</label><select id="vd" name="dateProp" className="input" defaultValue={dateId}>{dateProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="vf">Filter</label><div className="flex gap-1"><select name="fp0" id="vf" className="input" defaultValue={tmpFilters[0]?.prop}><option value="">None</option>{props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select name="fo0" className="input" aria-label="Operator" defaultValue={tmpFilters[0]?.op || 'contains'}><option value="contains">contains</option><option value="eq">is</option><option value="neq">is not</option><option value="notempty">is set</option><option value="empty">is empty</option></select></div></div>
          <div><label className="label" htmlFor="vfv">Filter value</label><input id="vfv" name="fv0" className="input" defaultValue={tmpFilters[0]?.value} /></div>
          <div><label className="label" htmlFor="vs">Sort</label><select id="vs" name="sort" className="input" defaultValue={sp.sort}><option value="">Default</option>{props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="vdir">Direction</label><select id="vdir" name="dir" className="input"><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
          <fieldset className="sm:col-span-3"><legend className="label">Visible columns</legend><div className="flex flex-wrap gap-2">{props.map(p => <label key={p.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="hidden" value={p.id} /> hide {p.name}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" defaultChecked className="h-4 w-4" /> Shared with everyone who can open this database</label>
          <Submit variant="secondary">Save view</Submit></ActionForm></div></details>)}
    </div>
  );
}
function D_add(ym: string, n: number) { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
function FilterRedirect() { return null; }
