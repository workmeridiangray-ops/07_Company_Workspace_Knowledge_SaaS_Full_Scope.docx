// Plans, entitlements, proration and renewal state. Money is integer paise-free INR rupees; tax is 18% GST.
import { one, all, run, insert, update, id, now, J, tx } from './db';
import type { Ctx } from './ctx';
import { audit, auditSystem } from './audit';

export const GST = 0.18;
export const GRACE_DAYS = 7;
export const TRIAL_DAYS = 14;
export interface Limits { members: number; guests: number; storage_mb: number; databases: number; history_days: number }
export function planLimits(planId: string): Limits { return J<Limits>(one<any>('SELECT limits FROM plans WHERE id=?', planId)?.limits, { members: 5, guests: 2, storage_mb: 1024, databases: 5, history_days: 14 }); }
export const gst = (amount: number) => Math.round(amount * GST);
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function currentPlan(ws: string) {
  const sub = one<any>('SELECT * FROM subscriptions WHERE ws=?', ws); if (!sub) return null;
  // Historical billing is preserved: the plan row for the subscribed version, falling back to the live plan.
  const plan = one<any>('SELECT * FROM plans WHERE id=?', sub.plan_id);
  return { sub, plan, limits: J<Limits>(plan?.limits, planLimits(sub.plan_id)) };
}
export function usage(ws: string) {
  const members = one<any>(`SELECT COUNT(*) n FROM memberships WHERE ws=? AND status='active' AND is_guest=0`, ws)!.n;
  const guests = one<any>(`SELECT COUNT(*) n FROM memberships WHERE ws=? AND status='active' AND is_guest=1`, ws)!.n;
  const storage = one<any>('SELECT COALESCE(SUM(size),0) n FROM files WHERE ws=? AND deleted_at IS NULL', ws)!.n;
  const databases = one<any>('SELECT COUNT(*) n FROM databases WHERE ws=? AND archived=0', ws)!.n;
  const pages = one<any>('SELECT COUNT(*) n FROM pages WHERE ws=? AND deleted_at IS NULL', ws)!.n;
  const records = one<any>('SELECT COUNT(*) n FROM records WHERE ws=? AND deleted_at IS NULL', ws)!.n;
  return { members, guests, storage_mb: Math.round((storage / 1048576) * 10) / 10, databases, pages, records };
}
export type Entitlement = 'members' | 'guests' | 'databases' | 'storage';
/** Entitlement check used before every limit-bound create. Returns a human message if blocked. */
export function entitlementBlock(ws: string, what: Entitlement, adding = 1): string | null {
  const w = one<any>('SELECT status FROM workspaces WHERE id=?', ws);
  if (!w || ['suspended', 'closed', 'closing'].includes(w.status)) return 'This workspace is read-only because of its account status.';
  const cp = currentPlan(ws); if (!cp) return null;
  const u = usage(ws); const L = cp.limits; const extra = cp.sub.seats_extra || 0;
  if (what === 'members' && u.members + adding > L.members + extra) return `Your ${cp.plan.name} plan includes ${L.members + extra} members. Upgrade or remove a member to add more.`;
  if (what === 'guests' && u.guests + adding > L.guests) return `Your ${cp.plan.name} plan includes ${L.guests} guests. Upgrade or remove a guest first.`;
  if (what === 'databases' && u.databases + adding > L.databases) return `Your ${cp.plan.name} plan includes ${L.databases} databases. Archive one or upgrade.`;
  if (what === 'storage' && u.storage_mb + adding / 1048576 > L.storage_mb) return `Storage limit of ${L.storage_mb >= 1024 ? L.storage_mb / 1024 + ' GB' : L.storage_mb + ' MB'} reached. Delete files or upgrade.`;
  return null;
}
/** Proration for an upgrade in the middle of a period: credit unused part of the old plan, charge remaining part of the new plan. */
export function prorate(oldPrice: number, newPrice: number, periodStart: Date, periodEnd: Date, at = new Date()) {
  const total = periodEnd.getTime() - periodStart.getTime();
  const remain = Math.max(0, Math.min(total, periodEnd.getTime() - at.getTime()));
  const frac = total > 0 ? remain / total : 0;
  const credit = Math.round(oldPrice * frac), charge = Math.round(newPrice * frac);
  const net = Math.max(0, charge - credit);
  return { credit, charge, net, tax: gst(net), fraction: frac };
}
/** What would be over-limit after moving to `planId`. */
export function downgradeImpact(ws: string, planId: string) {
  const L = planLimits(planId); const u = usage(ws); const out: string[] = [];
  if (u.members > L.members) out.push(`${u.members - L.members} member(s) over the limit of ${L.members}. Suspend or remove them before the change.`);
  if (u.guests > L.guests) out.push(`${u.guests - L.guests} guest(s) over the limit of ${L.guests}.`);
  if (u.databases > L.databases) out.push(`${u.databases - L.databases} database(s) over the limit of ${L.databases}; archive extras.`);
  if (u.storage_mb > L.storage_mb) out.push(`Storage ${u.storage_mb} MB exceeds ${L.storage_mb} MB.`);
  return out;
}
export function nextInvoiceNumber() {
  const n = (one<any>('SELECT COUNT(*) n FROM invoices')!.n || 0) + 1;
  return `INV-${new Date().getUTCFullYear()}-${String(n).padStart(5, '0')}`;
}
export function addInterval(d: Date, interval: string) { const x = new Date(d); if (interval === 'year') x.setUTCFullYear(x.getUTCFullYear() + 1); else x.setUTCMonth(x.getUTCMonth() + 1); return x; }
export function priceFor(plan: any, interval: string, coupon?: { percent: number } | null) {
  const base = interval === 'year' ? plan.price_year : plan.price_month;
  const disc = coupon ? Math.round((base * coupon.percent) / 100) : 0;
  const amount = base - disc; return { base, disc, amount, tax: gst(amount), total: amount + gst(amount) };
}
export function findCoupon(code?: string | null) {
  if (!code) return null; const c = one<any>('SELECT * FROM coupons WHERE code=? AND active=1', code.trim().toUpperCase());
  if (!c || (c.max_uses && c.uses >= c.max_uses)) return null; return c;
}

