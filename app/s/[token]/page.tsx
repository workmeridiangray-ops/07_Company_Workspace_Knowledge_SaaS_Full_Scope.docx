import type { Metadata } from 'next';
import { one, J } from '@/lib/db';
import { getSession } from '@/lib/ctx';
import { BlocksView } from '@/components/BlocksView';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Shared page', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export function loadLink(token: string) {
  const l = one<any>('SELECT * FROM share_links WHERE token=?', token); if (!l) return { error: 'This link is not valid.' } as const; if (l.revoked) return { error: 'This link was revoked by its owner.' } as const; if (l.expires_at && new Date(l.expires_at) < new Date()) return { error: 'This link has expired.' } as const;
  const w = one<any>('SELECT status FROM workspaces WHERE id=?', l.ws); if (!w || w.status === 'closed') return { error: 'This content is no longer available.' } as const;
  const p = one<any>('SELECT * FROM pages WHERE id=? AND ws=? AND deleted_at IS NULL', l.resource_id, l.ws); if (!p) return { error: 'This page is no longer available.' } as const; return { l, p } as const;
}
export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token; const r = loadLink(token);
  const frame = (body: React.ReactNode) => <main id="main" className="mx-auto max-w-3xl px-4 py-10">{body}</main>;
  if ('error' in r) return frame(<div className="card p-6"><h1 className="text-xl font-semibold">Link unavailable</h1><p className="mt-2 text-muted">{r.error}</p></div>);
  const { l, p } = r; if (!l.is_public) { const s = await getSession(); if (!s || s.expired || s.pending2fa) return frame(<div className="card p-6"><h1 className="text-xl font-semibold">Sign in to view this page</h1><p className="mt-2 text-muted">The owner shared it with signed-in people only.</p><Link className="btn-primary mt-4" href={`/login?next=/s/${token}`}>Sign in</Link></div>); }
  // Deliberately shows only title + content: no workspace name, members, comments, or linked database data.
  return frame(<article><h1 className="mb-4 text-3xl font-semibold tracking-tight">{p.title}</h1><BlocksView blocks={J(p.body, [])} fileBase={`/s/${token}/file`} allowDownload={!!l.allow_download} /></article>);
}
