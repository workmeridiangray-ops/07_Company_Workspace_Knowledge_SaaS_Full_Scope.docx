import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace, loadMembership } from '../ctx';
import { getDb } from '../access';
import { audit } from '../audit';
import { emit, runAutomation, enqueue, isPrivateHost, conditionsPass } from './core';
import { createRecord, dbProps, cleanRecord, COMPUTED, type Prop } from './data';
import { token, sha, rateLimit } from '../security';

// ---------------- forms ----------------
export interface FormField { prop: string; label: string; required: boolean }
const PUBLIC_OK = ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url'];
export function saveForm(c: Ctx, o: { id?: string; name: string; dbId: string; fields: FormField[]; isPublic: boolean; active: boolean; success?: string }) {
  assertCan(c, 'automation.manage'); writableWorkspace(c); const g = getDb(c, o.dbId, 'edit'); if (!g) throw new Forbidden('automation.manage'); if (!o.name.trim()) throw new Invalid('Name the form.');
  const props = dbProps(g.db); const fields = o.fields.filter(f => props.some(p => p.id === f.prop && !COMPUTED.includes(p.type) && !['relation', 'files'].includes(p.type)));
  if (!fields.length) throw new Invalid('Add at least one field.'); if (o.isPublic) for (const f of fields) { const p = props.find(x => x.id === f.prop)!; if (!PUBLIC_OK.includes(p.type)) throw new Invalid(`“${p.name}” cannot be on a public form (${p.type} fields would expose workspace data).`); }
  const req = props.filter(p => p.title || p.required).filter(p => !fields.some(f => f.prop === p.id)); if (req.length) throw new Invalid(`Required properties must be on the form: ${req.map(r => r.name).join(', ')}.`);
  const row = { name: o.name.trim().slice(0, 100), db_id: o.dbId, fields: JSON.stringify(fields.map(f => ({ ...f, label: f.label.slice(0, 100), required: f.required || !!props.find(p => p.id === f.prop && (p.title || p.required)) }))), is_public: o.isPublic ? 1 : 0, active: o.active ? 1 : 0, success_message: (o.success || 'Thank you - your response was recorded.').slice(0, 300) };
  if (o.id) { const f = one<any>('SELECT * FROM forms WHERE id=? AND ws=?', o.id, c.ws.id); if (!f) throw new Invalid('Form not found.'); const keys = Object.keys(row); run(`UPDATE forms SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`, ...keys.map(k => (row as any)[k]), o.id); audit(c, 'form.updated', 'form', o.id, {}); return o.id; }
  const fid = id('fm_'); insert('forms', { id: fid, ws: c.ws.id, ...row, token: token(18), created_at: now() }); audit(c, 'form.created', 'form', fid, {}); return fid;
}
export function submitForm(formToken: string, data: Record<string, any>, nonce: string, ip: string, internalUser?: { id: string }) {
  const f = one<any>('SELECT * FROM forms WHERE token=? AND active=1', formToken); if (!f) throw new Invalid('This form is not available.');
  if (!f.is_public && !internalUser) throw new Invalid('This form is for workspace members. Sign in to submit.');
  if (!rateLimit(`form:${f.id}:${ip}`, 20, 600_000)) throw new Invalid('Too many submissions. Please wait a few minutes.');
  const w = one<any>('SELECT * FROM workspaces WHERE id=?', f.ws); if (!w || ['suspended', 'closed', 'closing', 'expired'].includes(w.status)) throw new Invalid('This form is temporarily unavailable.');
  const creatorId = one<any>('SELECT created_by FROM templates WHERE 0')?.created_by; const owner = one<any>(`SELECT m.user_id FROM memberships m JOIN roles r ON r.id=m.role_id WHERE m.ws=? AND m.status='active' AND r.name='Owner' ORDER BY m.created_at LIMIT 1`, f.ws);
  if (!owner) throw new Invalid('This form is not available.');
  const m = loadMembership(owner.user_id, w.slug); const u = one<any>('SELECT id,email,name,email_verified,totp_enabled,platform_role,suspended,notif_prefs,timezone,title FROM users WHERE id=?', owner.user_id);
  const ctx: Ctx = { user: u, ws: { id: w.id, slug: w.slug, name: w.name, status: w.status, trial_ends: w.trial_ends, timezone: w.timezone, branding: w.branding, billing: w.billing, setup: w.setup }, role: { id: m.role_id, name: m.role_name }, perms: new Set(J<string[]>(m.perms, [])), isGuest: false, sessionId: 'form' };
  const fields = J<FormField[]>(f.fields, []); const input: Record<string, any> = {}; for (const fl of fields) if (fl.prop in data) input[fl.prop] = data[fl.prop];
  const key = (nonce && nonce.length >= 8 ? 'n:' + nonce : 'h:' + sha(JSON.stringify(input))).slice(0, 80);
  const dup = one<any>('SELECT record_id FROM form_submissions WHERE form_id=? AND dedupe_key=?', f.id, key); if (dup) return { duplicate: true, message: f.success_message };
  const props = dbProps(one<any>('SELECT * FROM databases WHERE id=?', f.db_id));
  for (const fl of fields) { const p = props.find(x => x.id === fl.prop)!; if (fl.required && (input[fl.prop] == null || input[fl.prop] === '' || (Array.isArray(input[fl.prop]) && !input[fl.prop].length)) && p.type !== 'checkbox') throw new Invalid(`${fl.label || p.name} is required.`); }
  const { errors } = cleanRecord(ctx, props, input); const first = Object.values(errors)[0]; if (first) throw new Invalid(first);
  let rid = ''; try { rid = tx(() => { const r = createRecord(ctx, f.db_id, input, { silent: false, owner: owner.user_id }); insert('form_submissions', { id: id('fs_'), ws: f.ws, form_id: f.id, data: JSON.stringify(input), record_id: r, dedupe_key: key, created_at: now() }); return r; }); } catch (e: any) { if (/UNIQUE/i.test(String(e.message))) return { duplicate: true, message: f.success_message }; throw e; }
  emit(ctx, 'form.submitted', { id: rid, db_id: f.db_id, version: 1, data: input, form: f.id }); return { duplicate: false, message: f.success_message, recordId: rid };
}

