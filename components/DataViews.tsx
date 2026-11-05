'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { moveRecordAction } from '@/lib/data-actions';

type Card = { id: string; title: string; sub?: string };
/** Kanban board with drag-and-drop. Dropping shows exactly what will change and asks first (also keyboard accessible via the "Move to" select). */
export function Board({ slug, propId, propName, columns, cards, canEdit }: { slug: string; propId: string; propName: string; columns: { id: string; name: string }[]; cards: Record<string, Card[]>; canEdit: boolean }) {
  const [pending, start] = useTransition(); const [msg, setMsg] = useState(''); const [over, setOver] = useState<string | null>(null);
  const move = (c: Card, from: string, to: string) => {
    if (from === to || !canEdit) return; const fn = columns.find(x => x.id === from)?.name ?? 'No value', tn = columns.find(x => x.id === to)?.name ?? 'No value';
    if (!window.confirm(`Move “${c.title}” from ${fn} to ${tn}?\n\nThis sets ${propName} to “${tn}”.`)) return;
    start(async () => { const r = await moveRecordAction(slug, c.id, propId, to || null); setMsg(r?.error ? r.error : `Moved “${c.title}” to ${tn}.`); });
  };
  return (
    <div>
      <p role="status" aria-live="polite" className="mb-2 min-h-[1.25rem] text-sm text-muted">{pending ? 'Updating…' : msg}</p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {[...columns, { id: '', name: 'No value' }].map(col => (
          <section key={col.id || 'none'} aria-label={`${col.name}, ${(cards[col.id] || []).length} cards`} onDragOver={e => { if (canEdit) { e.preventDefault(); setOver(col.id); } }} onDragLeave={() => setOver(null)}
            onDrop={e => { e.preventDefault(); setOver(null); const raw = e.dataTransfer.getData('text/plain'); try { const { card, from } = JSON.parse(raw); move(card, from, col.id); } catch {} }}
            className={`w-72 shrink-0 rounded-lg border p-2 ${over === col.id ? 'border-brand bg-brandSoft' : 'border-line bg-bg'}`}>
            <h3 className="mb-2 flex justify-between px-1 text-sm font-semibold">{col.name}<span className="font-normal text-muted">{(cards[col.id] || []).length}</span></h3>
            <ul className="space-y-2">
              {(cards[col.id] || []).map(c => (
                <li key={c.id} draggable={canEdit} onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ card: c, from: col.id }))} className="card cursor-grab p-3 text-sm active:cursor-grabbing">
                  <Link href={`/w/${slug}/records/${c.id}`} className="font-medium hover:underline">{c.title}</Link>{c.sub && <p className="mt-0.5 text-muted">{c.sub}</p>}
                  {canEdit && <label className="mt-2 block text-xs text-muted">Move to <select aria-label={`Move ${c.title} to column`} className="ml-1 rounded border border-line bg-white px-1 py-0.5" value={col.id} onChange={e => move(c, col.id, e.target.value)}>{[...columns, { id: '', name: 'No value' }].map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
                </li>))}
              {(cards[col.id] || []).length === 0 && <li className="rounded border border-dashed border-line p-3 text-center text-xs text-muted">Empty</li>}
            </ul>
          </section>))}
      </div>
    </div>
  );
}
export function CalendarGrid({ slug, propId, propName, days, month, items, canEdit, today }: { slug: string; propId: string; propName: string; days: string[]; month: number; items: Record<string, Card[]>; canEdit: boolean; today: string }) {
  const [pending, start] = useTransition(); const [msg, setMsg] = useState('');
  const move = (c: Card, from: string, to: string) => {
    if (from === to || !canEdit) return;
    if (!window.confirm(`Reschedule “${c.title}” from ${from} to ${to}?\n\nThis changes ${propName}.`)) return;
    start(async () => { const r = await moveRecordAction(slug, c.id, propId, to); setMsg(r?.error ? r.error : `Rescheduled “${c.title}” to ${to}.`); });
  };
  return (
    <div>
      <p role="status" aria-live="polite" className="mb-2 min-h-[1.25rem] text-sm text-muted">{pending ? 'Updating…' : msg}</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-xs" role="grid" aria-label="Calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} role="columnheader" className="bg-bg p-1.5 text-center font-semibold">{d}</div>)}
        {days.map(d => (
          <div key={d} role="gridcell" aria-label={d} onDragOver={e => canEdit && e.preventDefault()} onDrop={e => { e.preventDefault(); try { const { card, from } = JSON.parse(e.dataTransfer.getData('text/plain')); move(card, from, d); } catch {} }}
            className={`min-h-[84px] p-1 ${Number(d.slice(5, 7)) === month ? 'bg-surface' : 'bg-bg text-muted'} ${d === today ? 'ring-2 ring-inset ring-brand' : ''}`}>
            <div className="mb-0.5 text-right">{Number(d.slice(8))}</div>
            {(items[d] || []).map(c => (<div key={c.id} draggable={canEdit} onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ card: c, from: d }))} className="mb-0.5 truncate rounded bg-brandSoft px-1 py-0.5 text-brand"><Link href={`/w/${slug}/records/${c.id}`} title={c.title}>{c.title}</Link></div>))}
          </div>))}
      </div>
    </div>
  );
}
