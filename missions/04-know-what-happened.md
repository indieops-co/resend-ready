# Mission 4 — Know What Happened

**Why it matters:** "sent" is not "delivered". Without webhooks, the first sign of a bounce problem is a customer saying "I never got the invite" — or Resend closing the account for a 5% bounce rate you never saw. This mission gives the app a send log and the admin a place to look.

**What the doctor checks:** `webhook.route_exists`, `webhook.verifies_signature`, `webhook.raw_body`, `webhook.dedupe`, `env.webhook_secret_present`, `store.events_table`, `admin.send_log`, `code.tags`; optional `admin.test_send`; with `--live`, `live.webhook_registered`.

## Do this

1. **Storage first.** Supabase: run `snippets/schema-supabase.sql` (creates `email_events` with `svix_id` as primary key — that's the dedupe — plus RLS so only admins read). Firebase: `emailEvents/{svixId}` docs (`snippets/store-firestore.ts`). Add `lib/email-store.ts` with `alreadySeen`, `storeEvent`, `storeInbound`, `listRecentEvents`.
2. **The route**: `app/api/resend/webhook/route.ts` from `snippets/webhook-route.ts`. Non-negotiables: `await req.text()` **before** anything parses JSON; `resend.webhooks.verify(...)` with the `svix-*` headers; 400 on failure; dedupe on `svix-id`; return 2xx quickly. Note the route already dispatches `email.received` for Mission 5 — leave that branch in place even if receiving is off; it's harmless.
3. **Register it** at resend.com/webhooks with the public URL (`https://app.acme.com/api/resend/webhook`). For local dev, tunnel with ngrok / VS Code port forwarding. Tick `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed` (and `email.received` if Mission 5 is coming). Copy the signing secret into `RESEND_WEBHOOK_SECRET`.
4. **The admin page**: `app/admin/email/page.tsx` from `snippets/admin-send-log.tsx` behind the project's existing admin guard. Columns: when, event, to, subject, tag, bounce reason. The bounce `message` is the thing support actually needs.
5. **Test-send affordance** (`snippets/test-send-form.tsx`): a dropdown of `delivered@`/`bounced@`/`complained@resend.dev` plus "me". Send one of each and watch the log fill. This is also how you prove the webhook is wired without touching a real mailbox.
6. **Tags on every send** (`tags: [{ name: 'category', value: … }]`) — they come back in each event, so the log can be filtered by purpose.

## Branches

- **Supabase**: write with the service-role client (no session in a webhook); read with the server client + admin check. Realtime subscription is optional sugar.
- **Firebase**: `firebase-admin` on the server; lock the collection in Firestore rules; custom claim `admin: true` for the page.
- **Don't want to hand-roll storage?** Resend publishes an open-source Webhook Ingester; the checks still expect an admin page that reads whatever it stores.

## Done when

`webhook.route_exists`, `webhook.verifies_signature`, `env.webhook_secret_present`, `store.events_table`, `admin.send_log` pass. Bonus: `webhook.raw_body`, `webhook.dedupe`, `code.tags` green.
