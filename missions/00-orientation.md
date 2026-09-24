# Mission 0 — Orientation

**Why it matters:** the rest of the course branches on four answers. Get them recorded once and every later check knows what "done" means for *this* app.

**What the doctor checks:** `config.complete` — it wants `authPlatform`, `receiving`, `purposes`, and at least one sending domain. It will also try to infer sending domains from `from:` literals in code, but declare them explicitly; inference is a fallback.

## Do this

Ask the user these four questions, in this order, and record the answers with `--set`:

1. **Auth platform** — Supabase, Firebase, or neither? (Auth emails are sent by the platform, not your code, and need their own SMTP wiring in Mission 3.)
2. **Will the app receive email too?** — support@ replies inside the admin, forwarded attachments, "reply to this email" flows → `receiving=true`. Sending-only → `receiving=false` (Mission 5 becomes N/A, not failed).
3. **What kinds of email?** — `transactional` (receipts, invites, alerts, auth) and/or `marketing` (newsletters, digests, product updates). Marketing unlocks unsubscribe checks in Mission 6.
4. **Subdomain plan** — propose it, don't ask them to invent it: `notifications.<root>` for transactional, `updates.<root>` if marketing, `inbox.<root>` if receiving. Confirm the root domain they own.

Optional but useful now: `targetDailyVolume` (what a normal day looks like at launch — drives the warm-up table), `existingDomain=true` if the *root* already sends real mail elsewhere, `productName` for the certificate.

```
node <skill>/scripts/doctor.mjs --project . \
  --set authPlatform=supabase --set receiving=true --set purposes=transactional,marketing \
  --set sendingDomains=notifications.acme.com,updates.acme.com --set transactionalDomain=notifications.acme.com \
  --set receivingDomain=inbox.acme.com --set targetDailyVolume=2000 --set productName="Acme"
```

If they'll use a Resend-managed `<id>.resend.app` address for receiving instead of a custom domain, leave `receivingDomain` unset and later `--confirm dns.receiving_mx:"using resend.app address"`.

## Branches

None yet — this is where they're chosen.

## Done when

`config.complete` is `VERIFIED`. Mission 1 starts immediately (it's just running the doctor).
