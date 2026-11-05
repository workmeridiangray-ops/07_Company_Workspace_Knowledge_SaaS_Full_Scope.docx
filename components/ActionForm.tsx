'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export type ActionResult = { ok?: boolean; error?: string; message?: string; redirect?: string; data?: any } | null;
export function Submit({ children, variant = 'primary', pendingText = 'Working…', className = '', confirm }: { children: ReactNode; variant?: string; pendingText?: string; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (<button type="submit" disabled={pending} className={`btn-${variant} ${className}`} aria-busy={pending}
    onClick={confirm ? e => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>{pending ? pendingText : children}</button>);
}
/** Form bound to a server action returning {ok,error,message,redirect}. Shows validation/failure inline and preserves input on error. */
export function ActionForm({ action, children, className = '', resetOnSuccess = false, id }: { action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>; children: ReactNode; className?: string; resetOnSuccess?: boolean; id?: string }) {
  const [state, fa] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.redirect) window.location.assign(state.redirect); else if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={fa} className={className} id={id}>
      {state?.error && <div role="alert" className="mb-3 rounded-lg border border-bad/40 bg-badSoft px-3 py-2 text-sm text-ink"><strong>Could not save.</strong> {state.error}</div>}
      {state?.ok && state.message && <div role="status" className="mb-3 rounded-lg border border-ok/30 bg-okSoft px-3 py-2 text-sm text-ink">{state.message}</div>}
      {children}
    </form>
  );
}
/** One-click server action button (no fields) with optional confirmation. */
export function ActionButton({ action, children, variant = 'secondary', small, confirm, className = '' }: { action: () => Promise<ActionResult | void>; children: ReactNode; variant?: string; small?: boolean; confirm?: string; className?: string }) {
  const [state, fa] = useActionState(async () => (await action()) || null, null);
  useEffect(() => { if (state?.redirect) window.location.assign(state.redirect); }, [state]);
  return (<form action={fa} className="inline-block"><Submit variant={variant} className={`${small ? 'btn-sm' : ''} ${className}`} confirm={confirm}>{children}</Submit>{state?.error && <span role="alert" className="ml-2 text-[13px] text-bad">{state.error}</span>}</form>);
}
