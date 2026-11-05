import { authApi, json } from '@/lib/api-v1';
import { visibleRecords, createRecord, computeValues } from '@/lib/svc/data';
import { getDb } from '@/lib/access';
import { one, run, now } from '@/lib/db';
import { sha } from '@/lib/security';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = authApi(req); if (a instanceof Response) return a; const { id: dbId } = await params; if (!getDb(a.ctx, dbId, 'view')) return json({ error: 'Not found' }, 404);
  const { props, rows } = visibleRecords(a.ctx, dbId); computeValues(a.ctx, props, rows); const u = new URL(req.url); const limit = Math.min(200, Number(u.searchParams.get('limit')) || 50); const off = Math.max(0, Number(u.searchParams.get('offset')) || 0);
  return json({ data: rows.slice(off, off + limit).map(r => ({ id: r.id, values: r.d, created_at: r.created_at, updated_at: r.updated_at })), total: rows.length, limit, offset: off });
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = authApi(req); if (a instanceof Response) return a; if (a.scopes !== 'write') return json({ error: 'This key is read-only.' }, 403); const { id: dbId } = await params;
  const body = await req.json().catch(() => null); if (!body || typeof body.values !== 'object' || body.values === null) return json({ error: 'Body must be {"values": {...}}' }, 400);
  const idem = req.headers.get('idempotency-key'); const key = idem ? sha(`${a.ctx.ws.id}|${dbId}|${idem}`) : null;
  if (key) { const prior = one<any>('SELECT result FROM idempotency WHERE key=?', key); if (prior) return json({ id: prior.result, duplicate: true }, 200); }
  try { const rid = createRecord(a.ctx, dbId, body.values); if (key) run('INSERT OR IGNORE INTO idempotency(key,ws,result,created_at) VALUES(?,?,?,?)', key, a.ctx.ws.id, rid, now()); return json({ id: rid }, 201); }
  catch (e: any) { return json({ error: e.message || 'Could not create record' }, e.name === 'Forbidden' || /Not allowed/.test(e.message) ? 403 : 422); }
}
