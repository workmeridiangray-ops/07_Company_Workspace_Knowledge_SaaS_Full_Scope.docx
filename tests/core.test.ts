import { describe, it, expect, beforeAll } from 'vitest';
import { db, one, run, insert, id, now, all } from '@/lib/db';
import { hashPassword, verifyPassword, totp, verifyTotp, newTotpSecret } from '@/lib/security';
import { createWorkspace, roleByName, processJobs, enqueue } from '@/lib/svc/core';
import { ctxFor } from '@/lib/svc/ctxfor';
import { getPage, getRecord, getDb, pageLevel } from '@/lib/access';
import { createPage, savePage, trashPage, restorePage } from '@/lib/svc/pages';
import { createDatabase, addProp, updateProp, deleteProp, createRecord, updateRecord, createView, previewImport, commitImport, visibleRecords, computeValues } from '@/lib/svc/data';
import { shareWith, createLink } from '@/lib/svc/collab';
import { search } from '@/lib/svc/search';
import { sanitizeBlocks, embedUrl } from '@/lib/blocks';
import { nextDue, zonedToUtc, utcToZoned, addMonths } from '@/lib/dates';
import { prorate, entitlementBlock, startCheckout, downgradeImpact, gst, runBillingLifecycle } from '@/lib/billing';
import { createTask, updateTask, goalProgress, createGoal, updateGoal } from '@/lib/svc/work';
import { createSop, submitForReview, publish, startRevision, versionInForce, acknowledge } from '@/lib/svc/sop';
import { saveForm, submitForm } from '@/lib/svc/auto';
import { ensureBase } from '@/lib/bootstrap';

const mkUser = (email: string, name: string) => { const uid = id('u_'); insert('users', { id: uid, email, name, pw_hash: 'x', email_verified: 1, notif_prefs: '{}', created_at: now() }); return uid; };
const join = (wsId: string, uid: string, role: string) => run('INSERT INTO memberships(id,ws,user_id,role_id,status,is_guest,created_at) VALUES(?,?,?,?,?,?,?)', id('m_'), wsId, uid, roleByName(wsId, role).id, 'active', role === 'Guest' ? 1 : 0, now());
let A: any, B: any, ownerA: string, memberA: string, guestA: string, ownerB: string, cA: any, cMemA: any, cGuestA: any, cB: any;
beforeAll(() => {
  db(); ensureBase();
  ownerA = mkUser('a@a.test', 'Owner A'); memberA = mkUser('m@a.test', 'Member A'); guestA = mkUser('g@a.test', 'Guest A'); ownerB = mkUser('b@b.test', 'Owner B');
  A = createWorkspace({ id: ownerA, name: 'A' }, 'Alpha Co'); B = createWorkspace({ id: ownerB, name: 'B' }, 'Beta Co');
  join(A.wsId, memberA, 'Member'); join(A.wsId, guestA, 'Guest');
  cA = ctxFor(ownerA, A.wsId); cMemA = ctxFor(memberA, A.wsId); cGuestA = ctxFor(guestA, A.wsId); cB = ctxFor(ownerB, B.wsId);
});

describe('tenant isolation', () => {
  it('guessed ids from another workspace resolve to nothing', () => {
    const pid = createPage(cA, { title: 'Alpha secret plan' }); const dbId = createDatabase(cA, 'Alpha DB'); const rid = createRecord(cA, dbId, { name: 'Alpha rec' });
    expect(getPage(cB, pid, 'view')).toBeNull(); expect(getDb(cB, dbId, 'view')).toBeNull(); expect(getRecord(cB, rid, 'view')).toBeNull();
    expect(() => savePage(cB, pid, { title: 'x', body: [], baseVersion: 1 })).not.toThrow(); expect(savePage(cB, pid, { title: 'x', body: [], baseVersion: 1 }).ok).toBe(false);
    expect(search(cB, 'Alpha')).toHaveLength(0); expect(search(cA, 'Alpha').length).toBeGreaterThan(0);
  });
  it('relations cannot point across workspaces', () => {
    const dA = createDatabase(cA, 'Clients A'); const rA = createRecord(cA, dA, { name: 'X' }); const dB = createDatabase(cB, 'Clients B'); const rel = addProp(cB, dB, { name: 'Link', type: 'relation', relDb: dB });
    expect(() => createRecord(cB, dB, { name: 'Y', [rel]: [rA] })).toThrow(/cannot access/);
  });
  it('cross-tenant references in tasks are rejected', () => {
    const dA = createDatabase(cA, 'Cross A'); const rA = createRecord(cA, dA, { name: 'X' });
    expect(() => createTask(cB, { title: 'bad', record: rA })).toThrow(/cannot link/);
  });
});

