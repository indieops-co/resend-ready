# Deliverability playbook — the part nobody reads until they're in the spam folder

This is the "beyond plumbing" material. Mission 6 draws from it. Everything here is either an official Resend recommendation or an inbox-provider requirement (Gmail/Yahoo bulk-sender rules). Opinions are marked as such.

## 1. The subdomain plan (do this before the first real send)

One subdomain per *purpose*, never the apex. The name is a promise to inbox providers about what comes from it.

| Purpose | Suggested name | Tracking | Notes |
|---|---|---|---|
| Auth / security (magic links, resets, 2FA) | `auth.` or fold into transactional | **off** | Single-use links + link rewriting = broken logins |
| Transactional (receipts, invites, alerts) | `notifications.` / `mail.` | **off** | Highest trust, protect it hardest |
| Marketing / newsletters / product updates | `updates.` / `news.` | on is fine | Needs unsubscribe + List-Unsubscribe headers |
| Receiving (support@, replies) | `inbox.` / `reply.` | n/a | Gets the MX record so your real company mail is untouched |

Why separate: a bad day on marketing (a stale list, a spike in complaints) can't take down password resets. Resend calls this **reputation isolation**; the naming is **sending purpose transparency**.

Opinion: solopreneurs can start with two — `notifications.` and `updates.` — and add `inbox.` when Mission 5 is on.

## 2. Cold email: the honest paragraph

Resend's Acceptable Use Policy prohibits mass, non-personalized, unsolicited messages without prior consent. Complaint rate over 0.08% or bounce rate over 4% can get an account shut down without warning, and no refund. A cold campaign is the fastest known route to both numbers.

"But I'll use a separate subdomain" protects your *root* domain's reputation; it does not protect your *Resend account*. If cold outreach is part of the business, do it from a dedicated cold-outreach tool on a dedicated *domain* (not a subdomain of your product), with its own mailbox warm-up, and keep it a thousand miles from the account that sends your customers' receipts. Then, when a prospect replies and becomes a customer, *that's* when Resend starts talking to them.

The course will not help route cold outreach through Resend. Keep your head on a swivel.

## 3. Consent, in one table

| You may send | Because |
|---|---|
| Account emails (auth, receipts, security, service changes) | Contractual / implied by signup |
| Product updates to users who didn't opt out | Existing relationship; must have unsubscribe |
| Newsletters to people who opted in (checkbox, double opt-in ideal) | Express consent |
| Nothing to a list you bought, scraped, or "found" | No consent, AUP breach, CAN-SPAM/GDPR exposure |

Keep a record of *how* each contact consented (form, date, IP if you have it). Resend Segments/Topics can hold preference state; the source-of-truth record should live in your own DB.

## 4. Authentication trio

- **DKIM** — Resend signs; you publish `resend._domainkey`. Proves the message wasn't altered.
- **SPF** — on the return-path subdomain (`send.<domain>`). Proves Resend may send for you.
- **DMARC** — `_dmarc.<root>` TXT. Start with `v=DMARC1; p=none; rua=mailto:dmarc@<root>` to collect reports, move to `p=quarantine` then `p=reject` once only legitimate mail is passing. Gmail/Yahoo require DMARC for bulk senders; a `p=none` record still counts as "has DMARC".
- Resend publishes a free DMARC report analyzer if you want to read the XML without crying.
- BIMI (logo in the inbox) needs `p=quarantine`/`reject` and, for Gmail, a VMC certificate — nice-to-have, not a mission.

## 5. Warm-up (new domain baseline, from Resend)

Day 1 · 150 → Day 2 · 250 → Day 3 · 400 → Day 4 · 700 → Day 5 · 1,000 → Day 6 · 1,500 → Day 7 · 2,000, then roughly ×1.4 per day. Hourly caps kick in from day 4 (50/hr) rising to 150/hr by day 7. If bounces or complaints climb, hold volume flat and find the cause. Warm-up applies any time your pattern changes: new domain, new provider, big volume jump. Don't buy "warm-up network" engagement — Resend explicitly discourages it and Gmail is good at spotting it.

Practical: transactional mail warms itself (real users, real engagement). A newsletter launch to a 5,000-person list should be sent in tranches over a week, not in one go on day one.

## 6. Hygiene that keeps the two numbers low

- **Bounces (<4%)**: validate addresses at signup (a confirmation email is the real validation); honor the Suppression List (Resend auto-adds hard bounces and complaints); never remove a suppression just because someone asked nicely — verify first.
- **Complaints (<0.08%)**: make unsubscribing one click. For marketing, add `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (Broadcasts do this for you; for hand-rolled marketing sends you add them). Gmail and Yahoo require one-click unsubscribe for bulk senders and will punish you if the link doesn't work within 2 days.
- **Content**: a real plain-text part, a real name in `from` ("Acme Receipts <receipts@notifications.acme.com>"), a `reply-to` that a human reads, no URL shorteners, no image-only emails, consistent sending identity.
- **Frequency**: consistent beats bursty. A domain that sends 200/day every day is trusted more than one that sends 0 for a month and 6,000 on Tuesday.
- **Watch the dashboard**: Resend's Deliverability Insights and per-domain bounce/complaint rates. Check weekly; check daily during warm-up.

## 7. Secrets and safety

- API keys: server-only env vars, one key per environment, named by purpose, minimum permission (sending-only keys for the app; full-access only where you manage domains). Rotate on any suspected leak — Resend has a leaked-key procedure.
- Webhook secrets: `whsec_…`, per endpoint, verify every request against the raw body, dedupe on `svix-id`.
- Don't put secrets, tokens, or passwords in email bodies. Email is stored on Resend's side (for the retention window) and on every recipient's server forever.
- Don't put PII in `tags` (they show up in logs and webhooks).

## 8. Testing without hurting reputation

- `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` simulate outcomes without touching real mailboxes.
- Use the Send Test Emails feature and the webhook "Replay" button to exercise the send log.
- For inbound, mail your `<id>.resend.app` address from a personal account before wiring a custom MX.
- E2E: Resend documents a Playwright pattern (send → poll the Emails API → assert).

## 9. Region and data

Pick the sending region closest to recipients when creating the domain (it's fixed afterward). If you can't have message bodies stored on Resend at all, the docs describe the option to disable storage of sensitive content; understand what you lose (no dashboard preview, no replay).

## 10. Legal one-liners (not legal advice)

- CAN-SPAM (US): honest `from` and subject, physical mailing address in commercial email, working opt-out honored within 10 business days, no harvested addresses.
- GDPR/PECR (EU/UK): consent or legitimate interest documented; easy withdrawal; a lawful basis for transactional mail is generally the contract.
- CASL (Canada): express or implied consent rules are stricter; keep records.

If any of this applies to a real business decision, a lawyer beats a markdown file.
