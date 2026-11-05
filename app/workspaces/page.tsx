import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser, userWorkspaces } from '@/lib/ctx';
import { createWorkspaceAction } from '@/lib/workspace-actions';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { signOut } from '@/lib/auth-actions';
import { Logo } from '@/components/SiteShell';
import { Badge, Empty, Icon, Status } from '@/components/ui';
import { all } from '@/lib/db';
export const metadata: Metadata = { title: 'Choose a workspace' };
export const dynamic = 'force-dynamic';
export default async function Workspaces() {
  const s = await requireUser(); const list = userWorkspaces(s.user.id);
  const pending = all<any>(`SELECT i.id, w.name FROM invitations i JOIN workspaces w ON w.id=i.ws WHERE i.email=? AND i.status='pending' AND i.expires_at>?`, s.user.email, new Date().toISOString());
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between"><Logo /><div className="flex items-center gap-2 text-sm"><Link href="/account/profile" className="btn-ghost btn-sm">{s.user.name}</Link><form action={signOut}><button className="btn-ghost btn-sm">Sign out</button></form></div></div>
      <h1 className="text-2xl font-semibold">Your workspaces</h1><p className="mt-1 text-muted">Switch between businesses explicitly. Nothing is shared across them.</p>
      {s.user.platform_role && <p className="mt-3"><Link className="btn-secondary btn-sm" href="/platform">Platform admin</Link></p>}
      <ul className="mt-5 space-y-3">
        {list.map(w => (<li key={w.id}><Link href={`/w/${w.slug}`} className="card flex items-center justify-between gap-3 p-4 hover:border-brand"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brandSoft text-brand"><Icon name="building" /></span><span><span className="block font-semibold">{w.name}</span><span className="text-sm text-muted">{w.role_name}</span></span></span><Status value={w.status} /></Link></li>))}
      </ul>
      {list.length === 0 && <div className="mt-5"><Empty title="No workspaces yet" icon="building">Create one below{pending.length ? ' or accept an invitation you received' : ''}.</Empty></div>}
      {pending.length > 0 && <p className="mt-3 text-sm text-muted">You have {pending.length} pending invitation{pending.length > 1 ? 's' : ''} by email. Use the link in the email to accept.</p>}
      <div className="card mt-8 p-5"><h2 className="font-semibold">Create another workspace</h2>
        <ActionForm action={createWorkspaceAction} className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><label className="sr-only" htmlFor="name">Business name</label><input id="name" name="name" className="input" placeholder="Business name" required /></div><Submit>Create</Submit></ActionForm></div>
    </div>
  );
}
