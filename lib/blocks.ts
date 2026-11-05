// Block vocabulary, validation and text extraction. Pure: usable in client and server.
export const BLOCK_TYPES = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code', 'divider', 'table', 'image', 'file', 'embed'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export interface Block {
  id: string; type: BlockType; text?: string; indent?: number; checked?: boolean; lang?: string; tone?: 'info' | 'warn' | 'ok';
  url?: string; fileId?: string; name?: string; rows?: string[][]; header?: boolean;
}
export const LIMITS = { blocks: 2000, textChars: 10000, indent: 3, tableRows: 50, tableCols: 8, fileBytes: 10 * 1024 * 1024 };
export const ALLOWED_UPLOAD = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
export const EMBED_HOSTS = ['www.youtube.com', 'youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com', 'www.loom.com', 'www.figma.com', 'figma.com', 'docs.google.com'];

export function embedUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || !EMBED_HOSTS.includes(x.hostname)) return null;
    if (/youtube\.com$/.test(x.hostname) && x.pathname === '/watch' && x.searchParams.get('v')) return `https://www.youtube.com/embed/${encodeURIComponent(x.searchParams.get('v')!)}`;
    if (x.hostname === 'youtu.be') return `https://www.youtube.com/embed/${encodeURIComponent(x.pathname.slice(1))}`;
    if (x.hostname === 'vimeo.com' && /^\/\d+$/.test(x.pathname)) return `https://player.vimeo.com/video${x.pathname}`;
    if (x.hostname === 'www.loom.com' && x.pathname.startsWith('/share/')) return `https://www.loom.com/embed/${x.pathname.slice(7)}`;
    return x.toString();
  } catch { return null; }
}
export function safeUrl(u: string): string | null {
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; } catch { return null; }
}
const rid = () => Math.random().toString(36).slice(2, 10);

