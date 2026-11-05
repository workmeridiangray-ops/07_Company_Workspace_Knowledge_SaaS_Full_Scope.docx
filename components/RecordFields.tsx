import type { Prop } from '@/lib/svc/data';
import { COMPUTED, displayValue } from '@/lib/svc/data';
import type { Ctx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { getDb, recordLevel, atLeast } from '@/lib/access';
import { titleProp, dbProps } from '@/lib/svc/data';

export function recordOptions(c: Ctx, dbId: string) {
  const d = one<any>('SELECT * FROM databases WHERE id=? AND ws=? AND archived=0', dbId, c.ws.id); if (!d || !getDb(c, dbId, 'view')) return [];
  const tp = titleProp(dbProps(d)); return all<any>('SELECT * FROM records WHERE db_id=? AND ws=? AND deleted_at IS NULL AND archived=0 ORDER BY created_at LIMIT 300', dbId, c.ws.id).filter(r => atLeast(recordLevel(c, r, d), 'view')).map(r => ({ id: r.id, name: String(J<any>(r.data, {})[tp.id] ?? 'Untitled') }));
}
/** Renders an input per property. Names are p_<propId>; hidden has_ markers let unchecked boxes/multi-selects submit as empty. */
export function RecordFields({ c, props, values = {}, errors = {}, only }: { c: Ctx; props: Prop[]; values?: Record<string, any>; errors?: Record<string, string>; only?: string[] }) {
  const members = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active' ORDER BY u.name`, c.ws.id);
  return (<>{props.filter(p => !COMPUTED.includes(p.type) && (!only || only.includes(p.id))).map(p => {
    const n = 'p_' + p.id, v = values[p.id], label = <label className="label" htmlFor={n}>{p.name}{(p.required || p.title) && <span className="text-bad" aria-hidden> *</span>}</label>;
    let input: React.ReactNode;
    switch (p.type) {
      case 'number': input = <input id={n} name={n} inputMode="decimal" defaultValue={v ?? ''} className="input" />; break;
      case 'date': input = <input id={n} name={n} type="date" defaultValue={v ?? ''} className="input" />; break;
      case 'checkbox': input = <label className="flex min-h-[40px] items-center gap-2"><input type="hidden" name={'has_' + n} value="1" /><input id={n} name={n} type="checkbox" defaultChecked={!!v} className="h-4 w-4" /> Yes</label>; break;
      case 'select': input = <select id={n} name={n} defaultValue={v ?? ''} className="input"><option value="">-</option>{(p.options || []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>; break;
      case 'multiselect': input = <fieldset><input type="hidden" name={'has_' + n} value="1" /><div className="flex flex-wrap gap-2">{(p.options || []).map(o => <label key={o.id} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-sm"><input type="checkbox" name={n} value={o.id} defaultChecked={(v || []).includes(o.id)} />{o.name}</label>)}</div></fieldset>; break;
      case 'people': input = <select id={n} name={n} defaultValue={v ?? ''} className="input"><option value="">Unassigned</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>; break;
      case 'relation': { const opts = recordOptions(c, p.relDb!); input = <fieldset><input type="hidden" name={'has_' + n} value="1" /><select id={n} name={n} multiple size={Math.min(5, Math.max(2, opts.length))} defaultValue={v || []} className="input" aria-describedby={n + '-h'}>{opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><p id={n + '-h'} className="hint">Hold Ctrl/⌘ to pick several. Only records you can access are listed.</p></fieldset>; break; }
      case 'files': input = <p className="text-sm text-muted">{(v || []).length} file(s) attached. Upload files from the record page notes.</p>; break;
      case 'url': input = <input id={n} name={n} type="url" placeholder="https://" defaultValue={v ?? ''} className="input" />; break;
      default: input = <input id={n} name={n} defaultValue={v ?? ''} className="input" maxLength={5000} />;
    }
    return <div key={p.id}>{label}{input}{errors[p.id] && <p className="mt-1 text-[13px] text-bad" role="alert">{errors[p.id]}</p>}</div>;
  })}</>);
}
