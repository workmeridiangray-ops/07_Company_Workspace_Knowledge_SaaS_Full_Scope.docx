import { requireCtx } from '@/lib/ctx';
import { all } from '@/lib/db';
import { visibleDatabases } from '@/lib/access';
import { PageHeader } from '@/components/ui';
import { AutomationForm } from '@/components/AutomationForm';
export default async function NewAuto({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'automation.manage'); const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active'`, c.ws.id);
  return (<div className="mx-auto max-w-3xl"><PageHeader crumbs={[{ href: `/w/${slug}/automations`, label: 'Automations' }, { label: 'New' }]} title="New automation" /><AutomationForm slug={slug} dbs={visibleDatabases(c)} people={people} /></div>);
}
