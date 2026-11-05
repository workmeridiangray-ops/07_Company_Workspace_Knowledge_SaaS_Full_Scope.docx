import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { LeadForm } from '@/components/LeadForm';
export const metadata: Metadata = { title: 'Contact' };
export default function Contact() { return (<div className="mx-auto max-w-2xl px-4 py-10"><PageHeader title="Contact us" subtitle="Sales, support or privacy questions. Existing customers can also raise a ticket from inside the app." /><LeadForm kind="contact" /></div>); }
