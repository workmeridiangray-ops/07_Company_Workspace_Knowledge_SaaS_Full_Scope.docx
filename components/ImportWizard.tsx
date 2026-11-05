'use client';
import { useActionState } from 'react';
import { previewImportAction, commitImportAction } from '@/lib/data-actions';
import { Submit } from './ActionForm';

export function ImportWizard({ slug, dbId, props }: { slug: string; dbId: string; props: { id: string; name: string }[] }) {
  const [pv, pvAction] = useActionState(previewImportAction.bind(null, slug, dbId), null);
  const [cm, cmAction] = useActionState(commitImportAction.bind(null, slug, dbId), null);
  const d = pv?.data as any;
  return (
    <div className="space-y-5">
      <form action={pvAction} className="card space-y-3 p-5">
        <h2 className="font-semibold">1. Choose a CSV file</h2>
        <div><label className="label" htmlFor="file">CSV file (first row = column names, up to 5,000 rows)</label><input id="file" type="file" name="file" accept=".csv,text/csv" className="input py-1.5" /></div>
        <div><label className="label" htmlFor="csv">…or paste CSV text</label><textarea id="csv" name="csv" rows={4} className="input font-mono text-xs" placeholder={'Name,Status\nAcme,Active'} /></div>
        {d?.header && <div><p className="label">Column mapping</p><div className="grid gap-2 sm:grid-cols-2">{d.header.map((h: string) => (<label key={h} className="text-sm">{h}<select name={`map_${h}`} className="input mt-1" defaultValue={d.mapping[h]}><option value="">Skip this column</option>{props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>))}</div></div>}
        <Submit variant="secondary">{d ? 'Update preview' : 'Preview import'}</Submit>
        {pv?.error && <p role="alert" className="text-sm text-bad">{pv.error}</p>}
      </form>
      {d?.preview && (
        <form action={cmAction} className="card space-y-3 p-5">
          <h2 className="font-semibold">2. Review and import</h2>
          <input type="hidden" name="csv" value={d.csv} /><input type="hidden" name="mapping" value={JSON.stringify(d.mapping)} />
          <ul className="text-sm"><li><strong>{d.preview.ok}</strong> rows ready to import</li><li><strong>{d.preview.dup}</strong> possible duplicates (same title as an existing or earlier row)</li><li className={d.preview.err.length ? 'text-bad' : ''}><strong>{d.preview.err.length}</strong> rows with errors</li></ul>
          {d.preview.err.length > 0 && <ul className="rounded-lg bg-badSoft p-3 text-sm" role="alert">{d.preview.err.map((e: any) => <li key={e.line}>Line {e.line}: {e.error}</li>)}<li className="mt-1 font-medium">Fix these in your file and preview again - nothing is imported until every row is valid.</li></ul>}
          <fieldset><legend className="label">Duplicates</legend><label className="mr-4 text-sm"><input type="radio" name="dups" value="skip" defaultChecked className="mr-1" />Skip duplicates</label><label className="text-sm"><input type="radio" name="dups" value="import" className="mr-1" />Import them anyway</label></fieldset>
          <Submit>Import {d.preview.ok} rows</Submit>
          {cm?.error && <p role="alert" className="text-sm text-bad">{cm.error}</p>}
          <p className="hint">Importing the same file twice is detected and will not add rows again.</p>
        </form>)}
    </div>
  );
}
