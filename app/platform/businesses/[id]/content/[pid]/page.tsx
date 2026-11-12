import { notFound, redirect } from 'next/navigation';
import { requirePlatform } from '@/lib/ctx';
import { one, J } from '@/lib/db';
import { PageHeader, Alert } from '@/components/ui';
import { BlocksView } from '@/components/BlocksView';
import { audit } from '@/lib/audit';
export const dynamic = 'force-dynamic';
export default async function ContentPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const s = await requirePlatform('support'); const { id, pid } = await params; const g = one<any>(`SELECT * FROM support_access WHERE ws=? AND staff_user=? AND status='approved' AND expires_at>?`, id, s.user.id, new Date().toISOString()); if (!g) redirect(`/platform/businesses/${id}`);
  const p = one<any>(`SELECT * FROM pages WHERE id=? AND ws=? AND deleted_at IS NULL AND record_id IS NULL AND visibility!='private'`, pid, id); if (!p) notFound();
  audit({ user: s.user, ws: { id } }, 'platform.support_page_viewed', 'page', pid, { grant: g.id });
  return (<div className="max-w-3xl"><PageHeader crumbs={[{ href: `/platform/businesses/${id}/content`, label: 'Customer content' }, { label: p.title }]} title={p.title} /><Alert tone="warn">Read-only support view. This access was logged.</Alert><div className="card mt-4 p-5"><BlocksView blocks={J(p.body, [])} fileBase="#" allowDownload={false} /></div></div>);
}
