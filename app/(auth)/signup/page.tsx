import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, Submit } from '@/components/ActionForm';
import { signUp } from '@/lib/auth-actions';
export const metadata: Metadata = { title: 'Start your free trial' };
export default function SignUp() {
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Start your 14-day free trial</h1>
      <p className="mt-1 text-sm text-muted">No card needed. You can invite your team right after.</p>
      <ActionForm action={signUp} className="mt-5 space-y-4">
        <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" required autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" placeholder="name@company.com" /></div>
        <div><label className="label" htmlFor="company">Business name</label><input id="company" name="company" className="input" required autoComplete="organization" placeholder="e.g. Bright Studio" /><p className="hint">This becomes your workspace and its web address.</p></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" aria-describedby="pw-hint" /><p className="hint" id="pw-hint">At least 10 characters with letters and a number.</p></div>
        <input type="hidden" name="timezone" value="Asia/Kolkata" />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="sample" defaultChecked className="mt-1 h-4 w-4" /> Start with sample data (a client, a project, a template and an SOP)</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" className="mt-1 h-4 w-4" /> <span>I accept the <Link className="link" href="/legal/terms">terms</Link> and <Link className="link" href="/legal/privacy">privacy policy</Link>.</span></label>
        <Submit pendingText="Creating workspace…" className="w-full">Create workspace</Submit>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">Already have an account? <Link href="/login" className="link">Sign in</Link></p>
    </div>
  );
}
