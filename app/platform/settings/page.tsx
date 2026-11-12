import { requirePlatform } from '@/lib/ctx';
import { all, one } from '@/lib/db';
import { PageHeader, Card, ago } from '@/components/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { platformAnnounceAction, saveSettingAction } from '@/lib/platform-actions';
export const dynamic = 'force-dynamic';
export default async function PSettings() {
  const s = await requirePlatform('announce'); const v = (k: string) => one<any>('SELECT value FROM settings WHERE key=?', k)?.value; const ann = all<any>('SELECT * FROM announcements WHERE ws IS NULL ORDER BY created_at DESC LIMIT 10');
  return (<div className="max-w-3xl"><PageHeader title="Announcements and settings" />
    <Card title="Platform-wide announcement"><ActionForm action={platformAnnounceAction} className="space-y-2" resetOnSuccess><div><label className="label" htmlFor="pt">Headline</label><input id="pt" name="title" className="input" required /></div><div><label className="label" htmlFor="pb">Details</label><input id="pb" name="body" className="input" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" className="h-4 w-4" /> Pin</label><Submit>Publish to every workspace</Submit></ActionForm><ul className="mt-3 text-sm text-muted">{ann.map(a => <li key={a.id}>{a.title} · {ago(a.created_at)}</li>)}</ul></Card>
    {s.role === 'owner' && <Card title="Platform settings" className="mt-5"><ActionForm action={saveSettingAction} className="space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="signups_open" defaultChecked={v('signups_open') !== '0'} className="h-4 w-4" /> New sign-ups open</label><div><label className="label" htmlFor="mb">Maintenance banner (shown on the marketing site)</label><input id="mb" name="maintenance_banner" defaultValue={v('maintenance_banner') || ''} className="input" /></div><Submit>Save</Submit></ActionForm></Card>}</div>);
}
