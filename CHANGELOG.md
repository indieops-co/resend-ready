# Changelog

## 1.1.0 — 2026-09-05

Six changes, every one of them a bug found by running the doctor against a real
project whose email was silently broken in production.

### Fixed — a false green on the most common shape of the worst bug
- `code.no_resend_dev_from` only ever matched `from:` followed by a quoted
  literal, so it **passed** on `process.env.RESEND_FROM ?? 'Acme <onboarding@resend.dev>'`
  — reporting "no from: literals found" while every customer email was being
  rejected. It now scans all source for `@resend.dev`, excludes the three
  simulator recipients (`delivered@`/`bounced@`/`complained@`), and calls out a
  `??`/`||` fallback as the severe case. Weight raised 2 → 3.

### Added
- `env.from_configured` — the env var behind the from address must exist. A
  fallback only fires when its variable is missing, so this is the check that
  says whether the one above is theoretical or live. Fix text points at the
  deployment stores, not `.env.local`.
- `dns.dkim_single` — exactly one DKIM record on the `resend` selector. Moving a
  domain between Resend accounts issues a new key on the same selector; adding
  rather than replacing left two, and the old check's `.some()` passed on it.
- `dns.spf_single` — no name carries two `v=spf1` records (RFC 7208 PermError),
  checked on both the return-path subdomain and the root.
- `dns.return_path_clean` — advisory. An A/AAAA/CNAME on `send.<domain>` means
  the DNS host is managing it as a website subdomain, which is how managed hosts
  come to overwrite Resend's SPF with their own. The early warning for a break
  that otherwise appears out of nowhere after an unrelated registrar change.
- `code.reply_to` — warns when the sending domain has no MX and sends pass no
  `replyTo`, i.e. when every human reply bounces.
- Inferred sending domains now report **where they came from**. Domain inference
  walks the whole tree, so a vendored reference app or archived project can
  donate a domain the project never sends from.

### Docs
- Mission 2 gains "Three ways this quietly breaks later" (host re-writes records;
  duplicate DKIM/SPF; don't add `amazonses` to the apex SPF) and "One account,
  many domains" — the subdomain protects the root, a second account does not.
- Mission 3 shows the fallback line explicitly, says to delete rather than
  improve it, and says to set the variable in every deployment store.
- Mission 3's real-email step now insists on **an address you do not own**. Your
  own address is the one that keeps working while everything is broken.
- `resend-facts.md` "Things people get wrong" grows from 10 to 16.

## 1.0.0 — 2026-09-04
- Initial release: 7 missions + orientation, zero-dependency doctor (env/sdk/code/DNS/webhook/inbound/hygiene/live checks), HTML report with Light|Dark|Auto, certificate, Supabase and Firebase branches, 10 snippets, two fixtures, plugin manifest + commands + session-start hook.
