import { insert, id, now, run } from './db';
export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
/** Transactional email. With RESEND_API_KEY set, sends through Resend; otherwise queues to the outbox (visible to platform ops). */
export async function sendMail(to: string, subject: string, text: string): Promise<{ delivered: boolean }> {
  const oid = id('mail_'); insert('outbox', { id: oid, to_email: to, subject, body: text, status: 'queued', created_at: now() });
  if (!emailConfigured()) return { delivered: false };
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM || 'Fieldnote <no-reply@fieldnote.example>', to, subject, text }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    run(`UPDATE outbox SET status='sent' WHERE id=?`, oid); return { delivered: true };
  } catch (e: any) { run(`UPDATE outbox SET status='failed', error=? WHERE id=?`, String(e.message).slice(0, 200), oid); return { delivered: false }; }
}
