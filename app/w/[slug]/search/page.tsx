import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { search } from '@/lib/svc/search';
import { PageHeader, Empty, Badge, Icon, ago } from '@/components/ui';
export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';
const TYPES = [['page', 'Pages'], ['sop', 'SOPs'], ['meeting', 'Meetings'], ['record', 'Records'], ['database', 'Databases'], ['task', 'Tasks']];
export default async function Search({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; type?: string | string[]; ts?: string }> }) {
  const slug = (await params).slug; const sp = await searchParams; const c = await requireCtx(slug); const q = (sp.q || '').trim().slice(0, 100); const types = ([] as string[]).concat(sp.type || []);
  const hits = q ? search(c, q, { types, teamspace: sp.ts }) : []; const ts = all<any>('SELECT id,name FROM teamspaces WHERE ws=? AND archived=0', c.ws.id);
  const recent = all<any>('SELECT * FROM saved_searches WHERE ws=? AND user_id=? ORDER BY rowid DESC LIMIT 5', c.ws.id, c.user.id);
  return (<div className="mx-auto max-w-3xl"><PageHeader title="Search" subtitle="Results only include what you are allowed to open." />
    <form role="search" className="card mb-4 space-y-3 p-4"><div className="flex gap-2"><label className="sr-only" htmlFor="sq">Search</label><input id="sq" name="q" defaultValue={q} autoFocus className="input" placeholder="Search pages, records, SOPs, tasks…" /><button className="btn-primary">Search</button></div>
      <details open={types.length > 0 || !!sp.ts}><summary className="cursor-pointer text-sm text-brand">Filters</summary><div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Types</legend>{TYPES.map(([k, l]) => <label key={k} className="flex items-center gap-1 rounded border border-line px-2 py-1"><input type="checkbox" name="type" value={k} defaultChecked={types.includes(k)} />{l}</label>)}</fieldset><label>Teamspace <select name="ts" defaultValue={sp.ts || ''} className="input ml-1 inline-block w-auto"><option value="">Any</option>{ts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div></details></form>
    {!q ? <Empty title="Search your workspace" icon="search">Type a client name, a procedure, or a task.</Empty> : hits.length === 0 ? <Empty title={`No results for “${q}”`} icon="search">Check spelling, remove filters, or ask the owner to share the item with you. Results never show content you cannot open.</Empty> :
      <><p className="mb-2 text-sm text-muted" role="status">{hits.length} result{hits.length === 1 ? '' : 's'}</p><ul className="card divide-y divide-line">{hits.map(h => <li key={h.type + h.id}><Link href={h.href} className="block px-4 py-3 hover:bg-bg"><span className="flex items-center gap-2"><Badge tone={h.type === 'sop' ? 'brand' : 'neutral'}>{h.type}</Badge><span className="font-medium">{h.title}</span>{h.where && <span className="text-xs text-muted">in {h.where}</span>}{h.updated && <span className="ml-auto text-xs text-muted">{ago(h.updated)}</span>}</span>{h.snippet && <span className="mt-0.5 block text-sm text-muted">{h.snippet}</span>}</Link></li>)}</ul></>}</div>);
}
