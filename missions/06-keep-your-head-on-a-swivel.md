# Mission 6 — Keep Your Head on a Swivel

**Why it matters:** the plumbing is done; this is the part that keeps the account open and the mail in the inbox. Everything here is either an inbox-provider rule (Gmail/Yahoo bulk-sender requirements) or a Resend policy with real consequences. Source material: `references/deliverability-playbook.md` — read it before running this mission, then teach it in your own words, not by pasting.

**What the doctor checks:** `policy.acknowledged` (human), `hygiene.list_unsubscribe` (only if `marketing` is a purpose; VERIFIED via `List-Unsubscribe` headers or Broadcasts usage), `hygiene.tracking_off_transactional` (human, or VERIFIED with `--live`), `hygiene.warmup_plan` (human; the doctor generates the table from `targetDailyVolume`).

## Do this — the five conversations

1. **The rules, plainly.** Complaint rate under 0.08%, bounce rate under 4%, or the account can be closed without warning and without refund. Cold, unsolicited, non-personalized bulk email is prohibited on Resend. A subdomain protects the root domain's reputation; it does **not** protect the Resend account. If cold outreach is part of the business, it lives in a dedicated cold tool on a dedicated *domain*, far from the account that sends customers' receipts. Do not help route cold email through Resend, however it's framed. Then `--confirm policy.acknowledged`.
2. **Consent.** Account mail: implied by signup. Product updates: existing relationship + unsubscribe. Newsletters: opted in. Bought/scraped lists: never. Keep the consent record in their own DB.
3. **Unsubscribe (marketing only).** Use Broadcasts (unsubscribe page and headers handled) or, for hand-rolled digests, `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers with a link that works within seconds (`snippets/marketing-send.ts`). A physical address in commercial mail (CAN-SPAM).
4. **Tracking off on transactional/auth domains.** Rewritten links corrupt single-use magic links; pixels look like marketing. `--confirm hygiene.tracking_off_transactional` (or verify with `--live`).
5. **Warm-up.** Show the generated table (`.resend-ready/report.html` → Warm-up schedule). New domain baseline: 150 → 250 → 400 → 700 → 1,000 → 1,500 → 2,000 over the first week, then ~1.4× a day; hourly caps from day 4. Transactional mail warms itself; a newsletter launch is sent in tranches. No third-party warm-up networks. `--confirm hygiene.warmup_plan`.

Also worth two sentences each: honor the Suppression List (don't "helpfully" remove hard bounces), send consistently rather than in spikes, real name in `from`, human-read `reply-to`, no secrets or PII in bodies or tags, one API key per environment with least privilege, check Deliverability Insights weekly (daily during warm-up).

## Branches

- **Marketing not in purposes** → `hygiene.list_unsubscribe` is N/A; still mention that the day they add a newsletter, it comes back.
- **Existing domain moving to Resend** (`existingDomain=true`) → warm-up table uses the higher "existing domain" baseline.
- **Multi-tenant SaaS** (customers send from *their* domains): Resend documents a per-tenant domain setup; each tenant's reputation is theirs — point them at that guide and note the doctor only checks the platform's own domains.

## Done when

`policy.acknowledged`, `hygiene.tracking_off_transactional`, `hygiene.warmup_plan` confirmed; `hygiene.list_unsubscribe` passing or N/A.
