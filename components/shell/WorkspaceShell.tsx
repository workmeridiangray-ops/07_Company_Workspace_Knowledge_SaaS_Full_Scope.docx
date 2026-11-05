import Link from 'next/link';
import type { Ctx } from '@/lib/ctx';
import { userWorkspaces } from '@/lib/ctx';
import { one, J } from '@/lib/db';
import { Icon, Alert } from '../ui';
import { signOut } from '@/lib/auth-actions';
import { currentPlan } from '@/lib/billing';
import { Logo } from '../SiteShell';

const MAIN: [string, string, string][] = [['', 'Home', 'home'], ['/search', 'Search', 'search'], ['/inbox', 'Inbox', 'bell'], ['/teamspaces', 'Teamspaces', 'building'], ['/pages', 'Pages', 'page'], ['/files', 'Files', 'box'], ['/databases', 'Databases', 'db'], ['/tasks', 'Tasks', 'task'], ['/projects', 'Projects', 'flag'], ['/goals', 'Goals', 'goal'], ['/knowledge', 'Knowledge & SOPs', 'book'], ['/meetings', 'Meetings', 'cal'], ['/templates', 'Templates', 'grid'], ['/forms', 'Forms', 'form'], ['/automations', 'Automations', 'bolt'], ['/integrations', 'Integrations', 'plug']];
const ADMIN: [string, string, string, string][] = [['/admin/members', 'Members', 'users', 'members.manage'], ['/admin/roles', 'Roles', 'shield', 'roles.manage'], ['/admin/sharing', 'Sharing & guests', 'share', 'content.share'], ['/admin/billing', 'Billing', 'receipt', 'billing.manage'], ['/admin/usage', 'Usage & content', 'chart', 'audit.view'], ['/admin/audit', 'Audit trail', 'eye', 'audit.view'], ['/admin/export', 'Export & closure', 'download', 'content.export'], ['/admin/settings', 'Settings', 'settings', 'workspace.configure'], ['/admin/support', 'Support', 'warn', 'members.manage']];

