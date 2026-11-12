import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePlatform } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { PageHeader, Alert } from '@/components/ui';
import { audit } from '@/lib/audit';
export const dynamic = 'force-dynamic';
function supportGrant(userId: string, wsId: string) { return one<any>(`SELECT * FROM support_access WHERE ws=? AND staff_user=? AND status='approved' AND expires_at>? ORDER BY expires_at DESC`, wsId, userId, new Date().toISOString()); }
export default async function Content({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePlatform('support'); const id = (await params).id; const w = one<any>('SELECT * FROM workspaces WHERE id=?', id); if (!w) notFound(); if (!supportGrant(s.user.id, id)) redirect(`/platform/businesses/${id}`);
  const pages = all<any>(`SELECT id,title,kind,updated_at FROM pages WHERE ws=? AND deleted_at IS NULL AND record_id IS NULL ORDER BY updated_at DESC LIMIT 100`, id); audit({ user: s.user, ws: { id } }, 'platform.support_content_listed', 'workspace', id, {});
  return (<div><PageHeader crumbs={[{ href: `/platform/businesses/${id}`, label: w.name }, { label: 'Customer content' }]} title="Customer content (read-only)" /><Alert tone="warn" title="Audited access">Opening any page is recorded in the customer’s audit trail. Private pages of individual members are not listed.</Alert>
    <ul className="card mt-4 divide-y divide-line">{pages.filter(p => p).map(p => <li key={p.id}><Link className="block px-4 py-2.5 hover:bg-bg" href={`/platform/businesses/${id}/content/${p.id}`}>{p.title} <span className="text-xs text-muted">{p.kind}</span></Link></li>)}</ul></div>);
}
