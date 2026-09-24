// Prefer Resend Broadcasts for newsletters: they handle unsubscribe pages, List-Unsubscribe headers, and segments.
// If you must hand-roll a marketing send (e.g. per-user digests), these two headers are the price of admission
// for Gmail/Yahoo bulk-sender rules — and the unsubscribe URL must actually work, quickly.
import { resend } from '@/lib/email';

export async function sendDigest(user: { email: string; unsubscribeToken: string }, html: string, text: string) {
  const unsubUrl = `https://acme.com/unsubscribe?token=${user.unsubscribeToken}`; // POST-capable endpoint
  const { data, error } = await resend.emails.send({
    from: 'Acme Updates <news@updates.acme.com>', // the MARKETING subdomain, not the transactional one
    to: [user.email],
    subject: 'Your weekly digest',
    html: html + `<p style="font-size:12px"><a href="${unsubUrl}">Unsubscribe</a> · Acme, 123 Main St, San Jose, CA</p>`,
    text: text + `\n\nUnsubscribe: ${unsubUrl}\nAcme, 123 Main St, San Jose, CA`,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@updates.acme.com?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'category', value: 'digest' }],
  });
  if (error) throw new Error(`digest to ${user.email} failed: ${error.message}`);
  return data!.id;
}
