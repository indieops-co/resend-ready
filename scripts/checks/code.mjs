import { check, VERIFIED, INFERRED, UNKNOWN, na } from '../lib/classify.mjs';
import { grep } from '../lib/fs.mjs';
import { isApex } from '../lib/dns.mjs';

const FROM_RE = /\bfrom\s*:\s*(['"`])([^'"`]+)\1/g;
const EMAIL_IN = s => { const m = s.match(/<([^>]+)>/); return (m ? m[1] : s).trim(); };

// An env var read with a hard-coded fallback that looks like an email address:
//   process.env.RESEND_FROM ?? 'Ellee <onboarding@resend.dev>'
//   Deno.env.get('RESEND_FROM') ?? 'Ellee <onboarding@resend.dev>'
// This is where the dangerous from-address actually lives in most codebases —
// not in a `from:` literal. The fallback ships, and it fires the moment the
// variable is missing in whichever environment is doing the sending.
const ENV_FALLBACK_RE =
  /(?:process\.env\.([A-Z0-9_]+)|(?:Deno\.env\.get|env\.get|getEnv)\(\s*['"]([A-Z0-9_]+)['"]\s*\))\s*(?:\?\?|\|\|)\s*(['"`])([^'"`]*@[^'"`]*)\3/g;

// Legitimate: Resend's simulator addresses. They exercise delivered/bounced/
// complained events without touching real reputation, so they are not a finding.
const TEST_RECIPIENTS = new Set(['delivered@resend.dev', 'bounced@resend.dev', 'complained@resend.dev']);

const lineAt = (text, index) => {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim();
};

export async function run(ctx) {
  const { project: p, config } = ctx;
  const out = [];
  const M = 3;

  const instantiators = grep(p.source, /new\s+Resend\s*\(/);
  const senders = grep(p.source, /\.emails\.send\s*\(|\.batch\.send\s*\(/);
  out.push(check({
    id: 'code.email_module', mission: M, title: 'One email module (single Resend instance)',
    status: instantiators.length ? (instantiators.length <= 2 ? VERIFIED : INFERRED) : VERIFIED,
    pass: instantiators.length >= 1 && instantiators.length <= 2,
    detail: instantiators.length === 0 ? 'No `new Resend(` found in source'
      : `Resend instantiated in ${instantiators.length} file(s): ${instantiators.map(f => f.rel).join(', ')}${instantiators.length > 2 ? ' — consolidate so there is one place to change from-addresses, tags and error handling' : ''}`,
    fix: 'Create lib/email.ts (see references/snippets/email.ts) and route every send through sendEmail().',
    weight: 2,
  }));

  // from-addresses → domains. Two sources: `from:` literals, and env vars read
  // with an email-shaped fallback (the pattern a literal-only scan walks past).
  const froms = [];
  for (const f of p.source) for (const m of f.text.matchAll(FROM_RE)) froms.push({ file: f.rel, from: m[2], email: EMAIL_IN(m[2]) });

  const envFroms = [];
  for (const f of p.source) for (const m of f.text.matchAll(ENV_FALLBACK_RE)) {
    envFroms.push({ file: f.rel, varName: m[1] || m[2], fallback: m[4], email: EMAIL_IN(m[4]) });
  }

  const domains = [...new Set([...froms, ...envFroms].map(x => x.email.split('@')[1]).filter(Boolean).map(d => d.toLowerCase()))];
  ctx.inferredSendingDomains = domains.filter(d => !d.endsWith('resend.dev') && !d.includes('example.com') && !d.includes('acme.com'));

  // Where each inferred domain came from. Inference walks the whole tree, so a
  // vendored reference app, an archived project or a docs example can donate a
  // domain this project never sends from — and the user should be able to see
  // that at a glance instead of wondering why the doctor is checking DNS for it.
  ctx.domainSources = {};
  for (const x of [...froms, ...envFroms]) {
    const d = (x.email.split('@')[1] || '').toLowerCase();
    if (!d) continue;
    (ctx.domainSources[d] ||= new Set()).add(x.file);
  }
  const provenance = ds => [...new Set(ds.map(d => `${d} (${[...(ctx.domainSources[d] || [])].slice(0, 2).join(', ') || 'config'})`))].join('; ');

  // Every @resend.dev address in source except the simulator recipients. A hit
  // inside a `??`/`||` default is the severe one: it is invisible until the env
  // var goes missing, and then it silently limits delivery to the account owner.
  const devHits = [];
  for (const f of p.source) for (const m of f.text.matchAll(/[A-Za-z0-9._%+-]+@resend\.dev/g)) {
    if (TEST_RECIPIENTS.has(m[0].toLowerCase())) continue;
    const line = lineAt(f.text, m.index);
    devHits.push({ file: f.rel, addr: m[0], isFallback: /\?\?|\|\|/.test(line), line: line.slice(0, 140) });
  }
  const fallbackHits = devHits.filter(h => h.isFallback);
  out.push(check({
    id: 'code.no_resend_dev_from', mission: M, title: 'No @resend.dev sender anywhere in source',
    status: VERIFIED, pass: devHits.length === 0,
    detail: devHits.length
      ? (fallbackHits.length
          ? `Fallback default — ships and fires whenever ${[...new Set(fallbackHits.map(h => h.file))].join(', ')} runs without its from-address env var set: ${fallbackHits[0].line}`
          : `@resend.dev sender in ${[...new Set(devHits.map(h => h.file))].join(', ')}`)
      : (domains.length ? `from-addresses use: ${domains.join(', ')}` : 'No from address found in source (literal or env fallback)'),
    fix: 'Delete the fallback rather than improving it — failing loudly beats sending from an address that only reaches you. onboarding@resend.dev delivers ONLY to the Resend account owner, so everything to real users is silently rejected. (delivered@/bounced@/complained@resend.dev as recipients are fine.)',
    weight: 3,
  }));

  // The variable behind the from address must actually exist. A fallback is only
  // ever reached when its variable is missing, so this is the check that decides
  // whether the fallback above is theoretical or live.
  const fromVars = [...new Set(envFroms.map(x => x.varName))];
  if (!fromVars.length) {
    out.push(na('env.from_configured', M, 'From-address env var is set', 'No env-var-driven from address in source — the from: literals are the sender.'));
  } else {
    const missing = fromVars.filter(v => !p.envValue(v));
    out.push(check({
      id: 'env.from_configured', mission: M, title: `From-address env var is set (${fromVars.join(', ')})`,
      status: VERIFIED, pass: missing.length === 0,
      detail: missing.length
        ? `${missing.join(', ')} not found in this project's env — the hard-coded fallback is what actually sends here`
        : `${fromVars.join(', ')} present`,
      fix: 'Set it — and set it everywhere the code RUNS, not just in .env.local. Production reads from the deployment store (Vercel env, Supabase Edge Function secrets, Fly secrets…), and a variable missing there activates the fallback with nothing in the logs to say so.',
      weight: 3,
    }));
  }

  const apex = ctx.inferredSendingDomains.filter(isApex);
  const configured = (config.sendingDomains || []).filter(isApex);
  const apexAll = [...new Set([...apex, ...configured])];
  out.push(check({
    id: 'domain.not_apex', mission: 2, title: 'Sending from a subdomain, not the apex',
    status: (ctx.inferredSendingDomains.length || config.sendingDomains?.length) ? VERIFIED : UNKNOWN,
    pass: (ctx.inferredSendingDomains.length || config.sendingDomains?.length) ? apexAll.length === 0 : false,
    detail: apexAll.length ? `Apex domain used for sending: ${provenance(apexAll)}` : ((ctx.inferredSendingDomains.length || config.sendingDomains?.length) ? `All sending domains are subdomains: ${provenance(ctx.inferredSendingDomains)}` : 'No sending domain known yet — set one with --set sendingDomains=notifications.yourdomain.com'),
    fix: 'Add notifications.<domain> (transactional) and updates.<domain> (marketing) in Resend, and use those in from:. If a domain above came from a vendored/reference/archived folder rather than your app, pin the real list with --set sendingDomains=… so DNS is not checked for someone else\'s domain.',
    weight: 3,
  }));

  const sendersNoText = senders.filter(f => !/\btext\s*:/.test(f.text) && !/\breact\s*:/.test(f.text) && !/htmlToText|toPlainText/.test(f.text));
  out.push(check({
    id: 'code.text_fallback', mission: M, title: 'Sends include a plain-text part (or React Email renders one)',
    status: senders.length ? INFERRED : UNKNOWN, pass: senders.length ? sendersNoText.length === 0 : false,
    detail: senders.length ? (sendersNoText.length ? `No text: in ${sendersNoText.map(f => f.rel).join(', ')}` : 'Every send site has text:, react:, or a converter') : 'No emails.send( found yet',
    fix: 'Pass text: alongside html: (derive it if you must). Spam filters and screen readers both want it.',
    weight: 1,
  }));

  const ignoreErr = senders.filter(f => !/\berror\b/.test(f.text));
  out.push(check({
    id: 'code.checks_error', mission: M, title: 'Send results check `error` (the promise does not reject)',
    status: senders.length ? INFERRED : UNKNOWN, pass: senders.length ? ignoreErr.length === 0 : false,
    detail: senders.length ? (ignoreErr.length ? `No error handling near send in ${ignoreErr.map(f => f.rel).join(', ')}` : 'Send sites reference error') : 'No emails.send( found yet',
    fix: 'const { data, error } = await resend.emails.send(...); if (error) { log + surface it }.',
    weight: 1,
  }));

  const tagged = senders.filter(f => /\btags\s*:/.test(f.text));
  out.push(check({
    id: 'code.tags', mission: 4, title: 'Sends are tagged (tags come back in webhooks)',
    status: senders.length ? INFERRED : UNKNOWN, pass: senders.length ? tagged.length === senders.length : null,
    detail: senders.length ? `${tagged.length}/${senders.length} send sites use tags:` : 'No emails.send( found yet',
    fix: "tags: [{ name: 'category', value: 'welcome' }] — then the send log can group by purpose.",
    weight: 1,
  }));

  const idem = grep(p.source, /idempotencyKey/);
  out.push(check({
    id: 'code.idempotency', mission: 3, title: 'Idempotency keys on retry-prone sends (optional)',
    status: INFERRED, pass: idem.length ? true : null,
    detail: idem.length ? `Used in ${idem.map(f => f.rel).join(', ')}` : 'Not used — fine for one-off sends; add for anything a job runner might retry',
    fix: "resend.emails.send(params, { idempotencyKey: `welcome/${userId}` })", weight: 0,
  }));

  return out;
}
