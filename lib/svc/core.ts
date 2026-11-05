// Workspace lifecycle, notifications, events (automations + webhooks) and background jobs.
import { all, one, run, insert, update, id, now, J, tx } from '../db';
import { BUILTIN_ROLES } from '../perm';
import { hmac, sha, token } from '../security';
import { audit, auditSystem } from '../audit';
import { TRIAL_DAYS, entitlementBlock } from '../billing';
import type { Ctx } from '../ctx';

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workspace';
const RESERVED = new Set(['login', 'signup', 'api', 'platform', 'admin', 'w', 'www', 'app', 'help', 'static']);
export function uniqueSlug(name: string) {
  let base = slugify(name); if (RESERVED.has(base)) base += '-team'; let s = base, i = 2;
  while (one('SELECT 1 FROM workspaces WHERE slug=?', s)) s = `${base}-${i++}`; return s;
}

export function createWorkspace(owner: { id: string; name: string }, name: string, opts: { timezone?: string; sample?: boolean } = {}) {
  return tx(() => {
    const wsId = id('w_'); const slug = uniqueSlug(name);
    const trialPlan = one<any>(`SELECT * FROM plans WHERE code='team' AND active=1`);
    insert('workspaces', { id: wsId, slug, name, status: 'trial', trial_ends: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString(), timezone: opts.timezone || 'Asia/Kolkata', branding: '{"accent":"#244B78"}', billing: '{}', setup: '{}', created_at: now() });
    const roleIds: Record<string, string> = {};
    for (const [rn, perms] of Object.entries(BUILTIN_ROLES)) { const rid = id('r_'); roleIds[rn] = rid; insert('roles', { id: rid, ws: wsId, name: rn, perms: JSON.stringify(perms), builtin: 1 }); }
    insert('memberships', { id: id('m_'), ws: wsId, user_id: owner.id, role_id: roleIds.Owner, status: 'active', is_guest: 0, created_at: now() });
    if (trialPlan) insert('subscriptions', { id: id('sub_'), ws: wsId, plan_id: trialPlan.id, plan_version: trialPlan.version, interval: 'month', status: 'trialing', period_start: now(), period_end: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString(), seats_extra: 0 });
    const ts = id('ts_'); insert('teamspaces', { id: ts, ws: wsId, name: 'General', description: 'Company-wide pages and databases.', icon: 'building', visibility: 'open', archived: 0, created_at: now() });
    auditSystem(wsId, 'workspace.created', 'workspace', wsId, { by: owner.id });
    return { wsId, slug, roleIds, teamspaceId: ts };
  });
}
export function roleByName(ws: string, name: string) { return one<any>('SELECT * FROM roles WHERE ws=? AND name=?', ws, name); }

// ---- notifications (respect access: never carry content, only a pointer re-checked on read) ----
export function notify(ws: string, userId: string, kind: string, resourceType: string, resourceId: string, actor: string | null) {
  if (userId === actor) return;
  const u = one<any>('SELECT notif_prefs FROM users WHERE id=?', userId); const prefs = J<Record<string, boolean>>(u?.notif_prefs, {});
  if (prefs[kind] === false) return;
  if (!one('SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status=\'active\'', ws, userId)) return;
  insert('notifications', { id: id('n_'), ws, user_id: userId, kind, resource_type: resourceType, resource_id: resourceId, actor, read: 0, created_at: now() });
}

