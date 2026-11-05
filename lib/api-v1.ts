import { NextResponse } from 'next/server';
import { ctxFromApiKey } from './svc/auto';
import type { Ctx } from './ctx';
export function authApi(req: Request): { ctx: Ctx; scopes: string } | NextResponse {
  const h = req.headers.get('authorization') || ''; const m = h.match(/^Bearer\s+(fn_[\w-]+)$/); if (!m) return NextResponse.json({ error: 'Missing or malformed Authorization: Bearer fn_… header.' }, { status: 401 });
  try { const r = ctxFromApiKey(m[1]); if (!r) return NextResponse.json({ error: 'Invalid or revoked API key.' }, { status: 401 }); return { ctx: r.ctx, scopes: r.scopes }; } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}
export const json = (data: any, status = 200) => NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
