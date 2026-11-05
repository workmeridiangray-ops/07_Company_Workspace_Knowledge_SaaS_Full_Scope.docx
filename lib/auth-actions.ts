'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, all, run, insert, update, id, now, tx } from './db';
import { hashPassword, verifyPassword, passwordProblem, validEmail, code6, token, sha, rateLimit, newTotpSecret, verifyTotp } from './security';
import { createSession, destroySession, getSession, requireUser } from './ctx';
import { guard, str, need, UserError } from './action';
import { createWorkspace, roleByName } from './svc/core';
import { sendMail, emailConfigured, appUrl } from './mail';
import { auditSystem } from './audit';
import { seedSampleData } from './sample';
import type { ActionResult } from '@/components/ActionForm';

async function ip() { return ((await headers()).get('x-forwarded-for') || 'local').split(',')[0].trim(); }

export async function signUp(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    if (!rateLimit('signup:' + (await ip()), 10, 3600_000)) throw new UserError('Too many sign-up attempts. Try again in an hour.');
    const name = need(str(fd, 'name', 100), 'Enter your name.'); const email = str(fd, 'email', 254).toLowerCase();
    if (!validEmail(email)) throw new UserError('Enter a valid email, for example name@company.com.');
    const pw = String(fd.get('password') || ''); const pe = passwordProblem(pw); if (pe) throw new UserError(pe);
    const company = need(str(fd, 'company', 80), 'Enter your business name.');
    if (fd.get('terms') !== 'on') throw new UserError('Please accept the terms of service and privacy policy.');
    if (one('SELECT 1 FROM users WHERE email=?', email)) throw new UserError('An account with this email already exists. Sign in or reset your password.');
    const uid = id('u_'); const code = code6(); const needsVerify = emailConfigured();
    let wsSlug = '';
    tx(() => {
      insert('users', { id: uid, email, name, pw_hash: hashPassword(pw), email_verified: needsVerify ? 0 : 1, verify_code: needsVerify ? sha(code) : null, notif_prefs: '{}', timezone: 'Asia/Kolkata', created_at: now() });
      const w = createWorkspace({ id: uid, name }, company, { timezone: str(fd, 'timezone', 40) || 'Asia/Kolkata' }); wsSlug = w.slug;
      if (fd.get('sample') === 'on') seedSampleData(w.wsId, uid, w.teamspaceId, w.roleIds);
      auditSystem(w.wsId, 'user.signed_up', 'user', uid);
    });
    if (needsVerify) await sendMail(email, 'Verify your email', `Your verification code is ${code}. It expires in 30 minutes.`);
    await createSession(uid);
    return { ok: true, redirect: needsVerify ? '/verify' : `/w/${wsSlug}/welcome` };
  });
}
export async function verifyEmail(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const code = str(fd, 'code', 10);
    if (!rateLimit('verify:' + s.user.id, 8, 900_000)) throw new UserError('Too many attempts. Wait 15 minutes and try again.');
    const u = one<any>('SELECT verify_code FROM users WHERE id=?', s.user.id);
    if (!u?.verify_code || sha(code) !== u.verify_code) throw new UserError('That code is not right. Check the latest email and try again.');
    run('UPDATE users SET email_verified=1, verify_code=NULL WHERE id=?', s.user.id);
    const w = one<any>('SELECT w.slug FROM memberships m JOIN workspaces w ON w.id=m.ws WHERE m.user_id=? ORDER BY m.created_at LIMIT 1', s.user.id);
    return { ok: true, redirect: w ? `/w/${w.slug}/welcome` : '/workspaces' };
  });
}
export async function resendVerification(): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); if (!rateLimit('resend:' + s.user.id, 3, 900_000)) throw new UserError('Please wait a few minutes before requesting another code.');
    const code = code6(); run('UPDATE users SET verify_code=? WHERE id=?', sha(code), s.user.id);
    await sendMail(s.user.email, 'Your verification code', `Your verification code is ${code}.`); return { ok: true, message: 'A new code has been sent.' };
  });
}
export async function signIn(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const email = str(fd, 'email', 254).toLowerCase(); const pw = String(fd.get('password') || ''); const next = str(fd, 'next', 200);
    if (!rateLimit('login:' + (await ip()) + email, 8, 900_000)) throw new UserError('Too many attempts. Wait 15 minutes, or reset your password.');
    const u = one<any>('SELECT * FROM users WHERE email=?', email);
    if (!u || !verifyPassword(pw, u.pw_hash)) throw new UserError('Email or password is not correct.');
    if (u.suspended) throw new UserError('This account is suspended. Contact support.');
    if (u.totp_enabled) { await createSession(u.id, true); return { ok: true, redirect: '/two-factor' + (next ? `?next=${encodeURIComponent(next)}` : '') }; }
    await createSession(u.id); auditSystem(null, 'user.signed_in', 'user', u.id);
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : u.email_verified ? '/workspaces' : '/verify';
    return { ok: true, redirect: dest };
  });
}
export async function verifySecondFactor(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await getSession(); if (!s || !s.pending2fa) throw new UserError('Your sign-in expired. Start again.');
    if (!rateLimit('2fa:' + s.user.id, 8, 900_000)) throw new UserError('Too many attempts. Wait 15 minutes.');
    const u = one<any>('SELECT totp_secret FROM users WHERE id=?', s.user.id); if (!u?.totp_secret || !verifyTotp(u.totp_secret, str(fd, 'code', 10))) throw new UserError('That code is not valid. Codes change every 30 seconds.');
    run('UPDATE sessions SET pending_2fa=0, expires_at=? WHERE id=?', new Date(Date.now() + 14 * 864e5).toISOString(), s.sessionId);
    const next = str(fd, 'next', 200); return { ok: true, redirect: next.startsWith('/') && !next.startsWith('//') ? next : '/workspaces' };
  });
}
export async function signOut() { await destroySession(); redirect('/login'); }

