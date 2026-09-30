---
name: resend-ready
description: Resend Ready — a 7-mission micro-course plus a permanent `resend doctor` diagnostic for wiring Resend (resend.com) into a Next.js SaaS app as a sender and, optionally, a receiver of email. Use this whenever the user mentions Resend, transactional email, "emails going to spam", DKIM/SPF/DMARC, sending subdomains, email webhooks, an admin email dashboard or send log, inbound/receiving email, replying to customer emails from inside the app, Supabase Auth or Firebase Auth emails, warm-up, or an "email readiness" check — even if they don't say the word "course". Also trigger for "resend doctor", "email school", or "am I ready to send email from my app".
---

# Resend Ready

**What this is:** a tiny, state-aware course (seven missions, each with programmatic checks) that takes a Next.js app from "we installed the Resend SDK" to "we send from a warmed subdomain, log every delivery event, receive and reply to inbound mail from our own admin page, and we know the rules well enough not to get our account shut down."

**What it also is:** a permanent tool. `resend doctor` runs the same checks any time, long after the course is done, and never forgets what state the project is in.

Two things to keep separate in your head:

| The course (`/resend-ready`) | The tool (`resend doctor`) |
|---|---|
| Walks a person through missions, one at a time | Runs every check, prints a score, writes a report |
| Finishes; hands out a joke certificate | Never finishes; you run it before every launch |
| Lives in `missions/` | Lives in `scripts/` |

## Invocation

Skilllet style (drop the folder into a project):

> "Use ./resend-ready to get my app sending email properly."
> "Use ./resend-ready — run the resend doctor."

Plugin style (installed as a Claude Code plugin): `/resend-ready` and `/resend-doctor`. Same files, same behavior.

## Principles you must protect

