import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const event = await req.json();
  if (event.type === 'email.delivered') console.log('delivered', event.data.email_id);
  return NextResponse.json({ ok: true });
}
