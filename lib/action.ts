import { Forbidden, Invalid } from './ctx';
import type { ActionResult } from '@/components/ActionForm';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

/** Wrap a server action body: converts known errors to readable results, never leaks internals. */
export async function guard(fn: () => Promise<ActionResult | void> | ActionResult | void): Promise<ActionResult> {
  try { const r = await fn(); return r || { ok: true }; }
  catch (e: any) {
    if (isRedirectError(e)) throw e;
    if (e instanceof Forbidden) return { error: 'You do not have permission to do that.' };
    if (e instanceof Invalid || e?.name === 'UserError') return { error: e.message };
    if (/UNIQUE constraint/i.test(String(e?.message))) return { error: 'That already exists.' };
    console.error('[action]', e); return { error: 'Something went wrong. Nothing was lost - please try again.' };
  }
}
export class UserError extends Error { name = 'UserError'; }
export const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max);
export const need = (v: string, msg: string) => { if (!v) throw new UserError(msg); return v; };
