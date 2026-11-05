import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { getPage } from '@/lib/access';
import { PageHeader, Empty, Table, fmtDateTime } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { deleteFileAction } from '@/lib/ws-actions';
import { usage, currentPlan } from '@/lib/billing';
export const metadata: Metadata = { title: 'Files' };
export const dynamic = 'force-dynamic';
export default async function Files({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const u = usage(c.ws.id); const lim = currentPlan(c.ws.id)?.limits;
  const rows = all<any>(`SELECT f.id,f.name,f.mime,f.size,f.owner,f.page_id,f.created_at,u.name AS owner_name FROM files f LEFT JOIN users u ON u.id=f.owner WHERE f.ws=? AND f.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 300`, c.ws.id).filter(f => f.page_id ? !!getPage(c, f.page_id, 'view') : f.owner === c.user.id);
  const pct = lim ? Math.min(100, Math.round((u.storage_mb / lim.storage_mb) * 100)) : 0;
  return (<div><PageHeader title="Attachment library" subtitle="Files you can access. A file stays available only while its page is accessible to the viewer." />
    <div className="card mb-4 p-4"><p className="text-sm">Storage: <strong>{u.storage_mb} MB</strong>{lim ? ` of ${lim.storage_mb >= 1024 ? lim.storage_mb / 1024 + ' GB' : lim.storage_mb + ' MB'}` : ''}</p><div className="mt-2 h-2 rounded-full bg-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used"><div className={`h-2 rounded-full ${pct > 90 ? 'bg-bad' : 'bg-brand'}`} style={{ width: `${pct}%` }} /></div></div>
    {rows.length === 0 ? <Empty title="No files yet" icon="box">Upload files from the page editor with the Attachment or Image block.</Empty> : <Table head={['Name', 'Type', 'Size', 'Page', 'Uploaded', '']} caption="Files">{rows.map(f => { const pg = f.page_id ? one<any>('SELECT title FROM pages WHERE id=?', f.page_id) : null; return (<tr key={f.id}><td className="td font-medium"><a className="link" href={`/api/w/${slug}/files/${f.id}`}>{f.name}</a></td><td className="td">{f.mime.split('/')[1]}</td><td className="td tabular-nums">{f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.ceil(f.size / 1024) + ' KB'}</td><td className="td">{pg ? <Link className="link" href={`/w/${slug}/pages/${f.page_id}`}>{pg.title}</Link> : '-'}</td><td className="td">{f.owner_name} · {fmtDateTime(f.created_at, c.ws.timezone)}</td><td className="td text-right">{(f.owner === c.user.id || c.perms.has('content.delete')) && <ActionButton action={deleteFileAction.bind(null, slug, f.id)} small variant="ghost" confirm="Delete this file? Pages that show it will lose the attachment.">Delete</ActionButton>}</td></tr>); })}</Table>}</div>);
}
