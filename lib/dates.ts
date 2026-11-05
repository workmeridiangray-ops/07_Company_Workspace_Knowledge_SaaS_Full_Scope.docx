/** Date helpers evaluated in a workspace time zone. Dates are plain 'YYYY-MM-DD' strings so they never shift with the viewer's zone. */
export function todayIn(tz: string, at = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  return p; // en-CA yields YYYY-MM-DD
}
export function addDays(d: string, n: number): string { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last)); return t.toISOString().slice(0, 10);
}
export const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();
export type Recur = { every: 'day' | 'weekday' | 'week' | 'month'; interval?: number } | null;
/** Next due date for a recurring task, anchored to the previous due date (not completion time) and never in the past relative to today in the workspace zone. */
export function nextDue(prev: string, r: NonNullable<Recur>, today: string): string {
  const n = Math.max(1, r.interval || 1); let d = prev;
  const step = (x: string) => r.every === 'day' ? addDays(x, n) : r.every === 'week' ? addDays(x, 7 * n) : r.every === 'month' ? addMonths(x, n) : (() => { let y = addDays(x, 1); while (dow(y) === 0 || dow(y) === 6) y = addDays(y, 1); return y; })();
  d = step(d); let guard = 0; while (d <= today && guard++ < 400) d = step(d); return d;
}
export const monthGrid = (ym: string) => {
  const [y, m] = ym.split('-').map(Number); const first = `${ym}-01`; const start = addDays(first, -dow(first)); const days: string[] = []; for (let i = 0; i < 42; i++) days.push(addDays(start, i)); return { days, month: m, year: y };
};

/** Convert a wall-clock date+time in a time zone to a UTC ISO string. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); const guess = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value])); const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return new Date(guess - (asUtc - guess)).toISOString();
}
export function utcToZoned(iso: string, tz: string) { const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }; }
