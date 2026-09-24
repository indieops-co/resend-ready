// lib/email.ts — every send in the app goes through here. One module, one place to fix things.
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY); // the ONLY `new Resend(` in the app. Server-only: never NEXT_PUBLIC_

const FROM = {
  transactional: 'Acme <hello@notifications.acme.com>', // your verified subdomain, not the apex
  marketing: 'Acme Updates <news@updates.acme.com>',
} as const;

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;                 // always send a text part; we derive one if you don't
  kind?: keyof typeof FROM;      // picks the from-address (and therefore the subdomain)
  tag: string;                   // 'welcome' | 'receipt' | 'invite' … comes back in every webhook
  replyTo?: string;
  idempotencyKey?: string;       // e.g. `welcome/${userId}` — safe to retry for 24h
};

export async function sendEmail(args: SendArgs) {
  const { data, error } = await resend.emails.send(
    {
      from: FROM[args.kind ?? 'transactional'],
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text ?? htmlToText(args.html),
      replyTo: args.replyTo,
      tags: [{ name: 'category', value: args.tag }],
    },
    args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
  );

  // The promise resolves even when the API says no. Check `error`, every time.
  if (error) {
    console.error('[email] send failed', { tag: args.tag, name: error.name, message: error.message });
    return { ok: false as const, error };
  }
  return { ok: true as const, id: data!.id };
}

// Good enough for a fallback part; use a real converter if you care about formatting.
function htmlToText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
