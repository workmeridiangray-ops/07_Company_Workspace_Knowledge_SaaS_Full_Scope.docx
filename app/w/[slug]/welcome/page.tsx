import Link from 'next/link';
import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { PageHeader, Icon, Badge, Card } from '@/components/ui';
import { ActionButton } from '@/components/ActionForm';
import { completeSetupAction } from '@/lib/ws-actions';
import { usage } from '@/lib/billing';
export const metadata: Metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';
export default async function Welcome({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug); const base = `/w/${slug}`; const setup = J<any>(c.ws.setup, {}); const u = usage(c.ws.id); const b = J<any>(c.ws.billing, {});
  const steps = [
    { key: 'business', title: 'Confirm business details', body: 'Business name, time zone and billing contact.', href: `${base}/admin/settings`, done: !!(b.legalName || setup.business) },
    { key: 'brand', title: 'Choose your brand colour', body: 'Pick the accent colour members see.', href: `${base}/admin/settings`, done: !!setup.brand },
    { key: 'team', title: 'Invite your team', body: 'Members get full access by role; guests see only what you share.', href: `${base}/admin/members`, done: u.members > 1 },
    { key: 'import', title: 'Import existing data', body: 'Upload a CSV into a database like Clients.', href: `${base}/databases`, done: !!one('SELECT 1 FROM imports WHERE ws=?', c.ws.id) },
    { key: 'page', title: 'Write your first page', body: 'Plans, notes, proposals - anything.', href: `${base}/pages`, done: u.pages > 1 },
    { key: 'sop', title: 'Publish your first SOP', body: 'Draft, review and publish a controlled procedure.', href: `${base}/knowledge`, done: !!one(`SELECT 1 FROM sops WHERE ws=? AND published_version IS NOT NULL`, c.ws.id) },
    { key: 'plan', title: 'Pick a plan', body: 'Your trial includes Team limits. Choose monthly or yearly billing.', href: `${base}/admin/billing`, done: c.ws.status === 'active' },
  ];
  const done = steps.filter(s => s.done || setup[s.key]).length;
  return (<div className="mx-auto max-w-3xl"><PageHeader title={`Welcome to ${c.ws.name}`} subtitle="A short checklist to get your workspace ready. Progress is saved automatically." />
    <div className="mb-5"><div className="h-2.5 rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Setup progress"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} /></div><p className="mt-1 text-sm text-muted">{done} of {steps.length} done</p></div>
    <ul className="space-y-3">{steps.map(s => { const d = s.done || setup[s.key]; return (<li key={s.key} className="card flex flex-wrap items-center gap-3 p-4"><span className={`grid h-7 w-7 place-items-center rounded-full ${d ? 'bg-ok text-white' : 'border border-line'}`}>{d && <Icon name="check" size={16} />}</span><div className="min-w-0 flex-1"><p className="font-medium">{s.title} {d && <Badge tone="ok">Done</Badge>}</p><p className="text-sm text-muted">{s.body}</p></div><Link href={s.href} className="btn-secondary btn-sm">Open</Link>{!d && c.perms.has('workspace.configure') && <ActionButton action={completeSetupAction.bind(null, slug, s.key)} small variant="ghost">Skip</ActionButton>}</li>); })}</ul>
    <p className="mt-6"><Link className="btn-primary" href={base}>Go to workspace home</Link></p></div>);
}
