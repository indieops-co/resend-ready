# Mission 5 — Two-Way Street

**Why it matters:** customers reply to email. If those replies land in a founder's personal inbox (or nowhere), the app has a support channel it can't see. Receiving turns replies into rows you can list, assign, and answer from the admin — in the same thread the customer already has open.

Skipped (N/A) when Mission 0 set `receiving=false`.

**What the doctor checks:** `inbound.handler` (`email.received` branch), `inbound.fetches_content` (`resend.emails.receiving.get`), `store.inbound_table`, `admin.inbox`, `code.reply_threading` (`In-Reply-To`), `dns.receiving_mx`; with `--live`, `live.received_event_enabled`.

## Do this

1. **Choose the receiving address.** Fastest: the team's `<anything>@<id>.resend.app` address (Emails → Receiving → Receiving address). Better for replies: a custom subdomain `inbox.acme.com` — enable Receiving on it in the dashboard and add the MX it shows. **It must be the lowest-priority MX on that name**, which is exactly why it goes on a subdomain and not on the domain Google Workspace / Outlook already uses. Never put Resend's MX on the apex of a domain with a real inbox.
2. **Enable `email.received`** on the webhook from Mission 4.
3. **Handle it**: the payload is metadata (`email_id`, `message_id`, `from`, `to`, `subject`, attachment metadata). Call `resend.emails.receiving.get(email_id)` for `html`/`text`/`headers`, then `storeInbound()` — and **store `message_id`**; it's what makes replies thread.
4. **Inbox page**: `app/admin/inbox/page.tsx` + `[id]/page.tsx` from `snippets/admin-inbox.tsx`. Render `text_body` by default; if rendering HTML, sanitize it — it came from a stranger.
5. **Reply**: `snippets/reply-action.ts`. `from:` an address on the receiving domain (so the next reply comes back), `subject: 'Re: …'`, `headers: { 'In-Reply-To': message_id, References: message_id }`. Mark the row replied.
6. **Attachments**: list via `receiving.attachments.list(email_id)`; the download URLs are temporary, so fetch on demand rather than storing them.
7. **Routing by `to`**: one receiving domain can serve `support@`, `billing@`, `bounce+<id>@`; branch on `event.data.to`.

## Branches

- **Supabase**: `inbound_emails` table (in `schema-supabase.sql`), status column `open | replied | archived`, Realtime for a new-mail badge.
- **Firebase**: `inboundEmails/{emailId}`, `firebase-admin` writes, rules closed to clients.
- **Forward to a human instead of an inbox UI**: send the fetched content onward with `sendEmail()` and `replyTo` set to the original sender. Still store it.

## Done when

All six checks pass. `dns.receiving_mx` is `VERIFIED` for a custom domain, or `--confirm dns.receiving_mx:"resend.app address"` if using the managed one.
