import { authApi, json } from '@/lib/api-v1';
import { all } from '@/lib/db';
export async function GET(req: Request) { const a = authApi(req); if (a instanceof Response) return a; if (a.ctx.isGuest) return json({ data: [] }); return json({ data: all('SELECT id,title,status,priority,assignee,due_date FROM tasks WHERE ws=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 500', a.ctx.ws.id) }); }
