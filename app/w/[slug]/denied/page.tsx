import Link from 'next/link';
import { requireCtx } from '@/lib/ctx';
import { PageHeader, Alert } from '@/components/ui';
import { PERMS } from '@/lib/perm';
export default async function Denied({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ need?: string }> }) {
  const slug = (await params).slug; const need = (await searchParams).need as keyof typeof PERMS | undefined; const c = await requireCtx(slug);
  return (<div className="mx-auto max-w-lg"><PageHeader title="You don’t have permission" /><Alert tone="bad">{need && PERMS[need] ? <>Your role (<strong>{c.role.name}</strong>) cannot: {PERMS[need].toLowerCase()}.</> : 'Your role does not allow this.'} Ask a workspace owner if you need access.</Alert><p className="mt-4"><Link className="btn-primary" href={`/w/${slug}`}>Back to home</Link></p></div>);
}
