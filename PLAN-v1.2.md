# resend-ready v1.2 — plan for a fresh thread

**Context for whoever picks this up.** v1.1 shipped six changes (see `CHANGELOG.md`).
Every one came from running the doctor against a real project — a senior-care app on
Supabase Edge Functions + a Vercel Next.js portal — whose email had been silently
broken in production for weeks. The v1.1 changes are the ones that fit inside
existing check families. What is left needs new structure, and item 1 needs a new
mission.

**Read first:** `SKILL.md` (principles — especially #2 "check, don't ask", #3 the
status vocabulary, and #5 never print secrets), then `references/resend-facts.md`.

---

## 1. `deploy.*` — audit the deployment, not just the repo  ⭐ the big one

**The bug that motivated it.** A wrong Resend API key sat in Supabase Edge Function
secrets and in Vercel env vars. The *right* key was in `.env.local` the whole time.
The doctor reads `.env*` and `process.env` ([`scripts/checks/env.mjs`](scripts/checks/env.mjs)),
so it found the good key, marked everything VERIFIED, and would have declared the
project healthy while production was rejecting every email.

**The general truth:** in any deployed SaaS the repo's env file is the *least*
authoritative copy. Three stores drifting is the normal condition.

### How to check it without ever touching a secret

Compare **names and digests**, never values. Proven in the incident:

```bash
# Supabase returns a SHA-256 of each secret's value — never the value.
npx supabase secrets list --project-ref <ref>
#   → [{ "name": "RESEND_API_KEY", "value": "<sha256>", "updated_at": ... }]

printf '%s' "$LOCAL_KEY" | shasum -a 256      # compare locally
```

**Establish the algorithm with a control before trusting a mismatch.** Hash a
variable whose value you *do* have in both places (`GEMINI_API_KEY` served this
role); if the control matches, a mismatch elsewhere is real. If the control does
not match, the platform salts or truncates and the comparison proves nothing — say
UNKNOWN, do not guess. This is exactly principle #3.

Vercel exposes `vercel env pull` for non-sensitive vars; sensitive ones come back
as `[SENSITIVE]`, so drift there is **UNKNOWN, not FAIL**. `vercel env ls` gives
names + environments + age, which is enough for presence and for spotting a var
that exists in Production but not Preview.

### Proposed checks

| ID | What it does |
|---|---|
| `deploy.platform_detected` | Finds `.vercel/`, `supabase/config.toml`, `fly.toml`, `netlify.toml`, `wrangler.toml`. Informational. |
| `deploy.cli_available` | Is the CLI installed *and authenticated*? Everything below is UNKNOWN without it — never FAIL. |
| `deploy.env_present` | `RESEND_API_KEY` / the from-address var exist in each detected store, per environment. |
| `deploy.env_drift` | Same-named var differs between repo and store, or between Production and Preview. Digest-based; UNKNOWN when the platform will not expose enough to tell. |
| `deploy.build_time_vars` | `NEXT_PUBLIC_*` are inlined at build — changing one without a redeploy does nothing. Flags a var edited more recently than the last deploy. |

### Cautions

- **Read-only, always.** The doctor must never write a secret to a deploy target.
  Principle #6 ("never modify config silently") applies with extra force here.
- **Shelling out to CLIs is new for this codebase** — the doctor is currently
  zero-dependency and pure Node. Keep that: use `child_process` with a short
  timeout, treat any non-zero exit as UNKNOWN, and never let a missing CLI fail a
  check.
- This deserves its own mission (a new Mission 3.5, or fold into Mission 3 as a
  second half). Mission numbering is baked into `MISSIONS` in
  [`scripts/doctor.mjs`](scripts/doctor.mjs) and into filenames, so decide before
  building.

---

## 2. `--live` on by default when a key exists

**Why.** The account-mismatch class of bug is invisible without asking Resend
`/domains`. It is read-only and never prints the key, yet it is opt-in — so the
one check that catches "your key belongs to a different account than your verified
domain" is the one most people never run.

**Change.** Default on when `RESEND_API_KEY` resolves; `--offline` (already exists)
and a new `--no-live` opt out. Fail soft: a network error is UNKNOWN, never FAIL.
Add one line to the summary so the user knows a network call happened.

---

## 3. Resend accounts, not just domains

**The bug.** Two Resend accounts — one holding `ellee.app` + `hello.ellee.app`,
another holding `post.ellee.app`. A single `RESEND_API_KEY` can only send from
domains verified in **its own** account. Set the from-address to a domain the key's
account does not hold and every email 403s.

The user had created the second account for a defensible reason: Resend recommends
a sending subdomain to protect the root's reputation. **That protection comes from
the subdomain, not from a second account.** This misreading will be common; Mission
2 now says so in prose (v1.1), and the tooling should back it.

**Proposed:**

- `live.key_owns_all_domains` — one `/domains` call; assert every sending domain is
  present *and* `verified` in that key's account.
- Distinguish the failure modes in the message. Today `live.domain.<d>` collapses
  "not in this account" and "in this account but `not_started`" into one line. They
  need different fixes. Resend statuses seen in the wild: `not_started`, `pending`,
  `verified`, `failure`, `temporary_failure`.
- When a domain is absent, say the likely cause out loud: *"verified in a different
  Resend account?"* — that sentence would have saved an hour.

---

## 4. `domain.not_apex` is a tradeoff, not a defect

**Today:** hard FAIL, weight 3.

**The counter-case, from the incident.** A low-volume transactional app sending from
`help@ellee.app` — a real, monitored, replyable mailbox on the apex. Alignment is
fine (DKIM `d=ellee.app`, SPF on `send.ellee.app`, both pass under `aspf=r`). For a
non-technical recipient scanning an inbox for an alert about a family member,
recognisability beat reputation isolation, and replies reaching a human beat a
no-reply subdomain. Resend's advice is aimed at bulk.

**Proposed:** condition it on Mission 0. `purposes` includes `marketing`, or
`targetDailyVolume` above a threshold → keep the hard fail. Purely transactional and
low volume → `INFERRED` warning that states the tradeoff both ways: the apex ties
your app's sending reputation to the domain your humans email from; the upside is
recognisability and working replies.

Both config keys already exist in `CONFIG_KEYS`. This is a scoring change, not new
plumbing — but it touches the check most likely to be quoted at users, so word it
carefully.

---

## 5. Mission 7: test to an address you do not own

**Why.** `human.inbox_landed` currently says "a real inbox". But
`onboarding@resend.dev` **delivers to the account owner** — so the developer's own
address is exactly the one that keeps working while every customer is being
rejected. That is precisely how the incident hid for weeks: "email is working" was
true and useless.

Mission 3's send step was fixed in v1.1. Mission 7 needs the same sentence, plus a
prompt to check the received headers for `dkim=pass` and `spf=pass`.

One line of prose. Do it first — it is the cheapest item on this page.

---

## 6. Projects that call the REST API instead of the SDK

**Found while testing.** The incident's Supabase Edge Functions call
`fetch('https://api.resend.com/emails', …)` directly — Deno, no npm SDK. Every
check keyed on `.emails.send(` or `new Resend(` therefore reported "not found":
`code.email_module`, `code.text_fallback`, `code.checks_error`, `code.tags`,
`code.reply_to`. Silence, not failure — which reads as "nothing to fix here."

This is a whole population: Deno, Cloudflare Workers, Go/Python/Rust backends, and
anyone avoiding a dependency.

**Proposed:** teach the code checks a second shape — `fetch` to
`api.resend.com/emails` with a JSON body — and check the same properties against the
payload keys (`text`, `reply_to`, `tags`, and whether the response's `ok`/status is
inspected). Where a project uses neither shape, say so explicitly rather than
implying health: *"no Resend send sites found — the doctor cannot see how you send."*

---

## 7. Domain inference picks up vendored code

**Found while testing.** The doctor inferred `mypaige.app` as a sending domain from
`ref/myPaige copy/` — an archived reference app vendored inside the repo — and then
went and checked DNS for it.

v1.1 mitigates this by reporting **provenance** (which file each inferred domain came
from), so the user can see the cause. The fix is not complete:

- Consider skipping obvious vendor/archive directories, but resist a naive blocklist
  — `examples/` and `ref/` are real source in plenty of projects. A directory
  containing its own `package.json` is tempting as a signal and **wrong**: that is
  every monorepo package.
- Better shape: when inferred domains span more than one root domain, treat the list
  as INFERRED and ask the user to pin `--set sendingDomains=…` rather than silently
  checking DNS for a stranger's domain.

---

## Suggested order

1. **#5** — one line of prose, highest value per character.
2. **#2** — small, and it switches on an existing check that catches a whole bug class.
3. **#3** — builds on #2, one API call.
4. **#4** — scoring and wording only.
5. **#6** — self-contained, doubles the addressable projects.
6. **#7** — finish what v1.1 started.
7. **#1** — last, largest, needs a mission-structure decision first.

## Testing

`fixtures/sample-app` (deliberately half-finished) and `fixtures/finished-app` are
the regression suite:

```bash
node scripts/doctor.mjs --project fixtures/sample-app  --offline --no-report
node scripts/doctor.mjs --project fixtures/finished-app --offline --no-report
rm -rf fixtures/*/.resend-ready
```

Scores at the end of v1.1: **20** and **58** offline. A change that moves those
without an intended reason is a regression. `--offline` keeps the suite hermetic;
run once without it before shipping, to exercise the DNS paths.

For #1 and #6 there is no fixture yet. Build one: a project with a Deno-style
`fetch` send, a `??` fallback from-address, and a `.vercel/` directory.
