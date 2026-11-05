import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { visibleDatabases } from '@/lib/access';
import { PageHeader, Card, Table, Status, fmtDateTime, Badge } from '@/components/ui';
import { AutomationForm } from '@/components/AutomationForm';
import { ActionButton } from '@/components/ActionForm';
import { testAutomationAction, toggleAutomationAction } from '@/lib/auto-actions';
export const dynamic = 'force-dynamic';
export default async function Auto({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const c = await requireCtx(slug); const a = one<any>('SELECT * FROM automations WHERE id=? AND ws=?', id, c.ws.id); if (!a) notFound();
  const runs = all<any>('SELECT * FROM automation_runs WHERE automation_id=? AND ws=? ORDER BY created_at DESC LIMIT 20', id, c.ws.id); const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active'`, c.ws.id); const can = c.perms.has('automation.manage');
  return (<div className="mx-auto max-w-4xl"><PageHeader crumbs={[{ href: `/w/${slug}/automations`, label: 'Automations' }, { label: a.name }]} title={a.name} actions={<>{a.active ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}{can && <ActionButton action={testAutomationAction.bind(null, slug, id)} small>Test (dry run)</ActionButton>}{can && (a.active ? <ActionButton action={toggleAutomationAction.bind(null, slug, id, false)} small variant="ghost">Turn off</ActionButton> : <ActionButton action={toggleAutomationAction.bind(null, slug, id, true)} small variant="primary">Turn on</ActionButton>)}</>} />
    <Card title="Run history" className="mb-5">{runs.length === 0 ? <p className="text-sm text-muted">Not run yet.</p> : <Table head={['When', 'Result', 'What happened']} caption="Runs">{runs.map(r => <tr key={r.id}><td className="td">{fmtDateTime(r.created_at, c.ws.timezone)}</td><td className="td"><Status value={r.status === 'ok' ? 'completed' : r.status === 'failed' ? 'failed' : 'draft'} /></td><td className="td">{r.detail}</td></tr>)}</Table>}</Card>
    {can && <Card title="Edit rule"><AutomationForm slug={slug} dbs={visibleDatabases(c)} people={people} a={a} /></Card>}</div>);
}
