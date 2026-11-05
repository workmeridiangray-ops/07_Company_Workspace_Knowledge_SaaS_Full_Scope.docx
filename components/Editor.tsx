'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_TYPES, embedUrl, newBlock, parsePaste, type Block, type BlockType } from '@/lib/blocks';
import { savePageAction } from '@/lib/page-actions';
import { Icon } from './ui/Icon';

type Props = { slug: string; pageId: string; initialTitle: string; initialBlocks: Block[]; initialVersion: number; readOnly: boolean; locked?: string };
type Save = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'offline';
const MENU: { type: BlockType; label: string; hint: string }[] = [
  { type: 'p', label: 'Text', hint: 'Plain paragraph' }, { type: 'h1', label: 'Heading 1', hint: '# ' }, { type: 'h2', label: 'Heading 2', hint: '## ' }, { type: 'h3', label: 'Heading 3', hint: '### ' },
  { type: 'bullet', label: 'Bulleted list', hint: '- ' }, { type: 'number', label: 'Numbered list', hint: '1. ' }, { type: 'todo', label: 'Checklist', hint: '[] ' }, { type: 'quote', label: 'Quote', hint: '> ' },
  { type: 'callout', label: 'Callout', hint: 'Highlighted note' }, { type: 'code', label: 'Code block', hint: '```' }, { type: 'divider', label: 'Divider', hint: '---' }, { type: 'table', label: 'Table', hint: 'Rows and columns' },
  { type: 'image', label: 'Image', hint: 'Upload or link' }, { type: 'file', label: 'Attachment', hint: 'Upload a file' }, { type: 'embed', label: 'Embed', hint: 'YouTube, Vimeo, Loom, Figma, Google Docs' },
];
const PLACEHOLDER: Partial<Record<BlockType, string>> = { p: "Type '/' for blocks", h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', bullet: 'List item', number: 'List item', todo: 'To-do', quote: 'Quote', callout: 'Callout', code: 'Code' };
const TEXTY: BlockType[] = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code'];
const LISTY: BlockType[] = ['bullet', 'number', 'todo'];
const CLS: Partial<Record<BlockType, string>> = { h1: 'text-3xl font-semibold', h2: 'text-2xl font-semibold', h3: 'text-xl font-semibold', quote: 'border-l-4 border-line pl-3 italic text-muted', code: 'rounded-lg bg-bg p-3 font-mono text-[13px]', callout: 'rounded-lg bg-brandSoft p-3' };

function Auto({ value, onChange, onKeyDown, onPaste, placeholder, className, id, readOnly, forwardRef }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = '0px'; el.style.height = el.scrollHeight + 'px'; } }, [value]);
  return <textarea id={id} ref={el => { (ref as any).current = el; forwardRef?.(el); }} rows={1} value={value} readOnly={readOnly} placeholder={readOnly ? '' : placeholder} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste}
    className={`block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted/60 focus-visible:outline-none ${className || ''}`} aria-label={placeholder || 'Block text'} />;
}

