// Optional demo environment (SEED_DEMO=1) and first platform owner (PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_PASSWORD).
import { one, insert, run, id, now } from './db';
import { hashPassword } from './security';
import { createWorkspace, roleByName } from './svc/core';
import { seedSampleData } from './sample';
import { createInvitation } from './svc/core';
import { ctxFor } from './svc/ctxfor';
import { startCheckout } from './billing';
import { createPage } from './svc/pages';

function mkUser(email: string, name: string, pw: string, platformRole?: string) {
  const ex = one<any>('SELECT id FROM users WHERE email=?', email); if (ex) return ex.id as string; const uid = id('u_');
  insert('users', { id: uid, email, name, pw_hash: hashPassword(pw), email_verified: 1, notif_prefs: '{}', timezone: 'Asia/Kolkata', platform_role: platformRole ?? null, created_at: now() }); return uid;
}
export function ensurePlatformOwner() {
  const email = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase(), pw = process.env.PLATFORM_OWNER_PASSWORD; if (!email || !pw) return;
  const ex = one<any>('SELECT id, platform_role FROM users WHERE email=?', email); if (ex) { if (ex.platform_role !== 'owner') run(`UPDATE users SET platform_role='owner' WHERE id=?`, ex.id); return; }
  mkUser(email, 'Platform Owner', pw, 'owner');
}
export function seedDemo() {
  if (one('SELECT 1 FROM users WHERE email=?', 'priya@brightstudio.test')) return; const PW = process.env.DEMO_PASSWORD || 'demo-pass-2026';
  const priya = mkUser('priya@brightstudio.test', 'Priya Nair', PW); const arjun = mkUser('arjun@brightstudio.test', 'Arjun Mehta', PW); const meera = mkUser('meera@brightstudio.test', 'Meera Iyer', PW); const sam = mkUser('sam@brightstudio.test', 'Sam Patel', PW); const guest = mkUser('client@acme.test', 'Asha (Acme client)', PW);
  const staff = mkUser('ops@fieldnote.test', 'Platform Operator', PW, 'owner'); mkUser('support@fieldnote.test', 'Support Agent', PW, 'support'); mkUser('billing@fieldnote.test', 'Billing Analyst', PW, 'billing');
  const w = createWorkspace({ id: priya, name: 'Priya' }, 'Bright Studio'); const c = ctxFor(priya, w.wsId)!;
  for (const [uid, role] of [[arjun, 'Admin'], [meera, 'Manager'], [sam, 'Member']] as const) run(`INSERT INTO memberships(id,ws,user_id,role_id,status,is_guest,created_at) VALUES(?,?,?,?,?,?,?)`, id('m_'), w.wsId, uid, roleByName(w.wsId, role).id, 'active', 0, now());
  run(`INSERT INTO memberships(id,ws,user_id,role_id,status,is_guest,created_at) VALUES(?,?,?,?,?,?,?)`, id('m_'), w.wsId, guest, roleByName(w.wsId, 'Guest').id, 'active', 1, now());
  seedSampleData(w.wsId, priya, w.teamspaceId, w.roleIds);
  const ts2 = id('ts_'); run(`INSERT INTO teamspaces(id,ws,name,description,icon,visibility,archived,created_at) VALUES(?,?,?,?,?,?,?,?)`, ts2, w.wsId, 'Leadership', 'Hiring, finance and strategy.', 'shield', 'closed', 0, now()); run('INSERT INTO teamspace_members(teamspace_id,user_id) VALUES(?,?)', ts2, priya);
  createPage(c, { title: 'Compensation bands (confidential)', teamspaceId: ts2, visibility: 'teamspace', body: [{ type: 'p', text: 'Only Leadership members can see this page.' }] as any });
  const shared = one<any>(`SELECT id FROM pages WHERE ws=? AND title LIKE 'Proposal - Acme%'`, w.wsId); if (shared) run(`INSERT INTO shares(id,ws,resource_type,resource_id,user_id,level,by_user,created_at) VALUES(?,?,?,?,?,?,?,?)`, id('sh_'), w.wsId, 'page', shared.id, guest, 'comment', priya, now());
  startCheckout(c, 'plan_team', 'month', null); run('INSERT INTO payment_methods(id,ws,brand,last4,exp,is_default) VALUES(?,?,?,?,?,1)', id('pm_'), w.wsId, 'Visa', '4242', '12/29');
  const w2 = createWorkspace({ id: arjun, name: 'Arjun' }, 'Northgate Consulting'); const c2 = ctxFor(arjun, w2.wsId)!; seedSampleData(w2.wsId, arjun, w2.teamspaceId, w2.roleIds);
  run(`INSERT INTO memberships(id,ws,user_id,role_id,status,is_guest,created_at) VALUES(?,?,?,?,?,?,?)`, id('m_'), w2.wsId, priya, roleByName(w2.wsId, 'Member').id, 'active', 0, now());
  insert('support_tickets', { id: id('tk_'), ws: w.wsId, subject: 'How do I move a page between teamspaces?', body: 'I tried dragging it but nothing happened.', status: 'open', priority: 'normal', created_by: priya, created_at: now() });
  insert('incidents', { id: id('inc_'), title: 'Delayed email delivery (resolved)', status: 'resolved', severity: 'minor', body: '', created_at: now(), resolved_at: now() });
  void staff;
}
