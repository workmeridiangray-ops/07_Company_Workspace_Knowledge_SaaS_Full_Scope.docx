import { NextResponse } from 'next/server';
import { getSession, loadMembership } from '@/lib/ctx';
import { J, insert, id, now } from '@/lib/db';
import { ALLOWED_UPLOAD, LIMITS } from '@/lib/blocks';
import { entitlementBlock } from '@/lib/billing';
import { getPage } from '@/lib/access';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';
import type { Ctx } from '@/lib/ctx';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const s = await getSession();
  if (!s || s.expired || s.pending2fa) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const m = loadMembership(s.user.id, slug); if (!m || m.mstatus !== 'active') return NextResponse.json({ error: 'No access.' }, { status: 403 });
  const perms = new Set<string>(J<string[]>(m.perms, []));
  if (!perms.has('content.create') && !perms.has('content.edit')) return NextResponse.json({ error: 'You do not have permission to upload.' }, { status: 403 });
  if (!rateLimit(`up:${s.user.id}`, 60, 600_000)) return NextResponse.json({ error: 'Too many uploads. Wait a few minutes.' }, { status: 429 });
  const fd = await req.formData(); const f = fd.get('file');
  if (!(f instanceof File)) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  if (f.size > LIMITS.fileBytes) return NextResponse.json({ error: 'That file is larger than 10 MB.' }, { status: 413 });
  if (f.size === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  if (!ALLOWED_UPLOAD.includes(f.type)) return NextResponse.json({ error: `Files of type ${f.type || 'unknown'} are not allowed. Allowed: images, PDF, text/CSV, Word, Excel and PowerPoint.` }, { status: 415 });
  const block = entitlementBlock(m.id, 'storage', f.size); if (block) return NextResponse.json({ error: block }, { status: 402 });
  const buf = Buffer.from(await f.arrayBuffer());
  // Basic content-sniff so a renamed executable cannot pass as an image/PDF.
  const head = buf.subarray(0, 8).toString('latin1');
  const ok = f.type === 'image/png' ? head.startsWith('\x89PNG') : f.type === 'image/jpeg' ? buf[0] === 0xff && buf[1] === 0xd8 : f.type === 'image/gif' ? head.startsWith('GIF8') : f.type === 'application/pdf' ? head.startsWith('%PDF') : f.type === 'image/webp' ? buf.subarray(8, 12).toString('latin1') === 'WEBP' : true;
  if (!ok || (buf.subarray(0, 2).toString('latin1') === 'MZ') || head.startsWith('\x7fELF')) return NextResponse.json({ error: 'The file content does not match its type, or looks like a program. It was rejected.' }, { status: 415 });
  const pageId = String(fd.get('page') || '') || null;
  if (pageId) { const fake = { user: s.user, ws: { id: m.id }, perms, isGuest: !!m.is_guest } as unknown as Ctx; if (!getPage(fake, pageId, 'edit')) return NextResponse.json({ error: 'You cannot attach files to that page.' }, { status: 403 }); }
  const fid = id('f_'); const name = f.name.replace(/[^\w.\- ()]/g, '_').slice(0, 150);
  insert('files', { id: fid, ws: m.id, name, mime: f.type, size: f.size, data: buf, owner: s.user.id, page_id: pageId, created_at: now() });
  audit({ user: s.user, ws: { id: m.id } }, 'file.uploaded', 'file', fid, { size: f.size, type: f.type });
  return NextResponse.json({ id: fid, name, size: f.size });
}
