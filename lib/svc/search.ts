import { all, one, J } from '../db';
import type { Ctx } from '../ctx';
import { pageLevel, dbLevel, recordLevel, atLeast } from '../access';
import { blocksText } from '../blocks';
import { dbProps, titleProp } from './data';

export interface Hit { type: 'page' | 'sop' | 'meeting' | 'record' | 'database' | 'task'; id: string; title: string; snippet: string; where?: string; href: string; updated?: string; score: number }
const esc = (s: string) => s.replace(/\s+/g, ' ').trim();
function snippet(text: string, terms: string[]) {
  const low = text.toLowerCase(); let at = -1; for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return esc(text.slice(0, 140)); const s = Math.max(0, at - 50); return (s > 0 ? '…' : '') + esc(text.slice(s, s + 160)) + (s + 160 < text.length ? '…' : '');
}
/** Query-time access checks: every candidate is filtered through the same resolver used to open it, so restricted content never appears. */
export function search(c: Ctx, q: string, o: { types?: string[]; teamspace?: string; limit?: number } = {}): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 0).slice(0, 6); if (!terms.length) return [];
  const want = (t: string) => !o.types?.length || o.types.includes(t); const hits: Hit[] = []; const base = `/w/${c.ws.slug}`;
  const score = (title: string, text: string) => { const tl = title.toLowerCase(); const hay = (title + ' ' + text).toLowerCase(); if (!terms.every(t => hay.includes(t))) return 0; return terms.reduce((s, t) => s + (tl.includes(t) ? 10 : 1) + (tl.startsWith(t) ? 5 : 0), 0); };
  if (want('page') || want('sop') || want('meeting')) {
    for (const p of all<any>('SELECT * FROM pages WHERE ws=? AND deleted_at IS NULL AND record_id IS NULL', c.ws.id)) {
      const type = p.kind === 'sop' ? 'sop' : p.kind === 'meeting' ? 'meeting' : 'page'; if (!want(type)) continue; if (o.teamspace && p.teamspace_id !== o.teamspace) continue;
      const text = blocksText(J(p.body, [])); const sc = score(p.title, text); if (!sc) continue; if (pageLevel(c, p) === 'none') continue;
      const ts = p.teamspace_id ? one<any>('SELECT name FROM teamspaces WHERE id=?', p.teamspace_id)?.name : undefined;
      hits.push({ type, id: p.id, title: p.title, snippet: snippet(text, terms), where: ts, href: type === 'sop' ? `${base}/knowledge/${one<any>('SELECT id FROM sops WHERE page_id=?', p.id)?.id ?? ''}` : `${base}/pages/${p.id}`, updated: p.updated_at, score: sc });
    }
  }
  if (want('database') || want('record')) {
    for (const d of all<any>('SELECT * FROM databases WHERE ws=? AND archived=0', c.ws.id)) {
      if (o.teamspace && d.teamspace_id !== o.teamspace) continue; const dl = dbLevel(c, d); const props = dbProps(d);
      if (want('database') && dl !== 'none') { const sc = score(d.name, ''); if (sc) hits.push({ type: 'database', id: d.id, title: d.name, snippet: `${props.length} properties`, href: `${base}/databases/${d.id}`, score: sc }); }
      if (want('record')) { const tp = titleProp(props); for (const r of all<any>('SELECT * FROM records WHERE ws=? AND db_id=? AND deleted_at IS NULL AND archived=0', c.ws.id, d.id)) {
        const data = J<any>(r.data, {}); const title = String(data[tp.id] ?? 'Untitled'); const text = props.filter(p => ['text', 'url', 'number'].includes(p.type) && p.id !== tp.id).map(p => String(data[p.id] ?? '')).join(' '); const sc = score(title, text); if (!sc) continue;
        if (!atLeast(recordLevel(c, r, d), 'view')) continue; hits.push({ type: 'record', id: r.id, title, snippet: snippet(text, terms), where: d.name, href: `${base}/records/${r.id}`, updated: r.updated_at, score: sc }); } }
    }
  }
  if (want('task') && !c.isGuest) for (const t of all<any>(`SELECT * FROM tasks WHERE ws=? AND deleted_at IS NULL`, c.ws.id)) { const sc = score(t.title, t.blocked_reason || ''); if (sc) hits.push({ type: 'task', id: t.id, title: t.title, snippet: t.status, href: `${base}/tasks?open=${t.id}&tab=all`, score: sc }); }
  return hits.sort((a, b) => b.score - a.score || String(b.updated).localeCompare(String(a.updated))).slice(0, o.limit ?? 50);
}
