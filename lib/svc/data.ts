// Structured databases: properties, validation, records, relations, lookups, views, import.
import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { getDb, getRecord, dbLevel, recordLevel, atLeast, type Level } from '../access';
import { entitlementBlock } from '../billing';
import { audit } from '../audit';
import { emit, notify } from './core';
import { sha } from '../security';

export const PROP_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'people', 'checkbox', 'url', 'files', 'relation', 'lookup', 'rollup'] as const;
export type PropType = (typeof PROP_TYPES)[number];
export interface Opt { id: string; name: string; color?: string }
export interface Prop { id: string; name: string; type: PropType; options?: Opt[]; relDb?: string; relProp?: string; lookupProp?: string; agg?: 'count' | 'sum' | 'min' | 'max' | 'avg'; required?: boolean; title?: boolean }
export interface ViewCfg { startProp?: string; endProp?: string; filters?: { prop: string; op: string; value?: any }[]; sorts?: { prop: string; dir: 'asc' | 'desc' }[]; group?: string; hidden?: string[]; density?: 'compact' | 'comfortable'; dateProp?: string }
export const COMPUTED: PropType[] = ['lookup', 'rollup'];
export const OPS: Record<string, [string, string][]> = {
  text: [['contains', 'contains'], ['eq', 'is'], ['neq', 'is not'], ['empty', 'is empty'], ['notempty', 'is not empty']], url: [['contains', 'contains'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  number: [['eq', '='], ['gt', '>'], ['lt', '<'], ['empty', 'is empty'], ['notempty', 'is not empty']], date: [['eq', 'is'], ['before', 'before'], ['after', 'after'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  select: [['eq', 'is'], ['neq', 'is not'], ['empty', 'is empty'], ['notempty', 'is not empty']], multiselect: [['has', 'has'], ['empty', 'is empty'], ['notempty', 'is not empty']], people: [['eq', 'is'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  checkbox: [['eq', 'is']], relation: [['has', 'links to'], ['empty', 'is empty'], ['notempty', 'is not empty']], files: [['empty', 'has none'], ['notempty', 'has files']], lookup: [['contains', 'contains']], rollup: [['eq', '='], ['gt', '>'], ['lt', '<']],
};
const rid = () => Math.random().toString(36).slice(2, 9);
export const titleProp = (props: Prop[]) => props.find(p => p.title) || props[0];
export const dbProps = (d: any) => J<Prop[]>(d.props, []);

// ---------- schema ----------
export function createDatabase(c: Ctx, name: string, props?: Prop[], teamspaceId?: string | null, visibility = 'workspace') {
  assertCan(c, 'schema.manage'); writableWorkspace(c); const block = entitlementBlock(c.ws.id, 'databases'); if (block) throw new Invalid(block);
  if (!name.trim()) throw new Invalid('Give the database a name.');
  const dbId = id('db_'); const P = props?.length ? props : [{ id: 'name', name: 'Name', type: 'text' as PropType, title: true }];
  if (!P.some(p => p.title)) P[0].title = true;
  if (teamspaceId && !one('SELECT 1 FROM teamspaces WHERE id=? AND ws=?', teamspaceId, c.ws.id)) throw new Invalid('Unknown teamspace.');
  tx(() => { insert('databases', { id: dbId, ws: c.ws.id, teamspace_id: teamspaceId ?? null, name: name.trim().slice(0, 80), icon: 'db', props: JSON.stringify(P), visibility, archived: 0, owner: c.user.id, created_at: now() });
    insert('views', { id: id('vw_'), ws: c.ws.id, db_id: dbId, name: 'All records', type: 'table', config: '{}', shared: 1, owner: c.user.id, created_at: now() }); });
  audit(c, 'database.created', 'database', dbId, {}); return dbId;
}
function usedBy(c: Ctx, d: any, propId: string): string[] {
  const out: string[] = [];
  for (const v of all<any>('SELECT * FROM views WHERE db_id=? AND ws=?', d.id, c.ws.id)) { const cfg = J<ViewCfg>(v.config, {}); if (cfg.filters?.some(f => f.prop === propId) || cfg.sorts?.some(s => s.prop === propId) || cfg.group === propId || cfg.dateProp === propId) out.push(`view "${v.name}"`); }
  for (const o of all<any>('SELECT * FROM databases WHERE ws=? AND archived=0', c.ws.id)) for (const p of dbProps(o)) {
    if (p.type === 'relation' && p.relDb === d.id && o.id !== d.id && false) out.push('');
    if ((p.type === 'lookup' || p.type === 'rollup') && p.relProp) { const rel = dbProps(o).find(x => x.id === p.relProp); if (rel?.relDb === d.id && p.lookupProp === propId) out.push(`${p.type} "${p.name}" in "${o.name}"`); }
  }
  for (const p of dbProps(d)) if ((p.type === 'lookup' || p.type === 'rollup') && p.relProp === propId) out.push(`${p.type} "${p.name}"`);
  for (const f of all<any>('SELECT name,fields FROM forms WHERE db_id=? AND ws=?', d.id, c.ws.id)) if (J<any[]>(f.fields, []).some(x => x.prop === propId)) out.push(`form "${f.name}"`);
  for (const a of all<any>('SELECT name,conditions,actions FROM automations WHERE ws=?', c.ws.id)) if ((a.conditions + a.actions).includes(`"${propId}"`)) out.push(`automation "${a.name}"`);
  return out;
}
export function addProp(c: Ctx, dbId: string, p: Partial<Prop>) {
  assertCan(c, 'schema.manage'); writableWorkspace(c); const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('schema.manage');
  const props = dbProps(g.db); const name = (p.name || '').trim(); if (!name) throw new Invalid('Name the property.'); if (props.some(x => x.name.toLowerCase() === name.toLowerCase())) throw new Invalid('A property with that name already exists.');
  if (props.length >= 40) throw new Invalid('A database can have at most 40 properties.');
  if (!PROP_TYPES.includes(p.type as PropType)) throw new Invalid('Choose a property type.');
  const np: Prop = { id: 'p_' + rid(), name: name.slice(0, 60), type: p.type as PropType, required: !!p.required };
  if (np.type === 'select' || np.type === 'multiselect') np.options = (p.options || []).map(o => ({ id: o.id || rid(), name: o.name.trim().slice(0, 40) })).filter(o => o.name);
  if (np.type === 'relation') { if (!p.relDb) throw new Invalid('Choose which database to link to.'); const t = getDb(c, p.relDb, 'view'); if (!t) throw new Invalid('You cannot link to that database.'); np.relDb = p.relDb; }
  if (np.type === 'lookup' || np.type === 'rollup') {
    const rel = props.find(x => x.id === p.relProp && x.type === 'relation'); if (!rel) throw new Invalid('Choose a relation property first.');
    const tgt = one<any>('SELECT * FROM databases WHERE id=? AND ws=?', rel.relDb, c.ws.id); const tp = tgt && dbProps(tgt).find(x => x.id === p.lookupProp); if (!tp || COMPUTED.includes(tp.type)) throw new Invalid('Choose a property from the linked database.');
    np.relProp = rel.id; np.lookupProp = tp.id; if (np.type === 'rollup') { np.agg = (p.agg as any) || 'count'; if (np.agg !== 'count' && tp.type !== 'number') throw new Invalid('Sum, average, min and max need a number property.'); }
  }
  props.push(np); run('UPDATE databases SET props=? WHERE id=? AND ws=?', JSON.stringify(props), dbId, c.ws.id); audit(c, 'database.property_added', 'database', dbId, { prop: np.id, type: np.type }); return np.id;
}
export function updateProp(c: Ctx, dbId: string, propId: string, patch: { name?: string; type?: string; options?: Opt[]; required?: boolean }) {
  assertCan(c, 'schema.manage'); writableWorkspace(c); const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('schema.manage');
  const props = dbProps(g.db); const p = props.find(x => x.id === propId); if (!p) throw new Invalid('Property not found.');
  if (patch.name !== undefined) { const n = patch.name.trim(); if (!n) throw new Invalid('Name the property.'); if (props.some(x => x.id !== propId && x.name.toLowerCase() === n.toLowerCase())) throw new Invalid('A property with that name already exists.'); p.name = n.slice(0, 60); }
  if (patch.type && patch.type !== p.type) {
    if (p.title) throw new Invalid('The title property must stay text.');
    const u = usedBy(c, g.db, propId); if (u.length) throw new Invalid(`Cannot change the type because it is used by ${u.join(', ')}. Remove those first.`);
    const compat: Record<string, string[]> = { text: ['url', 'select'], url: ['text'], select: ['text', 'multiselect'], multiselect: ['text'], number: ['text'], checkbox: ['text'], date: ['text'] };
    if (!(compat[p.type] || []).includes(patch.type)) throw new Invalid(`Changing ${p.type} to ${patch.type} could lose data, so it is blocked. Add a new property and copy values instead.`);
    p.type = patch.type as PropType; if (p.type === 'select' && !p.options) p.options = [];
  }
  if (patch.options && (p.type === 'select' || p.type === 'multiselect')) {
    const next = patch.options.map(o => ({ id: o.id || rid(), name: o.name.trim().slice(0, 40) })).filter(o => o.name); const removed = (p.options || []).filter(o => !next.some(n => n.id === o.id));
    for (const o of removed) { const inUse = all<any>('SELECT data FROM records WHERE db_id=? AND ws=? AND deleted_at IS NULL', dbId, c.ws.id).some(r => { const v = J<any>(r.data, {})[propId]; return Array.isArray(v) ? v.includes(o.id) : v === o.id; }); if (inUse) throw new Invalid(`Option "${o.name}" is used by existing records. Change those records first.`); }
    p.options = next;
  }
  if (patch.required !== undefined) p.required = !!patch.required;
  run('UPDATE databases SET props=? WHERE id=? AND ws=?', JSON.stringify(props), dbId, c.ws.id); audit(c, 'database.property_changed', 'database', dbId, { prop: propId });
}
export function deleteProp(c: Ctx, dbId: string, propId: string) {
  assertCan(c, 'schema.manage'); writableWorkspace(c); const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('schema.manage');
  const props = dbProps(g.db); const p = props.find(x => x.id === propId); if (!p) return; if (p.title) throw new Invalid('The title property cannot be deleted.');
  const u = usedBy(c, g.db, propId); if (u.length) throw new Invalid(`Cannot delete "${p.name}" because it is used by ${u.join(', ')}. Remove those uses first.`);
  tx(() => { run('UPDATE databases SET props=? WHERE id=? AND ws=?', JSON.stringify(props.filter(x => x.id !== propId)), dbId, c.ws.id);
    for (const r of all<any>('SELECT id,data FROM records WHERE db_id=? AND ws=?', dbId, c.ws.id)) { const d = J<any>(r.data, {}); if (propId in d) { delete d[propId]; run('UPDATE records SET data=? WHERE id=?', JSON.stringify(d), r.id); } } });
  audit(c, 'database.property_deleted', 'database', dbId, { prop: propId });
}
export function archiveDatabase(c: Ctx, dbId: string, v = true) {
  assertCan(c, 'schema.manage'); const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('schema.manage');
  if (v) { const dep = all<any>('SELECT name,props FROM databases WHERE ws=? AND id!=? AND archived=0', c.ws.id, dbId).filter(o => dbProps(o).some(p => p.relDb === dbId)); if (dep.length) throw new Invalid(`Linked from ${dep.map(d => d.name).join(', ')}. Remove those relations first.`); }
  else { const b = entitlementBlock(c.ws.id, 'databases'); if (b) throw new Invalid(b); }
  run('UPDATE databases SET archived=? WHERE id=? AND ws=?', v ? 1 : 0, dbId, c.ws.id); audit(c, v ? 'database.archived' : 'database.unarchived', 'database', dbId, {});
}

// ---------- validation ----------
export function cleanRecord(c: Ctx, props: Prop[], input: Record<string, any>, existing: Record<string, any> = {}) {
  const out: Record<string, any> = { ...existing }; const errors: Record<string, string> = {};
  for (const p of props) {
    if (COMPUTED.includes(p.type)) continue; if (!(p.id in input)) continue; let v = input[p.id];
    const empty = v === '' || v == null || (Array.isArray(v) && v.length === 0);
    if (empty) { if (p.required || p.title) { errors[p.id] = `${p.name} is required.`; continue; } delete out[p.id]; continue; }
    switch (p.type) {
      case 'text': v = String(v).slice(0, 5000); break; case 'url': { v = String(v).trim(); try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { errors[p.id] = `${p.name} must be a link starting with https://`; continue; } break; }
      case 'number': { const n = Number(String(v).replace(/,/g, '')); if (!Number.isFinite(n) || Math.abs(n) > 1e15) { errors[p.id] = `${p.name} must be a number.`; continue; } v = n; break; }
      case 'date': { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(new Date(v + 'T00:00:00Z').getTime())) { errors[p.id] = `${p.name} must be a valid date.`; continue; } break; }
      case 'checkbox': v = v === true || v === 'on' || v === 'true' || v === 1; break;
      case 'select': if (!(p.options || []).some(o => o.id === v)) { errors[p.id] = `Choose a valid ${p.name}.`; continue; } break;
      case 'multiselect': { v = (Array.isArray(v) ? v : [v]).filter(x => (p.options || []).some(o => o.id === x)); if (!v.length) { delete out[p.id]; continue; } break; }
      case 'people': { if (!one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, v)) { errors[p.id] = `${p.name} must be a workspace member.`; continue; } break; }
      case 'relation': { const arr: string[] = (Array.isArray(v) ? v : [v]).slice(0, 50); const okIds: string[] = []; for (const rId of arr) { const g = getRecord(c, rId, 'view'); if (!g || g.db.id !== p.relDb) { errors[p.id] = `${p.name} links to a record you cannot access.`; break; } okIds.push(rId); } if (errors[p.id]) continue; v = okIds; break; }
      case 'files': { v = (Array.isArray(v) ? v : [v]).filter((fid: string) => one('SELECT 1 FROM files WHERE id=? AND ws=? AND deleted_at IS NULL', fid, c.ws.id)); break; }
    }
    out[p.id] = v;
  }
  for (const p of props) if ((p.required || p.title) && !COMPUTED.includes(p.type) && (out[p.id] == null || out[p.id] === '') && !(p.id in errors) && (p.id in input || !Object.keys(existing).length)) errors[p.id] = `${p.name} is required.`;
  return { data: out, errors };
}
export function createRecord(c: Ctx, dbId: string, input: Record<string, any>, opts: { silent?: boolean; owner?: string } = {}) {
  assertCan(c, 'content.create'); writableWorkspace(c); const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('content.edit');
  const props = dbProps(g.db); const { data, errors } = cleanRecord(c, props, input); if (Object.keys(errors).length) throw Object.assign(new Invalid(Object.values(errors)[0]), { fields: errors });
  const rId = id('rc_'); const t = now(); insert('records', { id: rId, ws: c.ws.id, db_id: dbId, data: JSON.stringify(data), body: '[]', owner: opts.owner ?? c.user.id, version: 1, archived: 0, created_at: t, updated_at: t });
  for (const p of props) if (p.type === 'people' && data[p.id]) notify(c.ws.id, data[p.id], 'assignment', 'record', rId, c.user.id);
  if (!opts.silent) { audit(c, 'record.created', 'record', rId, { db: dbId }); emit(c, 'record.created', { id: rId, db_id: dbId, version: 1, data }); }
  return rId;
}
export function updateRecord(c: Ctx, recId: string, input: Record<string, any>, baseVersion?: number) {
  writableWorkspace(c); const g = getRecord(c, recId, 'edit'); if (!g) throw new Forbidden('content.edit'); if (g.record.deleted_at) throw new Invalid('This record is in the trash.');
  if (baseVersion != null && baseVersion !== g.record.version) throw new Invalid('Someone else changed this record while you were editing. Reload to see their changes, then apply yours again.');
  const props = dbProps(g.db); const prev = J<any>(g.record.data, {}); const { data, errors } = cleanRecord(c, props, input, prev); if (Object.keys(errors).length) throw Object.assign(new Invalid(Object.values(errors)[0]), { fields: errors });
  const changed = props.filter(p => JSON.stringify(prev[p.id]) !== JSON.stringify(data[p.id])).map(p => p.id); if (!changed.length) return;
  const nv = g.record.version + 1; run('UPDATE records SET data=?, version=?, updated_at=? WHERE id=? AND ws=? AND version=?', JSON.stringify(data), nv, now(), recId, c.ws.id, g.record.version);
  for (const p of props) if (p.type === 'people' && data[p.id] && data[p.id] !== prev[p.id]) notify(c.ws.id, data[p.id], 'assignment', 'record', recId, c.user.id);
  audit(c, 'record.updated', 'record', recId, { db: g.db.id, fields: changed }); emit(c, 'record.updated', { id: recId, db_id: g.db.id, version: nv, data, changed });
}
export function archiveRecord(c: Ctx, recId: string, v = true) { const g = getRecord(c, recId, 'edit'); if (!g) throw new Forbidden('content.edit'); run('UPDATE records SET archived=? WHERE id=? AND ws=?', v ? 1 : 0, recId, c.ws.id); audit(c, v ? 'record.archived' : 'record.unarchived', 'record', recId, {}); }
export function trashRecord(c: Ctx, recId: string) { assertCan(c, 'content.delete'); const g = getRecord(c, recId, 'edit'); if (!g) throw new Forbidden('content.delete'); run('UPDATE records SET deleted_at=? WHERE id=? AND ws=?', now(), recId, c.ws.id); audit(c, 'record.trashed', 'record', recId, {}); }
/** Restore never resurrects broken links: relation ids pointing at trashed/missing records are removed from this record, and the removal is audited. */
export function restoreRecord(c: Ctx, recId: string) {
  const r = one<any>('SELECT * FROM records WHERE id=? AND ws=?', recId, c.ws.id); if (!r || !r.deleted_at) throw new Invalid('That record is not in the trash.');
  const d = one<any>('SELECT * FROM databases WHERE id=? AND ws=?', r.db_id, c.ws.id); if (!d || dbLevel(c, d) === 'none' || !c.perms.has('content.delete')) throw new Forbidden('content.delete');
  const props = dbProps(d); const data = J<any>(r.data, {}); const dropped: string[] = [];
  for (const p of props) if (p.type === 'relation' && Array.isArray(data[p.id])) { const keep = data[p.id].filter((x: string) => one('SELECT 1 FROM records WHERE id=? AND ws=? AND deleted_at IS NULL', x, c.ws.id)); if (keep.length !== data[p.id].length) { dropped.push(p.id); if (keep.length) data[p.id] = keep; else delete data[p.id]; } }
  run('UPDATE records SET deleted_at=NULL, data=?, updated_at=? WHERE id=? AND ws=?', JSON.stringify(data), now(), recId, c.ws.id); audit(c, 'record.restored', 'record', recId, { droppedRelations: dropped });
  return dropped.length;
}

// ---------- reading ----------
export function visibleRecords(c: Ctx, dbId: string, includeArchived = false) {
  const g = getDb(c, dbId, 'view'); if (!g) return { db: null as any, props: [] as Prop[], rows: [] as any[] };
  const props = dbProps(g.db);
  const rows = all<any>(`SELECT * FROM records WHERE ws=? AND db_id=? AND deleted_at IS NULL ${includeArchived ? '' : 'AND archived=0'} ORDER BY created_at LIMIT 5000`, c.ws.id, dbId).map(r => ({ ...r, d: J<any>(r.data, {}) }));
  return { db: g.db, props, rows };
}
/** Resolve lookups/rollups. Values from records the viewer cannot see are never exposed. */
export function computeValues(c: Ctx, props: Prop[], rows: any[]) {
  const comp = props.filter(p => COMPUTED.includes(p.type)); if (!comp.length) return;
  const cache = new Map<string, { rec: any; allowed: boolean; props: Prop[] } | null>();
  const fetchRec = (rId: string) => { if (cache.has(rId)) return cache.get(rId)!; const r = one<any>('SELECT * FROM records WHERE id=? AND ws=? AND deleted_at IS NULL', rId, c.ws.id); let v = null; if (r) { const d = one<any>('SELECT * FROM databases WHERE id=? AND ws=?', r.db_id, c.ws.id); v = { rec: { ...r, d: J<any>(r.data, {}) }, allowed: !!d && atLeast(recordLevel(c, r, d), 'view'), props: d ? dbProps(d) : [] }; } cache.set(rId, v); return v; };
  for (const row of rows) for (const p of comp) {
    const ids: string[] = row.d[p.relProp!] || []; const vals: any[] = []; let hidden = 0;
    for (const x of ids) { const f = fetchRec(x); if (!f) continue; if (!f.allowed) { hidden++; continue; } vals.push(f.rec.d[p.lookupProp!]); }
    if (p.type === 'lookup') row.d[p.id] = { lookup: vals.filter(v => v != null).map(v => (Array.isArray(v) ? v.join(', ') : String(v))), hidden };
    else { const nums = vals.filter(v => typeof v === 'number'); const agg = p.agg || 'count'; row.d[p.id] = { value: agg === 'count' ? vals.filter(v => v != null && v !== '').length : !nums.length ? null : agg === 'sum' ? nums.reduce((a, b) => a + b, 0) : agg === 'avg' ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : agg === 'min' ? Math.min(...nums) : Math.max(...nums), hidden }; }
  }
}
export function displayValue(c: Ctx, p: Prop, v: any, users: Map<string, string>): string {
  if (v == null || v === '') return '';
  switch (p.type) {
    case 'select': return (p.options || []).find(o => o.id === v)?.name ?? ''; case 'multiselect': return (v as string[]).map(x => (p.options || []).find(o => o.id === x)?.name).filter(Boolean).join(', ');
    case 'people': return users.get(v) ?? 'Former member'; case 'checkbox': return v ? 'Yes' : 'No'; case 'number': return Number(v).toLocaleString('en-IN');
    case 'date': return new Date(v + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    case 'relation': return (v as string[]).map(x => { const r = one<any>('SELECT * FROM records WHERE id=? AND ws=? AND deleted_at IS NULL', x, c.ws.id); if (!r) return 'Deleted record'; const d = one<any>('SELECT * FROM databases WHERE id=?', r.db_id); if (!d || !atLeast(recordLevel(c, r, d), 'view')) return 'Restricted'; const tp = titleProp(dbProps(d)); return String(J<any>(r.data, {})[tp.id] ?? 'Untitled'); }).join(', ');
    case 'lookup': return (v.lookup || []).join(', ') + (v.hidden ? ` (+${v.hidden} restricted)` : ''); case 'rollup': return (v.value ?? '') + (v.hidden ? ` (+${v.hidden} restricted)` : '');
    case 'files': return `${(v as string[]).length} file${(v as string[]).length === 1 ? '' : 's'}`; default: return String(v);
  }
}
export function applyView(props: Prop[], rows: any[], cfg: ViewCfg, extraFilters: ViewCfg['filters'] = [], q = '') {
  let out = rows; const get = (r: any, pid: string) => r.d[pid];
  const test = (f: { prop: string; op: string; value?: any }, r: any) => {
    const p = props.find(x => x.id === f.prop); if (!p) return true; const v = get(r, f.prop); const e = v == null || v === '' || (Array.isArray(v) && !v.length);
    switch (f.op) { case 'empty': return e; case 'notempty': return !e; case 'contains': return String(p.type === 'lookup' ? (v?.lookup || []).join(' ') : v ?? '').toLowerCase().includes(String(f.value ?? '').toLowerCase());
      case 'eq': return p.type === 'checkbox' ? !!v === (f.value === true || f.value === 'true' || f.value === 'on') : p.type === 'number' ? Number(v) === Number(f.value) : String(v ?? '') === String(f.value ?? '');
      case 'neq': return String(v ?? '') !== String(f.value ?? ''); case 'gt': return Number(p.type === 'rollup' ? v?.value : v) > Number(f.value); case 'lt': return Number(p.type === 'rollup' ? v?.value : v) < Number(f.value);
      case 'before': return !!v && v < f.value; case 'after': return !!v && v > f.value; case 'has': return Array.isArray(v) && v.includes(f.value); default: return true; }
  };
  for (const f of [...(cfg.filters || []), ...(extraFilters || [])]) out = out.filter(r => test(f, r));
  if (q) { const ql = q.toLowerCase(); const tp = titleProp(props); out = out.filter(r => String(r.d[tp.id] ?? '').toLowerCase().includes(ql)); }
  const sorts = cfg.sorts || [];
  if (sorts.length) out = [...out].sort((a, b) => { for (const s of sorts) { const pa = get(a, s.prop), pb = get(b, s.prop); const va = typeof pa === 'object' && pa && 'value' in pa ? pa.value : pa, vb = typeof pb === 'object' && pb && 'value' in pb ? pb.value : pb; if (va == null && vb == null) continue; if (va == null) return 1; if (vb == null) return -1; const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en', { numeric: true }); if (cmp) return s.dir === 'desc' ? -cmp : cmp; } return 0; });
  return out;
}
export function createView(c: Ctx, dbId: string, name: string, type: string, cfg: ViewCfg, shared: boolean) {
  const g = getDb(c, dbId, 'view'); if (!g) throw new Forbidden('content.view'); if (!['table', 'board', 'calendar', 'list', 'timeline'].includes(type)) throw new Invalid('Unknown view type.');
  if (shared) assertCan(c, 'schema.manage'); else if (!c.perms.has('content.view')) throw new Forbidden('content.view'); writableWorkspace(c);
  const props = dbProps(g.db);
  if (type === 'board' && !cfg.group) { const sel = props.find(p => p.type === 'select'); if (!sel) throw new Invalid('Board views need a select property to group by. Add a Status property first.'); cfg.group = sel.id; }
  if (type === 'calendar' && !cfg.dateProp) { const dp = props.find(p => p.type === 'date'); if (!dp) throw new Invalid('Calendar views need a date property.'); cfg.dateProp = dp.id; }
  if (type === 'timeline') {
    const dps = props.filter(p => p.type === 'date'); if (!dps.length) throw new Invalid('Timeline views need a date property.');
    if (!cfg.startProp || !dps.some(p => p.id === cfg.startProp)) cfg.startProp = dps[0].id; if (cfg.endProp && !dps.some(p => p.id === cfg.endProp)) throw new Invalid('The end date must be a date property.'); if (!cfg.endProp && dps.length > 1) cfg.endProp = dps.find(p => p.id !== cfg.startProp)!.id;
  }
  const vId = id('vw_'); insert('views', { id: vId, ws: c.ws.id, db_id: dbId, name: name.trim().slice(0, 60) || 'Untitled view', type, config: JSON.stringify(cfg), shared: shared ? 1 : 0, owner: c.user.id, created_at: now() }); return vId;
}
export function updateView(c: Ctx, viewId: string, patch: { name?: string; config?: ViewCfg }) {
  const v = one<any>('SELECT * FROM views WHERE id=? AND ws=?', viewId, c.ws.id); if (!v) throw new Invalid('View not found.'); if (!getDb(c, v.db_id, 'view')) throw new Forbidden('content.view');
  if (v.shared ? !c.perms.has('schema.manage') : v.owner !== c.user.id) throw new Forbidden('schema.manage');
  run('UPDATE views SET name=?, config=? WHERE id=? AND ws=?', patch.name?.trim().slice(0, 60) || v.name, JSON.stringify(patch.config ?? J(v.config, {})), viewId, c.ws.id);
}
export function deleteView(c: Ctx, viewId: string) {
  const v = one<any>('SELECT * FROM views WHERE id=? AND ws=?', viewId, c.ws.id); if (!v) return; if (v.shared ? !c.perms.has('schema.manage') : v.owner !== c.user.id) throw new Forbidden('schema.manage');
  if (one('SELECT COUNT(*) n FROM views WHERE db_id=? AND ws=?', v.db_id, c.ws.id)!.n <= 1) throw new Invalid('A database needs at least one view.'); run('DELETE FROM views WHERE id=?', viewId);
}
export function listViews(c: Ctx, dbId: string) { return all<any>('SELECT * FROM views WHERE ws=? AND db_id=? AND (shared=1 OR owner=?) ORDER BY shared DESC, created_at', c.ws.id, dbId, c.user.id); }

// ---------- CSV import ----------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = [], f = '', q = false; const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { cur.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; cur.push(f); f = ''; if (cur.some(x => x !== '') || cur.length > 1) rows.push(cur); cur = []; } else f += ch; }
  if (f !== '' || cur.length) { cur.push(f); rows.push(cur); } return rows;
}
export function csvEscape(v: any): string { const s = v == null ? '' : String(v); const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe; }
export function previewImport(c: Ctx, dbId: string, csv: string, mapping: Record<string, string>, keyProp?: string) {
  const g = getDb(c, dbId, 'edit'); if (!g) throw new Forbidden('content.create'); const props = dbProps(g.db); const rows = parseCsv(csv); if (rows.length < 2) throw new Invalid('The file needs a header row and at least one data row.');
  if (rows.length > 5001) throw new Invalid('Imports are limited to 5,000 rows. Split the file and import in parts.');
  const header = rows[0].map(h => h.trim()); const result: { line: number; data?: Record<string, any>; error?: string; duplicate?: boolean }[] = [];
  const key = keyProp || titleProp(props).id; const existing = new Set(all<any>('SELECT data FROM records WHERE db_id=? AND ws=? AND deleted_at IS NULL', dbId, c.ws.id).map(r => String(J<any>(r.data, {})[key] ?? '').toLowerCase())); const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const input: Record<string, any> = {};
    for (const [col, pid] of Object.entries(mapping)) { if (!pid) continue; const idx = header.indexOf(col); if (idx < 0) continue; const p = props.find(x => x.id === pid); if (!p) continue; let v: any = (r[idx] ?? '').trim();
      if (p.type === 'select') v = v ? (p.options || []).find(o => o.name.toLowerCase() === v.toLowerCase())?.id ?? '__bad:' + v : ''; else if (p.type === 'multiselect') v = v ? v.split(/[;|]/).map((s: string) => (p.options || []).find(o => o.name.toLowerCase() === s.trim().toLowerCase())?.id).filter(Boolean) : '';
      else if (p.type === 'people') v = v ? one<any>(`SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id AND m.ws=? WHERE u.email=? OR u.name=?`, c.ws.id, v.toLowerCase(), v)?.id ?? '__bad:' + v : ''; else if (p.type === 'checkbox') v = /^(true|yes|1|y)$/i.test(v); else if (p.type === 'relation' || p.type === 'files') { continue; }
      if (typeof v === 'string' && v.startsWith('__bad:')) { result.push({ line: i + 2, error: `"${v.slice(6)}" does not match any ${p.name} value.` }); input.__skip = true; break; }
      input[pid] = v; }
    if (input.__skip) return;
    const { data, errors } = cleanRecord(c, props, input); const first = Object.values(errors)[0]; if (first) { result.push({ line: i + 2, error: first }); return; }
    const k = String(data[key] ?? '').toLowerCase(); result.push({ line: i + 2, data, duplicate: !!k && (existing.has(k) || seen.has(k)) }); if (k) seen.add(k);
  });
  return { header, total: rows.length - 1, results: result, ok: result.filter(r => r.data && !r.duplicate).length, errors: result.filter(r => r.error), duplicates: result.filter(r => r.duplicate) };
}
export function commitImport(c: Ctx, dbId: string, csv: string, mapping: Record<string, string>, opts: { keyProp?: string; duplicates: 'skip' | 'import'; filename: string }) {
  assertCan(c, 'integrations.manage'); writableWorkspace(c);
  const batchKey = sha(`${c.ws.id}|${dbId}|${csv}|${JSON.stringify(mapping)}`);
  if (one('SELECT 1 FROM imports WHERE batch_key=?', batchKey)) throw new Invalid('This exact file was already imported into this database. Nothing was added twice.');
  const pv = previewImport(c, dbId, csv, mapping, opts.keyProp); if (pv.errors.length) throw new Invalid(`${pv.errors.length} row(s) have errors (first: line ${pv.errors[0].line} - ${pv.errors[0].error}). Fix the file and upload again; nothing was imported.`);
  const toAdd = pv.results.filter(r => r.data && (opts.duplicates === 'import' || !r.duplicate)); if (!toAdd.length) throw new Invalid('There is nothing new to import.');
  tx(() => { for (const r of toAdd) createRecord(c, dbId, r.data!, { silent: true }); insert('imports', { id: id('im_'), ws: c.ws.id, db_id: dbId, filename: opts.filename.slice(0, 120), status: 'done', total: pv.total, ok: toAdd.length, errors: '[]', batch_key: batchKey, by_user: c.user.id, created_at: now() }); });
  audit(c, 'import.completed', 'database', dbId, { rows: toAdd.length, skippedDuplicates: pv.duplicates.length && opts.duplicates === 'skip' ? pv.duplicates.length : 0 }); return toAdd.length;
}
export function exportCsv(c: Ctx, dbId: string): string {
  assertCan(c, 'content.export'); const { db, props, rows } = visibleRecords(c, dbId, true); if (!db) throw new Forbidden('content.view'); computeValues(c, props, rows);
  const users = new Map(all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=?`, c.ws.id).map(u => [u.id, u.name]));
  const lines = [props.map(p => csvEscape(p.name)).join(',')]; for (const r of rows) lines.push(props.map(p => csvEscape(displayValue(c, p, r.d[p.id], users))).join(','));
  audit(c, 'export.csv', 'database', dbId, { rows: rows.length }); return lines.join('\n');
}
export function findDuplicates(c: Ctx, dbId: string) {
  const { props, rows } = visibleRecords(c, dbId); const tp = titleProp(props); const by = new Map<string, any[]>();
  for (const r of rows) { const k = String(r.d[tp.id] ?? '').trim().toLowerCase(); if (k) (by.get(k) || by.set(k, []).get(k)!).push(r); }
  return [...by.values()].filter(g => g.length > 1);
}
export function mergeDuplicates(c: Ctx, keepId: string, dropIds: string[]) {
  assertCan(c, 'content.delete'); const keep = getRecord(c, keepId, 'edit'); if (!keep) throw new Forbidden('content.edit');
  tx(() => { const kd = J<any>(keep.record.data, {});
    for (const dId of dropIds) { const d = getRecord(c, dId, 'edit'); if (!d || d.db.id !== keep.db.id || dId === keepId) continue; const dd = J<any>(d.record.data, {}); for (const [k, v] of Object.entries(dd)) if (kd[k] == null || kd[k] === '') kd[k] = v;
      // re-point relations that referenced the dropped record
      for (const o of all<any>('SELECT * FROM databases WHERE ws=?', c.ws.id)) for (const p of dbProps(o).filter(p => p.type === 'relation' && p.relDb === keep.db.id)) for (const r of all<any>('SELECT id,data FROM records WHERE db_id=? AND ws=?', o.id, c.ws.id)) { const rd = J<any>(r.data, {}); if (Array.isArray(rd[p.id]) && rd[p.id].includes(dId)) { rd[p.id] = [...new Set(rd[p.id].map((x: string) => (x === dId ? keepId : x)))]; run('UPDATE records SET data=? WHERE id=?', JSON.stringify(rd), r.id); } }
      run('UPDATE records SET deleted_at=? WHERE id=?', now(), dId); run('UPDATE tasks SET record_id=? WHERE record_id=? AND ws=?', keepId, dId, c.ws.id); }
    run('UPDATE records SET data=?, version=version+1, updated_at=? WHERE id=?', JSON.stringify(kd), now(), keepId); });
  audit(c, 'record.merged', 'record', keepId, { merged: dropIds.length });
}
