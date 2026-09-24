---
description: Start or resume the Resend Ready — a 7-mission course that gets this app sending (and optionally receiving) email through Resend properly.
argument-hint: [mission number, or blank to resume]
---

Read `${CLAUDE_PLUGIN_ROOT}/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/references/resend-facts.md`.

Then run the doctor against the current project:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs --project .
```

Read `.resend-ready/progress.json`. If the user passed a mission number in `$ARGUMENTS`, open that mission; otherwise open the mission the doctor reports as current, from `${CLAUDE_PLUGIN_ROOT}/missions/`. Follow the mission file. Re-run the doctor after each mission and report the score delta, not the whole report.

Never print API keys or webhook secrets. Never edit config without showing the diff first. Never help route cold outreach through Resend.
