import { apiCtx } from '@/lib/api-auth';
import { getPage } from '@/lib/access';
import { toMarkdown } from '@/lib/blocks';
import { J } from '@/lib/db';
import { audit } from '@/lib/audit';
export async function GET(_r: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await apiCtx(slug); if (!c) return new Response('Not found', { status: 404 });
  if (!c.perms.has('content.export')) return new Response('You do not have permission to export.', { status: 403 });
  const g = getPage(c, id, 'view'); if (!g) return new Response('Not found', { status: 404 });
  audit(c, 'export.page', 'page', id, {});
  return new Response(toMarkdown(g.page.title, J(g.page.body, [])), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="${g.page.title.replace(/[^\w\- ]/g, '_').slice(0, 60) || 'page'}.md"`, 'x-content-type-options': 'nosniff' } });
}
