import Link from 'next/link';
import { Icon } from '@/components/ui';
import { FEATURES, SOLUTIONS } from '@/lib/site';
export default function Home() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-medium text-brand">Company workspace and knowledge base</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Link the client, the project, the proposal, the task and the decision &mdash; in one place.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Fieldnote gives agencies, startups, consultants and distributed teams pages, databases, tasks, SOPs and meeting notes in an isolated workspace with permissions you can explain.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="btn-primary">Start 14-day free trial</Link><Link href="/demo" className="btn-secondary">Book a demo</Link></div>
          <p className="mt-3 text-sm text-muted">No card needed. Plans in INR with GST invoices.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Everything a small team needs, nothing it has to fight</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 6).map(f => (<div key={f.title} className="card p-5"><Icon name={f.icon} className="text-brand" size={22} /><h3 className="mt-3 font-semibold">{f.title}</h3><p className="mt-1 text-muted">{f.body}</p></div>))}
        </div>
        <p className="mt-5"><Link href="/features" className="link">See all features</Link></p>
      </section>
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold">Built for how your team works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">{SOLUTIONS.map(s => (<Link key={s.slug} href={`/solutions/${s.slug}`} className="card block p-5 hover:border-brand"><h3 className="font-semibold">{s.name}</h3><p className="mt-1 text-muted">{s.pitch}</p></Link>))}</div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 text-center"><h2 className="text-2xl font-semibold">Try it with sample data</h2><p className="mx-auto mt-2 max-w-xl text-muted">Every new workspace can start with a sample client, project and SOP so you can see how the pieces connect.</p><Link href="/signup" className="btn-primary mt-5">Create your workspace</Link></section>
    </>
  );
}
