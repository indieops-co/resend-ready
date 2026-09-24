// app/admin/email/test-send-form.tsx — send a test, then watch the send log fill in as webhooks arrive.
'use client';
import { useActionState } from 'react';
import { sendTestEmail } from './actions';

export function TestSendForm() {
  const [state, action, pending] = useActionState(sendTestEmail, null);
  return (
    <form action={action} className="flex gap-2 items-end">
      <label>To
        <select name="to" className="block border rounded px-2 py-1">
          <option value="delivered@resend.dev">delivered@resend.dev (simulate delivery)</option>
          <option value="bounced@resend.dev">bounced@resend.dev (simulate bounce)</option>
          <option value="complained@resend.dev">complained@resend.dev (simulate complaint)</option>
          <option value="me">my own address</option>
        </select>
      </label>
      <button disabled={pending} className="border rounded px-3 py-1">{pending ? 'Sending…' : 'Send test'}</button>
      {state && <span className="text-sm">{state.ok ? `Queued: ${state.id}` : `Failed: ${state.message}`}</span>}
    </form>
  );
}

// app/admin/email/actions.ts
// 'use server';
// import { sendEmail } from '@/lib/email';
// import { requireAdmin } from '@/lib/auth';
// export async function sendTestEmail(_prev: any, formData: FormData) {
//   const admin = await requireAdmin();
//   const to = formData.get('to') === 'me' ? admin.email : String(formData.get('to'));
//   const r = await sendEmail({ to, subject: 'Resend Ready test', html: '<p>If you can read this, plumbing works.</p>', tag: 'test' });
//   return r.ok ? { ok: true, id: r.id } : { ok: false, message: r.error.message };
// }
