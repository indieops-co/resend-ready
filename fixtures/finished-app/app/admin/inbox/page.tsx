// app/admin/inbox/page.tsx — inbox list; app/admin/inbox/[id]/page.tsx — one thread + reply box.
import { requireAdmin } from '@/lib/auth';
import { listInbound, getInbound } from '@/lib/email-store'; // select from inbound_emails
import { replyToInbound } from './actions';
import Link from 'next/link';

export default async function InboxPage() {
  await requireAdmin();
  const mail = await listInbound({ status: 'open', limit: 50 });
  return (
    <ul className="divide-y">
      {mail.map((m) => (
        <li key={m.email_id} className="py-2">
          <Link href={`/admin/inbox/${m.email_id}`} className="font-medium">{m.subject || '(no subject)'}</Link>
          <div className="text-sm text-gray-600">{m.from_address} · {new Date(m.received_at).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}

// ---- app/admin/inbox/[id]/page.tsx ----
export async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const m = await getInbound(id);
  return (
    <article className="space-y-4">
      <h1 className="text-lg font-semibold">{m.subject}</h1>
      <p className="text-sm text-gray-600">From {m.from_address}</p>
      {/* Render text by default. If you must render HTML, sanitize it first (it came from a stranger). */}
      <pre className="whitespace-pre-wrap text-sm">{m.text_body}</pre>
      <form action={replyToInbound.bind(null, m.email_id)} className="space-y-2">
        <textarea name="body" rows={6} className="w-full border rounded p-2" placeholder="Reply…" />
        <button className="border rounded px-3 py-1">Send reply</button>
      </form>
    </article>
  );
}
