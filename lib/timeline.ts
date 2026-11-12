import { addDays } from './dates';
export interface TLItem { id: string; title: string; start: string | null; end: string | null }
const diff = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
/** Place items on a window of `days` days starting at `from`. Items outside the window are reported, never silently dropped. */
export function layoutTimeline(items: TLItem[], from: string, days: number) {
  const to = addDays(from, days - 1); const placed: { id: string; title: string; left: number; width: number; start: string; end: string; clippedL: boolean; clippedR: boolean }[] = []; const undated: TLItem[] = []; const outside: TLItem[] = [];
  for (const it of items) {
    const s = it.start || it.end; if (!s) { undated.push(it); continue; } let e = it.end || it.start || s; if (e < s) e = s;
    if (e < from || s > to) { outside.push(it); continue; }
    const cs = s < from ? from : s, ce = e > to ? to : e; placed.push({ id: it.id, title: it.title, start: s, end: e, left: (diff(from, cs) / days) * 100, width: Math.max(((diff(cs, ce) + 1) / days) * 100, 1.2), clippedL: s < from, clippedR: e > to });
  }
  return { placed, undated, outside, from, to };
}
/** Default window: starts at the earliest dated item (or today) rounded back to the week. */
export function defaultFrom(items: TLItem[], today: string) {
  const ds = items.flatMap(i => [i.start, i.end]).filter(Boolean) as string[]; const first = ds.length ? ds.sort()[0] : today; const d = new Date(first + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10);
}
/** One label per week (never overlapping); the month is named on the first label of each month. */
export function ticks(from: string, days: number) {
  const out: { left: number; label: string; major: boolean }[] = []; let lastMonth = -1; const every = days > 100 ? 14 : 7;
  for (let i = 0; i < days; i += every) { const dt = new Date(addDays(from, i) + 'T00:00:00Z'); const m = dt.getUTCMonth(); const first = m !== lastMonth; lastMonth = m;
    out.push({ left: (i / days) * 100, label: first ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : String(dt.getUTCDate()), major: first }); }
  return out;
}
