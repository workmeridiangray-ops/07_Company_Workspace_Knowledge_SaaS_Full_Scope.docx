import Link from 'next/link';
import { Alert } from '@/components/ui';
export default async function Denied({ searchParams }: { searchParams: Promise<{ why?: string }> }) {
  const why = (await searchParams).why;
  const msg = why === 'suspended' ? 'Your access to this workspace has been suspended by an administrator.' : why === 'closed' ? 'This workspace has been closed.' : 'You do not have access to this page. If you think you should, ask a workspace owner.';
  return (<div className="card p-6"><h1 className="text-xl font-semibold">Access denied</h1><div className="mt-3"><Alert tone="bad">{msg}</Alert></div><p className="mt-4 flex gap-3"><Link className="btn-primary" href="/workspaces">Your workspaces</Link><Link className="btn-secondary" href="/">Home</Link></p></div>);
}
