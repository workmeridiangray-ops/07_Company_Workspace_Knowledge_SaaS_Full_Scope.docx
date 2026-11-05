import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, J } from '@/lib/db';
import { PageHeader, Empty, Badge, Icon, ago } from '@/components/ui';
import { EVENTS } from '@/lib/svc/auto';
export const metadata: Metadata = { title: 'Automations' };
export const dynamic = 'force-dynamic';
export default async function Automations({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const list = all<any>('SELECT * FROM automations WHERE ws=? ORDER BY created_at DESC', c.ws.id);
  return (<div><PageHeader title="Automations" subtitle="Simple rules: when something happens, check conditions, then act. Every rule is tested before it can run, and rules never trigger other rules." actions={c.perms.has('automation.manage') && <Link className="btn-primary btn-sm" href={`/w/${slug}/automations/new`}><Icon name="plus" size={16} /> New rule</Link>} />
    {list.length === 0 ? <Empty title="No automations" icon="bolt">For example: when a client becomes Active, create an onboarding task.</Empty> : <ul className="card divide-y divide-line">{list.map(a => <li key={a.id}><Link href={`/w/${slug}/automations/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-bg"><span className="min-w-0 flex-1"><span className="font-medium">{a.name}</span><span className="block text-xs text-muted">When: {EVENTS.find(e => e[0] === J<any>(a.trigger, {}).event)?.[1]} · {a.runs} runs{a.last_run ? ` · last ${ago(a.last_run)}` : ''}</span></span>{a.active ? <Badge tone="ok">On</Badge> : a.tested ? <Badge tone="warn">Tested, off</Badge> : <Badge>Untested</Badge>}</Link></li>)}</ul>}</div>);
}
