import { requireCtx } from '@/lib/ctx';
import { WorkspaceShell } from '@/components/shell/WorkspaceShell';
import { one } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function WsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const ctx = await requireCtx((await params).slug);
  const unread = one<any>('SELECT COUNT(*) n FROM notifications WHERE ws=? AND user_id=? AND read=0', ctx.ws.id, ctx.user.id)!.n;
  return <WorkspaceShell ctx={ctx} unread={unread}>{children}</WorkspaceShell>;
}
