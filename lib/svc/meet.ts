import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { getPage, getRecord } from '../access';
import { audit } from '../audit';
import { notify } from './core';
import { createPage } from './pages';
import { createDatabase, dbProps, type Prop } from './data';
import { zonedToUtc, todayIn } from '../dates';
import { sanitizeBlocks } from '../blocks';

export function createMeeting(c: Ctx, o: { title: string; date: string; time: string; minutes?: number; location?: string; attendees?: string[]; agenda?: string[]; projectId?: string | null; templateId?: string | null }) {
  assertCan(c, 'content.create'); writableWorkspace(c); if (!o.title.trim()) throw new Invalid('Give the meeting a title.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !/^\d{2}:\d{2}$/.test(o.time)) throw new Invalid('Choose a valid date and time.');
  const starts = zonedToUtc(o.date, o.time, c.ws.timezone); const ends = new Date(new Date(starts).getTime() + (o.minutes || 30) * 60_000).toISOString();
  const att = [...new Set([c.user.id, ...(o.attendees || [])])].filter(u => one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, u));
  if (o.projectId && !one('SELECT 1 FROM projects WHERE id=? AND ws=?', o.projectId, c.ws.id)) throw new Invalid('Unknown project.');
  const mid = id('mt_'); let agenda = (o.agenda || []).filter(a => a.trim()).map(t => ({ id: id('ag_'), text: t.trim().slice(0, 200), done: false })); let notesBody: any[] = [{ type: 'h2', text: 'Notes' }, { type: 'p', text: '' }];
  if (o.templateId) { const t = one<any>(`SELECT * FROM templates WHERE id=? AND ws=? AND kind='meeting'`, o.templateId, c.ws.id); if (t) { const p = J<any>(t.payload, {}); if (!agenda.length) agenda = (p.agenda || []).map((x: string) => ({ id: id('ag_'), text: x, done: false })); if (p.body) notesBody = p.body; } }
  return tx(() => {
    const pid = createPage(c, { title: `${o.title.trim()} - notes`, kind: 'meeting', visibility: 'workspace', body: sanitizeBlocks(notesBody) });
    insert('meetings', { id: mid, ws: c.ws.id, title: o.title.trim().slice(0, 140), starts_at: starts, ends_at: ends, location: (o.location || '').slice(0, 140), organizer: c.user.id, attendees: JSON.stringify(att.map(u => ({ user: u, status: 'invited' }))), agenda: JSON.stringify(agenda), notes: '', status: 'scheduled', project_id: o.projectId || null, page_id: pid, created_at: now() });
    for (const u of att) notify(c.ws.id, u, 'share', 'meeting', mid, c.user.id);
    if (o.templateId) insert('template_uses', { id: id('tu_'), ws: c.ws.id, template_id: o.templateId, template_version: one<any>('SELECT version FROM templates WHERE id=?', o.templateId)?.version, resource_type: 'meeting', resource_id: mid, at: now(), by_user: c.user.id });
    audit(c, 'meeting.created', 'meeting', mid, {}); return mid;
  });
}
const meeting = (c: Ctx, mid: string) => { const m = one<any>('SELECT * FROM meetings WHERE id=? AND ws=?', mid, c.ws.id); if (!m) throw new Invalid('Meeting not found.'); const att = J<any[]>(m.attendees, []); if (m.organizer !== c.user.id && !att.some(a => a.user === c.user.id) && !c.perms.has('content.edit')) throw new Forbidden('content.edit'); return { m, att }; };
export function setAttendance(c: Ctx, mid: string, userId: string, status: 'invited' | 'present' | 'absent') {
  const { m, att } = meeting(c, mid); if (m.organizer !== c.user.id && userId !== c.user.id && !c.perms.has('content.edit')) throw new Forbidden('content.edit'); const a = att.find(x => x.user === userId); if (!a) throw new Invalid('That person was not invited.'); a.status = status; run('UPDATE meetings SET attendees=? WHERE id=?', JSON.stringify(att), mid);
}
export function addAttendee(c: Ctx, mid: string, userId: string) { const { m, att } = meeting(c, mid); if (att.some(a => a.user === userId)) return; if (!one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, userId)) throw new Invalid('Not a workspace member.'); att.push({ user: userId, status: 'invited' }); run('UPDATE meetings SET attendees=? WHERE id=?', JSON.stringify(att), mid); notify(c.ws.id, userId, 'share', 'meeting', mid, c.user.id); }
export function addAgenda(c: Ctx, mid: string, text: string) { const { m } = meeting(c, mid); if (!text.trim()) throw new Invalid('Write the agenda item.'); const ag = J<any[]>(m.agenda, []); if (ag.length >= 30) throw new Invalid('Agenda is limited to 30 items.'); ag.push({ id: id('ag_'), text: text.trim().slice(0, 200), done: false }); run('UPDATE meetings SET agenda=? WHERE id=?', JSON.stringify(ag), mid); }
export function toggleAgenda(c: Ctx, mid: string, aid: string) { const { m } = meeting(c, mid); const ag = J<any[]>(m.agenda, []); const a = ag.find(x => x.id === aid); if (a) a.done = !a.done; run('UPDATE meetings SET agenda=? WHERE id=?', JSON.stringify(ag), mid); }
export function setMeetingStatus(c: Ctx, mid: string, status: string) { const { m } = meeting(c, mid); if (m.organizer !== c.user.id && !c.perms.has('content.edit')) throw new Forbidden('content.edit'); if (!['scheduled', 'completed', 'cancelled'].includes(status)) throw new Invalid('Unknown status.'); run('UPDATE meetings SET status=? WHERE id=?', status, mid); audit(c, 'meeting.' + status, 'meeting', mid, {}); }
export function addDecision(c: Ctx, mid: string, o: { text: string; owner: string; sopRef?: string; relatedRecord?: string }) {
  const { m } = meeting(c, mid); if (!o.text.trim()) throw new Invalid('Write the decision.'); if (!o.owner || !one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, o.owner)) throw new Invalid('Every decision needs an owner.');
  let sopRef: string | null = null; if (o.sopRef) { const s = one<any>('SELECT id, published_version FROM sops WHERE id=? AND ws=?', o.sopRef, c.ws.id); if (!s) throw new Invalid('Unknown SOP.'); sopRef = `${s.id}:${s.published_version ?? 'draft'}`; }
  if (o.relatedRecord && !getRecord(c, o.relatedRecord, 'view')) throw new Invalid('You cannot link to that record.');
  const did = id('dc_'); insert('decisions', { id: did, ws: c.ws.id, meeting_id: mid, text: o.text.trim().slice(0, 1000), owner: o.owner, decided_on: todayIn(c.ws.timezone), related_type: o.relatedRecord ? 'record' : null, related_id: o.relatedRecord || null, sop_ref: sopRef, created_at: now() });
  notify(c.ws.id, o.owner, 'assignment', 'meeting', mid, c.user.id); audit(c, 'decision.recorded', 'decision', did, { meeting: mid });
}
export function addAction(c: Ctx, mid: string, o: { title: string; assignee: string; due?: string }) {
  const { m } = meeting(c, mid); if (!o.title.trim()) throw new Invalid('Describe the action.'); if (!o.assignee) throw new Invalid('Every action needs an owner.');
  if (o.assignee !== c.user.id) assertCan(c, 'content.assign'); if (!one(`SELECT 1 FROM memberships WHERE ws=? AND user_id=? AND status='active'`, c.ws.id, o.assignee)) throw new Invalid('Not a workspace member.');
  const tid = id('t_'); insert('tasks', { id: tid, ws: c.ws.id, title: o.title.trim().slice(0, 200), status: 'todo', priority: 'medium', assignee: o.assignee, due_date: o.due || null, project_id: m.project_id, page_id: m.page_id, created_by: c.user.id, created_at: now() }); notify(c.ws.id, o.assignee, 'assignment', 'task', tid, c.user.id); return tid;
}

