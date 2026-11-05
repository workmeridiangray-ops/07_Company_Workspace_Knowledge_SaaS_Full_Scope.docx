import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/ctx';
import { all, one, J } from '@/lib/db';
import { getPage } from '@/lib/access';
import { PageHeader, Card, Status, Badge, Alert, fmtDate, fmtDateTime, Table } from '@/components/ui';
import { ActionForm, Submit, ActionButton } from '@/components/ActionForm';
import { BlocksView } from '@/components/BlocksView';
import { submitSopAction, returnSopAction, publishSopAction, ackSopAction, reviseSopAction, retireSopAction, reviewedSopAction, remindSopAction } from '@/lib/sop-actions';
import { ackStatus, audienceMembers, versionInForce } from '@/lib/svc/sop';
import { todayIn } from '@/lib/dates';
import { Comments } from '@/components/Collab';
export const dynamic = 'force-dynamic';
export default async function SopPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ v?: string; asof?: string }> }) {
  const { slug, id } = await params; const sp = await searchParams; const c = await requireCtx(slug); const s = one<any>('SELECT s.*, p.title, p.body, u.name AS owner_name FROM sops s JOIN pages p ON p.id=s.page_id LEFT JOIN users u ON u.id=s.owner WHERE s.id=? AND s.ws=?', id, c.ws.id); if (!s) notFound();
  const pg = getPage(c, s.page_id, 'view'); if (!pg) return <Alert tone="bad" title="You don’t have access to this SOP" />;
  const today = todayIn(c.ws.timezone); const versions = all<any>('SELECT v.*, u.name AS by_name FROM sop_versions v LEFT JOIN users u ON u.id=v.by_user WHERE v.sop_id=? ORDER BY v.version DESC', id);
  const shown = sp.v ? versions.find(v => String(v.version) === sp.v) : null; const inForce = s.published_version ? versions.find(v => v.version === s.published_version) : null;
  const body = J<any[]>((shown || (s.state === 'draft' || s.state === 'review' ? { body: s.body } : inForce) || { body: s.body }).body, []);
  const mine = s.published_version ? !!one('SELECT 1 FROM sop_acks WHERE sop_id=? AND version=? AND user_id=?', id, s.published_version, c.user.id) : false;
  const inAud = audienceMembers(c.ws.id, s.audience).includes(c.user.id); const st = c.perms.has('content.approve') && s.published_version ? ackStatus(c, id) : null;
  const asof = sp.asof && /^\d{4}-\d{2}-\d{2}$/.test(sp.asof) ? versionInForce(id, sp.asof) : null; const canEditPage = pg.level === 'edit' && s.state === 'draft'; const approver = c.perms.has('content.approve');
  const roles = new Map(all<any>('SELECT id,name FROM roles WHERE ws=?', c.ws.id).map(r => [r.id, r.name]));
  return (<div className="mx-auto max-w-4xl">
    <PageHeader crumbs={[{ href: `/w/${slug}/knowledge`, label: 'Knowledge' }, { label: s.title }]} title={s.title} subtitle={`Owner ${s.owner_name} · Audience: ${s.audience === 'all' ? 'everyone' : s.audience.split(',').map((r: string) => roles.get(r)).join(', ')} · ${s.requires_ack ? 'acknowledgement required' : 'no acknowledgement'}`} actions={<><Status value={s.state} />{canEditPage && <Link className="btn-primary btn-sm" href={`/w/${slug}/pages/${s.page_id}`}>Edit draft</Link>}</>} />
    {s.review_note && s.state === 'draft' && <div className="mb-3"><Alert tone="warn" title="Changes requested">{s.review_note}</Alert></div>}
    {s.state === 'review' && <div className="mb-3"><Alert tone="brand" title="In review - locked for editing">{s.review_note && <>Author note: {s.review_note}</>}</Alert></div>}
    {s.published_version && s.effective_from > today && <div className="mb-3"><Alert tone="brand">Version {s.published_version} takes effect on {fmtDate(s.effective_from + 'T00:00:00Z', 'UTC')}.</Alert></div>}
    {s.published_version && s.review_due <= today && <div className="mb-3"><Alert tone="warn" title="Review overdue">This SOP was due for review on {fmtDate(s.review_due + 'T00:00:00Z', 'UTC')}. {approver && <ActionButton action={reviewedSopAction.bind(null, slug, id)} small>Confirm still accurate</ActionButton>}</Alert></div>}
    {shown && <div className="mb-3"><Alert tone="warn" title={`Viewing version ${shown.version}${shown.version === s.published_version ? ' (in force)' : ''}`}>Published {fmtDate(shown.published_at, c.ws.timezone)}, effective {fmtDate(shown.effective_from + 'T00:00:00Z', 'UTC')}{shown.retired_at ? `, superseded ${fmtDate(shown.retired_at + 'T00:00:00Z', 'UTC')}` : ''}. <Link className="link" href={`/w/${slug}/knowledge/${id}`}>Back to current</Link></Alert></div>}
    <div className="card p-5"><BlocksView blocks={body} fileBase={`/api/w/${slug}/files`} /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card title="Workflow">
        {s.state === 'draft' && <ActionForm action={submitSopAction.bind(null, slug, id)} className="space-y-2"><label className="label" htmlFor="sn">Note for the reviewer</label><textarea id="sn" name="note" rows={2} className="input" /><Submit>Submit for review</Submit></ActionForm>}
        {s.state === 'review' && approver && (<div className="space-y-4"><ActionForm action={publishSopAction.bind(null, slug, id)} className="space-y-2"><label className="label" htmlFor="eff">Effective from</label><input id="eff" type="date" name="effective" min={today} defaultValue={today} className="input" /><label className="label" htmlFor="cn">What changed (shown in version history)</label><input id="cn" name="note" className="input" /><Submit>Approve and publish v{s.version}</Submit></ActionForm><ActionForm action={returnSopAction.bind(null, slug, id)} className="space-y-2"><label className="label" htmlFor="rr">Request changes</label><input id="rr" name="reason" className="input" placeholder="What needs to change?" /><Submit variant="secondary">Return to author</Submit></ActionForm></div>)}
        {s.state === 'review' && !approver && <p className="text-sm text-muted">Waiting for an approver. You will be notified.</p>}
        {s.state === 'published' && <div className="space-y-3"><p className="text-sm">Version {s.published_version} is in force since {fmtDate(s.effective_from + 'T00:00:00Z', 'UTC')}.</p>{(s.owner === c.user.id || approver) && <ActionButton action={reviseSopAction.bind(null, slug, id)} variant="secondary">Start a new draft version</ActionButton>}</div>}
        {s.state === 'draft' && s.published_version && <p className="mt-3 text-sm text-muted">Version {s.published_version} stays in force while you work on v{s.version}.</p>}
        {s.state === 'retired' && <p className="text-sm text-muted">Retired. {s.review_note}</p>}
        {approver && s.state !== 'retired' && <ActionForm action={retireSopAction.bind(null, slug, id)} className="mt-4 space-y-2 border-t border-line pt-3"><label className="label" htmlFor="rt">Retire this SOP</label><input id="rt" name="reason" className="input" placeholder="Why is it being retired?" /><Submit variant="danger" confirm="Retire this SOP? It will no longer be in force.">Retire</Submit></ActionForm>}
      </Card>
      <Card title="Acknowledgements">
        {!s.published_version ? <p className="text-sm text-muted">Nothing published yet.</p> : (<>
          {s.requires_ack && inAud && (mine ? <Badge tone="ok">You acknowledged v{s.published_version}</Badge> : s.effective_from <= today ? <ActionButton action={ackSopAction.bind(null, slug, id)} variant="primary">I have read and understood v{s.published_version}</ActionButton> : <p className="text-sm text-muted">You can acknowledge from {s.effective_from}.</p>)}
          {st && <div className="mt-3 text-sm"><p><strong>{st.done.length}</strong> of {st.total} acknowledged v{s.published_version}</p>{st.pending.length > 0 && <><p className="mt-2 text-muted">Pending: {st.pending.map(p => p.name).join(', ')}</p><div className="mt-2"><ActionButton action={remindSopAction.bind(null, slug, id)} small>Send reminder</ActionButton></div></>}</div>}
        </>)}
      </Card>
    </div>
    <Card title="Which version applied on a date?" className="mt-5"><form method="get" className="flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="asof">Date</label><input id="asof" name="asof" type="date" defaultValue={sp.asof} className="input" /></div><button className="btn-secondary">Look up</button></form>
      {sp.asof && (asof ? <p className="mt-3 text-sm">On {sp.asof}, <strong>version {asof.version}</strong> was in force (effective {asof.effective_from}{asof.retired_at ? `, replaced ${asof.retired_at}` : ''}). <Link className="link" href={`/w/${slug}/knowledge/${id}?v=${asof.version}`}>Read that version</Link></p> : <p className="mt-3 text-sm text-muted">No version was in force on that date.</p>)}</Card>
    <div className="mt-5"><h2 className="mb-2 font-semibold">Version history</h2>{versions.length === 0 ? <p className="text-sm text-muted">No published versions yet.</p> : <Table head={['Version', 'Effective', 'Published', 'By', 'Change', '']} caption="SOP versions">{versions.map(v => <tr key={v.id}><td className="td">v{v.version} {v.version === s.published_version ? <Badge tone="ok">In force</Badge> : null}</td><td className="td">{fmtDate(v.effective_from + 'T00:00:00Z', 'UTC')}</td><td className="td">{fmtDateTime(v.published_at, c.ws.timezone)}</td><td className="td">{v.by_name}</td><td className="td">{v.change_note || '-'}</td><td className="td"><Link className="link" href={`/w/${slug}/knowledge/${id}?v=${v.version}`}>Read</Link></td></tr>)}</Table>}</div>
    <Comments ctx={c} type="page" rid={s.page_id} canComment={pg.level !== 'view'} />
  </div>);
}
