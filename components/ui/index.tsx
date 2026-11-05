import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
export { Icon };

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { href?: string; label: string }[] }) {
  return (
    <header className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 text-[13px] text-muted">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => (<li key={i} className="flex items-center gap-1">{i > 0 && <span aria-hidden>/</span>}{c.href ? <Link href={c.href} className="hover:text-brand hover:underline">{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>{subtitle && <p className="mt-1 text-muted max-w-3xl">{subtitle}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
const TONES: Record<string, string> = {
  neutral: 'bg-bg text-muted border-line', brand: 'bg-brandSoft text-brand border-brandSoft', ok: 'bg-okSoft text-ok border-okSoft', warn: 'bg-warnSoft text-warn border-warnSoft', bad: 'bg-badSoft text-bad border-badSoft',
};
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone] || TONES.neutral}`}>{children}</span>;
}
const STATUS_TONE: Record<string, string> = {
  active: 'ok', paid: 'ok', done: 'ok', published: 'ok', succeeded: 'ok', delivered: 'ok', approved: 'ok', on_track: 'ok', resolved: 'ok', open: 'brand', trial: 'warn', trialing: 'warn', pending: 'warn', review: 'warn', draft: 'neutral', todo: 'neutral', doing: 'brand', blocked: 'bad',
  failed: 'bad', past_due: 'bad', suspended: 'bad', expired: 'bad', refunded: 'warn', disputed: 'bad', retired: 'neutral', at_risk: 'warn', off_track: 'bad', closed: 'neutral', cancelled: 'neutral', retry: 'warn', running: 'brand', investigating: 'bad', monitoring: 'warn', closing: 'warn', scheduled: 'brand', revoked: 'neutral', requested: 'warn', completed: 'ok',
};
export function Status({ value }: { value: string }) { return <Badge tone={STATUS_TONE[value] || 'neutral'}>{value.replace(/_/g, ' ')}</Badge>; }
export function Card({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (<section className={`card ${className}`}>{(title || actions) && <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3"><h2 className="font-semibold">{title}</h2><div className="flex gap-2">{actions}</div></div>}<div className="p-4">{children}</div></section>);
}
export function Empty({ title, children, action, icon = 'box' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: string }) {
  return (<div className="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center"><Icon name={icon} size={28} className="mx-auto text-muted" /><h3 className="mt-3 font-semibold">{title}</h3>{children && <p className="mx-auto mt-1 max-w-md text-muted">{children}</p>}{action && <div className="mt-4 flex justify-center gap-2">{action}</div>}</div>);
}
export function Alert({ tone = 'brand', title, children, role }: { tone?: 'brand' | 'ok' | 'warn' | 'bad'; title?: string; children?: ReactNode; role?: string }) {
  const t = { brand: 'border-brand/30 bg-brandSoft text-ink', ok: 'border-ok/30 bg-okSoft text-ink', warn: 'border-warn/40 bg-warnSoft text-ink', bad: 'border-bad/40 bg-badSoft text-ink' }[tone];
  return <div role={role || (tone === 'bad' ? 'alert' : 'status')} className={`rounded-lg border px-4 py-3 text-sm ${t}`}>{title && <p className="font-semibold">{title}</p>}{children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}</div>;
}
export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (<div className="card p-4"><p className="text-[13px] text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}</div>);
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}
export function LinkButton({ href, children, variant = 'secondary', small, ...r }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; small?: boolean } & Record<string, any>) {
  return <Link href={href} className={`btn-${variant} ${small ? 'btn-sm' : ''}`} {...r}>{children}</Link>;
}
export function Table({ head, children, caption, empty }: { head: (string | { label: string; right?: boolean })[]; children: ReactNode; caption?: string; empty?: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line bg-bg"><tr>{head.map((h, i) => { const o = typeof h === 'string' ? { label: h } : h; return <th key={i} scope="col" className={`th ${o.right ? 'text-right' : ''}`}>{o.label}</th>; })}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
export function Tabs({ items, current }: { items: { href: string; label: string; key: string; count?: number }[]; current: string }) {
  return (<nav aria-label="Sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">{items.map(i => (<Link key={i.key} href={i.href} aria-current={i.key === current ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${i.key === current ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{i.label}{i.count != null && <span className="ml-1.5 rounded-full bg-bg px-1.5 text-xs">{i.count}</span>}</Link>))}</nav>);
}
export function Field({ label, name, hint, error, children, required }: { label: string; name?: string; hint?: ReactNode; error?: string; children: ReactNode; required?: boolean }) {
  return (<div><label className="label" htmlFor={name}>{label}{required && <span className="text-bad" aria-hidden> *</span>}</label>{children}{hint && <p className="hint" id={name ? name + '-hint' : undefined}>{hint}</p>}{error && <p className="mt-1 text-[13px] text-bad" role="alert">{error}</p>}</div>);
}
export const fmtDate = (s?: string | null, tz = 'Asia/Kolkata') => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }) : '-');
export const fmtDateTime = (s?: string | null, tz = 'Asia/Kolkata') => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }) : '-');
export function ago(s?: string | null) {
  if (!s) return '-'; const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago'; if (d < 86400 * 30) return Math.floor(d / 86400) + ' d ago';
  return fmtDate(s);
}