export async function requestReset(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const email = str(fd, 'email', 254).toLowerCase(); if (!validEmail(email)) throw new UserError('Enter a valid email.');
    if (!rateLimit('reset:' + email, 3, 3600_000)) throw new UserError('A reset link was already sent. Check your email or wait an hour.');
    const u = one<any>('SELECT id FROM users WHERE email=?', email);
    if (u) { const t = token(); insert('reset_tokens', { id: id('rt_'), user_id: u.id, token_hash: sha(t), expires_at: new Date(Date.now() + 3600_000).toISOString(), used: 0 }); await sendMail(email, 'Reset your password', `Reset your password: ${appUrl()}/reset/${t}\nThis link works once and expires in 1 hour.`); }
    return { ok: true, message: 'If an account exists for that email, a reset link is on its way.' };
  });
}
export async function resetPassword(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const t = str(fd, 't', 100); const pw = String(fd.get('password') || ''); const pe = passwordProblem(pw); if (pe) throw new UserError(pe);
    const r = one<any>('SELECT * FROM reset_tokens WHERE token_hash=?', sha(t));
    if (!r || r.used || new Date(r.expires_at) < new Date()) throw new UserError('This reset link has expired or was already used. Request a new one.');
    tx(() => { run('UPDATE users SET pw_hash=? WHERE id=?', hashPassword(pw), r.user_id); run('UPDATE reset_tokens SET used=1 WHERE id=?', r.id); run('UPDATE sessions SET revoked=1 WHERE user_id=?', r.user_id); });
    auditSystem(null, 'user.password_reset', 'user', r.user_id); return { ok: true, redirect: '/login?reset=1' };
  });
}
export async function acceptInvite(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const t = str(fd, 't', 100); const inv = one<any>('SELECT * FROM invitations WHERE token_hash=?', sha(t));
    if (!inv || inv.status !== 'pending' || new Date(inv.expires_at) < new Date()) throw new UserError('This invitation is no longer valid. Ask the sender for a new one.');
    let s = await getSession(); let uid: string;
    if (s && !s.expired && !s.pending2fa) { if (s.user.email !== inv.email) throw new UserError(`This invitation was sent to ${inv.email}. Sign out and use that account.`); uid = s.user.id; }
    else {
      const ex = one<any>('SELECT * FROM users WHERE email=?', inv.email);
      if (ex) { if (!verifyPassword(String(fd.get('password') || ''), ex.pw_hash)) throw new UserError('Enter the password for your existing account.'); uid = ex.id; }
      else {
        const name = need(str(fd, 'name', 100), 'Enter your name.'); const pw = String(fd.get('password') || ''); const pe = passwordProblem(pw); if (pe) throw new UserError(pe);
        uid = id('u_'); insert('users', { id: uid, email: inv.email, name, pw_hash: hashPassword(pw), email_verified: 1, notif_prefs: '{}', timezone: 'Asia/Kolkata', created_at: now() });
      }
      await createSession(uid);
    }
    const w = one<any>('SELECT slug FROM workspaces WHERE id=?', inv.ws);
    tx(() => { run(`INSERT INTO memberships(id,ws,user_id,role_id,status,is_guest,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(ws,user_id) DO UPDATE SET role_id=excluded.role_id,status='active',is_guest=excluded.is_guest`, id('m_'), inv.ws, uid, inv.role_id, 'active', inv.is_guest, now()); run(`UPDATE invitations SET status='accepted' WHERE id=?`, inv.id); });
    auditSystem(inv.ws, 'member.joined', 'user', uid); return { ok: true, redirect: `/w/${w.slug}` };
  });
}
export async function startTotpSetup(): Promise<ActionResult> {
  return guard(async () => { const s = await requireUser(); const sec = newTotpSecret(); run('UPDATE users SET totp_secret=?, totp_enabled=0 WHERE id=?', sec, s.user.id); return { ok: true, redirect: '/account/security?setup=1' }; });
}
export async function confirmTotp(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const u = one<any>('SELECT totp_secret FROM users WHERE id=?', s.user.id);
    if (!u?.totp_secret || !verifyTotp(u.totp_secret, str(fd, 'code', 10))) throw new UserError('That code is not valid. Check your authenticator app and try again.');
    run('UPDATE users SET totp_enabled=1 WHERE id=?', s.user.id); auditSystem(null, 'user.2fa_enabled', 'user', s.user.id); return { ok: true, redirect: '/account/security' };
  });
}
export async function disableTotp(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const u = one<any>('SELECT pw_hash FROM users WHERE id=?', s.user.id);
    if (!verifyPassword(String(fd.get('password') || ''), u.pw_hash)) throw new UserError('Password is not correct.');
    run('UPDATE users SET totp_enabled=0, totp_secret=NULL WHERE id=?', s.user.id); auditSystem(null, 'user.2fa_disabled', 'user', s.user.id); return { ok: true, redirect: '/account/security' };
  });
}
export async function changePassword(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const u = one<any>('SELECT pw_hash FROM users WHERE id=?', s.user.id);
    if (!verifyPassword(String(fd.get('current') || ''), u.pw_hash)) throw new UserError('Current password is not correct.');
    const pw = String(fd.get('password') || ''); const pe = passwordProblem(pw); if (pe) throw new UserError(pe);
    tx(() => { run('UPDATE users SET pw_hash=? WHERE id=?', hashPassword(pw), s.user.id); run('UPDATE sessions SET revoked=1 WHERE user_id=? AND id!=?', s.user.id, s.sessionId); });
    auditSystem(null, 'user.password_changed', 'user', s.user.id); return { ok: true, message: 'Password changed. Other devices were signed out.' };
  });
}
export async function revokeSession(sid: string): Promise<ActionResult> {
  return guard(async () => { const s = await requireUser(); run('UPDATE sessions SET revoked=1 WHERE id=? AND user_id=?', sid, s.user.id); return { ok: true, redirect: sid === s.sessionId ? '/login' : '/account/sessions' }; });
}
export async function revokeOthers(): Promise<ActionResult> {
  return guard(async () => { const s = await requireUser(); run('UPDATE sessions SET revoked=1 WHERE user_id=? AND id!=?', s.user.id, s.sessionId); return { ok: true, redirect: '/account/sessions' }; });
}
export async function updateProfile(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const name = need(str(fd, 'name', 100), 'Name is required.');
    run('UPDATE users SET name=?, title=?, timezone=? WHERE id=?', name, str(fd, 'title', 100), str(fd, 'timezone', 50) || 'Asia/Kolkata', s.user.id); return { ok: true, message: 'Profile saved.' };
  });
}
export async function saveNotifPrefs(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const kinds = ['mention', 'comment', 'assignment', 'share', 'sop', 'reminder', 'automation'];
    const prefs: Record<string, boolean> = {}; for (const k of kinds) prefs[k] = fd.get(k) === 'on';
    run('UPDATE users SET notif_prefs=? WHERE id=?', JSON.stringify(prefs), s.user.id); return { ok: true, message: 'Notification preferences saved.' };
  });
}
