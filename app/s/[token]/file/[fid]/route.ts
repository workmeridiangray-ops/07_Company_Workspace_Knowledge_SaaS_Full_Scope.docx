import { NextResponse } from 'next/server';
import { one, J } from '@/lib/db';
import { getSession } from '@/lib/ctx';
export async function GET(_r: Request, { params }: { params: Promise<{ token: string; fid: string }> }) {
  const { token, fid } = await params; const l = one<any>('SELECT * FROM share_links WHERE token=? AND revoked=0', token);
  if (!l || (l.expires_at && new Date(l.expires_at) < new Date())) return new NextResponse('Not found', { status: 404 });
  if (!l.is_public) { const s = await getSession(); if (!s || s.expired || s.pending2fa) return new NextResponse('Sign in required', { status: 401 }); }
  const p = one<any>('SELECT body FROM pages WHERE id=? AND ws=? AND deleted_at IS NULL', l.resource_id, l.ws); const blocks = J<any[]>(p?.body, []); const b = blocks.find(x => x.fileId === fid); if (!b) return new NextResponse('Not found', { status: 404 });
  const f = one<any>('SELECT * FROM files WHERE id=? AND ws=? AND deleted_at IS NULL', fid, l.ws); if (!f) return new NextResponse('Not found', { status: 404 });
  const isImage = b.type === 'image' && /^image\/(png|jpeg|gif|webp)$/.test(f.mime); if (!isImage && !l.allow_download) return new NextResponse('Downloads are disabled for this link', { status: 403 });
  return new NextResponse(f.data, { headers: { 'content-type': f.mime, 'content-disposition': `${isImage ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.name)}"`, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=60', 'content-security-policy': "default-src 'none'; sandbox" } });
}