// ---------------- automations ----------------
export const EVENTS: [string, string][] = [['record.created', 'A record is created'], ['record.updated', 'A record is updated'], ['task.completed', 'A task is completed'], ['page.created', 'A page is created'], ['sop.published', 'An SOP is published'], ['form.submitted', 'A form is submitted']];
export function saveAutomation(c: Ctx, o: { id?: string; name: string; event: string; db?: string; conditions: any[]; actions: any[] }) {
  assertCan(c, 'automation.manage'); writableWorkspace(c); if (!o.name.trim()) throw new Invalid('Name the automation.'); if (!EVENTS.some(e => e[0] === o.event)) throw new Invalid('Choose a trigger.');
  if (o.db && !getDb(c, o.db, 'view')) throw new Invalid('Unknown database.'); if (!o.actions.length) throw new Invalid('Add at least one action.'); if (o.actions.length > 3 || o.conditions.length > 3) throw new Invalid('At most 3 conditions and 3 actions.');
  for (const a of o.actions) { if (a.type === 'create_task' && !String(a.title || '').trim()) throw new Invalid('The task action needs a title.'); if (a.type === 'set_property' && o.db) { const p = dbProps(one<any>('SELECT * FROM databases WHERE id=? AND ws=?', o.db, c.ws.id)).find(x => x.id === a.prop); if (!p || COMPUTED.includes(p.type)) throw new Invalid('Pick a property to set.'); } if (a.type === 'set_property' && !o.db) throw new Invalid('Setting a property needs a database trigger.'); if (a.type === 'notify' && a.user && !one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=?`, c.ws.id, a.user)) throw new Invalid('Choose who to notify.'); }
  const row = { name: o.name.trim().slice(0, 100), trigger: JSON.stringify({ event: o.event, db: o.db || null }), conditions: JSON.stringify(o.conditions), actions: JSON.stringify(o.actions) };
  if (o.id) { if (!one('SELECT 1 FROM automations WHERE id=? AND ws=?', o.id, c.ws.id)) throw new Invalid('Not found.'); run('UPDATE automations SET name=?, trigger=?, conditions=?, actions=?, tested=0, active=0 WHERE id=?', row.name, row.trigger, row.conditions, row.actions, o.id); audit(c, 'automation.updated', 'automation', o.id, {}); return o.id; }
  const aid = id('au_'); insert('automations', { id: aid, ws: c.ws.id, ...row, active: 0, tested: 0, runs: 0, created_at: now() }); audit(c, 'automation.created', 'automation', aid, {}); return aid;
}
export function testAutomation(c: Ctx, aid: string) {
  assertCan(c, 'automation.manage'); const a = one<any>('SELECT * FROM automations WHERE id=? AND ws=?', aid, c.ws.id); if (!a) throw new Invalid('Not found.'); const t = J<any>(a.trigger, {});
  let payload: any = { id: 'sample', data: { title: 'Sample' }, version: 'test' };
  if (t.db) { const r = one<any>('SELECT * FROM records WHERE db_id=? AND ws=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', t.db, c.ws.id); if (!r) throw new Invalid('Add at least one record to the trigger database so the rule can be tested against real data.'); payload = { id: r.id, db_id: t.db, version: r.version, data: J(r.data, {}) }; }
  const res = runAutomation(c, a, payload, 1, true); if (res.status === 'failed') throw new Invalid('The test failed: ' + res.log.join('; ')); run('UPDATE automations SET tested=1 WHERE id=?', aid); return res;
}
export function setAutomationActive(c: Ctx, aid: string, active: boolean) {
  assertCan(c, 'automation.manage'); const a = one<any>('SELECT * FROM automations WHERE id=? AND ws=?', aid, c.ws.id); if (!a) throw new Invalid('Not found.'); if (active && !a.tested) throw new Invalid('Run a test before turning this on. The test shows what would happen without changing anything.');
  run('UPDATE automations SET active=? WHERE id=?', active ? 1 : 0, aid); audit(c, active ? 'automation.enabled' : 'automation.disabled', 'automation', aid, {});
}

// ---------------- webhooks + API keys + connections ----------------
export const WEBHOOK_EVENTS = EVENTS.map(e => e[0]);
export function createWebhook(c: Ctx, url: string, events: string[]) {
  assertCan(c, 'integrations.manage'); writableWorkspace(c); let u: URL; try { u = new URL(url); } catch { throw new Invalid('Enter a full URL such as https://example.com/hook'); }
  if (u.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Invalid('Webhook URLs must use https.'); if (!['https:', 'http:'].includes(u.protocol)) throw new Invalid('Only http(s) URLs are allowed.');
  if (isPrivateHost(u.hostname) && process.env.ALLOW_PRIVATE_WEBHOOKS !== '1') throw new Invalid('Webhook targets on private or local addresses are not allowed.');
  const ev = events.filter(e => WEBHOOK_EVENTS.includes(e)); if (!ev.length) throw new Invalid('Choose at least one event.'); const secret = token(24); const wid = id('wh_');
  insert('webhooks', { id: wid, ws: c.ws.id, url: u.toString(), events: JSON.stringify(ev), secret, active: 1, created_at: now() }); insert('connections', { id: id('cn_'), ws: c.ws.id, provider: 'Outbound webhook', objects: ev.join(', '), direction: 'Out', schedule: 'Real time', source_of_truth: 'This workspace', failure_owner: c.user.name, status: 'active', created_at: now() });
  audit(c, 'webhook.created', 'webhook', wid, {}); return { id: wid, secret };
}
export function testWebhook(c: Ctx, wid: string) { assertCan(c, 'integrations.manage'); const h = one<any>('SELECT * FROM webhooks WHERE id=? AND ws=?', wid, c.ws.id); if (!h) throw new Invalid('Not found.'); enqueue(c.ws.id, 'webhook', { hookId: wid, event: 'ping', payload: { event: 'ping', workspace: c.ws.slug, at: now(), data: { id: 'ping' } } }, `ping:${wid}:${Date.now()}`); }
export function deleteWebhook(c: Ctx, wid: string) { assertCan(c, 'integrations.manage'); run('UPDATE webhooks SET active=0 WHERE id=? AND ws=?', wid, c.ws.id); audit(c, 'webhook.disabled', 'webhook', wid, {}); }
export function createApiKey(c: Ctx, name: string, scopes: string) {
  assertCan(c, 'integrations.manage'); if (!name.trim()) throw new Invalid('Name the key.'); const raw = 'fn_' + token(30); const kid = id('ak_');
  insert('api_keys', { id: kid, ws: c.ws.id, name: name.trim().slice(0, 60), prefix: raw.slice(0, 10), key_hash: sha(raw), scopes: scopes === 'write' ? 'write' : 'read', created_by: c.user.id, created_at: now(), revoked: 0 }); audit(c, 'apikey.created', 'apikey', kid, { scopes }); return raw;
}
export function revokeApiKey(c: Ctx, kid: string) { assertCan(c, 'integrations.manage'); run('UPDATE api_keys SET revoked=1 WHERE id=? AND ws=?', kid, c.ws.id); audit(c, 'apikey.revoked', 'apikey', kid, {}); }
export function registerConnection(c: Ctx, o: Record<string, string>) {
  assertCan(c, 'integrations.manage'); for (const k of ['provider', 'objects', 'direction', 'schedule', 'source_of_truth', 'failure_owner']) if (!o[k]?.trim()) throw new Invalid('Fill in every field - each connector needs a provider, objects, direction, schedule, source of truth and failure owner.');
  insert('connections', { id: id('cn_'), ws: c.ws.id, provider: o.provider.slice(0, 60), objects: o.objects.slice(0, 200), direction: o.direction.slice(0, 20), schedule: o.schedule.slice(0, 60), source_of_truth: o.source_of_truth.slice(0, 80), failure_owner: o.failure_owner.slice(0, 80), status: 'pending approval', created_at: now() }); audit(c, 'connection.registered', 'connection', o.provider, {});
}
/** Resolve an API key to a Ctx. Scope 'read' strips write permissions. */
export function ctxFromApiKey(raw: string): { ctx: Ctx; scopes: string; keyId: string } | null {
  const k = one<any>('SELECT * FROM api_keys WHERE key_hash=? AND revoked=0', sha(raw)); if (!k) return null; if (!rateLimit('api:' + k.id, 120, 60_000)) throw Object.assign(new Error('Rate limit exceeded (120 requests per minute).'), { status: 429 });
  const w = one<any>('SELECT * FROM workspaces WHERE id=?', k.ws); if (!w || w.status === 'closed') return null; const m = loadMembership(k.created_by, w.slug); if (!m || m.mstatus !== 'active') return null;
  const u = one<any>('SELECT id,email,name,email_verified,totp_enabled,platform_role,suspended,notif_prefs,timezone,title FROM users WHERE id=?', k.created_by); let perms = new Set(J<string[]>(m.perms, [])); if (k.scopes !== 'write') perms = new Set([...perms].filter(p => p === 'content.view'));
  run('UPDATE api_keys SET last_used=? WHERE id=?', now(), k.id);
  return { ctx: { user: u, ws: { id: w.id, slug: w.slug, name: w.name, status: w.status, trial_ends: w.trial_ends, timezone: w.timezone, branding: w.branding, billing: w.billing, setup: w.setup }, role: { id: m.role_id, name: m.role_name }, perms, isGuest: !!m.is_guest, sessionId: 'api' }, scopes: k.scopes, keyId: k.id };
}
