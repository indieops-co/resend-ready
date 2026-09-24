import { check, human, na, VERIFIED, INFERRED } from '../lib/classify.mjs';
import { grep } from '../lib/fs.mjs';

export function warmupSchedule(target = 2000, existing = false) {
  const base = existing ? [1000,2500,5000,5000,7500,7500,10000] : [150,250,400,700,1000,1500,2000];
  const hourly = existing ? [100,300,600,800,1000,1500,2000] : [null,null,null,50,75,100,150];
  const rows = base.map((daily, i) => ({ day: i + 1, daily: Math.min(daily, target), hourly: hourly[i] }));
  let cur = base[6], day = 8;
  while (cur < target && day <= 42) {
    cur = Math.min(Math.ceil(cur * (existing ? 1.5 : 1.4) / 100) * 100, target);
    rows.push({ day, daily: cur, hourly: Math.ceil(cur / 10 / 50) * 50 });
    day++;
  }
  return rows;
}

export async function run(ctx) {
  const { project: p, config } = ctx;
  const M = 6;
  const out = [];
  const purposes = config.purposes || ['transactional'];

  out.push(human('policy.acknowledged', M, 'Acceptable Use Policy read and acknowledged',
    'Complaints < 0.08%, bounces < 4%, no unsolicited bulk/cold email through Resend. Accounts get closed for this.',
    'Read references/deliverability-playbook.md §2–3, then: node scripts/doctor.mjs --confirm policy.acknowledged', 2));

  if (purposes.includes('marketing')) {
    const lu = grep(p.source, /List-Unsubscribe/);
    const bc = grep(p.source, /\.broadcasts\.(create|send)\s*\(/);
    out.push(check({ id: 'hygiene.list_unsubscribe', mission: M, title: 'Marketing sends carry List-Unsubscribe headers (or use Broadcasts)',
      status: (lu.length || bc.length) ? INFERRED : VERIFIED, pass: lu.length > 0 || bc.length > 0,
      detail: lu.length ? `Headers set in ${lu.map(f => f.rel).join(', ')}` : (bc.length ? `Using Broadcasts (${bc.map(f => f.rel).join(', ')})` : 'No List-Unsubscribe header and no Broadcasts usage found'),
      fix: 'Use Broadcasts for newsletters, or add List-Unsubscribe + List-Unsubscribe-Post headers (snippets/marketing-send.ts). Gmail/Yahoo require one-click unsubscribe for bulk senders.', weight: 2 }));
  } else {
    out.push(na('hygiene.list_unsubscribe', M, 'List-Unsubscribe headers', 'No marketing purpose declared in Mission 0'));
  }

  const trans = config.transactionalDomain || (ctx.sendingDomains || [])[0];
  const live = ctx.live?.domains?.find(d => d.name === trans);
  if (live && (live.open_tracking !== undefined || live.click_tracking !== undefined)) {
    const off = !live.open_tracking && !live.click_tracking;
    out.push(check({ id: 'hygiene.tracking_off_transactional', mission: M, title: `Open/click tracking OFF on ${trans}`, status: VERIFIED, pass: off,
      detail: off ? 'Both off (from Resend API)' : `open_tracking=${live.open_tracking}, click_tracking=${live.click_tracking}`,
      fix: 'Domain → settings in Resend: disable tracking on transactional/auth domains (link rewriting breaks single-use links).', weight: 2 }));
  } else {
    out.push(human('hygiene.tracking_off_transactional', M, `Open/click tracking OFF on the transactional domain${trans ? ` (${trans})` : ''}`,
      'Tracking pixels and rewritten links hurt transactional deliverability and can break magic links.',
      'Disable both in the domain settings at resend.com/domains, then --confirm hygiene.tracking_off_transactional (or run with --live to verify).', 2));
  }

  const target = Number(config.targetDailyVolume || 0);
  const rows = target ? warmupSchedule(target, config.existingDomain === true) : null;
  ctx.warmup = rows;
  out.push(human('hygiene.warmup_plan', M, 'Warm-up plan for the first weeks',
    target ? `Target ${target}/day → ${rows.length}-day ramp (day 1: ${rows[0].daily}, day 7: ${rows[6].daily}). Full table in the report.` : 'No target volume set. --set targetDailyVolume=2000 to generate a schedule.',
    'Review the schedule, agree to send below the daily caps, then --confirm hygiene.warmup_plan', 1));

  const platform = config.authPlatform || ctx.detectedPlatform;
  if (platform === 'supabase') out.push(human('supabase.smtp_configured', 3, 'Supabase Auth sends through Resend (Custom SMTP or integration)', 'Auth emails leave from Supabase, not your code — configure SMTP so they use your subdomain.', 'references/supabase.md, then --confirm supabase.smtp_configured', 2));
  else if (platform === 'firebase') out.push(human('firebase.smtp_configured', 3, 'Firebase Auth templates send via Resend SMTP', 'Verification/reset emails leave from Firebase — set the custom SMTP server.', 'references/firebase.md, then --confirm firebase.smtp_configured', 2));

  // Mission 7 — human only
  out.push(human('human.inbox_landed', 7, 'A real email from the app landed in a real inbox (not spam)', 'Send yourself something from production; check Gmail/Outlook/iCloud, look at the headers for DKIM=pass, SPF=pass, DMARC=pass.', '--confirm human.inbox_landed', 3));
  out.push(human('human.webhook_seen', 7, 'That send showed up in the admin send log as delivered', 'Proves the webhook round trip.', '--confirm human.webhook_seen', 2));
  if (config.receiving !== false) out.push(human('human.inbound_roundtrip', 7, 'You emailed the app, saw it in the inbox page, replied, and the reply threaded in your mail client', 'Proves receiving, storage, UI, and threading.', '--confirm human.inbound_roundtrip', 2));
  else out.push(na('human.inbound_roundtrip', 7, 'Inbound round trip', 'Receiving is off'));
  return out;
}
