import Link from 'next/link';
import { requirePlatform } from '@/lib/ctx';
import { PLATFORM_PERMS, PLATFORM_ROLES } from '@/lib/perm';
import { Logo } from '@/components/SiteShell';
import { Icon } from '@/components/ui';
export const dynamic = 'force-dynamic';
const NAV: [string, string, string, string][] = [['/platform', 'Overview', 'home', 'overview'], ['/platform/businesses', 'Businesses', 'building', 'businesses'], ['/platform/plans', 'Plans & coupons', 'receipt', 'plans'], ['/platform/billing', 'Invoices & payments', 'chart', 'billing'], ['/platform/support', 'Support', 'users', 'support'], ['/platform/ops', 'Operations', 'bolt', 'ops'], ['/platform/staff', 'Platform staff', 'shield', 'staff'], ['/platform/audit', 'Audit log', 'eye', 'audit'], ['/platform/settings', 'Announcements & settings', 'settings', 'settings']];
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePlatform('overview'); const allowed = PLATFORM_PERMS[s.role] || [];
  return (<div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><aside className="border-b border-line bg-surface lg:min-h-screen lg:border-b-0 lg:border-r"><div className="flex items-center justify-between p-4"><Logo href="/platform" /><span className="rounded bg-ink px-2 py-0.5 text-xs text-white">Platform</span></div>
    <nav aria-label="Platform" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">{NAV.filter(n => allowed.includes(n[3]) || (n[3] === 'settings' && allowed.includes('announce'))).map(([h, l, ic]) => <Link key={h} href={h} className="flex min-h-[40px] items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:bg-brandSoft hover:text-brand"><Icon name={ic} />{l}</Link>)}</nav>
    <p className="px-4 pb-4 text-xs text-muted">{s.user.name} · {(PLATFORM_ROLES as any)[s.role]}<br /><Link className="link" href="/workspaces">Back to workspaces</Link></p></aside>
    <main id="main" className="min-w-0 p-4 sm:p-6">{children}</main></div>);
}
