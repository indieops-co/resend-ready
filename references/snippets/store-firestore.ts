// lib/email-store.ts (Firebase flavor) — firebase-admin only; clients never touch these collections.
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();

export async function alreadySeen(svixId: string) {
  return (await db.doc(`emailEvents/${svixId}`).get()).exists; // doc id = svix-id → free dedupe
}

export async function storeEvent(e: { svixId: string; type: string; at: string; data: any }) {
  await db.doc(`emailEvents/${e.svixId}`).set({
    emailId: e.data.email_id,
    type: e.type,
    occurredAt: e.at,
    to: e.data.to,
    subject: e.data.subject ?? null,
    tag: e.data.tags?.find((t: any) => t.name === 'category')?.value ?? null,
    bounce: e.data.bounce ?? null,
    raw: e.data,
    storedAt: FieldValue.serverTimestamp(),
  });
}

export async function storeInbound(i: { svixId: string; meta: any; full: any }) {
  await db.doc(`inboundEmails/${i.meta.email_id}`).set({
    messageId: i.meta.message_id,
    from: i.meta.from,
    to: i.meta.to,
    subject: i.meta.subject ?? null,
    text: i.full?.text ?? null,
    html: i.full?.html ?? null,
    attachments: i.meta.attachments ?? null,
    status: 'open',
    receivedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