/** Validate + normalise untrusted block JSON. Throws a readable message on structural problems. */
export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) throw new Error('Page content must be a list of blocks.');
  if (input.length > LIMITS.blocks) throw new Error(`A page can hold at most ${LIMITS.blocks} blocks.`);
  const seen = new Set<string>();
  return input.map((raw: any, i) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Block ${i + 1} is invalid.`);
    const type = raw.type as BlockType;
    if (!BLOCK_TYPES.includes(type)) throw new Error(`Block ${i + 1}: unsupported type "${String(raw.type).slice(0, 20)}".`);
    let bid = typeof raw.id === 'string' && /^[\w-]{1,24}$/.test(raw.id) ? raw.id : rid();
    if (seen.has(bid)) bid = rid(); seen.add(bid);
    const b: Block = { id: bid, type };
    if (typeof raw.text === 'string') { if (raw.text.length > LIMITS.textChars) throw new Error(`Block ${i + 1} is longer than ${LIMITS.textChars} characters.`); b.text = raw.text; }
    const ind = Number(raw.indent || 0); if (ind > 0) b.indent = Math.min(LIMITS.indent, Math.floor(ind));
    if (type === 'todo') b.checked = !!raw.checked;
    if (type === 'code' && typeof raw.lang === 'string') b.lang = raw.lang.slice(0, 20);
    if (type === 'callout') b.tone = ['info', 'warn', 'ok'].includes(raw.tone) ? raw.tone : 'info';
    if (type === 'embed') { const u = embedUrl(String(raw.url || '')); if (!u) throw new Error(`Block ${i + 1}: embeds must be https links from YouTube, Vimeo, Loom, Figma or Google Docs.`); b.url = String(raw.url); }
    if (type === 'image' || type === 'file') {
      if (raw.fileId) b.fileId = String(raw.fileId).slice(0, 40);
      else if (type === 'image' && raw.url) { const u = safeUrl(String(raw.url)); if (!u) throw new Error(`Block ${i + 1}: image link is not valid.`); b.url = u; }
      if (raw.name) b.name = String(raw.name).slice(0, 200);
    }
    if (type === 'table') {
      const rows = Array.isArray(raw.rows) ? raw.rows : [['', ''], ['', '']];
      if (rows.length > LIMITS.tableRows) throw new Error(`Tables can have at most ${LIMITS.tableRows} rows.`);
      b.rows = rows.map((r: any) => (Array.isArray(r) ? r : []).slice(0, LIMITS.tableCols).map((c: any) => String(c ?? '').slice(0, 1000)));
      b.header = raw.header !== false;
    }
    return b;
  });
}
export function blocksText(blocks: Block[]): string {
  return blocks.map(b => (b.type === 'table' ? (b.rows || []).flat().join(' ') : b.text || b.name || '')).filter(Boolean).join('\n');
}
export function newBlock(type: BlockType = 'p', text = ''): Block { return { id: rid(), type, text }; }
/** Parse pasted plain text into blocks (markdown-ish prefixes). */
export function parsePaste(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = []; let code: string[] | null = null;
  for (const line of lines) {
    if (line.trim().startsWith('```')) { if (code) { out.push({ ...newBlock('code', code.join('\n')) }); code = null; } else code = []; continue; }
    if (code) { code.push(line); continue; }
    if (!line.trim()) continue;
    let m: RegExpMatchArray | null;
    const lead = (line.match(/^(\s*)/)?.[1].length || 0); const indent = Math.min(LIMITS.indent, Math.floor(lead / 2));
    const t = line.trim();
    if ((m = t.match(/^(#{1,3})\s+(.*)/))) out.push(newBlock(('h' + m[1].length) as BlockType, m[2]));
    else if ((m = t.match(/^[-*]\s+\[( |x|X)\]\s+(.*)/))) out.push({ ...newBlock('todo', m[2]), checked: m[1] !== ' ', indent });
    else if ((m = t.match(/^[-*•]\s+(.*)/))) out.push({ ...newBlock('bullet', m[1]), indent });
    else if ((m = t.match(/^\d+[.)]\s+(.*)/))) out.push({ ...newBlock('number', m[1]), indent });
    else if ((m = t.match(/^>\s?(.*)/))) out.push(newBlock('quote', m[1]));
    else if (/^(-{3,}|\*{3,})$/.test(t)) out.push(newBlock('divider'));
    else out.push(newBlock('p', t));
  }
  if (code) out.push(newBlock('code', code.join('\n')));
  return out;
}
export function toMarkdown(title: string, blocks: Block[]): string {
  let n = 0; const out = [`# ${title}`, ''];
  for (const b of blocks) {
    const pad = '  '.repeat(b.indent || 0); if (b.type !== 'number') n = 0;
    switch (b.type) {
      case 'h1': out.push(`# ${b.text}`); break; case 'h2': out.push(`## ${b.text}`); break; case 'h3': out.push(`### ${b.text}`); break;
      case 'bullet': out.push(`${pad}- ${b.text}`); break; case 'number': out.push(`${pad}${++n}. ${b.text}`); break;
      case 'todo': out.push(`${pad}- [${b.checked ? 'x' : ' '}] ${b.text}`); break; case 'quote': out.push(`> ${b.text}`); break;
      case 'callout': out.push(`> **Note:** ${b.text}`); break; case 'code': out.push('```' + (b.lang || ''), b.text || '', '```'); break;
      case 'divider': out.push('---'); break; case 'embed': out.push(`[Embedded content](${b.url})`); break;
      case 'image': out.push(`![${b.name || 'image'}](${b.url || '#attachment-' + b.fileId})`); break; case 'file': out.push(`[Attachment: ${b.name || 'file'}]`); break;
      case 'table': (b.rows || []).forEach((r, i) => { out.push('| ' + r.join(' | ') + ' |'); if (i === 0) out.push('|' + r.map(() => '---').join('|') + '|'); }); break;
      default: out.push(b.text || '');
    }
    out.push('');
  }
  return out.join('\n');
}
