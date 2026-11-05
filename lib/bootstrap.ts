import { one, insert, id, now } from './db';
export const PLAN_SEED = [
  { code: 'starter', name: 'Starter', price_month: 1499, price_year: 14990, limits: { members: 5, guests: 2, storage_mb: 1024, databases: 5, history_days: 14 }, features: ['Up to 5 members', '2 guests', '1 GB storage', '5 databases', '14-day version history', 'Email support'] },
  { code: 'team', name: 'Team', price_month: 4999, price_year: 49990, limits: { members: 25, guests: 10, storage_mb: 25600, databases: 50, history_days: 90 }, features: ['Up to 25 members', '10 guests', '25 GB storage', '50 databases', '90-day version history', 'Controlled SOPs and acknowledgements', 'Forms, automations and webhooks'] },
  { code: 'business', name: 'Business', price_month: 14999, price_year: 149990, limits: { members: 100, guests: 50, storage_mb: 204800, databases: 1000, history_days: 365 }, features: ['Up to 100 members', '50 guests', '200 GB storage', 'Unlimited databases*', '365-day version history', 'Access reviews and audit export', 'Priority support'] },
];
export function ensureBase() {
  for (const p of PLAN_SEED) if (!one('SELECT 1 FROM plans WHERE code=?', p.code)) insert('plans', { id: 'plan_' + p.code, code: p.code, name: p.name, price_month: p.price_month, price_year: p.price_year, limits: JSON.stringify(p.limits), features: JSON.stringify(p.features), version: 1, effective_from: '2026-01-01T00:00:00.000Z', active: 1 });
  if (!one(`SELECT 1 FROM coupons WHERE code='LAUNCH20'`)) insert('coupons', { id: id('cp_'), code: 'LAUNCH20', percent: 20, active: 1, uses: 0, max_uses: 500 });
}