// ---------------- templates ----------------
export function saveTemplate(c: Ctx, o: { id?: string; name: string; kind: string; description?: string; payload: any }) {
  assertCan(c, 'schema.manage'); writableWorkspace(c); if (!o.name.trim()) throw new Invalid('Name the template.'); if (!['page', 'database', 'meeting'].includes(o.kind)) throw new Invalid('Unknown template type.');
  let payload = o.payload; if (o.kind === 'page' || o.kind === 'meeting') payload = { ...payload, body: payload.body ? sanitizeBlocks(payload.body) : undefined };
  if (o.id) {
    const t = one<any>('SELECT * FROM templates WHERE id=? AND ws=?', o.id, c.ws.id); if (!t) throw new Invalid('Template not found.'); const nv = t.version + 1;
    tx(() => { run('INSERT OR IGNORE INTO template_versions(id,ws,template_id,version,name,payload,created_at) VALUES(?,?,?,?,?,?,?)', id('tv_'), c.ws.id, t.id, t.version, t.name, t.payload, now()); run('UPDATE templates SET name=?, description=?, payload=?, version=?, updated_at=? WHERE id=?', o.name.trim().slice(0, 100), (o.description || '').slice(0, 300), JSON.stringify(payload), nv, now(), o.id); run('INSERT OR IGNORE INTO template_versions(id,ws,template_id,version,name,payload,created_at) VALUES(?,?,?,?,?,?,?)', id('tv_'), c.ws.id, t.id, nv, o.name.trim(), JSON.stringify(payload), now()); });
    audit(c, 'template.updated', 'template', o.id, { version: nv }); return o.id;
  }
  const tid = id('tp_'); tx(() => { insert('templates', { id: tid, ws: c.ws.id, name: o.name.trim().slice(0, 100), kind: o.kind, description: (o.description || '').slice(0, 300), payload: JSON.stringify(payload), version: 1, updated_at: now(), created_by: c.user.id }); insert('template_versions', { id: id('tv_'), ws: c.ws.id, template_id: tid, version: 1, name: o.name.trim(), payload: JSON.stringify(payload), created_at: now() }); });
  audit(c, 'template.created', 'template', tid, {}); return tid;
}
/** Creates a copy. Later edits to the template never touch existing copies. */
export function instantiate(c: Ctx, templateId: string, o: { title?: string; teamspaceId?: string | null }) {
  assertCan(c, 'content.create'); writableWorkspace(c); const t = one<any>('SELECT * FROM templates WHERE id=? AND ws=?', templateId, c.ws.id); if (!t) throw new Invalid('Template not found.'); const p = J<any>(t.payload, {});
  return tx(() => {
    let rid: string, type: string, redirect: string;
    if (t.kind === 'page') { rid = createPage(c, { title: o.title || p.title || t.name, body: p.body, teamspaceId: o.teamspaceId ?? null }); type = 'page'; redirect = `pages/${rid}`; }
    else if (t.kind === 'database') { rid = createDatabase(c, o.title || p.name || t.name, (p.props as Prop[]) || undefined, o.teamspaceId ?? null); type = 'database'; redirect = `databases/${rid}`; }
    else { const d = new Date(); rid = createMeeting(c, { title: o.title || p.title || t.name, date: todayIn(c.ws.timezone, new Date(d.getTime() + 864e5)), time: '10:00', templateId }); type = 'meeting'; redirect = `meetings/${rid}`; return { redirect }; }
    insert('template_uses', { id: id('tu_'), ws: c.ws.id, template_id: templateId, template_version: t.version, resource_type: type, resource_id: rid, at: now(), by_user: c.user.id }); audit(c, 'template.used', 'template', templateId, { type }); return { redirect };
  });
}
export function outdatedCopies(c: Ctx, templateId: string) {
  const t = one<any>('SELECT * FROM templates WHERE id=? AND ws=?', templateId, c.ws.id); if (!t) return [];
  return all<any>(`SELECT u.*, p.title FROM template_uses u LEFT JOIN pages p ON p.id=u.resource_id AND u.resource_type='page' WHERE u.ws=? AND u.template_id=? AND u.template_version<? AND u.resource_type='page'`, c.ws.id, templateId, t.version).filter(u => u.title && getPage(c, u.resource_id, 'edit'));
}
export function applyTemplateUpdate(c: Ctx, useId: string) {
  const u = one<any>('SELECT * FROM template_uses WHERE id=? AND ws=?', useId, c.ws.id); if (!u || u.resource_type !== 'page') throw new Invalid('Not found.'); const g = getPage(c, u.resource_id, 'edit'); if (!g) throw new Forbidden('content.edit');
  const t = one<any>('SELECT * FROM templates WHERE id=?', u.template_id); const p = J<any>(t.payload, {});
  tx(() => { insert('page_versions', { id: id('pv_'), ws: c.ws.id, page_id: u.resource_id, version: g.page.version, title: g.page.title, body: g.page.body, by_user: g.page.updated_by, created_at: now(), label: 'Before template update' }); run('UPDATE pages SET body=?, version=version+1, updated_at=?, updated_by=? WHERE id=?', JSON.stringify(p.body || []), now(), c.user.id, u.resource_id); run('UPDATE template_uses SET template_version=? WHERE id=?', t.version, useId); });
  audit(c, 'template.update_applied', 'page', u.resource_id, { template: t.id, version: t.version });
}
export function dismissTemplateUpdate(c: Ctx, useId: string) { const u = one<any>('SELECT * FROM template_uses WHERE id=? AND ws=?', useId, c.ws.id); if (!u) return; const t = one<any>('SELECT version FROM templates WHERE id=?', u.template_id); run('UPDATE template_uses SET template_version=? WHERE id=?', t.version, useId); }
