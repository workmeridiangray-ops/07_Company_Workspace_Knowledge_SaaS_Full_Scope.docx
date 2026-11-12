import { requirePlatform } from '@/lib/ctx';
import { all } from '@/lib/db';
import { PageHeader, Table, Badge, Card } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { addStaffAction, removeStaffAction } from '@/lib/platform-actions';
import { PLATFORM_ROLES, PLATFORM_PERMS } from '@/lib/perm';
export const dynamic = 'force-dynamic';
export default async function Staff() {
  const s = await requirePlatform('staff'); const staff = all<any>(`SELECT id,name,email,platform_role FROM users WHERE platform_role IS NOT NULL ORDER BY platform_role, name`);
  return (<div><PageHeader title="Platform staff" subtitle="Roles are separated: billing cannot open customer content, support cannot refund, and operations cannot see invoices." />
    <Table head={['Person', 'Role', 'Can access', '']} caption="Staff">{staff.map(u => <tr key={u.id}><td className="td font-medium">{u.name}<span className="block text-xs text-muted">{u.email}</span></td><td className="td"><Badge tone="brand">{(PLATFORM_ROLES as any)[u.platform_role]}</Badge></td><td className="td text-xs text-muted">{PLATFORM_PERMS[u.platform_role].join(', ')}</td><td className="td text-right">{u.id !== s.user.id && <ActionButton action={removeStaffAction.bind(null, u.id)} small variant="ghost" confirm={`Remove platform access for ${u.name}? Their sessions end.`}>Remove</ActionButton>}</td></tr>)}</Table>
    <Card title="Grant platform access" className="mt-5"><ActionForm action={addStaffAction} className="grid gap-3 sm:grid-cols-3 sm:items-end" resetOnSuccess><div><label className="label" htmlFor="se">Account email</label><input id="se" name="email" type="email" className="input" required /></div><div><label className="label" htmlFor="sr">Role</label><select id="sr" name="role" className="input">{Object.entries(PLATFORM_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><Submit>Grant</Submit></ActionForm></Card></div>);
}
