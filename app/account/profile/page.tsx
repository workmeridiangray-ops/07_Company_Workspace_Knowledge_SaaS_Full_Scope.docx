import { requireUser } from '@/lib/ctx';
import { ActionForm, Submit } from '@/components/ActionForm';
import { updateProfile } from '@/lib/auth-actions';
const TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
export default async function Profile() {
  const { user } = await requireUser();
  return (<ActionForm action={updateProfile} className="card space-y-4 p-5"><div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={user.name} className="input" required /></div>
    <div><label className="label" htmlFor="title">Job title</label><input id="title" name="title" defaultValue={user.title} className="input" /></div>
    <div><label className="label" htmlFor="timezone">Your time zone</label><select id="timezone" name="timezone" defaultValue={user.timezone} className="input">{TZ.map(t => <option key={t}>{t}</option>)}</select><p className="hint">Dates you see use this zone. Recurring work follows the workspace zone.</p></div>
    <div><label className="label" htmlFor="email">Email</label><input id="email" value={user.email} disabled className="input bg-bg" /><p className="hint">To change your email, contact support so we can verify ownership.</p></div>
    <Submit>Save profile</Submit></ActionForm>);
}
