#!/usr/bin/env node
// make-button — puts a double-click "Check Email Readiness" button in the user's project,
// so they can re-run the resend doctor any time without Claude (no chat, no tokens).
//
//   node scripts/make-button.mjs --project .              # doctor only
//   node scripts/make-button.mjs --project . --live       # also asks Resend's API (read-only)
//   node scripts/make-button.mjs --project . --for mac    # required inside a sandbox such as Cowork
//
// Mac gets Check-Email-Readiness.command, Linux gets a .sh file, and Windows gets the one-line
// command to paste instead. A copy of the doctor goes in <project>/.check-again/ so the button
// keeps working after the Skilllet moves or updates. Both are added to .gitignore.
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRerunButton } from './lib/rerun-button.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const at = argv.indexOf('--project');
const project = at !== -1 && argv[at + 1] ? argv[at + 1] : '.';
const live = argv.includes('--live');
const f = argv.indexOf('--for');
const target = f !== -1 ? argv[f + 1] : undefined;

try {
  const r = makeRerunButton({
    title: 'Check Email Readiness',
    skill: 'resend-ready',
    skillName: 'Resend Ready',
    skillRoot: resolve(HERE, '..'),
    scriptRel: 'scripts/doctor.mjs',
    snapshot: ['scripts'],
    ...(target ? { target } : {}),
    args: ['--project', '{project}', ...(live ? ['--live'] : [])],
    project,
    explain: live
      ? 'Runs the resend doctor on this project (env, code, DNS, webhooks, inbound) and asks\nResend for your domain status, read-only. The API key is read from .env.local and never printed.\nThen it opens the report. The only thing it writes is its own report in .resend-ready/.'
      : 'Runs the resend doctor on this project (env, code, DNS, webhooks, inbound),\nprints your Email Readiness Score, then opens the report.\nThe only thing it writes is its own report in .resend-ready/.',
    openAfter: '.resend-ready/report.html',
    forbid: ['--reset', '--set', '--confirm', '--unconfirm', '--certificate'],
  });
  if (r.written) {
    console.log(`\nMade ${r.fileName} in your project folder${r.gitignored ? ' (and added it to .gitignore)' : ''}.`);
    console.log('Double-click it any time to re-check. It prints the score and opens the report.\n');
  } else {
    console.log(`\n${r.note}\n  ${r.oneLiner}\n`);
  }
} catch (e) {
  const hint = /sandbox/.test(e.message) ? 'Add --for mac (or --for windows / --for linux) for the computer the user will double-click on.\n' : '';
  console.error(`\n${e.message}\n${hint}`);
  process.exit(1);
}
