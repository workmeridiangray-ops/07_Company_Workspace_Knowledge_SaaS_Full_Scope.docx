import { authApi, json } from '@/lib/api-v1';
import { visiblePages } from '@/lib/access';
export async function GET(req: Request) { const a = authApi(req); if (a instanceof Response) return a; return json({ data: visiblePages(a.ctx, 'AND record_id IS NULL').slice(0, 500).map(p => ({ id: p.id, title: p.title, kind: p.kind, updated_at: p.updated_at })) }); }
