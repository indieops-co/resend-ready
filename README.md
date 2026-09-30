# Resend Ready

A Skilllet for getting a Next.js SaaS app sending — and optionally receiving — email through [Resend](https://resend.com) the way you'd want a senior engineer to have done it: from a subdomain you own, signed, logged, answerable from your own admin, and inside the rules that keep the account open.

Seven missions, each with programmatic checks, a persistent progress file, an HTML report with a Light | Dark | Auto toggle, and a permanent `resend doctor` you'll keep running long after the course is done.

## Install (pick one)

**As a Skilllet** — copy the folder into your project and say:

> Use ./resend-ready to get my app sending email properly.

**As a Claude Code plugin** — the folder is also a plugin (`.claude-plugin/plugin.json`). Install it with `/plugin` from a marketplace that lists it, or add it locally; then use `/resend-ready` and `/resend-doctor`. A session-start hook nudges you while the course is unfinished and goes quiet afterwards.

Either way the same files run. Node 18+ required; no npm dependencies.

## What you get

| Mission | Outcome |
|---|---|
| 0 Orientation | Auth platform, receiving on/off, purposes, subdomain plan recorded |
| 1 Diagnose | Baseline Email Readiness Score |
| 2 Pick Your Subdomains | DKIM, SPF, return-path MX, DMARC verified by real DNS lookups |
| 3 Plumbing | One email module, server-only key, text fallback, error handling, auth SMTP |
| 4 Know What Happened | Signed webhook → stored events → admin send log + test-send form |
| 5 Two-Way Street | Inbound mail → stored → admin inbox → threaded replies |
| 6 Keep Your Head on a Swivel | AUP, consent, unsubscribe, tracking, warm-up schedule |
| 7 Final Inspection | A human reads a real email; certificate (unofficial, confetti included) |

## The doctor

```
node resend-ready/scripts/doctor.mjs --project .          # scan + DNS
node resend-ready/scripts/doctor.mjs --project . --live   # + read-only Resend API (needs RESEND_API_KEY in env; never printed)
node resend-ready/scripts/doctor.mjs --set receiving=true --set sendingDomains=notifications.acme.com
node resend-ready/scripts/doctor.mjs --confirm human.inbox_landed:"gmail, all pass"
node resend-ready/scripts/doctor.mjs --json               # machine-readable
```

Outputs `.resend-ready/progress.json` and `report.html`. Every check is classified `VERIFIED`, `INFERRED`, `USER CONFIRMATION REQUIRED`, `USER CONFIRMED`, `UNKNOWN`, or `N/A`. The score is a readiness score — homework done — never a deliverability guarantee.

## Folder

- `SKILL.md` — instructions for the AI running the course
- `missions/` — the seven missions (plus orientation)
- `scripts/` — `doctor.mjs`, `checks/`, `report.mjs`, session hook
- `references/` — distilled Resend facts, deliverability playbook, Supabase/Firebase branches, `snippets/`
- `fixtures/` — `sample-app` (half-finished, for testing failures) and `finished-app` (snippets assembled, for the happy path)

## Testing

```
node scripts/doctor.mjs --project fixtures/sample-app --offline     # expect a low score and a long fix list
node scripts/doctor.mjs --project fixtures/finished-app --offline   # expect 100 once confirmations are recorded (see fixture README)
```

## Honesty notes

- Resend's Acceptable Use Policy prohibits unsolicited bulk/cold email. The course says so plainly and won't help route cold outreach through Resend.
- DNS checks look at public DNS; `--live` asks Resend what it thinks. Both can lag right after a change.
- Code checks are heuristics (`INFERRED`). They find the common patterns; an unusual layout may need a `--confirm`.

Built by IndieLifeLabs. Sibling of OAuth Finishing School.

## License

Copyright © 2026 Dave Biggs. All rights reserved.  
Licensed under the [IndieOps Free License v1.0](LICENSE). Free to use, even commercially; don't redistribute it.
