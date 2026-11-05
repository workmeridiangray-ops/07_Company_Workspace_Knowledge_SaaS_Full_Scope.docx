import { requireCtx } from '@/lib/ctx';
import { PageHeader } from '@/components/ui';
import { TemplateForm } from '@/components/TemplateForm';
export default async function NewTemplate({ params }: { params: Promise<{ slug: string }> }) { const slug = (await params).slug; await requireCtx(slug, 'schema.manage'); return (<div className="mx-auto max-w-3xl"><PageHeader crumbs={[{ href: `/w/${slug}/templates`, label: 'Templates' }, { label: 'New' }]} title="New template" /><TemplateForm slug={slug} /></div>); }
