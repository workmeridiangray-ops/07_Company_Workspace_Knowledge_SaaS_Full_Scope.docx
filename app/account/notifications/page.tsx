import { requireUser } from '@/lib/ctx';
import { J } from '@/lib/db';
import { ActionForm, Submit } from '@/components/ActionForm';
import { saveNotifPrefs } from '@/lib/auth-actions';
const KINDS: [string, string, string][] = [['mention', 'Mentions', 'When someone @mentions you in a comment.'], ['comment', 'Comments and replies', 'Replies to threads you started or follow.'], ['assignment', 'Task assignments', 'When a task is assigned to you.'], ['share', 'Sharing', 'When a page or record is shared with you.'], ['sop', 'SOP publishing', 'When a controlled SOP needs your acknowledgement.'], ['reminder', 'Reminders', 'Due-date and automation reminders.'], ['automation', 'Automation messages', 'Notifications triggered by rules.']];
export default async function Notifs() {
  const { user } = await requireUser(); const prefs = J<Record<string, boolean>>(user.notif_prefs, {});
  return (<ActionForm action={saveNotifPrefs} className="card divide-y divide-line">{KINDS.map(([k, l, d]) => (<label key={k} className="flex items-start gap-3 p-4"><input type="checkbox" name={k} defaultChecked={prefs[k] !== false} className="mt-1 h-4 w-4" /><span><span className="block font-medium">{l}</span><span className="text-sm text-muted">{d}</span></span></label>))}<div className="p-4"><Submit>Save preferences</Submit><p className="hint mt-2">Notifications only ever point to content you can currently access; previews never include restricted text.</p></div></ActionForm>);
}