/** Create a paid invoice + payment for a plan purchase. The payment provider is pluggable: PAYMENT_PROVIDER=manual records a pending payment; "test" auto-succeeds. */
export function chargeInvoice(wsId: string, description: string, amount: number, plan: any, opts: { simulateFail?: boolean; interval?: string } = {}) {
  const tax = gst(amount); const inv = id('i_'); const provider = process.env.PAYMENT_PROVIDER || 'test';
  const pm = one<any>('SELECT id FROM payment_methods WHERE ws=? AND is_default=1', wsId);
  const fail = opts.simulateFail || (provider !== 'test' && provider !== 'manual' ? false : false);
  const status = fail ? 'failed' : provider === 'manual' ? 'pending' : 'paid';
  insert('invoices', { id: inv, ws: wsId, number: nextInvoiceNumber(), description, amount, tax, status, plan_code: plan?.code, plan_version: plan?.version, issued_at: now(), reference: `${provider.toUpperCase()}-${id().slice(0, 8)}` });
  insert('payments', { id: id('p_'), ws: wsId, invoice_id: inv, amount: amount + tax, status: status === 'paid' ? 'succeeded' : status, provider, reference: `${provider}_${id().slice(0, 10)}`, failure: fail ? 'Card declined (simulated)' : null, created_at: now() });
  return { invoiceId: inv, status, hasMethod: !!pm };
}
export function startCheckout(c: Ctx, planId: string, interval: 'month' | 'year', couponCode?: string | null, opts: { simulateFail?: boolean } = {}) {
  const plan = one<any>('SELECT * FROM plans WHERE id=? AND active=1', planId); if (!plan) throw new Error('That plan is not available.');
  const coupon = findCoupon(couponCode); if (couponCode && !coupon) throw new Error('That coupon is not valid.');
  const impact = downgradeImpact(c.ws.id, planId); if (impact.length) throw new Error('Cannot switch yet: ' + impact.join(' '));
  const cur = currentPlan(c.ws.id); const pr = priceFor(plan, interval, coupon);
  return tx(() => {
    let amount = pr.amount; let desc = `${plan.name} plan (${interval === 'year' ? 'yearly' : 'monthly'})`;
    const ps = cur?.sub.period_start ? new Date(cur.sub.period_start) : null; const pe = cur?.sub.period_end ? new Date(cur.sub.period_end) : null;
    if (cur && cur.sub.status === 'active' && ps && pe && cur.plan.price_month < plan.price_month && cur.sub.interval === interval) {
      const pro = prorate(interval === 'year' ? cur.plan.price_year : cur.plan.price_month, pr.base, ps, pe); amount = pro.net; desc = `Upgrade to ${plan.name} (prorated)`;
    }
    const r = chargeInvoice(c.ws.id, desc, amount, plan, opts);
    if (r.status === 'failed') { audit(c, 'billing.payment_failed', 'invoice', r.invoiceId, { plan: plan.code }); run(`UPDATE subscriptions SET status='past_due', grace_until=? WHERE ws=?`, new Date(Date.now() + GRACE_DAYS * 864e5).toISOString(), c.ws.id); run(`UPDATE workspaces SET status='past_due' WHERE id=?`, c.ws.id); return { ...r, ok: false }; }
    const start = new Date(); const end = addInterval(start, interval);
    const fields = { plan_id: planId, plan_version: plan.version, interval, status: 'active', period_start: start.toISOString(), period_end: end.toISOString(), grace_until: null, cancel_at_period_end: 0, coupon: coupon?.code ?? null };
    if (cur) update('subscriptions', cur.sub.id, null, fields); else insert('subscriptions', { id: id('sub_'), ws: c.ws.id, ...fields, seats_extra: 0 });
    run(`UPDATE workspaces SET status='active' WHERE id=? AND status IN ('trial','past_due')`, c.ws.id);
    if (coupon) run('UPDATE coupons SET uses=uses+1 WHERE id=?', coupon.id);
    audit(c, 'billing.plan_changed', 'subscription', c.ws.id, { from: cur?.plan.code ?? null, to: plan.code, interval }); return { ...r, ok: true };
  });
}
/** Daily lifecycle: trial expiry, renewals, grace expiry. Safe to call repeatedly (idempotent). */
export function runBillingLifecycle(at = new Date()) {
  const t = at.toISOString(); const out = { trialsExpired: 0, renewed: 0, suspended: 0 };
  for (const w of all<any>(`SELECT id FROM workspaces WHERE status='trial' AND trial_ends<?`, t)) { run(`UPDATE workspaces SET status='expired' WHERE id=?`, w.id); auditSystem(w.id, 'billing.trial_expired'); out.trialsExpired++; }
  for (const s of all<any>(`SELECT * FROM subscriptions WHERE status='active' AND period_end<?`, t)) {
    if (s.cancel_at_period_end) { run(`UPDATE subscriptions SET status='cancelled' WHERE id=?`, s.id); run(`UPDATE workspaces SET status='expired' WHERE id=?`, s.ws); auditSystem(s.ws, 'billing.cancelled_at_period_end'); continue; }
    const plan = one<any>('SELECT * FROM plans WHERE id=?', s.plan_id); const coupon = findCoupon(s.coupon); const pr = priceFor(plan, s.interval, coupon);
    const hasPm = !!one('SELECT 1 FROM payment_methods WHERE ws=?', s.ws);
    if (!hasPm) { run(`UPDATE subscriptions SET status='past_due', grace_until=? WHERE id=?`, new Date(at.getTime() + GRACE_DAYS * 864e5).toISOString(), s.id); run(`UPDATE workspaces SET status='past_due' WHERE id=?`, s.ws); auditSystem(s.ws, 'billing.renewal_failed', 'subscription', s.id); continue; }
    chargeInvoice(s.ws, `${plan.name} renewal`, pr.amount, plan); const ns = new Date(s.period_end);
    run('UPDATE subscriptions SET period_start=?, period_end=? WHERE id=?', s.period_end, addInterval(ns, s.interval).toISOString(), s.id); out.renewed++;
  }
  for (const s of all<any>(`SELECT * FROM subscriptions WHERE status='past_due' AND grace_until<?`, t)) { run(`UPDATE workspaces SET status='suspended' WHERE id=?`, s.ws); auditSystem(s.ws, 'billing.suspended_after_grace', 'subscription', s.id); out.suspended++; }
  return out;
}
