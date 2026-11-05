// Controlled SOPs: draft -> review -> published -> retired, immutable versions, acknowledgements, audience and expiry.
import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan, writableWorkspace } from '../ctx';
import { audit } from '../audit';
import { emit, notify } from './core';
import { createPage } from './pages';
import { todayIn, addDays } from '../dates';

export function createSop(c: Ctx, o: { title: string; audience?: string[]; reviewDays?: number; requiresAck?: boolean; teamspaceId?: string | null; templateBody?: any[] }) {
  assertCan(c, 'content.create'); writableWorkspace(c); if (!o.title.trim()) throw new Invalid('Give the SOP a title.');
  const aud = o.audience?.length ? o.audience.filter(r => one('SELECT 1 FROM roles WHERE id=? AND ws=?', r, c.ws.id)) : []; const sid = id('sop_');
  return tx(() => {
    const pid = createPage(c, { title: o.title.trim(), kind: 'sop', teamspaceId: o.teamspaceId ?? null, visibility: 'workspace', body: (o.templateBody as any) || [{ type: 'h2', text: 'Purpose' }, { type: 'p', text: '' }, { type: 'h2', text: 'Steps' }, { type: 'number', text: '' }] });
    insert('sops', { id: sid, ws: c.ws.id, page_id: pid, owner: c.user.id, audience: aud.length ? aud.join(',') : 'all', state: 'draft', version: 1, published_version: null, effective_from: null, review_due: addDays(todayIn(c.ws.timezone), o.reviewDays || 365), requires_ack: o.requiresAck === false ? 0 : 1, created_at: now() });
    audit(c, 'sop.created', 'sop', sid, {}); return sid;
  });
}
const get = (c: Ctx, sopId: string) => { const s = one<any>('SELECT s.*, p.title, p.body, p.version AS page_version FROM sops s JOIN pages p ON p.id=s.page_id WHERE s.id=? AND s.ws=?', sopId, c.ws.id); if (!s) throw new Invalid('SOP not found.'); return s; };
export function submitForReview(c: Ctx, sopId: string, note: string) {
  writableWorkspace(c); const s = get(c, sopId); if (s.state !== 'draft') throw new Invalid('Only drafts can be submitted for review.'); if (s.owner !== c.user.id && !c.perms.has('content.edit')) throw new Forbidden('content.edit');
  if (!J<any[]>(s.body, []).some((b: any) => (b.text || '').trim())) throw new Invalid('The SOP is empty. Write the procedure before submitting.');
  run(`UPDATE sops SET state='review', review_note=?, submitted_by=? WHERE id=?`.replace(', submitted_by=?', ''), note.slice(0, 500), sopId); run('UPDATE pages SET updated_by=? WHERE id=?', c.user.id, s.page_id);
  for (const a of all<any>(`SELECT m.user_id FROM memberships m JOIN roles r ON r.id=m.role_id WHERE m.ws=? AND m.status='active'`, c.ws.id)) { const perms = J<string[]>(one<any>('SELECT perms FROM roles r JOIN memberships m ON m.role_id=r.id WHERE m.user_id=? AND m.ws=?', a.user_id, c.ws.id)?.perms, []); if (perms.includes('content.approve')) notify(c.ws.id, a.user_id, 'sop', 'sop', sopId, c.user.id); }
  audit(c, 'sop.submitted', 'sop', sopId, {});
}
export function returnToDraft(c: Ctx, sopId: string, reason: string) {
  assertCan(c, 'content.approve'); const s = get(c, sopId); if (s.state !== 'review') throw new Invalid('This SOP is not in review.'); if (!reason.trim()) throw new Invalid('Say what needs to change - the author will see it.');
  run(`UPDATE sops SET state='draft', review_note=? WHERE id=?`, reason.slice(0, 500), sopId); if (s.owner) notify(c.ws.id, s.owner, 'sop', 'sop', sopId, c.user.id); audit(c, 'sop.returned', 'sop', sopId, { reasonGiven: true });
}
export function publish(c: Ctx, sopId: string, o: { effectiveFrom?: string; changeNote?: string }) {
  assertCan(c, 'content.approve'); writableWorkspace(c); const s = get(c, sopId); if (s.state !== 'review') throw new Invalid('Submit the SOP for review before publishing.');
  const approvers = all<any>(`SELECT m.user_id, r.perms FROM memberships m JOIN roles r ON r.id=m.role_id WHERE m.ws=? AND m.status='active'`, c.ws.id).filter(x => J<string[]>(x.perms, []).includes('content.approve')).length;
  const lastEditor = one<any>('SELECT updated_by FROM pages WHERE id=?', s.page_id)?.updated_by; if (approvers > 1 && lastEditor === c.user.id) throw new Invalid('Someone else must approve this SOP - you were the last person to submit it.');
  const today = todayIn(c.ws.timezone); const eff = o.effectiveFrom && /^\d{4}-\d{2}-\d{2}$/.test(o.effectiveFrom) ? o.effectiveFrom : today; if (eff < today) throw new Invalid('The effective date cannot be in the past.');
  const prevVer = s.published_version; const ver = s.version;
  tx(() => {
    if (prevVer) run(`UPDATE sop_versions SET retired_at=?, state='superseded' WHERE sop_id=? AND version=?`, eff, sopId, prevVer);
    insert('sop_versions', { id: id('sv_'), ws: c.ws.id, sop_id: sopId, version: ver, title: s.title, body: s.body, state: 'published', effective_from: eff, published_at: now(), retired_at: null, by_user: c.user.id, change_note: (o.changeNote || '').slice(0, 500) });
    run(`UPDATE sops SET state='published', published_version=?, effective_from=?, review_note=NULL, review_due=? WHERE id=?`, ver, eff, addDays(eff, 365), sopId);
    run(`UPDATE pages SET is_draft=0 WHERE id=?`, s.page_id);
    // fresh acknowledgements: notify audience; a task is created per member who must acknowledge
    if (s.requires_ack) for (const m of audienceMembers(c.ws.id, s.audience)) { notify(c.ws.id, m, 'sop', 'sop', sopId, c.user.id);
      const dup = one('SELECT 1 FROM tasks WHERE ws=? AND assignee=? AND record_id IS NULL AND page_id=? AND title LIKE ? AND status!=\'done\' AND deleted_at IS NULL', c.ws.id, m, s.page_id, `Acknowledge: ${s.title}%`);
      if (!dup) run(`INSERT INTO tasks(id,ws,title,status,priority,assignee,due_date,page_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, id('t_'), c.ws.id, `Acknowledge: ${s.title} (v${ver})`, 'todo', 'medium', m, addDays(eff, 7), s.page_id, c.user.id, now()); }
  });
  audit(c, 'sop.published', 'sop', sopId, { version: ver, effectiveFrom: eff }); emit(c, 'sop.published', { id: sopId, version: ver, data: { title: s.title } });
}
export function audienceMembers(ws: string, audience: string): string[] {
  const rows = all<any>(`SELECT m.user_id, m.role_id FROM memberships m WHERE m.ws=? AND m.status='active' AND m.is_guest=0`, ws); return rows.filter(r => audience === 'all' || audience.split(',').includes(r.role_id)).map(r => r.user_id);
}
export function acknowledge(c: Ctx, sopId: string) {
  const s = get(c, sopId); if (!s.published_version) throw new Invalid('There is no published version to acknowledge.'); if (!audienceMembers(c.ws.id, s.audience).includes(c.user.id)) throw new Invalid('This SOP is not addressed to your role.');
  if (s.effective_from > todayIn(c.ws.timezone)) throw new Invalid(`This version takes effect on ${s.effective_from}. You can acknowledge it then.`);
  run('INSERT OR IGNORE INTO sop_acks(id,ws,sop_id,version,user_id,at) VALUES(?,?,?,?,?,?)', id('ak_'), c.ws.id, sopId, s.published_version, c.user.id, now());
  run(`UPDATE tasks SET status='done', completed_at=? WHERE ws=? AND assignee=? AND page_id=? AND title LIKE 'Acknowledge:%' AND status!='done'`, now(), c.ws.id, c.user.id, s.page_id); audit(c, 'sop.acknowledged', 'sop', sopId, { version: s.published_version });
}
export function startRevision(c: Ctx, sopId: string) {
  writableWorkspace(c); const s = get(c, sopId); if (s.state !== 'published') throw new Invalid('Only published SOPs can be revised.'); if (s.owner !== c.user.id && !c.perms.has('content.approve')) throw new Forbidden('content.approve');
  run(`UPDATE sops SET state='draft', version=version+1 WHERE id=?`, sopId); audit(c, 'sop.revision_started', 'sop', sopId, { fromVersion: s.version });
}
export function retire(c: Ctx, sopId: string, reason: string) {
  assertCan(c, 'content.approve'); const s = get(c, sopId); if (!reason.trim()) throw new Invalid('Record why this SOP is being retired.'); if (s.state === 'retired') return;
  tx(() => { if (s.published_version) run(`UPDATE sop_versions SET retired_at=?, state='retired' WHERE sop_id=? AND version=?`, todayIn(c.ws.timezone), sopId, s.published_version); run(`UPDATE sops SET state='retired', published_version=NULL, review_note=? WHERE id=?`, reason.slice(0, 500), sopId); });
  audit(c, 'sop.retired', 'sop', sopId, {});
}
export function reviewed(c: Ctx, sopId: string) { assertCan(c, 'content.approve'); const s = get(c, sopId); run('UPDATE sops SET review_due=? WHERE id=?', addDays(todayIn(c.ws.timezone), 365), sopId); audit(c, 'sop.review_confirmed', 'sop', sopId, {}); }
/** The SOP version that was in force on a given date - for explaining historical decisions. */
export function versionInForce(sopId: string, date: string) {
  return one<any>(`SELECT * FROM sop_versions WHERE sop_id=? AND effective_from<=? AND (retired_at IS NULL OR retired_at>?) ORDER BY version DESC LIMIT 1`, sopId, date, date);
}
export function ackStatus(c: Ctx, sopId: string) {
  const s = get(c, sopId); const members = audienceMembers(c.ws.id, s.audience); const acks = new Set(all<any>('SELECT user_id FROM sop_acks WHERE sop_id=? AND version=?', sopId, s.published_version).map(a => a.user_id));
  const names = new Map(all<any>('SELECT id,name FROM users').map(u => [u.id, u.name])); return { total: members.length, done: members.filter(m => acks.has(m)).map(m => names.get(m) as string), pending: members.filter(m => !acks.has(m)).map(m => ({ id: m, name: names.get(m) as string })) };
}
export function remind(c: Ctx, sopId: string) { assertCan(c, 'content.approve'); const st = ackStatus(c, sopId); for (const p of st.pending) notify(c.ws.id, p.id, 'sop', 'sop', sopId, c.user.id); audit(c, 'sop.reminder_sent', 'sop', sopId, { count: st.pending.length }); return st.pending.length; }
