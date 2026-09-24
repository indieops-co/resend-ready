// app/admin/email/page.tsx — the seam: a server component reading the events your webhook stored.
import { requireAdmin } from '@/lib/auth';          // your existing admin guard
import { listRecentEvents } from '@/lib/email-store'; // select * from email_events order by occurred_at desc limit 100
import { TestSendForm } from './test-send-form';

const PILL: Record<string, string> = {
  'email.delivered': 'bg-green-100 text-green-800',
  'email.bounced': 'bg-red-100 text-red-800',
  'email.complained': 'bg-red-100 text-red-800',
  'email.delivery_delayed': 'bg-amber-100 text-amber-800',
};

export default async function EmailAdminPage() {
  await requireAdmin();
  const events = await listRecentEvents(100);

  return (
    <main className="p-6 space-y-6">
      <TestSendForm />
      <table className="w-full text-sm">
        <thead><tr><th>When</th><th>Event</th><th>To</th><th>Subject</th><th>Tag</th><th>Detail</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.svix_id}>
              <td>{new Date(e.occurred_at).toLocaleString()}</td>
              <td><span className={`px-2 py-0.5 rounded ${PILL[e.type] ?? 'bg-gray-100'}`}>{e.type.replace('email.', '')}</span></td>
              <td>{e.to_address?.join(', ')}</td>
              <td>{e.subject}</td>
              <td>{e.tag}</td>
              <td className="text-red-700">{e.bounce?.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
