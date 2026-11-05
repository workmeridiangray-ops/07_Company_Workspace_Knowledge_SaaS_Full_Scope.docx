import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, J } from '@/lib/db';
import { PageHeader, Card, Badge } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { saveRoleAction, deleteRoleAction } from '@/lib/admin-actions';
import { PERMS, SENSITIVE, type Perm } from '@/lib/perm';
export const metadata: Metadata = { title: 'Roles' };
export const dynamic = 'force-dynamic';
function RoleEditor({ slug, role }: { slug: string; role?: any }) {
  const perms = new Set<string>(role ? J<string[]>(role.perms, []) : ['content.view']); const fixed = role?.name === 'Owner';
  return (<ActionForm action={saveRoleAction.bind(null, slug, role?.id || null)} className="space-y-3"><div><label className="label" htmlFor={`rn-${role?.id || 'new'}`}>Role name</label><input id={`rn-${role?.id || 'new'}`} name="name" defaultValue={role?.name} className="input max-w-sm" readOnly={role?.builtin} required /></div>
    <fieldset disabled={fixed}><legend className="label">Allowed actions</legend><div className="grid gap-1 sm:grid-cols-2">{(Object.keys(PERMS) as Perm[]).map(p => <label key={p} className="flex items-start gap-2 text-sm"><input type="checkbox" name="perm" value={p} defaultChecked={perms.has(p)} className="mt-1 h-4 w-4" /><span>{PERMS[p]} {SENSITIVE.includes(p) && <Badge tone="warn">sensitive</Badge>}</span></label>)}</div></fieldset>
    {!fixed && <div className="flex gap-2"><Submit>{role ? 'Save role' : 'Create role'}</Submit>{role && !role.builtin && <ActionButton action={deleteRoleAction.bind(null, slug, role.id)} variant="ghost" confirm="Delete this role?">Delete</ActionButton>}</div>}{fixed && <p className="text-sm text-muted">Owner has every permission and cannot be edited.</p>}</ActionForm>);
}
export default async function Roles({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'roles.manage'); const roles = all<any>(`SELECT r.*, (SELECT COUNT(*) FROM memberships m WHERE m.role_id=r.id) AS n FROM roles r WHERE ws=? ORDER BY builtin DESC, name`, c.ws.id);
  return (<div><PageHeader title="Roles and permissions" subtitle="Permissions are enforced on the server for every page, record, export, search and background job. Page and record access also depends on sharing and teamspaces." />
    <div className="space-y-4">{roles.map(r => <details key={r.id} className="card"><summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold">{r.name}<span className="font-normal text-muted text-sm">{r.n} member{r.n === 1 ? '' : 's'} · {r.builtin ? 'built-in' : 'custom'}</span></summary><div className="border-t border-line p-4"><RoleEditor slug={slug} role={r} /></div></details>)}</div>
    <Card title="Create a custom role" className="mt-6"><RoleEditor slug={slug} /></Card></div>);
}
