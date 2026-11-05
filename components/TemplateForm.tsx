import { ActionForm, Submit } from './ActionForm';
import { saveTemplateAction } from '@/lib/meet-actions';
const PREFIX: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ', bullet: '- ', number: '1. ', todo: '- [ ] ', quote: '> ' };
export function TemplateForm({ slug, template }: { slug: string; template?: { id: string; name: string; kind: string; description: string; payload: any } }) {
  const p = template?.payload || {}; const body = (p.body || []).map((b: any) => (PREFIX[b.type] || '') + (b.text || '')).join('\n');
  return (
    <ActionForm action={saveTemplateAction.bind(null, slug, template?.id || null)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3"><div className="sm:col-span-2"><label className="label" htmlFor="tn">Template name</label><input id="tn" name="name" defaultValue={template?.name} className="input" required /></div>
        <div><label className="label" htmlFor="tk">Type</label>{template ? <><input id="tk" value={template.kind} disabled className="input bg-bg" /><input type="hidden" name="kind" value={template.kind} /></> : <select id="tk" name="kind" className="input">{['page', 'database', 'meeting'].map(k => <option key={k} value={k}>{k}</option>)}</select>}</div></div>
      <div><label className="label" htmlFor="td">Description</label><input id="td" name="description" defaultValue={template?.description} className="input" /></div>
      <div><label className="label" htmlFor="tti">Default title</label><input id="tti" name="title" defaultValue={p.title || p.name} className="input" /></div>
      <div><label className="label" htmlFor="tb">Content (Markdown-style: # heading, - bullet, 1. step, - [ ] task)</label><textarea id="tb" name="body" rows={8} defaultValue={body} className="input font-mono text-sm" /></div>
      <div><label className="label" htmlFor="ta">Meeting agenda (one per line, meeting templates)</label><textarea id="ta" name="agenda" rows={3} defaultValue={(p.agenda || []).join('\n')} className="input" /></div>
      <div><label className="label" htmlFor="tp">Database properties JSON (database templates)</label><textarea id="tp" name="props" rows={4} defaultValue={template?.kind === 'database' ? JSON.stringify(p.props || [], null, 1) : ''} className="input font-mono text-xs" placeholder='[{"id":"name","name":"Name","type":"text","title":true}]' /></div>
      <Submit>{template ? 'Save as new version' : 'Create template'}</Submit>
    </ActionForm>
  );
}
