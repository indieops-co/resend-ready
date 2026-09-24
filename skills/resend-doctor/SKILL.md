---
name: resend-doctor
description: Resend email readiness for Next.js apps — run the resend doctor or the Resend Ready course whenever the user mentions Resend, transactional or marketing email, emails going to spam, DKIM/SPF/DMARC, sending subdomains, email webhooks, a send log or email admin dashboard, inbound/receiving email, replying to customers from the app, Supabase/Firebase auth emails, or warm-up. Triggers on "resend doctor", "email school", "is my email set up right".
---

This skill is the plugin entry point. The full instructions live one level up: read `${CLAUDE_PLUGIN_ROOT}/SKILL.md` (or `../../SKILL.md` relative to this file) and follow it. Everything — missions, checks, snippets, references — is in that folder.

Quick start: `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs --project .` then read `.resend-ready/progress.json`.