1. **Course and tool stay separate.** Missions read from the doctor's output; they never duplicate checks in prose.
2. **Check, don't ask.** Anything that can be verified programmatically (DNS, env, code, package.json) is verified. "I did this" checkboxes are reserved for things only a human can confirm (an email landed in a real inbox).
3. **Every check is classified** as one of `VERIFIED`, `INFERRED`, `USER CONFIRMATION REQUIRED`, or `UNKNOWN`. Never present an inference as a fact.
4. **"Email Readiness Score" is a readiness score.** Never call it a deliverability guarantee, a compliance score, or a security score. Inbox providers make the final call; the score measures whether the project has done its homework.
5. **Never print, log, store, or echo secrets.** API keys and webhook signing secrets are checked for *presence and shape only* (`re_…`, `whsec_…`). If the user pastes one into chat, tell them to rotate it.
6. **Never modify config silently.** Every file edit is proposed, shown, and confirmed. DNS is never touched (you can't anyway; the user does that at their registrar).
7. **Official docs outrank community sources.** `references/resend-facts.md` is the distilled official surface; when it conflicts with a blog post, the docs win. When the docs conflict with the fact sheet, the docs win and you note the fact sheet needs updating.
8. **Resend's Acceptable Use Policy is not optional.** Cold, unsolicited, bulk outreach is prohibited on Resend and gets accounts terminated. Mission 6 teaches this plainly. Never help the user route cold email through Resend, and never soften that guidance because "it's just a few."
9. **Progress persists in-project** at `.resend-ready/progress.json`. Reminders are local (session-start hook) by default. Do not wire external notifications unless the project already has them.

## Tone

An experienced developer helping another developer avoid an embarrassing (or account-ending) launch mistake. Clear, slightly funny, never condescending. No "Don't worry!", no "Great question!", no exclamation-point cheerleading. Say what's wrong, say why it matters, say what to do.

## How to run the course

1. **Read `references/resend-facts.md` once** at the start of a session. It is short and it is the source of truth for API shapes and DNS record names used in every mission.
2. **Run the doctor first, always:** `node <path-to-this-folder>/scripts/doctor.mjs --project .` (add `--live` to also ask the Resend API for domain status; requires `RESEND_API_KEY` in the environment — it is never printed). This creates or updates `.resend-ready/progress.json` and `.resend-ready/report.html`.
3. **Read `.resend-ready/progress.json`.** It tells you which mission is current, what's already `VERIFIED`, and what the user configured in Mission 0 (auth platform, sending purposes, receiving on/off, domains).
4. **Open the current mission file** from `missions/` and follow it. Each mission has: *Why it matters*, *What the doctor checks*, *Do this* (concrete steps), *Branches* (Supabase / Firebase where they differ), and *Done when* (the exact check IDs that must flip to `VERIFIED` or `USER CONFIRMED`).
5. **Re-run the doctor after each mission.** Show the delta ("Score 41 → 68, three checks flipped"). Don't re-narrate the whole report.
6. **Snippets** live in `references/snippets/`. They are deliberately small: they show *where Resend touches the page*, not entire pages. When you paste one into the user's project, adapt names and paths to what already exists — never overwrite a file wholesale.
7. **On completion** (all missions done, all required checks green, Mission 7 human-confirmed), run `node scripts/doctor.mjs --certificate` and celebrate exactly once.

## Mission map

| # | Mission | Done when (check IDs) |
|---|---|---|
| 0 | Orientation — declare what you're building | `config.complete` |
| 1 | Diagnose — first doctor run, baseline score | `doctor.first_run` |
| 2 | Pick Your Subdomains — DNS that inbox providers trust | `dns.dkim`, `dns.spf`, `dns.return_path_mx`, `dns.dmarc`, `dns.dkim_single`, `dns.spf_single`, `domain.not_apex` (advisory: `dns.return_path_clean`) |
| 3 | Plumbing — one email module, sane defaults | `sdk.installed`, `env.api_key_present`, `env.api_key_server_only`, `env.gitignored`, `code.email_module`, `code.no_resend_dev_from`, `env.from_configured`, `code.reply_to`, `code.text_fallback` |
| 4 | Know What Happened — signed webhooks + send log | `webhook.route_exists`, `webhook.verifies_signature`, `env.webhook_secret_present`, `store.events_table`, `admin.send_log` |
| 5 | Two-Way Street — inbound inbox + threaded replies | `inbound.handler`, `inbound.fetches_content`, `dns.receiving_mx`, `store.inbound_table`, `admin.inbox`, `code.reply_threading` |
| 6 | Keep Your Head on a Swivel — rules, warm-up, hygiene | `policy.acknowledged`, `hygiene.list_unsubscribe` (marketing only), `hygiene.tracking_off_transactional`, `hygiene.warmup_plan` |
| 7 | Final Inspection — a human reads a real email | `human.inbox_landed`, `human.webhook_seen`, `human.inbound_roundtrip` (if receiving) |

Mission 5 is skipped (marked `N/A`, not failed) when Mission 0 sets `receiving: false`.

## When the user only wants the tool

"Run the resend doctor" → run `scripts/doctor.mjs`, summarize the top three failing checks with the one-line fix for each, mention the report path, stop. Do not start the course unless asked.

## The Check Again button

After the **first** doctor run (Mission 1, or the first time someone asks for the doctor on its own), offer this once, in one line: *"Want a Check Again button? Double-click it in your project folder any time to re-run this without me, so no chat and no tokens."*

If they say yes, run `node <path-to-this-folder>/scripts/make-button.mjs --project .`. Add `--live` only if they already use `--live`.

Inside a sandbox such as Cowork, the script can't tell which computer the button is for and will ask. Add `--for mac` or `--for windows` to match the computer they'll double-click on. If you don't know, ask them.

- On a Mac this writes `Check-Email-Readiness.command` into the project. It also saves a copy of the doctor in `.check-again/`, so the button keeps working after an update or a move. Both go into `.gitignore`.
- On Linux it writes a `.sh` file instead.
- On Windows no file is made; the script prints the one-line command to show them.

Tell them where the button is and that it opens the report when it finishes.

**The repeat rule:** if they said no, don't nag. But if they later ask for the doctor again in the same project, offer it once more in one line, because a repeat request is exactly the signal the button exists for. After a second no, never again. If a button already exists, just remind them it's there. If the button ever says it can't find the Skilllet (after a move or reinstall), just make a new one.

The button runs the same read-only doctor you do. Never add `--set`, `--confirm`, `--reset` or `--certificate` to it (the script refuses anyway), and never put a key in it: the doctor reads `.env.local` itself.

## Files

- `missions/00-orientation.md` … `missions/07-final-inspection.md` — the course
- `scripts/doctor.mjs` — the tool (zero dependencies, Node 18+)
- `scripts/checks/*.mjs` — one file per check family
- `scripts/report.mjs` — single-file HTML report with Light | Dark | Auto toggle
- `scripts/make-button.mjs` — writes the Check Again button (uses `scripts/lib/rerun-button.mjs`, the IndieOps standard)
- `references/resend-facts.md` — distilled official API/DNS facts (read first)
- `references/deliverability-playbook.md` — the "beyond plumbing" material Mission 6 draws from
- `references/supabase.md`, `references/firebase.md` — platform branches
- `references/snippets/` — the small code examples
- `fixtures/sample-app/` — a deliberately half-finished Next.js project for testing the doctor
