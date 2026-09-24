# Mission 2 — Pick Your Subdomains

**Why it matters:** inbox providers judge the *sending domain's* reputation. A subdomain per purpose isolates reputation (a bad newsletter can't take down password resets) and signals intent (`notifications.` says "account mail", `updates.` says "marketing"). Resend strongly recommends this and it is the single highest-leverage decision in the whole course. Apex sending is the mistake you can't cheaply undo.

**What the doctor checks:** `domain.not_apex` (from `from:` literals, env-var fallbacks and config), then real DNS lookups: `dns.dkim` (`resend._domainkey.<domain>` TXT with `p=`), `dns.spf` (`send.<domain>` TXT `v=spf1 include:amazonses.com`), `dns.return_path_mx` (`send.<domain>` MX → `feedback-smtp.<region>.amazonses.com`), `dns.dmarc` (`_dmarc.<root>` TXT `v=DMARC1`), plus `dns.dkim_single`, `dns.spf_single` and `dns.return_path_clean` (below). With `--live`, also `live.domain.<name>` = Resend's own "verified" status.

## Do this

1. **Add each subdomain in Resend** (Domains → Add Domain). Enter the full subdomain (`notifications.acme.com`), pick the region closest to most recipients (it can't be changed later), leave return-path at `send` unless they have a reason.
2. **Copy the records exactly** from the domain's Records tab into DNS. Three records per domain: DKIM TXT, SPF TXT on `send.<domain>`, MX on `send.<domain>`. If the DNS host is Cloudflare, proxying must be **off** for these. Resend has per-registrar guides (Cloudflare, Namecheap, GoDaddy, Vercel, Route 53, Porkbun…) — name the right one.
3. **Add DMARC on the root** (one record covers all subdomains): `_dmarc.acme.com` TXT `v=DMARC1; p=none; rua=mailto:dmarc@acme.com`. Start at `p=none`; tighten later. If the root already has DMARC, leave it alone and note the policy.
4. **Wait, then re-run the doctor.** Usually minutes; occasionally hours. `dns.email` (Resend's checker) shows what the public sees. If a record is present but the doctor says missing, check for a trailing dot, a proxied CNAME, or the record placed on the apex instead of the subdomain.
5. **Turn tracking off on the transactional/auth domain** now while you're in its settings (Mission 6 checks it; do it here to save a trip).

## Three ways this quietly breaks later

- **Your DNS host re-writes the records.** Managed hosts (SiteGround, cPanel-style panels, some registrars' "add a subdomain" buttons) treat `send.<domain>` as a *website* subdomain: they stamp an `A` record on it and replace Resend's SPF with their own `include:`. Mail then fails SPF while everything still *looks* configured. `dns.return_path_clean` flags the A record as the early warning. **Re-run the doctor after any change at your registrar** — not just after the ones you think touched email.
- **Two records where there should be one.** Moving a domain to a different Resend account or team issues a **new** DKIM key on the same `resend` selector. Replace the TXT value; never add a second record next to it, or verification depends on which one a resolver happens to return (`dns.dkim_single`). Two `v=spf1` records on one name is worse — RFC 7208 calls it a PermError and receivers fail the whole check (`dns.spf_single`).
- **"Fixing" the apex SPF.** Once you notice the apex has your host's SPF and no `amazonses`, it is tempting to add the include there. **Don't.** Resend's envelope sender is `send.<domain>`, so the apex SPF is never consulted for it — the two paths are independent, and broadening the apex only widens who can send as you.

## One account, many domains

Resend's advice to use a sending subdomain protects your root domain's reputation. That protection comes from the **subdomain**, not from a second Resend account. A second account splits your dashboards, logs and API keys, and sets up the failure where a key from account A cannot send from a domain verified in account B — a 403 on every email, for a reason nothing in your code can explain. Keep one account and add domains to it.

## Branches

- **Supabase / Firebase auth mail**: either send auth from the transactional subdomain or from a dedicated `auth.<root>`; if dedicated, add it as a fourth domain and include it in `sendingDomains`.
- **Receiving planned**: the `inbox.<root>` MX record is Mission 5's job — don't add an MX to a sending subdomain by mistake.
- **Multiple products on one root**: one set of subdomains per product (`notifications.acme.com`, `notifications.otherproduct.com`) — never share a subdomain across products.

## Done when

`domain.not_apex`, `dns.dkim`, `dns.spf`, `dns.return_path_mx`, `dns.dmarc`, `dns.dkim_single` and `dns.spf_single` are all `VERIFIED` and passing (`dns.return_path_clean` is advisory — explain it rather than blocking on it). Show the score delta.
