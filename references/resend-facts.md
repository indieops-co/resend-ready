# Resend facts (distilled from official docs, September 2026)

Read this before any mission. If it disagrees with resend.com/docs, the docs win — then fix this file.

## Sending

- SDK: `npm i resend`. `import { Resend } from 'resend'; const resend = new Resend(process.env.RESEND_API_KEY)`.
- Send: `const { data, error } = await resend.emails.send({ from, to, subject, html, text, replyTo, headers, tags, attachments, scheduledAt })`. Returns `{ data: { id } }` on success; **check `error`, the promise does not reject on API errors.**
- Idempotency: pass `{ idempotencyKey: 'welcome/<userId>' }` as the **second argument** to `emails.send(params, { idempotencyKey })` to make retries safe (keys are scoped per API key, expire after 24h).
- Batch: `resend.batch.send([...])` up to 100 emails per call.
- `from` must be on a **verified domain**. `onboarding@resend.dev` only delivers to the account owner's own address — it is a dev crutch, not a launch setting.
- Safe test recipients that simulate events without hurting reputation: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`.
- Templates: Resend Templates (dashboard editor or API) with `{{variables}}`; or author with React Email (`@react-email/components`) and pass `react:` instead of `html:`.
- Marketing/bulk to contacts = **Broadcasts** (to Segments/Audiences), with Topics for preference management and a hosted unsubscribe page. Transactional = `emails.send`. Automations = event-triggered sequences.
- Tags: `tags: [{ name: 'category', value: 'welcome' }]` — they come back in webhook payloads, so tag every send.
- Rate limits exist (default 2 req/s on `emails.send`); batch or queue for bursts.

## Domains & DNS (what the doctor checks)

Resend **strongly recommends a subdomain** (e.g. `notifications.example.com`), not the apex, for reputation isolation and purpose transparency. Records Resend generates for a domain `D`:

| Purpose | Record | Name | Value contains |
|---|---|---|---|
| DKIM | TXT | `resend._domainkey.D` | `p=` (public key) |
| SPF (return path) | TXT | `send.D` (or custom return-path label) | `v=spf1 include:amazonses.com ~all` |
| Return-path MX | MX | `send.D` | `feedback-smtp.<region>.amazonses.com` (priority 10) |
| DMARC (you add it) | TXT | `_dmarc.<root>` | `v=DMARC1; p=none;` then `quarantine`/`reject` later |
| Receiving (optional) | MX | `D` or a receiving subdomain | Resend's inbound MX (shown in dashboard) — **must be the lowest priority value** on that name |

- CNAME/proxy warning: do not proxy these records (Cloudflare orange cloud off).
- Verification usually completes within 15 minutes; DNS can take up to 72h. `dns.email` is Resend's public checker.
- Custom Return-Path: label must be ≤63 chars, letters/numbers/hyphens, start with a letter.
- Regions: pick the one closest to most recipients when creating the domain; it can't be changed after.
- Open/click tracking is a per-domain toggle. **Turn it off on transactional/auth subdomains** — link rewriting can break single-use magic links and tracking pixels look suspicious to inbox providers.
- Domain claiming exists for domains already verified by another team.

## Webhooks

- Configure at resend.com/webhooks (or via API `POST /webhooks`). Each endpoint has a signing secret `whsec_…`.
- Delivery is via Svix: headers `svix-id`, `svix-timestamp`, `svix-signature`. Verify against the **raw request body** (`await req.text()`), not re-serialized JSON.
- SDK verification: `resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret })` — throws on invalid. Or `npm i svix` and `new Webhook(secret).verify(payload, headers)`.
- Retries happen on non-2xx; dedupe on `svix-id` (or `data.email_id` + `type`).
- Event types: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.scheduled`, `email.suppressed`, `email.received`, plus `domain.*`, `contact.*`, `suppression.*`.
- Payload shape: `{ type, created_at, data: { email_id, from, to, subject, created_at, tags?, ... } }`. Bounce events include `data.bounce.{type, subType, message}`.
- Resend also ships an open-source "Webhook Ingester" for storing all events in your own DB, if you'd rather not hand-roll.

## Receiving (inbound)

