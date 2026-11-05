import type { Metadata } from 'next';
import { one, J } from '@/lib/db';
import { getSession } from '@/lib/ctx';
import { dbProps } from '@/lib/svc/data';
import { PublicForm } from '@/components/PublicForm';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Form', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token; const f = one<any>('SELECT f.*, w.status AS wstatus FROM forms f JOIN workspaces w ON w.id=f.ws WHERE f.token=?', token);
  const shell = (body: React.ReactNode) => <main id="main" className="mx-auto max-w-xl px-4 py-10">{body}</main>;
  if (!f || !f.active || ['suspended', 'closed', 'closing', 'expired'].includes(f.wstatus)) return shell(<div className="card p-6"><h1 className="text-xl font-semibold">This form is not available</h1><p className="mt-2 text-muted">It may have been turned off. Contact the person who sent you the link.</p></div>);
  const s = await getSession(); const signedIn = !!(s && !s.expired && !s.pending2fa);
  if (!f.is_public && !signedIn) return shell(<div className="card p-6"><h1 className="text-xl font-semibold">Sign in to continue</h1><p className="mt-2 text-muted">This form is for members of the workspace.</p><Link className="btn-primary mt-4" href={`/login?next=/f/${token}`}>Sign in</Link></div>);
  const db = one<any>('SELECT * FROM databases WHERE id=?', f.db_id); const props = dbProps(db); const fields = J<any[]>(f.fields, []).map(fl => ({ ...fl, p: props.find(p => p.id === fl.prop)! })).filter(x => x.p);
  return shell(<><h1 className="mb-1 text-2xl font-semibold">{f.name}</h1><p className="mb-5 text-muted">Fields marked * are required.</p><PublicForm token={token} nonce={Math.random().toString(36).slice(2) + Date.now().toString(36)} fields={fields.map(x => ({ prop: x.prop, label: x.label || x.p.name, required: x.required, type: x.p.type, options: x.p.options || [] }))} /></>);
}
