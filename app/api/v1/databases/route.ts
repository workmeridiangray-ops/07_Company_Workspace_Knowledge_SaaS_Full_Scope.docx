import { authApi, json } from '@/lib/api-v1';
import { visibleDatabases } from '@/lib/access';
import { dbProps } from '@/lib/svc/data';
export async function GET(req: Request) { const a = authApi(req); if (a instanceof Response) return a; return json({ data: visibleDatabases(a.ctx).map(d => ({ id: d.id, name: d.name, properties: dbProps(d).map(p => ({ id: p.id, name: p.name, type: p.type, options: p.options })) })) }); }