// ---- events -> automations + webhooks ----
export type EventName = 'record.created' | 'record.updated' | 'task.completed' | 'page.created' | 'sop.published' | 'form.submitted';
const MAX_DEPTH = 3;
export function emit(c: Ctx, event: EventName, payload: Record<string, any>, depth = 0) {
  try {
    for (const hook of all<any>(`SELECT * FROM webhooks WHERE ws=? AND active=1`, c.ws.id)) {
      if (!J<string[]>(hook.events, []).includes(event)) continue;
      enqueue(c.ws.id, 'webhook', { hookId: hook.id, event, payload: { event, workspace: c.ws.slug, at: now(), data: payload } }, `wh:${hook.id}:${event}:${payload.id ?? ''}:${payload.version ?? ''}`);
    }
    if (depth >= MAX_DEPTH) { auditSystem(c.ws.id, 'automation.loop_blocked', 'event', event, { depth }); return; }
    for (const a of all<any>(`SELECT * FROM automations WHERE ws=? AND active=1`, c.ws.id)) {
      const t = J<any>(a.trigger, {}); if (t.event !== event) continue;
      if (t.db && payload.db_id && t.db !== payload.db_id) continue;
      runAutomation(c, a, payload, depth + 1);
    }
  } catch (e: any) { auditSystem(c.ws.id, 'event.error', 'event', event, { message: String(e?.message || e).slice(0, 200) }); }
}
export function conditionsPass(conds: any[], data: Record<string, any>) {
  return conds.every(cn => {
    const v = data?.[cn.prop]; const x = cn.value;
    switch (cn.op) {
      case 'eq': return String(v ?? '') === String(x); case 'neq': return String(v ?? '') !== String(x);
      case 'contains': return String(v ?? '').toLowerCase().includes(String(x).toLowerCase());
      case 'empty': return v == null || v === ''; case 'notempty': return !(v == null || v === '');
      case 'gt': return Number(v) > Number(x); case 'lt': return Number(v) < Number(x); default: return false;
    }
  });
}
export function runAutomation(c: Ctx, a: any, payload: Record<string, any>, depth: number, dry = false) {
  const conds = J<any[]>(a.conditions, []); const actions = J<any[]>(a.actions, []);
  const log: string[] = []; let status = 'ok';
  if (!conditionsPass(conds, payload.data || {})) { log.push('Conditions not met - skipped.'); status = 'skipped'; }
  else for (const act of actions) {
    try {
      if (act.type === 'create_task') { log.push(`${dry ? 'Would create' : 'Created'} task "${act.title}"`); if (!dry) insert('tasks', { id: id('t_'), ws: c.ws.id, title: String(act.title || 'Follow up').slice(0, 200), status: 'todo', priority: 'medium', assignee: act.assignee || null, created_by: c.user.id, record_id: payload.id || null, created_at: now() }); }
      else if (act.type === 'set_property' && payload.id && payload.db_id) { log.push(`${dry ? 'Would set' : 'Set'} ${act.prop} = ${act.value}`); if (!dry) { const r = one<any>('SELECT data FROM records WHERE id=? AND ws=?', payload.id, c.ws.id); if (r) { const d = J<any>(r.data, {}); d[act.prop] = act.value; run('UPDATE records SET data=?, updated_at=? WHERE id=? AND ws=?', JSON.stringify(d), now(), payload.id, c.ws.id); } } }
      else if (act.type === 'notify') { log.push(`${dry ? 'Would notify' : 'Notified'} ${act.user_name || 'user'}`); if (!dry && act.user) notify(c.ws.id, act.user, 'automation', 'record', payload.id || '', null); }
      else if (act.type === 'reminder') { log.push(`${dry ? 'Would schedule' : 'Scheduled'} reminder in ${act.days || 1} day(s)`); if (!dry) enqueue(c.ws.id, 'reminder', { user: act.user || c.user.id, text: act.text }, `rem:${a.id}:${payload.id}:${payload.version || ''}`, Number(act.days || 1) * 864e5); }
      else log.push(`Unknown action ${String(act.type).slice(0, 20)}`);
    } catch (e: any) { status = 'failed'; log.push('Failed: ' + String(e.message).slice(0, 100)); }
  }
  if (!dry) { insert('automation_runs', { id: id('ar_'), ws: c.ws.id, automation_id: a.id, status, detail: log.join(' | '), depth, created_at: now() }); run('UPDATE automations SET last_run=?, runs=runs+1 WHERE id=?', now(), a.id); }
  return { status, log };
}

