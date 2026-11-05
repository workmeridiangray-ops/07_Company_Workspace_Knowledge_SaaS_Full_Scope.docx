import { requireUser } from '@/lib/ctx';
import { all } from '@/lib/db';
import { ActionButton } from '@/components/ActionForm';
import { revokeSession, revokeOthers } from '@/lib/auth-actions';
import { Badge, Table, fmtDateTime } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function Sessions() {
  const s = await requireUser();
  const rows = all<any>(`SELECT * FROM sessions WHERE user_id=? AND revoked=0 AND expires_at>? ORDER BY last_seen DESC`, s.user.id, new Date().toISOString());
  return (
    <div><div className="mb-3 flex items-center justify-between"><p className="text-muted">Devices currently signed in to your account.</p><ActionButton action={revokeOthers} confirm="Sign out of all other devices?" small>Sign out other devices</ActionButton></div>
      <Table head={['Device', 'IP', 'Last active', '']} caption="Active sessions">
        {rows.map(r => (<tr key={r.id}><td className="td max-w-xs truncate">{r.ua || 'Unknown'} {r.id === s.sessionId && <Badge tone="brand">This device</Badge>}</td><td className="td">{r.ip || '-'}</td><td className="td">{fmtDateTime(r.last_seen)}</td><td className="td text-right"><ActionButton action={revokeSession.bind(null, r.id)} variant="ghost" small confirm="End this session?">Revoke</ActionButton></td></tr>))}
      </Table></div>
  );
}
