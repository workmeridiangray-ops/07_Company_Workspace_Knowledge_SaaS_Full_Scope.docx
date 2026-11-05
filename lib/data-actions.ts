'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from './ctx';
import { guard, str, need, UserError } from './action';
import * as D from './svc/data';
import { createPage } from './svc/pages';
import { one, run, J, id } from './db';
import { getRecord } from './access';
import type { ActionResult } from '@/components/ActionForm';

function fdToInput(fd: FormData, props: D.Prop[]) {
  const input: Record<string, any> = {};
  for (const p of props) {
    if (D.COMPUTED.includes(p.type)) continue; const k = 'p_' + p.id;
    if (p.type === 'checkbox') { if (fd.has('has_' + k)) input[p.id] = fd.get(k) === 'on'; }
    else if (p.type === 'multiselect' || p.type === 'relation' || p.type === 'files') { if (fd.has('has_' + k)) input[p.id] = fd.getAll(k).map(String).filter(Boolean); }
    else if (fd.has(k)) input[p.id] = String(fd.get(k) ?? '').trim();
  }
  return input;
}
const fieldErr = (e: any) => (e?.fields ? Object.values(e.fields)[0] : e.message);
export async function createDatabaseAction(slug: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const tpl = str(fd, 'template', 20);
    const status: D.Opt[] = [{ id: 'todo', name: 'To do' }, { id: 'doing', name: 'In progress' }, { id: 'done', name: 'Done' }];
    const presets: Record<string, D.Prop[]> = {
      blank: [{ id: 'name', name: 'Name', type: 'text', title: true }],
      clients: [{ id: 'name', name: 'Client', type: 'text', title: true }, { id: 'status', name: 'Status', type: 'select', options: [{ id: 'lead', name: 'Lead' }, { id: 'active', name: 'Active' }, { id: 'paused', name: 'Paused' }, { id: 'former', name: 'Former' }] }, { id: 'owner', name: 'Account owner', type: 'people' }, { id: 'email', name: 'Contact email', type: 'text' }, { id: 'value', name: 'Annual value (INR)', type: 'number' }, { id: 'since', name: 'Client since', type: 'date' }],
      tracker: [{ id: 'name', name: 'Item', type: 'text', title: true }, { id: 'status', name: 'Status', type: 'select', options: status }, { id: 'owner', name: 'Owner', type: 'people' }, { id: 'due', name: 'Due', type: 'date' }, { id: 'done', name: 'Complete', type: 'checkbox' }],
    };
    const name = need(str(fd, 'name', 80), 'Name the database.'); const dbId = D.createDatabase(c, name, presets[tpl] || presets.blank, str(fd, 'teamspace') || null);
    return { ok: true, redirect: `/w/${slug}/databases/${dbId}` };
  });
}
export async function addPropAction(slug: string, dbId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const type = str(fd, 'type', 20);
    D.addProp(c, dbId, { name: str(fd, 'name', 60), type: type as D.PropType, required: fd.get('required') === 'on', options: str(fd, 'options', 1000).split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ id: '', name })), relDb: str(fd, 'relDb') || undefined, relProp: str(fd, 'relProp') || undefined, lookupProp: str(fd, 'lookupProp') || undefined, agg: (str(fd, 'agg') || undefined) as any });
    revalidatePath(`/w/${slug}/databases/${dbId}`, 'layout'); return { ok: true, message: 'Property added.' };
  });
}
export async function updatePropAction(slug: string, dbId: string, pid: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const g = one<any>('SELECT props FROM databases WHERE id=? AND ws=?', dbId, c.ws.id); const cur = J<D.Prop[]>(g?.props, []).find(p => p.id === pid);
    const patch: any = { name: str(fd, 'name', 60), required: fd.get('required') === 'on' }; if (fd.has('type') && str(fd, 'type') !== cur?.type) patch.type = str(fd, 'type');
    if (fd.has('options')) { const lines = str(fd, 'options', 2000).split('\n').map(s => s.trim()).filter(Boolean); patch.options = lines.map(n => ({ id: (cur?.options || []).find(o => o.name === n)?.id || '', name: n })); }
    D.updateProp(c, dbId, pid, patch); revalidatePath(`/w/${slug}/databases/${dbId}`, 'layout'); return { ok: true, message: 'Property saved.' };
  });
}
export async function deletePropAction(slug: string, dbId: string, pid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); D.deleteProp(c, dbId, pid); revalidatePath(`/w/${slug}/databases/${dbId}`, 'layout'); return { ok: true }; }); }
export async function archiveDbAction(slug: string, dbId: string, v: boolean): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); D.archiveDatabase(c, dbId, v); return { ok: true, redirect: `/w/${slug}/databases` }; }); }
export async function createRecordAction(slug: string, dbId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const g = one<any>('SELECT props FROM databases WHERE id=? AND ws=?', dbId, c.ws.id); const props = J<D.Prop[]>(g?.props, []);
    try { const rid = D.createRecord(c, dbId, fdToInput(fd, props)); revalidatePath(`/w/${slug}/databases/${dbId}`); return fd.get('open') === 'on' ? { ok: true, redirect: `/w/${slug}/records/${rid}` } : { ok: true, message: 'Record added.' }; } catch (e: any) { if (e.fields) throw new UserError(fieldErr(e)); throw e; }
  });
}
export async function updateRecordAction(slug: string, recId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const g = getRecord(c, recId, 'view'); if (!g) throw new UserError('You no longer have access to this record.');
    try { D.updateRecord(c, recId, fdToInput(fd, J<D.Prop[]>(g.db.props, [])), Number(fd.get('version')) || undefined); revalidatePath(`/w/${slug}/records/${recId}`); return { ok: true, message: 'Saved.' }; } catch (e: any) { if (e.fields) throw new UserError(fieldErr(e)); throw e; }
  });
}
/** Board/calendar drag-and-drop. The client shows the exact effect and asks for confirmation before calling this. */
export async function moveRecordAction(slug: string, recId: string, propId: string, value: string | null): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); D.updateRecord(c, recId, { [propId]: value ?? '' }); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true, message: 'Updated.' }; });
}
export async function recordLifecycleAction(slug: string, recId: string, what: 'archive' | 'unarchive' | 'trash' | 'restore'): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); let msg = '';
    if (what === 'archive') D.archiveRecord(c, recId, true); else if (what === 'unarchive') D.archiveRecord(c, recId, false); else if (what === 'trash') D.trashRecord(c, recId); else { const n = D.restoreRecord(c, recId); if (n) msg = `Restored. ${n} link(s) to deleted records were removed.`; }
    revalidatePath(`/w/${slug}`, 'layout'); const r = one<any>('SELECT db_id FROM records WHERE id=?', recId); return what === 'trash' || what === 'archive' ? { ok: true, redirect: `/w/${slug}/databases/${r?.db_id}` } : { ok: true, message: msg || 'Done.' };
  });
}
export async function openRecordPageAction(slug: string, recId: string): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const g = getRecord(c, recId, 'edit'); if (!g) throw new UserError('You need edit access to add notes to this record.');
    let p = one<any>('SELECT id FROM pages WHERE record_id=? AND ws=?', recId, c.ws.id);
    if (!p) { const tp = D.titleProp(J<D.Prop[]>(g.db.props, [])); const pid = createPage(c, { title: String(J<any>(g.record.data, {})[tp.id] ?? 'Record notes'), recordId: recId, visibility: 'workspace' }); p = { id: pid }; }
    return { ok: true, redirect: `/w/${slug}/pages/${p.id}` };
  });
}
export async function saveViewAction(slug: string, dbId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const cfg: D.ViewCfg = { filters: [], sorts: [] };
    for (let i = 0; i < 3; i++) { const prop = str(fd, `fp${i}`), op = str(fd, `fo${i}`); if (prop && op) cfg.filters!.push({ prop, op, value: str(fd, `fv${i}`) }); }
    const sp = str(fd, 'sort'); if (sp) cfg.sorts!.push({ prop: sp, dir: str(fd, 'dir') === 'desc' ? 'desc' : 'asc' }); if (str(fd, 'group')) cfg.group = str(fd, 'group'); if (str(fd, 'dateProp')) cfg.dateProp = str(fd, 'dateProp'); cfg.density = str(fd, 'density') === 'compact' ? 'compact' : 'comfortable'; cfg.hidden = fd.getAll('hidden').map(String);
    const vid = D.createView(c, dbId, need(str(fd, 'name', 60), 'Name the view.'), str(fd, 'type', 10) || 'table', cfg, fd.get('shared') === 'on'); return { ok: true, redirect: `/w/${slug}/databases/${dbId}?view=${vid}` };
  });
}
export async function deleteViewAction(slug: string, dbId: string, vid: string): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); D.deleteView(c, vid); return { ok: true, redirect: `/w/${slug}/databases/${dbId}` }; }); }
export async function previewImportAction(slug: string, dbId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const c = await requireCtx(slug); const file = fd.get('file'); let csv = ''; if (file instanceof File && file.size) { if (file.size > 5_000_000) throw new UserError('CSV files can be up to 5 MB.'); csv = await file.text(); } else csv = String(fd.get('csv') || ''); if (!csv.trim()) throw new UserError('Choose a CSV file or paste CSV text.');
    const header = D.parseCsv(csv)[0]?.map(h => h.trim()) || []; const g = one<any>('SELECT props FROM databases WHERE id=? AND ws=?', dbId, c.ws.id); const props = J<D.Prop[]>(g?.props, []);
    const mapping: Record<string, string> = {}; for (const h of header) { const m = props.find(p => !D.COMPUTED.includes(p.type) && p.type !== 'relation' && p.type !== 'files' && p.name.toLowerCase() === h.toLowerCase()); mapping[h] = String(fd.get('map_' + h) ?? m?.id ?? ''); }
    const pv = D.previewImport(c, dbId, csv, mapping); return { ok: true, message: `Preview: ${pv.total} rows - ${pv.ok} ready, ${pv.duplicates.length} possible duplicates, ${pv.errors.length} with errors.${pv.errors.length ? ' First error: line ' + pv.errors[0].line + ' - ' + pv.errors[0].error : ''}`, data: { csv, mapping, header, preview: { ok: pv.ok, dup: pv.duplicates.length, err: pv.errors.slice(0, 20).map(e => ({ line: e.line, error: e.error })), total: pv.total } } };
  });
}
export async function commitImportAction(slug: string, dbId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => { const c = await requireCtx(slug); const n = D.commitImport(c, dbId, String(fd.get('csv') || ''), J(String(fd.get('mapping') || '{}'), {}), { duplicates: str(fd, 'dups') === 'import' ? 'import' : 'skip', filename: str(fd, 'filename', 100) || 'import.csv' }); return { ok: true, redirect: `/w/${slug}/databases/${dbId}?imported=${n}` }; });
}
export async function mergeAction(slug: string, keep: string, drop: string[]): Promise<ActionResult> { return guard(async () => { const c = await requireCtx(slug); D.mergeDuplicates(c, keep, drop); revalidatePath(`/w/${slug}`, 'layout'); return { ok: true }; }); }
