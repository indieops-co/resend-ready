# Mission 7 — Final Inspection

**Why it matters:** the doctor can verify DNS, code, and (with `--live`) Resend's own view. It cannot open Gmail. A human has to read a real email in a real inbox, and see the round trip in the app.

**What the doctor checks:** three human confirmations — `human.inbox_landed`, `human.webhook_seen`, `human.inbound_roundtrip` (N/A when receiving is off).

## Do this

1. **Outbound, for real.** From production (or a preview deploy with production env vars), send a normal email — the welcome email, a receipt — to an address the user controls at a major provider (Gmail, Outlook, iCloud). Check the inbox, not just "did it arrive": it must not be in spam. Open the headers ("Show original" in Gmail): `dkim=pass`, `spf=pass`, `dmarc=pass`, and the `from` domain is the subdomain from Mission 2. Then `--confirm human.inbox_landed:"gmail, all pass"`.
2. **Webhook round trip.** Open the admin send log. The email from step 1 should show `sent` then `delivered` with its tag. If it's missing: is the webhook URL public, is the secret right (400s in Resend's webhook logs = signature), did the insert fail silently? Resend's webhook page has per-event delivery attempts and a Replay button. Then `--confirm human.webhook_seen`.
3. **Inbound round trip** (if receiving). From the same personal mailbox, reply to the email from step 1 — or mail the receiving address directly. It should appear in the admin inbox with body text. Reply from the admin. Back in the personal mailbox, the reply should land *in the same thread*. If it started a new thread, `In-Reply-To` isn't set or `message_id` wasn't stored. Then `--confirm human.inbound_roundtrip`.
4. **Run the doctor one last time** with `--certificate`. Celebrate exactly once. The certificate (`.resend-ready/certificate.html`) is a joke reward with confetti and no legal standing whatsoever; the report is the real artifact.

## After graduation

- `resend doctor` is now a pre-launch habit: run it before every release that touches email, and after any DNS change.
- The session-start hook (plugin install) nudges when progress exists but isn't complete; it goes quiet once it is.
- Things the course didn't cover and might matter later: BIMI (logo in inbox; needs DMARC quarantine/reject), dedicated IPs (only at real volume), Topics for granular marketing preferences, Automations for onboarding sequences, multi-tenant sending domains.

## Done when

All three confirmations recorded; doctor reports "All missions done"; certificate issued.