// ---- jobs: deduplicated, bounded retries, visible failures ----
export function enqueue(ws: string | null, kind: string, payload: any, dedupeKey: string, delayMs = 0) {
  const t = now();
  try { insert('jobs', { id: id('j_'), ws, kind, payload: JSON.stringify(payload), status: 'pending', attempts: 0, max_attempts: 5, dedupe_key: dedupeKey, run_after: new Date(Date.now() + delayMs).toISOString(), created_at: t, updated_at: t }); return true; }
  catch (e: any) { if (/UNIQUE/i.test(String(e.message))) return false; throw e; }
}
export async function processJobs(limit = 25) {
  const due = all<any>(`SELECT * FROM jobs WHERE status IN ('pending','retry') AND run_after<=? ORDER BY created_at LIMIT ?`, now(), limit);
  let done = 0, failed = 0;
  for (const j of due) {
    run(`UPDATE jobs SET status='running', attempts=attempts+1, updated_at=? WHERE id=?`, now(), j.id);
    try {
      const p = J<any>(j.payload, {});
      if (j.kind === 'webhook') await deliverWebhook(j.ws, p);
      else if (j.kind === 'reminder') { if (p.user) notify(j.ws, p.user, 'reminder', 'workspace', j.ws, null); }
      run(`UPDATE jobs SET status='done', error=NULL, updated_at=? WHERE id=?`, now(), j.id); done++;
    } catch (e: any) {
      const attempts = j.attempts + 1; const final = attempts >= j.max_attempts;
      run(`UPDATE jobs SET status=?, error=?, run_after=?, updated_at=? WHERE id=?`, final ? 'failed' : 'retry', String(e.message).slice(0, 300), new Date(Date.now() + Math.min(3600e3, 2 ** attempts * 30e3)).toISOString(), now(), j.id);
      if (final) { auditSystem(j.ws, 'job.failed', 'job', j.id, { kind: j.kind }); failed++; }
    }
  }
  return { done, failed, scanned: due.length };
}
export function retryJob(jobId: string, ws: string | null) {
  const j = one<any>('SELECT * FROM jobs WHERE id=?', jobId); if (!j || (ws && j.ws !== ws)) return false;
  if (j.status !== 'failed') return false; run(`UPDATE jobs SET status='retry', attempts=0, run_after=?, error=NULL WHERE id=?`, now(), jobId); return true;
}
async function deliverWebhook(ws: string, p: any) {
  const hook = one<any>('SELECT * FROM webhooks WHERE id=? AND ws=?', p.hookId, ws); if (!hook || !hook.active) return;
  const body = JSON.stringify(p.payload); const sig = hmac(hook.secret || '', body);
  const url = new URL(hook.url); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported protocol');
  if (isPrivateHost(url.hostname) && process.env.ALLOW_PRIVATE_WEBHOOKS !== '1') throw new Error('Webhook target resolves to a private address.');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  let status = 'delivered', resp = '';
  try { const r = await fetch(hook.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-workspace-signature': `sha256=${sig}`, 'x-workspace-event': p.event }, body, signal: ctl.signal }); resp = `HTTP ${r.status}`; if (!r.ok) throw new Error(resp); }
  catch (e: any) { status = 'failed'; resp = String(e.message).slice(0, 200); throw e; }
  finally { clearTimeout(t); try { run('INSERT OR IGNORE INTO webhook_logs(id,ws,webhook_id,event,status,attempts,response,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id('wl_'), ws, hook.id, p.event, status, 1, resp, `${p.event}:${p.payload?.data?.id ?? ''}:${Date.now()}`, now()); } catch {} }
}
export function isPrivateHost(h: string) {
  return /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '::1' || h.endsWith('.internal') || h.endsWith('.local');
}

// ---- invitations ----
export function createInvitation(c: Ctx, email: string, roleId: string, guest: boolean) {
  const e = email.trim().toLowerCase(); const role = one<any>('SELECT * FROM roles WHERE id=? AND ws=?', roleId, c.ws.id); if (!role) throw new Error('Choose a valid role.');
  const block = entitlementBlock(c.ws.id, guest ? 'guests' : 'members'); if (block) throw new Error(block);
  if (one(`SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.ws=? AND u.email=? AND m.status='active'`, c.ws.id, e)) throw new Error('That person is already a member.');
  run(`UPDATE invitations SET status='revoked' WHERE ws=? AND email=? AND status='pending'`, c.ws.id, e);
  const t = token(24); insert('invitations', { id: id('inv_'), ws: c.ws.id, email: e, role_id: roleId, is_guest: guest ? 1 : 0, token_hash: sha(t), status: 'pending', expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), invited_by: c.user.id, created_at: now() });
  audit(c, 'member.invited', 'invitation', e, { role: role.name, guest }); return t;
}
