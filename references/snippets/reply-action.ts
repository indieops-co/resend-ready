// app/admin/inbox/actions.ts — reply lands in the customer's existing thread because of the two headers.
'use server';
import { resend } from '@/lib/email';
import { requireAdmin } from '@/lib/auth';
import { getInbound, markReplied } from '@/lib/email-store';

export async function replyToInbound(emailId: string, formData: FormData) {
  await requireAdmin();
  const m = await getInbound(emailId);
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const { error } = await resend.emails.send({
    from: 'Acme Support <support@inbox.acme.com>', // same receiving domain, so their next reply comes back to you
    to: [m.from_address],
    subject: m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject ?? ''}`,
    text: body,
    headers: {
      'In-Reply-To': m.message_id,
      References: m.message_id, // append prior ids, space-separated, if this thread has history
    },
    tags: [{ name: 'category', value: 'support-reply' }],
  });
  if (error) throw new Error(error.message);
  await markReplied(emailId);
}
