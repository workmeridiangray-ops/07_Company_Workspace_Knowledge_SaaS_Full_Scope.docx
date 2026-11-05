import { NextResponse } from 'next/server';
import { getSession, loadMembership } from '@/lib/ctx';
import { J, one } from '@/lib/db';
import { getPage } from '@/lib/access';
import type { Ctx } from '@/lib/ctx';

export async function GET(_r: Request, { params }: { params: Promise<{ slug: string; fid: string }> }) {
  const { slug, fid } = await params; const s = await getSession();
  if (!s || s.expired || s.pending2fa) return new NextResponse('Sign in required', { status: 401 });
  const m = loadMembership(s.user.id, slug); if (!m || m.mstatus !== 'active') return new NextResponse('Not found', { status: 404 });
  const f = one<any>('SELECT * FROM files WHERE id=? AND ws=? AND deleted_at IS NULL', fid, m.id); if (!f) return new NextResponse('Not found', { status: 404 });
  const perms = new Set<string>(J<string[]>(m.perms, [])); const fake = { user: s.user, ws: { id: m.id }, perms, isGuest: !!m.is_guest } as unknown as Ctx;
  const allowed = f.page_id ? !!getPage(fake, f.page_id, 'view') : f.owner === s.user.id || (!m.is_guest && perms.has('content.view'));
  if (!allowed) return new NextResponse('Not found', { status: 404 });
  const inline = /^image\/(png|jpeg|gif|webp)$/.test(f.mime);
  return new NextResponse(f.data, { headers: { 'content-type': f.mime, 'content-length': String(f.size), 'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.name)}"`, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=60', 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
}
