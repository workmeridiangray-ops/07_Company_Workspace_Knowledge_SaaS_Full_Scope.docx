import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { LeadForm } from '@/components/LeadForm';
export const metadata: Metadata = { title: 'Book a demo' };
export default function Demo() { return (<div className="mx-auto max-w-2xl px-4 py-10"><PageHeader title="Book a demo" subtitle="A 30-minute walkthrough using your own scenario: a client, a project, a proposal and a decision." /><LeadForm kind="demo" /></div>); }
