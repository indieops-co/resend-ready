---
description: Run the resend doctor — Resend readiness checks (env, code, DNS, webhooks, inbound) with an Email Readiness Score and an HTML report. Add "live" to also query the Resend API read-only.
argument-hint: [live] [offline] [--set key=value] [--confirm id]
---

Run:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs --project . $ARGUMENTS
```

(If `$ARGUMENTS` contains the bare word `live`, pass `--live`; `offline` → `--offline`.)

Then summarize: the score (and delta from the previous run), the current mission, and the top three failing checks with their one-line fix. Mention `.resend-ready/report.html`. Stop there — do not start the course unless the user asks. If they want to fix things, point them at `/resend-ready`.
