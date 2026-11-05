'use server';
import { headers } from 'next/headers';
import { insert, id, now } from './db';
import { guard, str, need, UserError } from './action';
import { rateLimit, validEmail } from './security';
import type { ActionResult } from '@/components/ActionForm';

export async function submitLead(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const h = await headers(); const ip = (h.get('x-forwarded-for') || 'local').split(',')[0];
    if (!rateLimit('lead:' + ip, 8, 3600_000)) throw new UserError('Too many requests. Please try again later.');
    if (str(fd, 'website')) return { ok: true, message: 'Thank you. We will be in touch.' }; // honeypot
    const name = need(str(fd, 'name', 100), 'Please enter your name.'); const email = str(fd, 'email', 200).toLowerCase();
    if (!validEmail(email)) throw new UserError('Enter a valid work email, for example name@company.com.');
    const kind = str(fd, 'kind', 20) === 'demo' ? 'Demo request' : 'Contact';
    const msg = need(str(fd, 'message', 2000), 'Tell us a little about what you need.');
    insert('support_tickets', { id: id('tk_'), ws: null, subject: `${kind}: ${name} <${email}>`, body: `${str(fd, 'company', 120)}\n${str(fd, 'size', 40)}\n\n${msg}`, status: 'open', priority: 'normal', created_by: null, created_at: now() });
    return { ok: true, message: kind === 'Demo request' ? 'Thanks, we have your request. Expect an email within one business day.' : 'Thanks, your message is with our team.' };
  });
}
