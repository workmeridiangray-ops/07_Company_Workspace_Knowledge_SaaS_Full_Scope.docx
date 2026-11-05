'use client';
import { useActionState } from 'react';
import { submitFormAction } from '@/lib/auto-actions';
import { Submit } from './ActionForm';
export function PublicForm({ token, nonce, fields }: { token: string; nonce: string; fields: { prop: string; label: string; required: boolean; type: string; options: { id: string; name: string }[] }[] }) {
  const [state, action] = useActionState(submitFormAction.bind(null, token), null);
  if (state?.ok && (state.data as any)?.done) return <div role="status" className="card p-6"><h2 className="text-lg font-semibold">Thank you</h2><p className="mt-1">{state.message}</p></div>;
  return (
    <form action={action} className="card space-y-4 p-5">
      {state?.error && <div role="alert" className="rounded-lg border border-bad/40 bg-badSoft px-3 py-2 text-sm">{state.error}</div>}
      <input type="hidden" name="nonce" value={nonce} /><div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {fields.map(f => { const n = 'f_' + f.prop; const req = f.required; const label = <label className="label" htmlFor={n}>{f.label}{req && <span className="text-bad" aria-hidden> *</span>}</label>;
        if (f.type === 'checkbox') return <div key={f.prop}><input type="hidden" name="bool" value={f.prop} /><label className="flex items-center gap-2"><input id={n} name={n} type="checkbox" className="h-4 w-4" required={req} />{f.label}</label></div>;
        if (f.type === 'select') return <div key={f.prop}>{label}<select id={n} name={n} className="input" required={req} defaultValue=""><option value="">Choose…</option>{f.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>;
        if (f.type === 'multiselect') return <fieldset key={f.prop}><legend className="label">{f.label}</legend><input type="hidden" name="multi" value={f.prop} /><div className="flex flex-wrap gap-2">{f.options.map(o => <label key={o.id} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-sm"><input type="checkbox" name={n} value={o.id} />{o.name}</label>)}</div></fieldset>;
        return <div key={f.prop}>{label}<input id={n} name={n} className="input" required={req} type={f.type === 'number' ? 'text' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} maxLength={5000} /></div>; })}
      <Submit pendingText="Submitting…">Submit</Submit>
    </form>
  );
}
