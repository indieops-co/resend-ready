// lib/email-store.ts (Supabase flavor) — writes from the webhook use the service role; no user session exists there.
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function alreadySeen(svixId: string) {
  const { data } = await db.from('email_events').select('svix_id').eq('svix_id', svixId).maybeSingle();
  return !!data;
}

export async function storeEvent(e: { svixId: string; type: string; at: string; data: any }) {
  await db.from('email_events').insert({
    svix_id: e.svixId,
    email_id: e.data.email_id,
    type: e.type,
    occurred_at: e.at,
    to_address: e.data.to,
    subject: e.data.subject,
    tag: e.data.tags?.find((t: any) => t.name === 'category')?.value ?? null,
    bounce: e.data.bounce ?? null,
    raw: e.data,
  });
}

export async function storeInbound(i: { svixId: string; meta: any; full: any }) {
  await db.from('inbound_emails').upsert({
    email_id: i.meta.email_id,
    message_id: i.meta.message_id,
    from_address: i.meta.from,
    to_address: i.meta.to,
    subject: i.meta.subject,
    text_body: i.full?.text ?? null,
    html_body: i.full?.html ?? null,
    attachments: i.meta.attachments ?? null,
  });
}
