import { ActionForm, Submit } from './ActionForm';
import { saveFormAction } from '@/lib/auto-actions';
import { dbProps, COMPUTED } from '@/lib/svc/data';
export function FormBuilder({ slug, dbs, form }: { slug: string; dbs: any[]; form?: any }) {
  const sel = form ? dbs.find(d => d.id === form.db_id) : dbs[0]; const fields: any[] = form ? JSON.parse(form.fields) : [];
  return (
    <ActionForm action={saveFormAction.bind(null, slug, form?.id || null)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="fn">Form name</label><input id="fn" name="name" defaultValue={form?.name} className="input" required /></div>
        <div><label className="label" htmlFor="fdb">Writes to database</label><select id="fdb" name="db" defaultValue={sel?.id} className="input" disabled={!!form}>{dbs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{form && <input type="hidden" name="db" value={form.db_id} />}<p className="hint">{form ? 'The database cannot change after creation.' : 'Pick a database, save, then fine-tune fields.'}</p></div></div>
      {sel && <fieldset className="card divide-y divide-line"><legend className="sr-only">Fields</legend>{dbProps(sel).filter(p => !COMPUTED.includes(p.type) && !['relation', 'files'].includes(p.type)).map(p => { const f = fields.find(x => x.prop === p.id); return (<div key={p.id} className="grid gap-2 p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"><label className="flex items-center gap-2 font-medium"><input type="checkbox" name="field" value={p.id} defaultChecked={form ? !!f : (p.title || p.required)} className="h-4 w-4" />{p.name} <span className="text-xs font-normal text-muted">({p.type})</span></label><div><label className="sr-only" htmlFor={`l-${p.id}`}>Label for {p.name}</label><input id={`l-${p.id}`} name={`label_${p.id}`} defaultValue={f?.label || p.name} className="input min-h-[34px]" /></div><span className="text-xs text-muted">{p.type === 'people' ? 'Not allowed on public forms' : ''}</span><label className="flex items-center gap-1 text-sm"><input type="checkbox" name={`req_${p.id}`} defaultChecked={f?.required || p.title || p.required} />Required</label></div>); })}</fieldset>}
      <div><label className="label" htmlFor="fs">Thank-you message</label><input id="fs" name="success" defaultValue={form?.success_message} className="input" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="public" defaultChecked={!!form?.is_public} className="h-4 w-4" /> Public - anyone with the link can submit, no sign-in. Only text, number, date, select, checkbox and link fields are allowed.</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={form ? !!form.active : true} className="h-4 w-4" /> Accepting submissions</label>
      <Submit>Save form</Submit>
    </ActionForm>
  );
}
