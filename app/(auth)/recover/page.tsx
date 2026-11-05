import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, Submit } from '@/components/ActionForm';
import { requestReset } from '@/lib/auth-actions';
import { Alert } from '@/components/ui';
import { emailConfigured } from '@/lib/mail';
export const metadata: Metadata = { title: 'Reset your password' };
export default function Recover() {
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter your account email and we will send a one-time link.</p>
      {!emailConfigured() && <div className="mt-3"><Alert tone="warn" title="Email delivery is not configured">The link is queued for platform staff to relay. Contact support if you need it urgently.</Alert></div>}
      <ActionForm action={requestReset} className="mt-5 space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
        <Submit className="w-full">Send reset link</Submit>
      </ActionForm>
      <p className="mt-4 text-sm"><Link href="/login" className="link">Back to sign in</Link></p>
    </div>
  );
}