export function WorkspaceShell({ ctx, children, unread }: { ctx: Ctx; children: React.ReactNode; unread: number }) {
  const base = `/w/${ctx.ws.slug}`; const spaces = userWorkspaces(ctx.user.id);
  const cp = currentPlan(ctx.ws.id); const accent = J<any>(ctx.ws.branding, {}).accent || '#244B78';
  const trialDays = ctx.ws.trial_ends ? Math.ceil((new Date(ctx.ws.trial_ends).getTime() - Date.now()) / 864e5) : 0;
  const sub = cp?.sub;
  const nav = (
    <nav aria-label="Workspace" className="flex flex-col gap-0.5 p-3 text-sm">
      {MAIN.map(([h, l, ic]) => (<Link key={l} href={base + h} className="flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-muted hover:bg-brandSoft hover:text-brand"><Icon name={ic} />{l}{l === 'Inbox' && unread > 0 && <span className="ml-auto rounded-full bg-brand px-2 text-xs text-white" aria-label={`${unread} unread`}>{unread}</span>}</Link>))}
      {ADMIN.some(a => ctx.perms.has(a[3])) && <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Administration</p>}
      {ADMIN.filter(a => ctx.perms.has(a[3])).map(([h, l, ic]) => (<Link key={l} href={base + h} className="flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-muted hover:bg-brandSoft hover:text-brand"><Icon name={ic} />{l}</Link>))}
    </nav>
  );
  return (
    <div className="min-h-screen" style={{ ['--accent' as any]: accent }}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3">
        <details className="relative lg:hidden"><summary className="btn-ghost btn-sm cursor-pointer list-none" aria-label="Open navigation"><Icon name="menu" /></summary>
          <div className="absolute left-0 top-10 max-h-[80vh] w-72 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">{nav}</div></details>
        <div className="hidden lg:block"><Logo href={base} /></div>
        <details className="relative"><summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-bg" aria-label={`Workspace: ${ctx.ws.name}. Switch workspace`}><Icon name="building" size={16} /><span className="max-w-[10rem] truncate">{ctx.ws.name}</span><Icon name="chev" size={14} className="rotate-90" /></summary>
          <div className="absolute left-0 top-11 w-64 rounded-lg border border-line bg-surface p-1 shadow-lg"><p className="px-3 py-1.5 text-xs font-semibold uppercase text-muted">Switch workspace</p>
            {spaces.map(w => <Link key={w.id} href={`/w/${w.slug}`} className={`block rounded-lg px-3 py-2 text-sm hover:bg-bg ${w.id === ctx.ws.id ? 'font-semibold text-brand' : ''}`}>{w.name}<span className="block text-xs font-normal text-muted">{w.role_name}</span></Link>)}
            <Link href="/workspaces" className="block rounded-lg px-3 py-2 text-sm text-brand hover:bg-bg">All workspaces / create new</Link></div></details>
        <form action={`${base}/search`} role="search" className="mx-2 hidden max-w-md flex-1 md:block"><label className="sr-only" htmlFor="gq">Search workspace</label><input id="gq" name="q" className="input min-h-[36px]" placeholder="Search pages, records, tasks…" /></form>
        <div className="ml-auto flex items-center gap-1">
          <Link href={`${base}/search`} className="btn-ghost btn-sm md:hidden" aria-label="Search"><Icon name="search" /></Link>
          <Link href={`${base}/inbox`} className="btn-ghost btn-sm relative" aria-label={`Inbox, ${unread} unread`}><Icon name="bell" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand" />}</Link>
          <Link href="/help" className="btn-ghost btn-sm hidden sm:inline-flex">Help</Link>
          <details className="relative"><summary className="btn-ghost btn-sm cursor-pointer list-none" aria-label="Account menu"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{ctx.user.name.slice(0, 1).toUpperCase()}</span></summary>
            <div className="absolute right-0 top-11 w-56 rounded-lg border border-line bg-surface p-1 shadow-lg"><p className="px-3 py-2 text-sm"><strong className="block">{ctx.user.name}</strong><span className="text-muted">{ctx.role.name}</span></p>
              <Link href="/account/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-bg">Account settings</Link><Link href="/workspaces" className="block rounded-lg px-3 py-2 text-sm hover:bg-bg">All workspaces</Link>
              {ctx.user.platform_role && <Link href="/platform" className="block rounded-lg px-3 py-2 text-sm hover:bg-bg">Platform admin</Link>}
              <form action={signOut}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg">Sign out</button></form></div></details>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-line bg-surface lg:block">{nav}</aside>
        <div className="min-w-0">
          <div className="space-y-2 px-4 pt-4 sm:px-6">
            {ctx.ws.status === 'trial' && <Alert tone="brand">Free trial: <strong>{Math.max(0, trialDays)} day{trialDays === 1 ? '' : 's'}</strong> left. {ctx.perms.has('billing.manage') ? <Link className="link" href={`${base}/admin/billing`}>Choose a plan</Link> : 'Ask an owner to choose a plan.'}</Alert>}
            {ctx.ws.status === 'past_due' && <Alert tone="warn" title="Payment failed">Everything keeps working until {sub?.grace_until ? new Date(sub.grace_until).toLocaleDateString('en-IN') : 'the grace period ends'}. After that the workspace becomes read-only. {ctx.perms.has('billing.manage') && <Link className="link" href={`${base}/admin/billing`}>Update payment</Link>}</Alert>}
            {['suspended', 'expired'].includes(ctx.ws.status) && <Alert tone="bad" title={ctx.ws.status === 'expired' ? 'Trial or subscription ended' : 'Workspace suspended'}>Your content is safe and you can still read and export it. Editing resumes once billing is resolved. {ctx.perms.has('billing.manage') && <Link className="link" href={`${base}/admin/billing`}>Go to billing</Link>}</Alert>}
            {ctx.ws.status === 'closing' && <Alert tone="warn" title="Workspace is closing">Data stays available for export until the closure date. <Link className="link" href={`${base}/admin/export`}>Export now</Link></Alert>}
          </div>
          <main id="main" className="px-4 py-5 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
