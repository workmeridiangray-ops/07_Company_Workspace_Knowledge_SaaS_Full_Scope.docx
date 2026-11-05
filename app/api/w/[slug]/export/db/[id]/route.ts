import { apiCtx } from '@/lib/api-auth';
import { exportCsv } from '@/lib/svc/data';
import { getDb } from '@/lib/access';
export async function GET(_r: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await apiCtx(slug); if (!c) return new Response('Not found', { status: 404 });
  if (!c.perms.has('content.export')) return new Response('You do not have permission to export.', { status: 403 });
  const g = getDb(c, id, 'view'); if (!g) return new Response('Not found', { status: 404 });
  return new Response('﻿' + exportCsv(c, id), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${g.db.name.replace(/[^\w\- ]/g, '_')}.csv"`, 'x-content-type-options': 'nosniff' } });
}
