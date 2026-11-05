import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, Submit } from '@/components/ActionForm';
import { signIn } from '@/lib/auth-actions';
import { Alert } from '@/components/ui';
export const metadata: Metadata = { title: 'Sign in' };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; expired?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {sp.reset && <div className="mt-3"><Alert tone="ok">Password updated. Sign in with the new password.</Alert></div>}
      <ActionForm action={signIn} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={sp.next || ''} />
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
        <Submit pendingText="Signing in…" className="w-full">Sign in</Submit>
      </ActionForm>
      <div className="mt-4 flex justify-between text-sm"><Link href="/recover" className="link">Forgot password?</Link><Link href="/signup" className="link">Create account</Link></div>
    </div>
  );
}
