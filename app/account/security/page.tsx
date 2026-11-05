import { requireUser } from '@/lib/ctx';
import { one } from '@/lib/db';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { changePassword, startTotpSetup, confirmTotp, disableTotp } from '@/lib/auth-actions';
import { Alert, Badge } from '@/components/ui';
export default async function Security({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { user } = await requireUser(); const sp = await searchParams;
  const u = one<any>('SELECT totp_secret, totp_enabled FROM users WHERE id=?', user.id);
  const uri = u?.totp_secret ? `otpauth://totp/Fieldnote:${encodeURIComponent(user.email)}?secret=${u.totp_secret}&issuer=Fieldnote` : '';
  return (
    <div className="space-y-5">
      <section className="card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Two-factor authentication</h2>{u?.totp_enabled ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}</div>
        {u?.totp_enabled ? (<><p className="mt-1 text-sm text-muted">Sign-in asks for a code from your authenticator app.</p>
          <ActionForm action={disableTotp} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"><div><label className="label" htmlFor="pw">Confirm password to turn off</label><input id="pw" name="password" type="password" className="input" required autoComplete="current-password" /></div><Submit variant="danger">Turn off</Submit></ActionForm></>)
        : sp.setup && u?.totp_secret ? (<div className="mt-3 space-y-3"><Alert>Add this key in your authenticator app (Google Authenticator, 1Password, Authy…): choose &ldquo;enter a setup key&rdquo;, type <code className="rounded bg-white px-1 font-mono">{u.totp_secret}</code>, time-based.</Alert>
          <p className="break-all text-xs text-muted">Or open: <a className="link" href={uri}>{uri}</a></p>
          <ActionForm action={confirmTotp} className="flex flex-col gap-2 sm:flex-row sm:items-end"><div><label className="label" htmlFor="code">6-digit code</label><input id="code" name="code" inputMode="numeric" maxLength={6} className="input" required /></div><Submit>Turn on</Submit></ActionForm></div>)
        : (<div className="mt-3"><p className="mb-3 text-sm text-muted">Protect your account with a code from an authenticator app.</p><ActionButton action={startTotpSetup} variant="primary">Set up two-factor</ActionButton></div>)}
      </section>
      <section className="card p-5"><h2 className="font-semibold">Change password</h2>
        <ActionForm action={changePassword} className="mt-3 space-y-3" resetOnSuccess><div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" className="input" required autoComplete="current-password" /></div>
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /><p className="hint">Other devices will be signed out.</p></div><Submit>Change password</Submit></ActionForm></section>
    </div>
  );
}
