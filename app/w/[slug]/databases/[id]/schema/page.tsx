import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getDb, visibleDatabases } from '@/lib/access';
import { dbProps, PROP_TYPES, COMPUTED } from '@/lib/svc/data';
import { PageHeader, Card, Badge, Alert } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { addPropAction, updatePropAction, deletePropAction, archiveDbAction } from '@/lib/data-actions';
export const dynamic = 'force-dynamic';
export default async function Schema({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug, 'schema.manage'); const g = getDb(c, id, 'edit'); if (!g) notFound();
  const props = dbProps(g.db); const others = visibleDatabases(c); const rels = props.filter(p => p.type === 'relation');
  const label: Record<string, string> = { text: 'Text', number: 'Number', date: 'Date', select: 'Select', multiselect: 'Multi-select', people: 'Person', checkbox: 'Checkbox', url: 'Link', files: 'Files', relation: 'Relation', lookup: 'Lookup', rollup: 'Rollup (count/sum…)' };
  return (
    <div><PageHeader crumbs={[{ href: `/w/${slug}/databases`, label: 'Databases' }, { href: `/w/${slug}/databases/${id}`, label: g.db.name }, { label: 'Schema' }]} title="Schema" subtitle="Properties used by views, relations, forms or automations are protected from deletion and unsafe type changes." />
      <div className="space-y-3">{props.map(p => (
        <Card key={p.id}><ActionForm action={updatePropAction.bind(null, slug, id, p.id)} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div><label className="label" htmlFor={`n-${p.id}`}>Name {p.title && <Badge tone="brand">Title</Badge>}</label><input id={`n-${p.id}`} name="name" defaultValue={p.name} className="input" required /></div>
          <div><label className="label" htmlFor={`t-${p.id}`}>Type</label>{p.title || COMPUTED.includes(p.type) || ['relation', 'people', 'files'].includes(p.type) ? <input id={`t-${p.id}`} value={label[p.type]} disabled className="input bg-bg" /> : <select id={`t-${p.id}`} name="type" defaultValue={p.type} className="input">{PROP_TYPES.filter(t => !COMPUTED.includes(t) && !['relation', 'people', 'files'].includes(t)).map(t => <option key={t} value={t}>{label[t]}</option>)}</select>}</div>
          <div className="flex items-center gap-2"><Submit variant="secondary" className="btn-sm">Save</Submit>{!p.title && <ActionButton action={deletePropAction.bind(null, slug, id, p.id)} variant="ghost" small confirm={`Delete “${p.name}” and its values from all records?`}>Delete</ActionButton>}</div>
          {(p.type === 'select' || p.type === 'multiselect') && <div className="sm:col-span-3"><label className="label" htmlFor={`o-${p.id}`}>Options (one per line)</label><textarea id={`o-${p.id}`} name="options" rows={3} defaultValue={(p.options || []).map(o => o.name).join('\n')} className="input" /></div>}
          {p.type === 'relation' && <p className="sm:col-span-3 text-sm text-muted">Links to {others.find(d => d.id === p.relDb)?.name ?? 'a database'}.</p>}
          {(p.type === 'lookup' || p.type === 'rollup') && <p className="sm:col-span-3 text-sm text-muted">Computed from a linked database. Values from records you cannot access are never shown.</p>}
          {!p.title && !COMPUTED.includes(p.type) && <label className="sm:col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked={p.required} className="h-4 w-4" /> Required</label>}
        </ActionForm></Card>))}</div>
      <Card title="Add a property" className="mt-6"><ActionForm action={addPropAction.bind(null, slug, id)} className="grid gap-3 sm:grid-cols-3 sm:items-end" resetOnSuccess>
        <div><label className="label" htmlFor="an">Name</label><input id="an" name="name" className="input" required /></div>
        <div><label className="label" htmlFor="at">Type</label><select id="at" name="type" className="input">{PROP_TYPES.map(t => <option key={t} value={t}>{label[t]}</option>)}</select></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="required" className="h-4 w-4" /> Required</label>
        <div className="sm:col-span-3"><label className="label" htmlFor="ao">Options for Select / Multi-select (one per line)</label><textarea id="ao" name="options" rows={2} className="input" /></div>
        <div><label className="label" htmlFor="ar">Relation → database</label><select id="ar" name="relDb" className="input"><option value="">-</option>{others.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label" htmlFor="arp">Lookup/Rollup via relation</label><select id="arp" name="relProp" className="input"><option value="">-</option>{rels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label" htmlFor="alp">…property in linked database</label><select id="alp" name="lookupProp" className="input"><option value="">-</option>{rels.flatMap(r => { const t = others.find(d => d.id === r.relDb); return t ? dbProps(t).filter(p => !COMPUTED.includes(p.type)).map(p => <option key={r.id + p.id} value={p.id}>{r.name} → {p.name}</option>) : []; })}</select></div>
        <div><label className="label" htmlFor="aag">Rollup function</label><select id="aag" name="agg" className="input"><option value="count">Count</option><option value="sum">Sum</option><option value="avg">Average</option><option value="min">Min</option><option value="max">Max</option></select></div>
        <Submit>Add property</Submit></ActionForm></Card>
      <Card title="Archive database" className="mt-6"><p className="mb-3 text-sm text-muted">Archiving hides the database from lists. Records and links are kept. Databases linked from others cannot be archived.</p><ActionButton action={archiveDbAction.bind(null, slug, id, true)} variant="danger" confirm="Archive this database?">Archive database</ActionButton></Card>
    </div>
  );
}
