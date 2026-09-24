# Mission 1 — Diagnose

**Why it matters:** a baseline. Every later mission reports its delta against this number, which is more motivating than a wall of red.

**What the doctor checks:** everything. `doctor.first_run` flips the moment it finishes.

## Do this

1. Run `node <skill>/scripts/doctor.mjs --project .` (add `--live` if `RESEND_API_KEY` is in the environment — it makes read-only calls to list domains and webhooks and never prints the key).
2. Read `.resend-ready/progress.json`. Report to the user:
   - the **Email Readiness Score** and what it is (homework done, not a deliverability guarantee),
   - which mission is current,
   - the top three failing checks *in plain language* — what's wrong and why anyone should care. Not the whole list; the report has that.
3. Point them at `.resend-ready/report.html` (open it in a browser; it has the full checklist and a Light | Dark | Auto toggle).
4. Do not fix anything yet. Diagnosis first, then the mission that owns the fix.

## Interpreting statuses

- `VERIFIED` failing → a real gap, fix in its mission.
- `INFERRED` failing → the scan didn't find the pattern; confirm with the user whether it's really missing or just named differently. If it exists under another name, tell them the check will stay INFERRED-fail and to `--confirm` it once verified by eye.
- `UNKNOWN` → usually DNS with no domain configured, or an `--offline` run.
- `USER CONFIRMATION REQUIRED` → leave for the mission that owns it.

## Done when

`doctor.first_run` is `VERIFIED` (always true after one run). Move to the current mission the doctor reports.
