import { embedUrl, type Block } from '@/lib/blocks';
/** Read-only renderer. Text is rendered as text (never HTML); embeds only for allow-listed hosts; files only via authenticated URLs. */
export function BlocksView({ blocks, fileBase, allowDownload = true }: { blocks: Block[]; fileBase: string; allowDownload?: boolean }) {
  let n = 0;
  return (
    <div className="space-y-2 leading-7">
      {blocks.map(b => {
        if (b.type !== 'number') n = 0; else n++;
        const pad = { paddingLeft: (b.indent || 0) * 24 };
        const t = b.text || '';
        switch (b.type) {
          case 'h1': return <h2 key={b.id} className="mt-4 text-3xl font-semibold" style={pad}>{t}</h2>;
          case 'h2': return <h3 key={b.id} className="mt-3 text-2xl font-semibold" style={pad}>{t}</h3>;
          case 'h3': return <h4 key={b.id} className="mt-2 text-xl font-semibold" style={pad}>{t}</h4>;
          case 'bullet': return <p key={b.id} style={pad} className="flex gap-2"><span aria-hidden>•</span><span className="whitespace-pre-wrap">{t}</span></p>;
          case 'number': return <p key={b.id} style={pad} className="flex gap-2"><span aria-hidden className="tabular-nums">{n + 1}.</span><span className="whitespace-pre-wrap">{t}</span></p>;
          case 'todo': return <p key={b.id} style={pad} className="flex gap-2"><input type="checkbox" checked={!!b.checked} readOnly disabled aria-label={b.checked ? 'Done' : 'Not done'} className="mt-2 h-4 w-4" /><span className={b.checked ? 'text-muted line-through' : ''}>{t}</span></p>;
          case 'quote': return <blockquote key={b.id} style={pad} className="border-l-4 border-line pl-3 italic text-muted">{t}</blockquote>;
          case 'callout': return <div key={b.id} style={pad} className={`rounded-lg p-3 ${b.tone === 'warn' ? 'bg-warnSoft' : b.tone === 'ok' ? 'bg-okSoft' : 'bg-brandSoft'}`}>{t}</div>;
          case 'code': return <pre key={b.id} style={pad} className="overflow-x-auto rounded-lg bg-bg p-3 font-mono text-[13px]">{t}</pre>;
          case 'divider': return <hr key={b.id} className="my-3 border-line" />;
          case 'table': return <div key={b.id} className="overflow-x-auto" style={pad}><table className="w-full border-collapse text-sm"><tbody>{(b.rows || []).map((r, i) => <tr key={i}>{r.map((c, j) => (i === 0 && b.header !== false ? <th key={j} scope="col" className="border border-line bg-bg px-2 py-1.5 text-left">{c}</th> : <td key={j} className="border border-line px-2 py-1.5">{c}</td>))}</tr>)}</tbody></table></div>;
          case 'image': return b.fileId || b.url ? <img key={b.id} src={b.fileId ? `${fileBase}/${b.fileId}` : b.url} alt={b.name || 'Image'} className="max-h-[28rem] rounded" style={pad} /> : null;
          case 'file': return b.fileId ? (allowDownload ? <p key={b.id} style={pad}><a className="link" href={`${fileBase}/${b.fileId}`} download>{b.name || 'Attachment'}</a></p> : <p key={b.id} className="text-muted" style={pad}>{b.name || 'Attachment'} (downloads are disabled for this link)</p>) : null;
          case 'embed': { const u = b.url ? embedUrl(b.url) : null; return u ? <iframe key={b.id} src={u} title="Embedded content" className="aspect-video w-full rounded" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" loading="lazy" referrerPolicy="no-referrer" /> : null; }
          default: return t ? <p key={b.id} style={pad} className="whitespace-pre-wrap">{t}</p> : <div key={b.id} className="h-3" />;
        }
      })}
    </div>
  );
}
