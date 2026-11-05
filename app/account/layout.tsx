import Link from 'next/link';
import { requireUser } from '@/lib/ctx';
import { Logo } from '@/components/SiteShell';
import { Tabs } from '@/components/ui';
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between"><Logo href="/workspaces" /><Link href="/workspaces" className="btn-ghost btn-sm">All workspaces</Link></div>
      <h1 className="text-2xl font-semibold">Account</h1><p className="mb-4 text-muted">{s.user.email}</p>
      <nav aria-label="Account sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">{[['profile', 'Profile'], ['security', 'Security'], ['sessions', 'Active sessions'], ['notifications', 'Notifications']].map(([k, l]) => <Link key={k} href={`/account/${k}`} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted hover:text-ink">{l}</Link>)}</nav>
      <main id="main">{children}</main>
    </div>
  );
}
