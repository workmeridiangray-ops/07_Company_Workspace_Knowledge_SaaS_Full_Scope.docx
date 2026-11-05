import { apiCtx } from '@/lib/api-auth';
import { buildExport } from '@/lib/svc/lifecycle';
export const dynamic = 'force-dynamic';
export async function GET(_r: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await apiCtx((await params).slug); if (!c) return new Response('Not found', { status: 404 }); if (!c.perms.has('content.export')) return new Response('You do not have permission to export.', { status: 403 });
  const zip = buildExport(c); return new Response(new Uint8Array(zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${c.ws.slug}-export-${new Date().toISOString().slice(0, 10)}.zip"`, 'x-content-type-options': 'nosniff' } });
}
