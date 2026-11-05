'use client';
import { ActionForm, Submit } from './ActionForm';
import { submitLead } from '@/lib/leads';
export function LeadForm({ kind }: { kind: 'demo' | 'contact' }) {
  return (
    <ActionForm action={submitLead} className="card space-y-4 p-5" resetOnSuccess>
      <input type="hidden" name="kind" value={kind} />
      <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" className="input" required autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" placeholder="name@company.com" /></div>
        <div><label className="label" htmlFor="company">Company</label><input id="company" name="company" className="input" autoComplete="organization" /></div>
        <div><label className="label" htmlFor="size">Team size</label><select id="size" name="size" className="input"><option>1-5</option><option>6-25</option><option>26-100</option><option>100+</option></select></div>
      </div>
      <div><label className="label" htmlFor="message">{kind === 'demo' ? 'What would you like to see?' : 'How can we help?'}</label><textarea id="message" name="message" rows={4} className="input" required /></div>
      <Submit pendingText="Sending…">{kind === 'demo' ? 'Request demo' : 'Send message'}</Submit>
    </ActionForm>
  );
}
