import { insert, id, now } from './db';
import type { Ctx } from './ctx';
/** Append-only audit record. detail holds field names / ids only - never document content. */
export function audit(c: Pick<Ctx, 'user' | 'ws'> | { user: { id: string; name: string }; ws: { id: string } | null }, action: string, entity?: string, entityId?: string, detail: Record<string, unknown> = {}) {
  insert('audit_log', { id: id('a_'), ws: c.ws?.id ?? null, actor: c.user.id, actor_label: c.user.name, action, entity: entity ?? null, entity_id: entityId ?? null, detail: JSON.stringify(detail), created_at: now() });
}
export function auditSystem(ws: string | null, action: string, entity?: string, entityId?: string, detail: Record<string, unknown> = {}) {
  insert('audit_log', { id: id('a_'), ws, actor: null, actor_label: 'system', action, entity: entity ?? null, entity_id: entityId ?? null, detail: JSON.stringify(detail), created_at: now() });
}
