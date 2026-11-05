import Link from 'next/link';
import { Icon } from './ui';
import { BRAND } from '@/lib/site';
import { getSession } from '@/lib/ctx';

export function Logo({ href = '/' }: { href?: string }) {
  return (<Link href={href} className="inline-flex items-center gap-2 font-semibold text-ink"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"><Icon name="page" size={18} /></span>{BRAND}</Link>);
}
const NAV = [['/features', 'Features'], ['/solutions', 'Solutions'], ['/pricing', 'Pricing'], ['/help', 'Help']];
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const s = await getSession(); const signedIn = !!(s && !s.expired && !s.pending2fa);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">{NAV.map(([h, l]) => <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-ink">{l}</Link>)}</nav>
          <div className="flex items-center gap-2">
            {signedIn ? <Link href="/workspaces" className="btn-primary btn-sm">Open workspace</Link> : <><Link href="/login" className="btn-ghost btn-sm">Sign in</Link><Link href="/signup" className="btn-primary btn-sm">Start free trial</Link></>}
          </div>
        </div>
        <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1 md:hidden">{NAV.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted">{l}</Link>)}</nav>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-4">
          <div><Logo /><p className="mt-2 text-muted">Documents, data and decisions in one isolated workspace.</p></div>
          <div><p className="font-semibold">Product</p><ul className="mt-2 space-y-1 text-muted"><li><Link href="/features">Features</Link></li><li><Link href="/solutions">Solutions</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/add-ons">Add-ons</Link></li><li><Link href="/updates">Updates</Link></li></ul></div>
          <div><p className="font-semibold">Company</p><ul className="mt-2 space-y-1 text-muted"><li><Link href="/demo">Book a demo</Link></li><li><Link href="/contact">Contact</Link></li><li><Link href="/help">Help centre</Link></li></ul></div>
          <div><p className="font-semibold">Legal</p><ul className="mt-2 space-y-1 text-muted"><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/security">Security</Link></li><li><Link href="/legal/refunds">Refunds</Link></li><li><Link href="/legal/cookies">Cookies</Link></li></ul></div>
        </div>
      </footer>
    </div>
  );
}
