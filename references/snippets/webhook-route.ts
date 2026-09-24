// app/api/resend/webhook/route.ts — one endpoint for every Resend event, sending AND receiving.
import { NextResponse, type NextRequest } from 'next/server';
import { resend } from '@/lib/email';                                   // the one shared client
import { storeEvent, storeInbound, alreadySeen } from '@/lib/email-store'; // your Supabase or Firestore store

export async function POST(req: NextRequest) {
  const payload = await req.text(); // RAW body. Parsing JSON first breaks the signature.

  let event: any;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id')!,
        timestamp: req.headers.get('svix-timestamp')!,
        signature: req.headers.get('svix-signature')!,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch {
    return new NextResponse('invalid signature', { status: 400 });
  }

  const svixId = req.headers.get('svix-id')!;
  if (await alreadySeen(svixId)) return NextResponse.json({ ok: true, dup: true }); // Resend retries; be idempotent

  if (event.type === 'email.received') {
    // The payload is metadata only. Fetch the body, then store the whole thing.
    const { data: full } = await resend.emails.receiving.get(event.data.email_id);
    await storeInbound({ svixId, meta: event.data, full });
  } else {
    await storeEvent({ svixId, type: event.type, at: event.created_at, data: event.data });
  }

  return NextResponse.json({ ok: true }); // 2xx fast; do heavy work in a queue if you have one
}