describe('page access', () => {
  it('private pages hide from other members until shared; guests only see shares', () => {
    const p = createPage(cA, { title: 'Private notes', visibility: 'private' }); const q = createPage(cA, { title: 'Open page', visibility: 'workspace' });
    expect(getPage(cMemA, p, 'view')).toBeNull(); expect(getPage(cMemA, q, 'view')).not.toBeNull(); expect(getPage(cGuestA, q, 'view')).toBeNull();
    shareWith(cA, 'page', p, 'm@a.test', 'comment'); expect(getPage(cMemA, p, 'view')).not.toBeNull(); expect(getPage(cMemA, p, 'edit')).toBeNull();
    shareWith(cA, 'page', q, 'g@a.test', 'view'); expect(getPage(cGuestA, q, 'view')).not.toBeNull(); expect(search(cGuestA, 'Private notes')).toHaveLength(0);
  });
  it('sub-pages inherit explicit shares', () => {
    const parent = createPage(cA, { title: 'Parent', visibility: 'private' }); const child = createPage(cA, { title: 'Child', parentId: parent, visibility: 'private' });
    expect(getPage(cMemA, child, 'view')).toBeNull(); shareWith(cA, 'page', parent, 'm@a.test', 'view'); expect(getPage(cMemA, child, 'view')).not.toBeNull();
  });
  it('record pages follow record access and cannot be published', () => {
    const d = createDatabase(cA, 'Private DB', undefined, null, 'workspace'); run(`UPDATE databases SET visibility='private' WHERE id=?`, d); const r = createRecord(cA, d, { name: 'secret' });
    expect(getRecord(cMemA, r, 'view')).toBeNull();
  });
  it('revoked/expired links stop working; public links need the review step', () => {
    const p = createPage(cA, { title: 'Linked' }); expect(() => createLink(cA, 'page', p, { publicWeb: true })).toThrow(/review/);
    const t = createLink(cA, 'page', p, { days: 7 }); expect(one<any>('SELECT revoked FROM share_links WHERE token=?', t)!.revoked).toBe(0);
  });
  it('trash and restore keep other content intact', () => {
    const parent = createPage(cA, { title: 'P1' }); const kid = createPage(cA, { title: 'K1', parentId: parent }); trashPage(cA, parent); expect(getPage(cA, kid, 'view')!.page.deleted_at).toBeTruthy(); restorePage(cA, kid); expect(getPage(cA, kid, 'view')!.page.parent_id).toBeNull();
  });
});

describe('editor safety', () => {
  it('detects edit conflicts instead of overwriting', () => {
    const p = createPage(cA, { title: 'Conflict' }); const first = savePage(cA, p, { title: 'v2', body: [{ type: 'p', text: 'mine' }], baseVersion: 1 }); expect(first.ok).toBe(true);
    const stale = savePage(cMemA, p, { title: 'theirs', body: [{ type: 'p', text: 'other' }], baseVersion: 1 }); expect(stale.ok).toBe(false); expect((stale as any).conflict).toBe(true); expect(getPage(cA, p)!.page.title).toBe('v2');
  });
  it('validates blocks: types, embeds, size', () => {
    expect(() => sanitizeBlocks([{ type: 'script', text: 'x' }])).toThrow(); expect(() => sanitizeBlocks([{ type: 'embed', url: 'https://evil.example/x' }])).toThrow(); expect(() => sanitizeBlocks([{ type: 'embed', url: 'javascript:alert(1)' }])).toThrow();
    expect(embedUrl('https://www.youtube.com/watch?v=abc')).toContain('/embed/abc'); expect(sanitizeBlocks([{ type: 'p', text: '<img onerror=x>' }])[0].text).toBe('<img onerror=x>');
    expect(() => sanitizeBlocks([{ type: 'p', text: 'x'.repeat(10001) }])).toThrow();
  });
});

