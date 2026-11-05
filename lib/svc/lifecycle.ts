// Retention, export and closure.
import { all, one, run, insert, id, now, J, tx } from '../db';
import { Ctx, Invalid, Forbidden, assertCan } from '../ctx';
import { pageLevel, getDb } from '../access';
import { toMarkdown, type Block } from '../blocks';
import { exportCsv, dbProps } from './data';
import { audit, auditSystem } from '../audit';
import { makeZip } from '../zip';
import { planLimits } from '../billing';

export const TRASH_DAYS = 30;
export const CLOSURE_RETENTION_DAYS = 30;
export function purgeOldVersions(at = new Date()) {
  let versions = 0, pages = 0, sessions = 0, closed = 0;
  for (const w of all<any>(`SELECT w.id, s.plan_id FROM workspaces w LEFT JOIN subscriptions s ON s.ws=w.id WHERE w.status!='closed'`)) {
    const days = planLimits(w.plan_id ?? 'plan_team').history_days; const cutoff = new Date(at.getTime() - days * 864e5).toISOString();
    // keep at least the 5 most recent versions of each page regardless of age
    versions += run(`DELETE FROM page_versions WHERE ws=? AND created_at<? AND id NOT IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY version DESC) rn FROM page_versions WHERE ws=?) WHERE rn<=5)`, w.id, cutoff, w.id).changes as number;
  }
  for (const p of all<any>(`SELECT id, ws FROM pages WHERE deleted_at IS NOT NULL AND deleted_at<?`, new Date(at.getTime() - TRASH_DAYS * 864e5).toISOString())) { run('DELETE FROM page_versions WHERE page_id=?', p.id); run('DELETE FROM comments WHERE resource_id=?', p.id); run('DELETE FROM favourites WHERE page_id=?', p.id); run('DELETE FROM pages WHERE id=?', p.id); pages++; }
  sessions += run('DELETE FROM sessions WHERE expires_at<? OR revoked=1', new Date(at.getTime() - 7 * 864e5).toISOString()).changes as number;
  run('DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at<?', at.toISOString());
  for (const w of all<any>(`SELECT * FROM workspaces WHERE status='closing' AND closed_at IS NOT NULL AND closed_at<?`, at.toISOString())) { purgeWorkspace(w.id); closed++; }
  return { versions, pages, sessions, closed };
}
/** After the retention window: remove customer content; keep invoices and audit records so charges and critical events stay traceable. */
export function purgeWorkspace(wsId: string) {
  tx(() => {
    for (const t of ['pages', 'page_versions', 'favourites', 'recents', 'databases', 'records', 'views', 'projects', 'milestones', 'goals', 'tasks', 'sop_versions', 'sop_acks', 'sops', 'meetings', 'decisions', 'templates', 'template_versions', 'template_uses', 'comments', 'notifications', 'shares', 'share_links', 'access_requests', 'files', 'form_submissions', 'forms', 'automation_runs', 'automations', 'api_keys', 'webhook_logs', 'webhooks', 'connections', 'imports', 'exports', 'saved_searches', 'announcements', 'teamspaces', 'jobs'])
      try { run(`DELETE FROM ${t} WHERE ws=?`, wsId); } catch {}
    run(`DELETE FROM invitations WHERE ws=?`, wsId); run(`UPDATE workspaces SET status='closed', branding='{}', billing='{}', setup='{}' WHERE id=?`, wsId); run(`UPDATE memberships SET status='suspended' WHERE ws=?`, wsId);
  });
  auditSystem(wsId, 'workspace.purged', 'workspace', wsId, { retained: ['invoices', 'audit_log'] });
}
export function requestClosure(c: Ctx, confirmName: string, reason: string) {
  assertCan(c, 'workspace.configure'); if (confirmName.trim() !== c.ws.name) throw new Invalid('Type the workspace name exactly to confirm.'); if (!reason.trim()) throw new Invalid('Tell us why you are closing - it helps us improve.');
  const until = new Date(Date.now() + CLOSURE_RETENTION_DAYS * 864e5).toISOString();
  tx(() => { run(`UPDATE workspaces SET status='closing', closed_at=?, close_reason=? WHERE id=?`, until, reason.slice(0, 300), c.ws.id); run(`UPDATE subscriptions SET cancel_at_period_end=1 WHERE ws=?`, c.ws.id); });
  audit(c, 'workspace.closure_requested', 'workspace', c.ws.id, { purgeAfter: until });
}
export function cancelClosure(c: Ctx) { assertCan(c, 'workspace.configure'); if (c.ws.status !== 'closing') throw new Invalid('This workspace is not closing.'); run(`UPDATE workspaces SET status='active', closed_at=NULL, close_reason=NULL WHERE id=?`, c.ws.id); audit(c, 'workspace.closure_cancelled', 'workspace', c.ws.id, {}); }
const slugName = (s: string) => s.replace(/[^\w\- ]/g, '_').trim().slice(0, 60) || 'untitled';
/** Documented export: manifest.json, pages/*.md, databases/*.csv, tasks.csv, sops/*.md, attachments/*. Contains only what the exporting user may access. */
export function buildExport(c: Ctx, opts: { attachments: boolean } = { attachments: true }) {
  assertCan(c, 'content.export'); const files: { name: string; data: Buffer | string }[] = []; const manifest: any = { workspace: c.ws.name, exported_at: now(), exported_by: c.user.email, format: 'fieldnote-export/1', counts: {} as any, notes: 'Includes only content the exporting user can access. Pages are Markdown; databases are CSV; attachments keep original files.' };
  const pages = all<any>('SELECT * FROM pages WHERE ws=? AND deleted_at IS NULL AND record_id IS NULL', c.ws.id).filter(p => pageLevel(c, p) !== 'none'); const used = new Set<string>();
  for (const p of pages) { let n = `${p.kind === 'sop' ? 'sops' : 'pages'}/${slugName(p.title)}`; let k = n, i = 2; while (used.has(k)) k = `${n}-${i++}`; used.add(k); files.push({ name: k + '.md', data: toMarkdown(p.title, J<Block[]>(p.body, [])) }); }
  manifest.counts.pages = pages.length; let dbN = 0;
  for (const d of all<any>('SELECT * FROM databases WHERE ws=?', c.ws.id)) { if (!getDb(c, d.id, 'view')) continue; try { files.push({ name: `databases/${slugName(d.name)}.csv`, data: '﻿' + exportCsv(c, d.id) }); dbN++; } catch {} }
  manifest.counts.databases = dbN;
  if (!c.isGuest) { const q = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; files.push({ name: 'tasks.csv', data: ['title,status,priority,assignee,due_date,completed_at', ...all<any>(`SELECT t.*, u.name AS an FROM tasks t LEFT JOIN users u ON u.id=t.assignee WHERE t.ws=? AND t.deleted_at IS NULL`, c.ws.id).map(t => [t.title, t.status, t.priority, t.an, t.due_date, t.completed_at].map(q).join(','))].join('\n') }); }
  let fn = 0; if (opts.attachments) for (const f of all<any>('SELECT * FROM files WHERE ws=? AND deleted_at IS NULL', c.ws.id)) { if (f.page_id) { const p = one<any>('SELECT * FROM pages WHERE id=?', f.page_id); if (!p || pageLevel(c, p) === 'none') continue; } else if (f.owner !== c.user.id) continue; files.push({ name: `attachments/${f.id}-${f.name}`, data: f.data }); fn++; }
  manifest.counts.attachments = fn; files.unshift({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }); insert('exports', { id: id('ex_'), ws: c.ws.id, kind: 'workspace', status: 'done', by_user: c.user.id, created_at: now(), size: files.reduce((a, f) => a + (typeof f.data === 'string' ? f.data.length : f.data.length), 0) });
  audit(c, 'export.workspace', 'workspace', c.ws.id, manifest.counts); return makeZip(files);
}
export function usageReport(c: Ctx) {
  const w = c.ws.id; const stale = all<any>(`SELECT id,title,updated_at,owner FROM pages WHERE ws=? AND deleted_at IS NULL AND record_id IS NULL AND kind='page' AND updated_at<? ORDER BY updated_at LIMIT 25`, w, new Date(Date.now() - 90 * 864e5).toISOString());
  const noOwner = all<any>(`SELECT p.id,p.title FROM pages p LEFT JOIN memberships m ON m.user_id=p.owner AND m.ws=p.ws AND m.status='active' WHERE p.ws=? AND p.deleted_at IS NULL AND p.record_id IS NULL AND (p.owner IS NULL OR m.id IS NULL) LIMIT 25`, w);
  const active = one<any>(`SELECT COUNT(DISTINCT s.user_id) n FROM sessions s JOIN memberships m ON m.user_id=s.user_id AND m.ws=? AND m.status='active' WHERE s.last_seen>?`, w, new Date(Date.now() - 30 * 864e5).toISOString())!.n;
  const reviewDue = all<any>(`SELECT s.id, p.title FROM sops s JOIN pages p ON p.id=s.page_id WHERE s.ws=? AND s.published_version IS NOT NULL AND s.review_due<=?`, w, new Date().toISOString().slice(0, 10));
  const templates = all<any>(`SELECT t.name, COUNT(u.id) AS uses FROM templates t LEFT JOIN template_uses u ON u.template_id=t.id WHERE t.ws=? GROUP BY t.id ORDER BY uses DESC`, w);
  return { stale, noOwner, active, reviewDue, templates };
}