- Two ways to get mail: a Resend-managed `<anything>@<id>.resend.app` address (free, instant), or your own domain/subdomain with the Resend MX record added.
- If the domain already has MX records (a real inbox), **use a subdomain** (`inbox.example.com`) so you don't hijack company email.
- Flow: mail arrives → Resend parses it → POSTs `email.received` to your webhook. **The webhook carries metadata only** (`email_id`, `message_id`, `from`, `to`, `subject`, attachment metadata). Fetch the body with `resend.emails.receiving.get(email_id)` → `{ html, text, headers, ... }`. Attachments via `resend.emails.receiving.attachments.list/get(...)` (temporary download URLs).
- Reply in thread: send with `subject: 'Re: ' + original`, `headers: { 'In-Reply-To': message_id, 'References': '<prior ids> ' + message_id }`. `message_id` comes from the `email.received` payload.
- Forwarding to a human inbox is supported (send the fetched content onward).
- Route by the `to` field if one receiving domain serves several purposes (`support@`, `billing@`).

## Account rules (Acceptable Use Policy) — the parts that get accounts closed

- Complaint rate must stay **below 0.08%**; bounce rate **below 4%**. Above those, accounts may be shut down without warning.
- Prohibited: mass, non-personalized, unsolicited messages without prior consent (cold email); phishing; illegal content; anything producing high bounce/complaint rates.
- No refunds for AUP breaches.

## Warm-up baselines (new domain)

Day 1: 150/day · Day 2: 250 · Day 3: 400 · Day 4: 700 (≤50/hr) · Day 5: 1,000 (≤75/hr) · Day 6: 1,500 (≤100/hr) · Day 7: 2,000 (≤150/hr), then ~1.4× per day until target. Existing domain moving to Resend: Day 1: 1,000 · Day 3: 5,000 · Day 7: 10,000. Slow down if bounce/complaint rates rise. Third-party "warm-up networks" are discouraged by Resend.

## Auth platform notes

- **Supabase Auth**: configure Custom SMTP (host `smtp.resend.com`, port 465, user `resend`, password = API key) or use the Resend ↔ Supabase integration. Put a custom domain on the Supabase project so links and `from` share a domain. Send auth mail from its own subdomain (`auth.example.com`) or your transactional subdomain. Disable tracking on that domain. Consider an interstitial "Sign in" page so link scanners don't burn single-use links.
- **Firebase Auth**: Authentication → Templates → SMTP settings accepts a custom SMTP server (same Resend SMTP credentials) so verification/reset mail leaves from your subdomain. App-originated mail (welcome, receipts) goes through the SDK from a server context (Route Handler, Server Action, or Cloud Function) — never from the browser.

## SMTP (for anything that can't call the API)

Host `smtp.resend.com`; ports 465 (TLS), 587/2587 (STARTTLS); username `resend`; password = an API key with sending permission.

## Things people get wrong (checked by the doctor)

1. `NEXT_PUBLIC_RESEND_API_KEY` — that ships the key to every browser. Server-only, always.
2. `from` still `onboarding@resend.dev` in production code — usually **not** as a literal but as a fallback: `process.env.RESEND_FROM ?? 'Acme <onboarding@resend.dev>'`. It only fires when the variable is missing in the environment that is sending, and since that address still delivers to the account owner, the developer's own tests keep passing while nothing reaches customers.
3. Sending from the apex domain.
4. No `text:` alternative (spam filters and screen readers both care).
5. Webhook handler that parses JSON before verifying (signature breaks) or doesn't verify at all.
6. Treating the `email.received` payload as the email (it isn't — fetch the content).
7. Tracking left on for auth/transactional domains.
8. Marketing mail without a working unsubscribe (and `List-Unsubscribe` headers).
9. Ignoring `error` from `emails.send` because the promise resolved.
10. `.env.local` not in `.gitignore`.
11. Setting `RESEND_FROM` / `RESEND_API_KEY` in the repo's env file only. Production reads the **deployment store** (Vercel env, Supabase Edge Function secrets, Fly secrets); the three copies drift, and the repo's is the least authoritative.
12. Two DKIM records on the `resend` selector after moving a domain between accounts (add instead of replace), or two `v=spf1` records on one name — an RFC 7208 PermError that fails SPF outright.
13. A managed DNS host re-stamping `send.<domain>` with its own SPF/A records. An `A` record on the return-path subdomain is the tell.
14. Adding `include:amazonses.com` to the **apex** SPF. Unnecessary — the envelope sender is `send.<domain>` — and it widens who can send as you.
15. A second Resend account "to protect the root domain". Subdomains do that; a second account just guarantees a key/domain mismatch and a 403 nobody can explain from the code.
16. No `replyTo` on mail sent from a subdomain that cannot receive — every human reply bounces.
