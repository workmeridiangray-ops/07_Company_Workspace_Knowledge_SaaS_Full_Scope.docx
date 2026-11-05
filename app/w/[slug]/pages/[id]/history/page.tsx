import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { getPage } from '@/lib/access';
import { listVersions, diffBlocks } from '@/lib/svc/pages';
import { one, J } from '@/lib/db';
import { PageHeader, Table, fmtDateTime, Empty, Badge } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { restoreVersionAction } from '@/lib/page-actions';
export const dynamic = 'force-dynamic';
export default async function History({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { slug, id } = await params; const sp = await searchParams; const c = await requireCtx(slug); const g = getPage(c, id, 'view'); if (!g) notFound();
  const versions = listVersions(c, id); const canRestore = g.level === 'edit' && c.perms.has('content.edit');
  const getBody = (v?: string) => { if (!v || v === 'current') return { title: g.page.title, body: J<any[]>(g.page.body, []) }; const r = one<any>('SELECT title, body FROM page_versions WHERE id=? AND page_id=? AND ws=?', v, id, c.ws.id); return r ? { title: r.title, body: J<any[]>(r.body, []) } : null; };
  const A = sp.a ? getBody(sp.a) : null; const B = sp.b ? getBody(sp.b) : getBody('current');
  const diff = A && B ? diffBlocks(A.body, B.body) : null;
  return (
    <div><PageHeader crumbs={[{ href: `/w/${slug}/pages`, label: 'Pages' }, { href: `/w/${slug}/pages/${id}`, label: g.page.title }, { label: 'History' }]} title="Version history" subtitle="Restoring creates a new version. The audit trail is never rewound." />
      {versions.length === 0 ? <Empty title="No earlier versions yet" icon="history">Versions are saved as people edit.</Empty> : (
        <Table head={['Version', 'Title', 'Saved by', 'When', 'Actions']} caption="Versions">
          <tr className="bg-brandSoft/40"><td className="td font-medium">Current (v{g.page.version})</td><td className="td">{g.page.title}</td><td className="td">-</td><td className="td">{fmtDateTime(g.page.updated_at)}</td><td className="td"><Link className="link" href={`/w/${slug}/pages/${id}`}>Open</Link></td></tr>
          {versions.map(v => (<tr key={v.id}><td className="td">v{v.version} {v.label && <Badge>{v.label}</Badge>}</td><td className="td">{v.title}</td><td className="td">{v.by_name || '-'}</td><td className="td">{fmtDateTime(v.created_at)}</td>
            <td className="td"><span className="flex flex-wrap gap-1"><Link className="btn-secondary btn-sm" href={`/w/${slug}/pages/${id}/history?a=${v.id}&b=current`}>Compare with current</Link>{canRestore && <ActionButton action={restoreVersionAction.bind(null, slug, id, v.id)} small confirm={`Restore version ${v.version}? Your current content is saved as a version first.`}>Restore</ActionButton>}</span></td></tr>))}
        </Table>)}
      {diff && (<section className="card mt-6 p-4" aria-label="Comparison"><h2 className="mb-2 font-semibold">Changes: selected version → current</h2>
        {diff.every(d => d.op === ' ') ? <p className="text-muted">No differences.</p> : <ul className="font-mono text-[13px]">{diff.map((d, i) => <li key={i} className={`whitespace-pre-wrap px-2 py-0.5 ${d.op === '+' ? 'bg-okSoft' : d.op === '-' ? 'bg-badSoft line-through' : ''}`}><span aria-label={d.op === '+' ? 'added' : d.op === '-' ? 'removed' : 'unchanged'} className="mr-2 select-none">{d.op === ' ' ? ' ' : d.op}</span>{d.text || ' '}</li>)}</ul>}</section>)}
    </div>
  );
}
