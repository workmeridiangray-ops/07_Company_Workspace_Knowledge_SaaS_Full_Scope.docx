import type { Metadata } from 'next';
import { requireUser } from '@/lib/ctx';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { verifyEmail, resendVerification } from '@/lib/auth-actions';
export const metadata: Metadata = { title: 'Verify your email' };
export default async function Verify() {
  const s = await requireUser();
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-1 text-sm text-muted">We sent a 6-digit code to <strong>{s.user.email}</strong>. It expires in 30 minutes.</p>
      <ActionForm action={verifyEmail} className="mt-5 space-y-4">
        <div><label className="label" htmlFor="code">Verification code</label><input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="input tracking-[0.4em]" required autoComplete="one-time-code" /></div>
        <Submit className="w-full">Verify email</Submit>
      </ActionForm>
      <div className="mt-4 text-sm"><ActionButton action={resendVerification} variant="ghost" small>Send a new code</ActionButton></div>
    </div>
  );
}
