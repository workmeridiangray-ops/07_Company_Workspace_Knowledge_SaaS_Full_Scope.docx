import type { Metadata } from 'next';
import { ActionForm, Submit } from '@/components/ActionForm';
import { verifySecondFactor } from '@/lib/auth-actions';
export const metadata: Metadata = { title: 'Two-factor verification' };
export default async function TwoFactor({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Two-factor verification</h1>
      <p className="mt-1 text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
      <ActionForm action={verifySecondFactor} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={sp.next || ''} />
        <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" className="input tracking-[0.4em]" required autoComplete="one-time-code" autoFocus /></div>
        <Submit className="w-full">Verify</Submit>
      </ActionForm>
    </div>
  );
}
