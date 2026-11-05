import { ActionForm, Submit } from '@/components/ActionForm';
import { resetPassword } from '@/lib/auth-actions';
import { one } from '@/lib/db';
import { sha } from '@/lib/security';
import { Alert } from '@/components/ui';
import Link from 'next/link';
export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const t = (await params).token; const r = one<any>('SELECT * FROM reset_tokens WHERE token_hash=?', sha(t));
  const valid = r && !r.used && new Date(r.expires_at) > new Date();
  if (!valid) return (<div className="card p-6"><h1 className="text-xl font-semibold">Link expired</h1><div className="mt-3"><Alert tone="warn">This reset link has expired or was already used.</Alert></div><p className="mt-4"><Link href="/recover" className="btn-primary">Request a new link</Link></p></div>);
  return (
    <div className="card p-6"><h1 className="text-xl font-semibold">Choose a new password</h1>
      <ActionForm action={resetPassword} className="mt-5 space-y-4"><input type="hidden" name="t" value={t} />
        <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /><p className="hint">At least 10 characters with letters and a number. All devices will be signed out.</p></div>
        <Submit className="w-full">Update password</Submit></ActionForm></div>
  );
}
