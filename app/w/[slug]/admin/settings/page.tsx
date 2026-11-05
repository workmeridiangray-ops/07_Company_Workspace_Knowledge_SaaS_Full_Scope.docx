import type { Metadata } from 'next';
import { requireCtx } from '@/lib/ctx';
import { all, J } from '@/lib/db';
import { PageHeader, Card, ago } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { updateSettingsAction } from '@/lib/admin-actions';
import { postAnnouncementAction, deleteAnnouncementAction } from '@/lib/ws-actions';
export const metadata: Metadata = { title: 'Workspace settings' };
export const dynamic = 'force-dynamic';
const TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
export default async function Settings({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const c = await requireCtx(slug, 'workspace.configure'); const b = J<any>(c.ws.billing, {}); const br = J<any>(c.ws.branding, {}); const ann = all<any>('SELECT * FROM announcements WHERE ws=? ORDER BY created_at DESC', c.ws.id);
  return (<div className="mx-auto max-w-3xl"><PageHeader title="Workspace settings" />
    <ActionForm action={updateSettingsAction.bind(null, slug)} className="card space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="sn">Business name</label><input id="sn" name="name" defaultValue={c.ws.name} className="input" required /></div><div><label className="label" htmlFor="stz">Workspace time zone</label><select id="stz" name="timezone" defaultValue={c.ws.timezone} className="input">{TZ.map(t => <option key={t}>{t}</option>)}</select><p className="hint">Used for due dates, recurring tasks, meeting times and “today”.</p></div>
      <div><label className="label" htmlFor="sl">Legal name (for invoices)</label><input id="sl" name="legalName" defaultValue={b.legalName} className="input" /></div><div><label className="label" htmlFor="sg">GSTIN</label><input id="sg" name="gstin" defaultValue={b.gstin} className="input" maxLength={15} placeholder="29ABCDE1234F1Z5" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="sa">Billing address</label><textarea id="sa" name="address" rows={2} defaultValue={b.address} className="input" /></div><div><label className="label" htmlFor="sbe">Billing email</label><input id="sbe" name="billingEmail" type="email" defaultValue={b.email} className="input" /></div><div><label className="label" htmlFor="sac">Accent colour</label><input id="sac" name="accent" type="color" defaultValue={br.accent || '#244B78'} className="h-10 w-20 rounded border border-line" /><p className="hint">Must keep 4.5:1 contrast with white text.</p></div></div><Submit>Save settings</Submit></ActionForm>
    <Card title="Announcements" className="mt-6"><ActionForm action={postAnnouncementAction.bind(null, slug)} className="mb-4 space-y-2" resetOnSuccess><div><label className="label" htmlFor="at">Headline</label><input id="at" name="title" className="input" required /></div><div><label className="label" htmlFor="ab">Details</label><input id="ab" name="body" className="input" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" className="h-4 w-4" /> Pin to top of everyone’s home</label><Submit variant="secondary">Post</Submit></ActionForm>
      <ul className="divide-y divide-line text-sm">{ann.map(a => <li key={a.id} className="flex items-center justify-between py-2"><span>{a.pinned ? '📌 ' : ''}<strong>{a.title}</strong> <span className="text-muted">{ago(a.created_at)}</span></span><ActionButton action={deleteAnnouncementAction.bind(null, slug, a.id)} small variant="ghost" confirm="Remove this announcement?">Remove</ActionButton></li>)}</ul></Card></div>);
}
