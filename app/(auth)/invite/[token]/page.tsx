import { one } from '@/lib/db';
import { sha } from '@/lib/security';
import { getSession } from '@/lib/ctx';
import { ActionForm, Submit } from '@/components/ActionForm';
import { acceptInvite } from '@/lib/auth-actions';
import { Alert } from '@/components/ui';
import Link from 'next/link';
export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const t = (await params).token; const inv = one<any>('SELECT i.*, w.name AS wname FROM invitations i JOIN workspaces w ON w.id=i.ws WHERE i.token_hash=?', sha(t));
  if (!inv || inv.status !== 'pending' || new Date(inv.expires_at) < new Date()) {
    const why = !inv ? 'This invitation link is not valid.' : inv.status === 'revoked' ? 'This invitation was withdrawn by the sender.' : inv.status === 'accepted' ? 'This invitation was already used.' : 'This invitation has expired.';
    return (<div className="card p-6"><h1 className="text-xl font-semibold">Invitation unavailable</h1><div className="mt-3"><Alert tone="warn">{why} Ask the person who invited you to send a new one.</Alert></div><p className="mt-4"><Link className="link" href="/login">Go to sign in</Link></p></div>);
  }
  const s = await getSession(); const signedIn = !!(s && !s.expired && !s.pending2fa); const exists = !!one('SELECT 1 FROM users WHERE email=?', inv.email);
  return (
    <div className="card p-6"><h1 className="text-xl font-semibold">Join {inv.wname}</h1>
      <p className="mt-1 text-sm text-muted">You were invited as {inv.is_guest ? 'a guest' : 'a member'} with {inv.email}.</p>
      <ActionForm action={acceptInvite} className="mt-5 space-y-4"><input type="hidden" name="t" value={t} />
        {!signedIn && !exists && <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" required /></div>}
        {!signedIn && <div><label className="label" htmlFor="password">{exists ? 'Your password' : 'Choose a password'}</label><input id="password" name="password" type="password" className="input" required minLength={exists ? 1 : 10} autoComplete={exists ? 'current-password' : 'new-password'} /></div>}
        <Submit className="w-full">Accept and join</Submit></ActionForm></div>
  );
}
