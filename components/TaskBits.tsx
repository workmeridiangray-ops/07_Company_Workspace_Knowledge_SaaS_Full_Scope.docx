'use client';
import { useState, useTransition } from 'react';
import { taskStatusAction, blockTaskAction } from '@/lib/work-actions';

export function StatusSelect({ slug, taskId, status }: { slug: string; taskId: string; status: string }) {
  const [pending, start] = useTransition(); const [err, setErr] = useState(''); const [val, setVal] = useState(status); const [asking, setAsking] = useState(false); const [reason, setReason] = useState('');
  const set = (s: string, r?: string) => start(async () => { const fd = new FormData(); if (r) fd.set('reason', r); const res = s === 'blocked' ? await blockTaskAction(slug, taskId, null, fd) : await taskStatusAction(slug, taskId, s); if (res?.error) { setErr(res.error); setVal(status); } else { setErr(''); setVal(s); setAsking(false); } });
  return (
    <span className="inline-flex flex-col">
      <label className="sr-only" htmlFor={`st-${taskId}`}>Status</label>
      <select id={`st-${taskId}`} value={val} disabled={pending} onChange={e => { const s = e.target.value; if (s === 'blocked') { setAsking(true); setVal(s); } else { setAsking(false); set(s); } }} className="rounded border border-line bg-white px-1.5 py-1 text-sm">
        <option value="todo">To do</option><option value="doing">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option>
      </select>
      {asking && <span className="mt-1 flex gap-1"><input aria-label="What is blocking this task?" value={reason} onChange={e => setReason(e.target.value)} placeholder="What is blocking it?" className="input min-h-[30px] text-xs" /><button type="button" className="btn-primary btn-sm" onClick={() => reason.trim() ? set('blocked', reason) : setErr('Say what is blocking this task.')}>Save</button></span>}
      {err && <span role="alert" className="mt-0.5 text-xs text-bad">{err}</span>}
    </span>
  );
}