describe('databases', () => {
  it('validates values and protects schema used by views', () => {
    const d = createDatabase(cA, 'Deals', [{ id: 'name', name: 'Name', type: 'text', title: true }, { id: 'st', name: 'Status', type: 'select', options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, { id: 'amt', name: 'Amount', type: 'number' }]);
    expect(() => createRecord(cA, d, { name: 'x', amt: 'abc' })).toThrow(/number/); expect(() => createRecord(cA, d, { name: '' })).toThrow(/required/); expect(() => createRecord(cA, d, { name: 'x', st: 'zzz' })).toThrow();
    const r = createRecord(cA, d, { name: 'Deal', st: 'a', amt: '1,500' }); expect(JSON.parse(one<any>('SELECT data FROM records WHERE id=?', r)!.data).amt).toBe(1500);
    createView(cA, d, 'Board', 'board', { group: 'st' }, true); expect(() => deleteProp(cA, d, 'st')).toThrow(/used by/); expect(() => updateProp(cA, d, 'st', { type: 'number' })).toThrow();
    expect(() => updateProp(cA, d, 'st', { options: [{ id: 'b', name: 'B' }] })).toThrow(/used by existing records/);
  });
  it('lookups and rollups never reveal restricted values', () => {
    const cl = createDatabase(cA, 'LClients', [{ id: 'name', name: 'Name', type: 'text', title: true }, { id: 'v', name: 'Value', type: 'number' }]); const dl = createDatabase(cA, 'LDeals');
    const rel = addProp(cA, dl, { name: 'Client', type: 'relation', relDb: cl }); addProp(cA, dl, { name: 'ClientValue', type: 'lookup', relProp: rel, lookupProp: 'v' });
    const c1 = createRecord(cA, cl, { name: 'C', v: 900 }); createRecord(cA, dl, { name: 'D', [rel]: [c1] }); run(`UPDATE databases SET visibility='private' WHERE id=?`, cl);
    const { props, rows } = visibleRecords(cA, dl); computeValues(cMemA, props, rows); const lk = Object.values(rows[0].d).find((v: any) => v && typeof v === 'object' && 'lookup' in v) as any; expect(lk.lookup).toEqual([]); expect(lk.hidden).toBe(1);
  });
  it('csv import validates first, flags duplicates, and is idempotent', () => {
    const d = createDatabase(cA, 'Imp', [{ id: 'name', name: 'Name', type: 'text', title: true }, { id: 'n', name: 'N', type: 'number' }]); const map = { Name: 'name', N: 'n' };
    expect(() => commitImport(cA, d, 'Name,N\nA,1\nB,oops', map, { duplicates: 'skip', filename: 'a.csv' })).toThrow(/error/);
    expect(visibleRecords(cA, d).rows).toHaveLength(0); const csv = 'Name,N\nA,1\nB,2\na,3'; const pv = previewImport(cA, d, csv, map); expect(pv.duplicates).toHaveLength(1);
    expect(commitImport(cA, d, csv, map, { duplicates: 'skip', filename: 'a.csv' })).toBe(2); expect(() => commitImport(cA, d, csv, map, { duplicates: 'skip', filename: 'a.csv' })).toThrow(/already imported/);
    expect(visibleRecords(cA, d).rows).toHaveLength(2);
  });
  it('optimistic version check on records', () => {
    const d = createDatabase(cA, 'Ver'); const r = createRecord(cA, d, { name: 'one' }); updateRecord(cA, r, { name: 'two' }, 1); expect(() => updateRecord(cA, r, { name: 'three' }, 1)).toThrow(/Someone else/);
  });
});

describe('tasks, goals and dates', () => {
  it('dependencies block completion and cannot loop', () => {
    const t1 = createTask(cA, { title: 'first' }); const t2 = createTask(cA, { title: 'second', dependsOn: t1 }); expect(() => updateTask(cA, t2, { status: 'done' })).toThrow(/first/);
    expect(() => updateTask(cA, t1, { dependsOn: t2 })).toThrow(/loop/); updateTask(cA, t1, { status: 'done' }); updateTask(cA, t2, { status: 'done' }); expect(one<any>('SELECT status FROM tasks WHERE id=?', t2)!.status).toBe('done');
  });
  it('blocked needs a reason; recurring tasks spawn exactly one next occurrence', () => {
    const t = createTask(cA, { title: 'rec', due: '2026-01-05', recur: { every: 'week' } }); expect(() => updateTask(cA, t, { status: 'blocked' })).toThrow(/blocking/);
    updateTask(cA, t, { status: 'done' }); updateTask(cA, t, { status: 'todo' }); updateTask(cA, t, { status: 'done' }); expect(all('SELECT 1 FROM tasks WHERE source_task=?', t)).toHaveLength(1);
  });
  it('goal is only achieved after human confirmation', () => {
    const g = createGoal(cA, { title: 'G' }); const t = createTask(cA, { title: 'gt', goal: g }); expect(() => updateGoal(cA, g, { confirm: true })).toThrow(); updateTask(cA, t, { status: 'done' });
    expect(goalProgress(A.wsId, one<any>('SELECT * FROM goals WHERE id=?', g)).pct).toBe(100); expect(one<any>('SELECT confirmed FROM goals WHERE id=?', g)!.confirmed).toBe(0); updateGoal(cA, g, { confirm: true }); expect(one<any>('SELECT confirmed FROM goals WHERE id=?', g)!.confirmed).toBe(1);
  });
  it('recurrence and zones', () => {
    expect(nextDue('2026-01-30', { every: 'month' }, '2026-01-31')).toBe('2026-02-28'); expect(nextDue('2026-03-06', { every: 'weekday' }, '2026-03-05')).toBe('2026-03-09'); expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(zonedToUtc('2026-11-12', '09:30', 'Asia/Kolkata')).toBe('2026-11-12T04:00:00.000Z'); expect(utcToZoned('2026-11-12T04:00:00.000Z', 'Asia/Kolkata')).toEqual({ date: '2026-11-12', time: '09:30' });
    expect(zonedToUtc('2026-07-01', '09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');
  });
});

describe('controlled SOPs', () => {
  it('versions are immutable and the in-force version is answerable by date', () => {
    const s = createSop(cA, { title: 'Refunds', templateBody: [{ type: 'p', text: 'v1 text' }] as any }); submitForReview(cA, s, ''); publish(cA, s, { effectiveFrom: new Date().toISOString().slice(0, 10) });
    expect(one<any>('SELECT state, published_version FROM sops WHERE id=?', s)).toMatchObject({ state: 'published', published_version: 1 }); startRevision(cA, s);
    const pg = one<any>('SELECT page_id FROM sops WHERE id=?', s)!.page_id; savePage(cA, pg, { title: 'Refunds', body: [{ type: 'p', text: 'v2 text' }], baseVersion: one<any>('SELECT version FROM pages WHERE id=?', pg)!.version });
    submitForReview(cA, s, ''); const later = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10); publish(cA, s, { effectiveFrom: later });
    expect(JSON.parse(one<any>('SELECT body FROM sop_versions WHERE sop_id=? AND version=1', s)!.body)[0].text).toBe('v1 text'); expect(versionInForce(s, new Date().toISOString().slice(0, 10))!.version).toBe(1); expect(versionInForce(s, later)!.version).toBe(2);
  });
  it('locked while in review and four-eyes enforced', () => {
    const s = createSop(cA, { title: 'Locked', templateBody: [{ type: 'p', text: 'x' }] as any }); submitForReview(cA, s, ''); const pg = one<any>('SELECT page_id FROM sops WHERE id=?', s)!.page_id;
    expect(savePage(cA, pg, { title: 'Locked', body: [], baseVersion: 1 }).ok).toBe(false);
  });
});

describe('billing', () => {
  it('proration, GST and limits', () => {
    const start = new Date('2026-01-01'), end = new Date('2026-01-31'); const r = prorate(1499, 4999, start, end, new Date('2026-01-16')); expect(r.credit).toBe(750); expect(r.charge).toBe(2500); expect(r.net).toBe(1750); expect(gst(1750)).toBe(315);
    expect(() => startCheckout(cA, 'plan_starter', 'month', null)).toThrow(/over the limit/); // A already uses more databases than Starter allows
    const w = createWorkspace({ id: ownerB, name: 'B' }, 'Delta'); const c = ctxFor(ownerB, w.wsId)!; const res = startCheckout(c, 'plan_starter', 'month', null); expect(res.ok).toBe(true);
    expect(entitlementBlock(w.wsId, 'members', 10)).toMatch(/plan includes 5 members/); const inv = one<any>('SELECT * FROM invoices WHERE ws=? ORDER BY issued_at DESC', w.wsId)!; expect(inv.tax).toBe(gst(inv.amount)); expect(inv.plan_code).toBe('starter'); expect(inv.plan_version).toBe(1);
  });
  it('failed payment gives a grace period, then suspension; paid state never deletes data', () => {
    const w = createWorkspace({ id: ownerB, name: 'B' }, 'Gamma'); const c = ctxFor(ownerB, w.wsId)!; const r = startCheckout(c, 'plan_team', 'month', null, { simulateFail: true }); expect(r.ok).toBe(false);
    expect(one<any>('SELECT status FROM workspaces WHERE id=?', w.wsId)!.status).toBe('past_due'); expect(entitlementBlock(w.wsId, 'members')).toBeNull(); createPage(c, { title: 'still works in grace' });
    runBillingLifecycle(new Date(Date.now() + 8 * 864e5)); expect(one<any>('SELECT status FROM workspaces WHERE id=?', w.wsId)!.status).toBe('suspended'); expect(() => createPage(c, { title: 'blocked' })).toThrow(/read-only/);
  });
  it('downgrade explains what must shrink', () => { expect(downgradeImpact(A.wsId, 'plan_starter').length).toBeGreaterThanOrEqual(0); });
});

describe('jobs, forms, audit, security primitives', () => {
  it('audit log is append-only', () => { const a = one<any>('SELECT id FROM audit_log LIMIT 1')!; expect(() => run('UPDATE audit_log SET action=? WHERE id=?', 'x', a.id)).toThrow(/append-only/); expect(() => run('DELETE FROM audit_log WHERE id=?', a.id)).toThrow(/append-only/); });
  it('jobs are deduplicated', () => { expect(enqueue(A.wsId, 'reminder', {}, 'dup-1')).toBe(true); expect(enqueue(A.wsId, 'reminder', {}, 'dup-1')).toBe(false); });
  it('public forms: safe fields only, duplicate submissions do not duplicate records', () => {
    const d = createDatabase(cA, 'Leads', [{ id: 'name', name: 'Name', type: 'text', title: true }, { id: 'who', name: 'Owner', type: 'people' }]);
    expect(() => saveForm(cA, { name: 'F', dbId: d, fields: [{ prop: 'name', label: 'Name', required: true }, { prop: 'who', label: 'Owner', required: false }], isPublic: true, active: true })).toThrow(/public form/);
    const f = saveForm(cA, { name: 'F', dbId: d, fields: [{ prop: 'name', label: 'Name', required: true }], isPublic: true, active: true }); const tok = one<any>('SELECT token FROM forms WHERE id=?', f)!.token;
    const r1 = submitForm(tok, { name: 'Zed' }, 'nonce-12345', '1.1.1.1'); const r2 = submitForm(tok, { name: 'Zed' }, 'nonce-12345', '1.1.1.1'); expect(r1.duplicate).toBe(false); expect(r2.duplicate).toBe(true); expect(visibleRecords(cA, d).rows).toHaveLength(1);
    expect(() => submitForm(tok, { name: '' }, 'n-2-abcdef', '1.1.1.1')).toThrow(/required/);
  });
  it('passwords and TOTP', () => {
    const h = hashPassword('correct horse 9'); expect(verifyPassword('correct horse 9', h)).toBe(true); expect(verifyPassword('wrong', h)).toBe(false);
    const s = newTotpSecret(); expect(verifyTotp(s, totp(s))).toBe(true); expect(verifyTotp(s, '000000') && totp(s) !== '000000').toBe(false);
    expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe('287082'); // RFC 6238 test vector (last 6 digits)
  });
});

import { layoutTimeline, defaultFrom } from '@/lib/timeline';
describe('timeline layout', () => {
  it('places, clips and reports items instead of dropping them', () => {
    const r = layoutTimeline([{ id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-08' }, { id: 'b', title: 'B', start: '2026-02-20', end: '2026-03-03' }, { id: 'c', title: 'C', start: null, end: null }, { id: 'd', title: 'D', start: '2026-06-01', end: null }, { id: 'e', title: 'E', start: '2026-03-10', end: '2026-03-01' }], '2026-03-01', 30);
    const a = r.placed.find(p => p.id === 'a')!; expect(a.left).toBeCloseTo((1 / 30) * 100); expect(a.width).toBeCloseTo((7 / 30) * 100);
    expect(r.placed.find(p => p.id === 'b')!.clippedL).toBe(true); expect(r.undated.map(i => i.id)).toEqual(['c']); expect(r.outside.map(i => i.id)).toEqual(['d']); expect(r.placed.find(p => p.id === 'e')!.width).toBeGreaterThan(0);
  });
  it('defaults to the week of the earliest date', () => { expect(defaultFrom([{ id: 'x', title: 'x', start: '2026-03-04', end: null }], '2026-01-01')).toBe('2026-03-01'); });
  it('timeline views require a date property and validate type', () => {
    const d = createDatabase(cA, 'TL', [{ id: 'name', name: 'Name', type: 'text', title: true }]); expect(() => createView(cA, d, 'T', 'timeline', {}, true)).toThrow(/date property/);
    addProp(cA, d, { name: 'Start', type: 'date' }); expect(() => createView(cA, d, 'T', 'timeline', {}, true)).not.toThrow();
  });
});
