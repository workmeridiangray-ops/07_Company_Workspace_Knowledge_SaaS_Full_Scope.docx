import { ActionForm, Submit, ActionButton } from './ActionForm';
import { Badge, Card, ago } from './ui';
import { commentAction, resolveCommentAction, deleteCommentAction, shareAction, unshareAction, createLinkAction, revokeLinkAction } from '@/lib/collab-actions';
import { listComments, listShares, listLinks } from '@/lib/svc/collab';
import type { Ctx } from '@/lib/ctx';
import { all } from '@/lib/db';

export function Comments({ ctx, type, rid, canComment }: { ctx: Ctx; type: string; rid: string; canComment: boolean }) {
  const list = listComments(ctx, type, rid); const roots = list.filter(x => !x.parent_id);
  const people = all<any>(`SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.ws=? AND m.status='active' ORDER BY u.name`, ctx.ws.id);
  const render = (body: string) => body.replace(/@\[([^\]]+)\]\(u:[\w-]+\)/g, '@$1');
  return (
    <Card title={`Comments (${roots.length})`} className="mt-6">
      {roots.length === 0 && <p className="text-sm text-muted">No comments yet. Start a thread or @mention a teammate.</p>}
      <ul className="space-y-4">{roots.map(r => (
        <li key={r.id} className={`rounded-lg border border-line p-3 ${r.resolved ? 'bg-bg opacity-80' : ''}`}>
          <div className="flex items-center justify-between gap-2 text-sm"><span><strong>{r.author_name}</strong> <span className="text-muted">{ago(r.created_at)}</span> {r.resolved ? <Badge tone="ok">Resolved</Badge> : null}</span>
            <span className="flex gap-1"><ActionButton action={resolveCommentAction.bind(null, ctx.ws.slug, r.id, !r.resolved)} variant="ghost" small>{r.resolved ? 'Reopen' : 'Resolve'}</ActionButton>{(r.author === ctx.user.id || ctx.perms.has('content.delete')) && <ActionButton action={deleteCommentAction.bind(null, ctx.ws.slug, r.id)} variant="ghost" small confirm="Delete this comment?">Delete</ActionButton>}</span></div>
          <p className="mt-1 whitespace-pre-wrap">{render(r.body)}</p>
          {list.filter(x => x.parent_id === r.id).map(rep => (<div key={rep.id} className="ml-4 mt-2 border-l-2 border-line pl-3 text-sm"><strong>{rep.author_name}</strong> <span className="text-muted">{ago(rep.created_at)}</span><p className="whitespace-pre-wrap">{render(rep.body)}</p></div>))}
          {canComment && !r.resolved && <ActionForm action={commentAction.bind(null, ctx.ws.slug, type, rid)} className="ml-4 mt-2 flex gap-2" resetOnSuccess><input type="hidden" name="parent" value={r.id} /><label className="sr-only" htmlFor={`rp-${r.id}`}>Reply</label><input id={`rp-${r.id}`} name="body" className="input min-h-[34px]" placeholder="Reply…" /><Submit variant="secondary" className="btn-sm">Reply</Submit></ActionForm>}
        </li>))}</ul>
      {canComment ? (
        <ActionForm action={commentAction.bind(null, ctx.ws.slug, type, rid)} className="mt-4 space-y-2" resetOnSuccess>
          <label className="label" htmlFor={`cm-${rid}`}>Add a comment</label><textarea id={`cm-${rid}`} name="body" rows={2} className="input" placeholder="Write a comment. To mention someone, type @[Name](u:ID) or pick below." />
          <details className="text-sm"><summary className="cursor-pointer text-brand">Mention someone</summary><ul className="mt-1 flex flex-wrap gap-1">{people.map(p => <li key={p.id}><code className="rounded bg-bg px-1.5 py-0.5 text-xs select-all">@[{p.name}](u:{p.id})</code></li>)}</ul><p className="hint">Copy a mention token into your comment. Only people in this workspace can be mentioned.</p></details>
          <Submit>Comment</Submit>
        </ActionForm>) : <p className="mt-3 text-sm text-muted">You have view-only access, so you cannot comment.</p>}
    </Card>
  );
}
export function SharePanel({ ctx, type, rid, canShare }: { ctx: Ctx; type: string; rid: string; canShare: boolean }) {
  const shares = listShares(ctx, type, rid); const links = type === 'page' ? listLinks(ctx, type, rid) : [];
  return (
    <div className="space-y-5">
      <div><h3 className="font-semibold">People with explicit access</h3>
        {shares.length === 0 ? <p className="text-sm text-muted">Nobody has been given explicit access. Default access follows the page&rsquo;s visibility.</p> : (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">{shares.map(s => (<li key={s.id} className="flex items-center justify-between gap-2 p-2.5 text-sm"><span>{s.name} <span className="text-muted">{s.email}</span> {s.is_guest ? <Badge tone="warn">Guest</Badge> : null} <Badge>{s.level}</Badge>{s.expires_at && <span className="ml-1 text-xs text-muted">expires {new Date(s.expires_at).toLocaleDateString('en-IN')}</span>}</span>{canShare && <ActionButton action={unshareAction.bind(null, ctx.ws.slug, s.id)} variant="ghost" small confirm="Remove this person's access?">Remove</ActionButton>}</li>))}</ul>)}
        {canShare && <ActionForm action={shareAction.bind(null, ctx.ws.slug, type, rid)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" resetOnSuccess>
          <div><label className="label" htmlFor="sh-email">Email of a workspace member or guest</label><input id="sh-email" name="email" type="email" className="input" required /></div>
          <div><label className="label" htmlFor="sh-level">Level</label><select id="sh-level" name="level" className="input"><option value="view">Can view</option><option value="comment">Can comment</option><option value="edit">Can edit</option></select></div>
          <div><label className="label" htmlFor="sh-days">Expires</label><select id="sh-days" name="days" className="input"><option value="">Never</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
          <Submit>Share</Submit></ActionForm>}
      </div>
      {type === 'page' && (
        <div><h3 className="font-semibold">Links</h3>
          {links.length > 0 && <ul className="mt-2 divide-y divide-line rounded-lg border border-line">{links.map(l => { const dead = l.revoked || (l.expires_at && new Date(l.expires_at) < new Date()); return (<li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm"><span className="min-w-0"><code className="break-all text-xs">/s/{l.token}</code> {l.is_public ? <Badge tone="warn">Public web</Badge> : <Badge>Signed-in only</Badge>} {dead ? <Badge tone="bad">{l.revoked ? 'Revoked' : 'Expired'}</Badge> : <Badge tone="ok">Active</Badge>} {l.allow_download ? <Badge>Downloads on</Badge> : null}{l.expires_at && <span className="ml-1 text-xs text-muted">expires {new Date(l.expires_at).toLocaleDateString('en-IN')}</span>}</span>{canShare && !dead && <ActionButton action={revokeLinkAction.bind(null, ctx.ws.slug, l.id)} variant="ghost" small confirm="Revoke this link? Anyone using it loses access immediately.">Revoke</ActionButton>}</li>); })}</ul>}
          {canShare && <ActionForm action={createLinkAction.bind(null, ctx.ws.slug, type, rid)} className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-3"><div><label className="label" htmlFor="ln-days">Expires</label><select id="ln-days" name="days" className="input"><option value="7">7 days</option><option value="30">30 days</option><option value="">Never</option></select></div></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="download" className="h-4 w-4" /> Allow downloading attachments</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="public" className="h-4 w-4" /> Publish to the public web (anyone with the link, no sign-in)</label>
            <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" name="review" className="mt-1 h-4 w-4" /> I reviewed this page: it contains no private client data, and the workspace name and member details will not be shown.</label>
            <Submit variant="secondary">Create link</Submit></ActionForm>}
        </div>)}
    </div>
  );
}