export default function Editor({ slug, pageId, initialTitle, initialBlocks, initialVersion, readOnly, locked }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks.length ? initialBlocks : [newBlock()]);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState<Save>('saved');
  const [msg, setMsg] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [conflict, setConflict] = useState<null | { version: number; title: string; body: Block[]; updatedBy: string }>(null);
  const undo = useRef<string[]>([]); const redo = useRef<string[]>([]);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({}); const focusNext = useRef<{ id: string; pos?: number } | null>(null);
  const timer = useRef<any>(null); const inflight = useRef(false); const latest = useRef({ title, blocks, version }); latest.current = { title, blocks, version };
  const dirty = status === 'dirty' || status === 'saving' || status === 'error' || status === 'offline';
  const cannotEdit = readOnly || !!conflict;

  const snapshot = () => JSON.stringify({ t: latest.current.title, b: latest.current.blocks });
  const pushUndo = () => { undo.current.push(snapshot()); if (undo.current.length > 100) undo.current.shift(); redo.current = []; };
  const mutate = (fn: (b: Block[]) => Block[], opts: { history?: boolean } = {}) => { if (cannotEdit) return; if (opts.history !== false) pushUndo(); setBlocks(b => fn(b)); markDirty(); };

  const markDirty = () => { setStatus('dirty'); clearTimeout(timer.current); timer.current = setTimeout(save, 900); };
  const save = useCallback(async () => {
    if (inflight.current) { timer.current = setTimeout(save, 600); return; }
    inflight.current = true; setStatus('saving');
    const { title: t, blocks: b, version: v } = latest.current;
    try {
      const r = await savePageAction(slug, pageId, t, b, v);
      if (r.ok) { setVersion(r.version); latest.current.version = r.version; setStatus(prev => (prev === 'dirty' ? 'dirty' : 'saved')); setMsg(''); if (JSON.stringify({ t, b }) !== snapshot()) markDirty(); }
      else if ('conflict' in r) { setConflict({ ...r.theirs }); setStatus('conflict'); }
      else { setStatus('error'); setMsg(r.error); }
    } catch { setStatus('offline'); setMsg('You appear to be offline. Changes are kept here and will save when you reconnect.'); timer.current = setTimeout(save, 5000); }
    finally { inflight.current = false; }
  }, [slug, pageId]); // eslint-disable-line

  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  useEffect(() => { const on = () => { if (status === 'offline') save(); }; window.addEventListener('online', on); return () => window.removeEventListener('online', on); }, [status, save]);
  useEffect(() => { if (focusNext.current) { const { id, pos } = focusNext.current; const el = refs.current[id]; if (el) { el.focus(); const p = pos ?? el.value.length; el.setSelectionRange(p, p); } focusNext.current = null; } });

  const doUndo = () => { const s = undo.current.pop(); if (!s) return; redo.current.push(snapshot()); const o = JSON.parse(s); setTitle(o.t); setBlocks(o.b); markDirty(); };
  const doRedo = () => { const s = redo.current.pop(); if (!s) return; undo.current.push(snapshot()); const o = JSON.parse(s); setTitle(o.t); setBlocks(o.b); markDirty(); };

  const upd = (bid: string, patch: Partial<Block>, history = false) => mutate(bs => bs.map(b => (b.id === bid ? { ...b, ...patch } : b)), { history });
  const insertAfter = (bid: string, nb: Block, focus = true) => { mutate(bs => { const i = bs.findIndex(b => b.id === bid); const c = [...bs]; c.splice(i + 1, 0, nb); return c; }); if (focus) focusNext.current = { id: nb.id, pos: 0 }; };
  const convert = (bid: string, type: BlockType, text?: string) => {
    mutate(bs => bs.map(b => (b.id === bid ? { ...b, type, text: text ?? b.text ?? '', ...(type === 'table' ? { rows: [['', ''], ['', '']], header: true } : {}), ...(type === 'callout' ? { tone: 'info' as const } : {}) } : b)));
    setMenuFor(null); if (TEXTY.includes(type)) focusNext.current = { id: bid };
  };

  function onKey(b: Block, i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget; const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(timer.current); save(); return; }
    if (cannotEdit) return;
    if (menuFor === b.id && (e.key === 'Escape')) { setMenuFor(null); return; }
    if (e.key === 'Enter' && !e.shiftKey && b.type !== 'code') {
      e.preventDefault();
      if (menuFor === b.id) return;
      if (LISTY.includes(b.type) && !(b.text || '').trim()) { upd(b.id, { type: 'p', indent: 0 }, true); return; }
      const pos = el.selectionStart; const text = b.text || ''; const before = text.slice(0, pos), after = text.slice(pos);
      const nt: BlockType = LISTY.includes(b.type) ? b.type : 'p';
      const nb: Block = { ...newBlock(nt, after), indent: LISTY.includes(b.type) ? b.indent : 0 }; if (nt === 'todo') nb.checked = false;
      mutate(bs => { const idx = bs.findIndex(x => x.id === b.id); const c = [...bs]; c[idx] = { ...b, text: before }; c.splice(idx + 1, 0, nb); return c; }); focusNext.current = { id: nb.id, pos: 0 }; return;
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.type !== 'p' && TEXTY.includes(b.type)) { e.preventDefault(); upd(b.id, { type: 'p', indent: 0 }, true); return; }
      if ((b.indent || 0) > 0) { e.preventDefault(); upd(b.id, { indent: (b.indent || 1) - 1 }, true); return; }
      if (i > 0) { e.preventDefault(); const prev = blocks[i - 1]; if (TEXTY.includes(prev.type)) { const pl = (prev.text || '').length; mutate(bs => { const c = [...bs]; c[i - 1] = { ...prev, text: (prev.text || '') + (b.text || '') }; c.splice(i, 1); return c; }); focusNext.current = { id: prev.id, pos: pl }; } else if (!(b.text || '')) { mutate(bs => bs.filter(x => x.id !== b.id)); } return; }
    }
    if (e.key === 'Tab') { e.preventDefault(); const d = (b.indent || 0) + (e.shiftKey ? -1 : 1); if (d >= 0 && d <= 3) upd(b.id, { indent: d }, true); return; }
    if (e.key === 'ArrowUp' && el.selectionStart === 0 && i > 0 && !e.shiftKey) { const p = blocks[i - 1]; if (refs.current[p.id]) { e.preventDefault(); refs.current[p.id]!.focus(); } }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length && i < blocks.length - 1 && !e.shiftKey) { const n = blocks[i + 1]; if (refs.current[n.id]) { e.preventDefault(); refs.current[n.id]!.focus(); } }
  }
  function onText(b: Block, v: string) {
    if (cannotEdit) return;
    const rules: [RegExp, BlockType][] = [[/^# $/, 'h1'], [/^## $/, 'h2'], [/^### $/, 'h3'], [/^[-*] $/, 'bullet'], [/^1\. $/, 'number'], [/^\[\] $/, 'todo'], [/^> $/, 'quote'], [/^```$/, 'code']];
    if (b.type === 'p') { for (const [re, t] of rules) if (re.test(v)) { convert(b.id, t, ''); return; } if (v === '---') { convert(b.id, 'divider', ''); insertAfter(b.id, newBlock()); return; } }
    if (v === '/' && !(b.text || '')) { setMenuFor(b.id); } else if (menuFor === b.id && !v.startsWith('/')) setMenuFor(null);
    upd(b.id, { text: v });
  }
  function onPaste(b: Block, e: React.ClipboardEvent) {
    if (cannotEdit) return; const text = e.clipboardData.getData('text/plain'); if (!text.includes('\n') && !/^(#{1,3} |[-*] |\d+[.)] |> )/.test(text)) return;
    e.preventDefault(); const parsed = parsePaste(text); if (!parsed.length) return;
    mutate(bs => { const i = bs.findIndex(x => x.id === b.id); const c = [...bs]; if (!(b.text || '').trim() && b.type === 'p') c.splice(i, 1, ...parsed); else c.splice(i + 1, 0, ...parsed); return c; });
  }
  async function upload(b: Block, file: File) {
    const fd = new FormData(); fd.append('file', file); fd.append('page', pageId);
    setMsg('Uploading ' + file.name + '…');
    try { const r = await fetch(`/api/w/${slug}/files`, { method: 'POST', body: fd }); const j = await r.json(); if (!r.ok) { setMsg(j.error || 'Upload failed.'); return; } upd(b.id, { fileId: j.id, name: j.name }, true); setMsg(''); } catch { setMsg('Upload failed - check your connection and try again.'); }
  }
  let numCounter = 0;
  const bar = { saved: ['Saved', 'text-ok'], dirty: ['Unsaved changes', 'text-warn'], saving: ['Saving…', 'text-muted'], error: ['Could not save', 'text-bad'], conflict: ['Edit conflict', 'text-bad'], offline: ['Offline - will retry', 'text-warn'] }[status];

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6">
        <span role="status" aria-live="polite" className={`flex items-center gap-1.5 font-medium ${bar[1]}`}><Icon name={status === 'saved' ? 'check' : status === 'error' || status === 'conflict' ? 'warn' : 'clock'} size={16} />{bar[0]}{readOnly && <span className="ml-2 rounded bg-bg px-1.5 text-muted">{locked || 'View only'}</span>}</span>
        <span className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" onClick={doUndo} disabled={cannotEdit} aria-label="Undo">Undo</button><button className="btn-ghost btn-sm" onClick={doRedo} disabled={cannotEdit} aria-label="Redo">Redo</button>
          <button className="btn-secondary btn-sm" onClick={() => { clearTimeout(timer.current); save(); }} disabled={cannotEdit || status === 'saved'}>Save now</button>
        </span>
      </div>
      {msg && <p role="alert" className="mb-2 rounded-lg border border-warn/40 bg-warnSoft px-3 py-2 text-sm">{msg}</p>}
      {conflict && (
        <div role="alertdialog" aria-label="Edit conflict" className="mb-4 rounded-lg border border-bad/40 bg-badSoft p-4 text-sm">
          <p className="font-semibold">{conflict.updatedBy} saved a newer version while you were editing.</p>
          <p className="mt-1">Your unsaved version is still on screen. Nothing has been overwritten. Choose how to continue:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={() => { setVersion(conflict.version); latest.current.version = conflict.version; setConflict(null); setStatus('dirty'); save(); }}>Keep my version (replace theirs)</button>
            <button className="btn-secondary btn-sm" onClick={() => { setTitle(conflict.title); setBlocks(conflict.body.length ? conflict.body : [newBlock()]); setVersion(conflict.version); latest.current.version = conflict.version; setConflict(null); setStatus('saved'); }}>Use their version (discard mine)</button>
            <button className="btn-secondary btn-sm" onClick={() => { const mine = latest.current.blocks; const merged = [...conflict.body, { ...newBlock('callout', 'Merged from a conflicting edit - review below') , tone: 'warn' as const }, ...mine.map(b => ({ ...b, id: newBlock().id }))]; setBlocks(merged); setVersion(conflict.version); latest.current.version = conflict.version; setConflict(null); setStatus('dirty'); markDirty(); }}>Keep both (append mine)</button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <label className="sr-only" htmlFor="page-title">Page title</label>
        <input id="page-title" value={title} readOnly={cannotEdit} onChange={e => { if (cannotEdit) return; setTitle(e.target.value); markDirty(); }} placeholder="Untitled" className="mb-4 w-full bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-muted/50" maxLength={200} />
        <div role="group" aria-label="Page content" className="space-y-1">
          {blocks.map((b, i) => {
            if (b.type !== 'number') numCounter = 0; else numCounter++;
            const pad = { paddingLeft: (b.indent || 0) * 24 };
            return (
              <div key={b.id} className="group relative flex items-start gap-1" style={pad}>
                {!cannotEdit && <button type="button" aria-label="Add block below" className="mt-1 hidden h-6 w-6 shrink-0 place-items-center rounded text-muted opacity-0 hover:bg-brandSoft group-hover:opacity-100 focus:opacity-100 sm:grid" onClick={() => { const nb = newBlock(); insertAfter(b.id, nb); setMenuFor(nb.id); }}><Icon name="plus" size={14} /></button>}
                <div className="min-w-0 flex-1">
                  {b.type === 'divider' ? <hr className="my-3 border-line" /> :
                   b.type === 'table' ? (
                    <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>{(b.rows || []).map((r, ri) => (<tr key={ri}>{r.map((cell, ci) => (<td key={ci} className={`border border-line p-0 ${ri === 0 && b.header !== false ? 'bg-bg font-semibold' : ''}`}><input aria-label={`Row ${ri + 1} column ${ci + 1}`} readOnly={cannotEdit} value={cell} className="w-full min-w-[90px] bg-transparent px-2 py-1.5 outline-none" onChange={e => upd(b.id, { rows: (b.rows || []).map((rr, k) => (k === ri ? rr.map((cc, l) => (l === ci ? e.target.value : cc)) : rr)) })} /></td>))}</tr>))}</tbody></table>
                      {!cannotEdit && <div className="mt-1 flex gap-2"><button className="btn-ghost btn-sm" onClick={() => upd(b.id, { rows: [...(b.rows || []), new Array(b.rows?.[0]?.length || 2).fill('')] }, true)}>+ Row</button><button className="btn-ghost btn-sm" onClick={() => upd(b.id, { rows: (b.rows || []).map(r => (r.length < 8 ? [...r, ''] : r)) }, true)}>+ Column</button>{(b.rows?.length || 0) > 1 && <button className="btn-ghost btn-sm" onClick={() => upd(b.id, { rows: (b.rows || []).slice(0, -1) }, true)}>- Row</button>}<button className="btn-ghost btn-sm text-bad" onClick={() => mutate(bs => bs.filter(x => x.id !== b.id))}>Remove table</button></div>}</div>
                   ) : b.type === 'image' || b.type === 'file' ? (
                    <div className="rounded-lg border border-line bg-surface p-3">
                      {b.fileId || b.url ? (b.type === 'image' ? <img src={b.fileId ? `/api/w/${slug}/files/${b.fileId}` : b.url} alt={b.name || 'Image'} className="max-h-96 rounded" /> : <a className="link" href={`/api/w/${slug}/files/${b.fileId}`} download>{b.name || 'Attachment'}</a>)
                        : <div className="flex flex-wrap items-center gap-2 text-sm"><label className="btn-secondary btn-sm cursor-pointer"><input type="file" className="sr-only" disabled={cannotEdit} accept={b.type === 'image' ? 'image/*' : undefined} onChange={e => e.target.files?.[0] && upload(b, e.target.files[0])} />Choose {b.type === 'image' ? 'image' : 'file'}</label><span className="text-muted">up to 10 MB</span>
                          {b.type === 'image' && <input aria-label="Image link" placeholder="or paste an https:// image link and press Enter" className="input min-h-[32px] flex-1" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); upd(b.id, { url: (e.target as HTMLInputElement).value }, true); } }} />}</div>}
                      {!cannotEdit && <button className="btn-ghost btn-sm mt-2 text-bad" onClick={() => mutate(bs => bs.filter(x => x.id !== b.id))}>Remove</button>}
                    </div>
                   ) : b.type === 'embed' ? (
                    <div className="rounded-lg border border-line bg-surface p-3">{b.url && embedUrl(b.url) ? <iframe src={embedUrl(b.url)!} title="Embedded content" className="aspect-video w-full rounded" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" loading="lazy" referrerPolicy="no-referrer" /> :
                      <input aria-label="Embed link" placeholder="Paste an https link (YouTube, Vimeo, Loom, Figma, Google Docs) and press Enter" className="input" readOnly={cannotEdit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value; if (!embedUrl(v)) { setMsg('That link cannot be embedded. Use https links from YouTube, Vimeo, Loom, Figma or Google Docs.'); return; } setMsg(''); upd(b.id, { url: v }, true); } }} />}
                      {!cannotEdit && <button className="btn-ghost btn-sm mt-2 text-bad" onClick={() => mutate(bs => bs.filter(x => x.id !== b.id))}>Remove</button>}</div>
                   ) : (
                    <div className="flex items-start gap-2">
                      {b.type === 'bullet' && <span aria-hidden className="mt-0.5 w-5 text-center">{['•', '◦', '▪', '▫'][b.indent || 0]}</span>}
                      {b.type === 'number' && <span aria-hidden className="mt-0.5 w-5 text-right tabular-nums">{numCounter + 1}.</span>}
                      {b.type === 'todo' && <input type="checkbox" aria-label="Done" className="mt-1.5 h-4 w-4" checked={!!b.checked} disabled={readOnly || !!conflict} onChange={e => upd(b.id, { checked: e.target.checked }, true)} />}
                      <div className="relative min-w-0 flex-1">
                        <Auto id={`b-${b.id}`} forwardRef={(el: any) => (refs.current[b.id] = el)} value={b.text || ''} readOnly={cannotEdit} placeholder={PLACEHOLDER[b.type] || ''} onChange={(v: string) => onText(b, v)} onKeyDown={(e: any) => onKey(b, i, e)} onPaste={(e: any) => onPaste(b, e)}
                          className={`${CLS[b.type] || ''} ${b.type === 'todo' && b.checked ? 'text-muted line-through' : ''} ${b.type === 'callout' ? (b.tone === 'warn' ? '!bg-warnSoft' : b.tone === 'ok' ? '!bg-okSoft' : '') : ''} py-0.5`} />
                        {b.type === 'callout' && !cannotEdit && <select aria-label="Callout tone" value={b.tone || 'info'} onChange={e => upd(b.id, { tone: e.target.value as any }, true)} className="mt-1 rounded border border-line bg-white px-1 text-xs"><option value="info">Info</option><option value="warn">Warning</option><option value="ok">Success</option></select>}
                        {menuFor === b.id && (
                          <ul role="listbox" aria-label="Block types" className="absolute left-0 top-8 z-30 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
                            {MENU.map(m => (<li key={m.type} role="option" aria-selected={false}><button type="button" className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-brandSoft" onMouseDown={e => { e.preventDefault(); if (m.type === 'divider') { convert(b.id, 'divider', ''); insertAfter(b.id, newBlock()); } else convert(b.id, m.type, ''); }}><span>{m.label}</span><span className="text-xs text-muted">{m.hint}</span></button></li>))}
                          </ul>)}
                      </div>
                    </div>
                   )}
                </div>
                {!cannotEdit && <button type="button" aria-label="Delete block" className="mt-1 hidden h-6 w-6 shrink-0 place-items-center rounded text-muted opacity-0 hover:bg-badSoft hover:text-bad group-hover:opacity-100 focus:opacity-100 sm:grid" onClick={() => mutate(bs => (bs.length > 1 ? bs.filter(x => x.id !== b.id) : [newBlock()]))}><Icon name="x" size={14} /></button>}
              </div>
            );
          })}
        </div>
        {!cannotEdit && <button className="btn-ghost btn-sm mt-3" onClick={() => insertAfter(blocks[blocks.length - 1].id, newBlock())}><Icon name="plus" size={14} /> Add block</button>}
        <p className="mt-6 text-xs text-muted">Shortcuts: <kbd>/</kbd> block menu, <kbd>Tab</kbd> indent, <kbd>Ctrl/⌘+Z</kbd> undo, <kbd>Ctrl/⌘+S</kbd> save. Markdown shortcuts like <kbd># </kbd>, <kbd>- </kbd>, <kbd>[] </kbd> work too.</p>
      </div>
    </div>
  );
}
