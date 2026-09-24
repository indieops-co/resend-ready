#!/usr/bin/env node
// resend doctor — zero-dependency readiness checks for Resend in a Next.js project.
// Usage:
//   node scripts/doctor.mjs [--project .] [--live] [--offline] [--json] [--no-report]
//                           [--set key=value ...] [--confirm id[:note]] [--unconfirm id]
//                           [--certificate] [--reset]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject } from './lib/fs.mjs';
import { VERIFIED, INFERRED, USER_CONFIRMED, USER_CONFIRMATION_REQUIRED, UNKNOWN, NA } from './lib/classify.mjs';
import { renderReport, renderCertificate } from './report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = '.resend-ready';

export const MISSIONS = [
  { id: 0, title: 'Orientation', required: ['config.complete'] },
  { id: 1, title: 'Diagnose', required: ['doctor.first_run'] },
  { id: 2, title: 'Pick Your Subdomains', required: ['dns.dkim', 'dns.spf', 'dns.return_path_mx', 'dns.dmarc', 'dns.dkim_single', 'dns.spf_single', 'domain.not_apex'] },
  { id: 3, title: 'Plumbing', required: ['sdk.installed', 'env.api_key_present', 'env.api_key_server_only', 'env.gitignored', 'env.no_committed_secrets', 'code.no_client_send', 'code.email_module', 'code.no_resend_dev_from', 'env.from_configured', 'code.reply_to', 'code.text_fallback', 'code.checks_error', 'supabase.smtp_configured', 'firebase.smtp_configured'] },
  { id: 4, title: 'Know What Happened', required: ['webhook.route_exists', 'webhook.verifies_signature', 'env.webhook_secret_present', 'store.events_table', 'admin.send_log'] },
  { id: 5, title: 'Two-Way Street', required: ['inbound.handler', 'inbound.fetches_content', 'dns.receiving_mx', 'store.inbound_table', 'admin.inbox', 'code.reply_threading'] },
  { id: 6, title: 'Keep Your Head on a Swivel', required: ['policy.acknowledged', 'hygiene.list_unsubscribe', 'hygiene.tracking_off_transactional', 'hygiene.warmup_plan'] },
  { id: 7, title: 'Final Inspection', required: ['human.inbox_landed', 'human.webhook_seen', 'human.inbound_roundtrip'] },
];

const CONFIG_KEYS = {
  authPlatform: v => (['supabase', 'firebase', 'none'].includes(v) ? v : null),
  receiving: v => v === 'true' ? true : v === 'false' ? false : null,
  purposes: v => v.split(',').map(s => s.trim()).filter(Boolean),
  sendingDomains: v => v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  transactionalDomain: v => v.trim().toLowerCase(),
  marketingDomain: v => v.trim().toLowerCase(),
  receivingDomain: v => v.trim().toLowerCase(),
  returnPathLabel: v => v.trim(),
  targetDailyVolume: v => Number(v) || null,
  existingDomain: v => v === 'true',
  productName: v => v.trim(),
};

function parseArgs(argv) {
  const a = { project: '.', set: [], confirm: [], unconfirm: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--project') a.project = argv[++i];
    else if (t === '--live') a.live = true;
    else if (t === '--offline') a.offline = true;
    else if (t === '--json') a.json = true;
    else if (t === '--no-report') a.noReport = true;
    else if (t === '--certificate') a.certificate = true;
    else if (t === '--reset') a.reset = true;
    else if (t === '--set') a.set.push(argv[++i]);
    else if (t === '--confirm') a.confirm.push(argv[++i]);
    else if (t === '--unconfirm') a.unconfirm.push(argv[++i]);
    else if (t === '-h' || t === '--help') a.help = true;
  }
  return a;
}

function loadProgress(root) {
  const p = join(root, STATE_DIR, 'progress.json');
  if (!existsSync(p)) return { version: 1, config: {}, confirmations: {}, runs: 0, firstRunAt: null, history: [] };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { version: 1, config: {}, confirmations: {}, runs: 0, firstRunAt: null, history: [] }; }
}

export async function runDoctor(opts) {
  const root = resolve(opts.project || '.');
  const progress = opts.reset ? { version: 1, config: {}, confirmations: {}, runs: 0, firstRunAt: null, history: [] } : loadProgress(root);

  for (const kv of opts.set || []) {
    const [k, ...rest] = kv.split('='); const v = rest.join('=');
    if (!CONFIG_KEYS[k]) { console.error(`Unknown config key: ${k}. Known: ${Object.keys(CONFIG_KEYS).join(', ')}`); continue; }
    const parsed = CONFIG_KEYS[k](v);
    if (parsed === null) { console.error(`Bad value for ${k}: ${v}`); continue; }
    progress.config[k] = parsed;
  }
  for (const c of opts.confirm || []) { const [id, ...n] = c.split(':'); progress.confirmations[id] = { at: new Date().toISOString(), note: n.join(':') || '' }; }
  for (const id of opts.unconfirm || []) delete progress.confirmations[id];

  const project = loadProject(root);
  const config = progress.config;
  const ctx = { project, config, liveMode: !!opts.live, offline: !!opts.offline };

  const order = ['sdk', 'env', 'code', 'dns', 'live', 'webhook', 'inbound', 'hygiene'];
  let checks = [];
  for (const name of order) {
    const mod = await import(`./checks/${name}.mjs`);
    try { checks.push(...await mod.run(ctx)); }
    catch (e) { checks.push({ id: `${name}.crashed`, mission: 1, title: `${name} checks crashed`, status: UNKNOWN, pass: null, detail: e.message, fix: '', weight: 0, evidence: [] }); }
  }

  // Synthetic checks
  const cfgComplete = !!config.authPlatform && typeof config.receiving === 'boolean' && Array.isArray(config.purposes) && (config.sendingDomains?.length || ctx.sendingDomains?.length);
  checks.unshift({ id: 'config.complete', mission: 0, title: 'Mission 0 config recorded', status: VERIFIED, pass: !!cfgComplete, weight: 1, evidence: [],
    detail: cfgComplete ? `authPlatform=${config.authPlatform}, receiving=${config.receiving}, purposes=${config.purposes.join('+')}, domains=${(config.sendingDomains || ctx.sendingDomains).join(', ')}` : 'Need authPlatform, receiving, purposes and at least one sending domain',
    fix: 'node scripts/doctor.mjs --set authPlatform=supabase --set receiving=true --set purposes=transactional,marketing --set sendingDomains=notifications.acme.com,updates.acme.com' });
  checks.splice(1, 0, { id: 'doctor.first_run', mission: 1, title: 'Doctor has run at least once', status: VERIFIED, pass: true, weight: 0, detail: `Run #${progress.runs + 1}`, fix: '', evidence: [] });

  // Apply confirmations, drop platform checks that don't apply
  const platform = config.authPlatform || ctx.detectedPlatform;
  checks = checks.filter(c => !(c.id === 'supabase.smtp_configured' && platform !== 'supabase') && !(c.id === 'firebase.smtp_configured' && platform !== 'firebase'));
  for (const c of checks) {
    if (progress.confirmations[c.id] && c.status !== NA) { c.status = USER_CONFIRMED; c.pass = true; c.confirmedAt = progress.confirmations[c.id].at; c.note = progress.confirmations[c.id].note; }
  }

  // Score
  const applicable = checks.filter(c => c.weight > 0 && c.status !== NA);
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  const got = applicable.reduce((s, c) => s + (c.pass ? c.weight : (c.status === INFERRED && c.pass === null ? c.weight * 0.5 : 0)), 0);
  const score = total ? Math.round((got / total) * 100) : 0;

  // Missions
  const byId = Object.fromEntries(checks.map(c => [c.id, c]));
  const missions = MISSIONS.map(m => {
    const present = m.required.filter(id => byId[id]);
    const na = present.length && present.every(id => byId[id].status === NA);
    const done = present.length > 0 && present.every(id => byId[id].status === NA || byId[id].pass === true);
    return { id: m.id, title: m.title, checks: present, status: na ? 'na' : (done ? 'done' : 'todo'), file: `missions/0${m.id}-${slug(m.title)}.md` };
  });
  const current = missions.find(m => m.status === 'todo');
  if (current) current.status = 'current';
  const complete = !current;

  progress.runs += 1;
  progress.firstRunAt = progress.firstRunAt || new Date().toISOString();
  progress.updatedAt = new Date().toISOString();
  progress.project = root;
  progress.score = score;
  progress.missions = missions;
  progress.checks = checks;
  progress.currentMission = current ? current.id : null;
  progress.complete = complete;
  progress.warmup = ctx.warmup || null;
  progress.sendingDomains = ctx.sendingDomains || [];
  progress.history = [...(progress.history || []).slice(-29), { at: progress.updatedAt, score }];
  if (complete && opts.certificate && !progress.certificate) progress.certificate = { issuedAt: new Date().toISOString(), product: config.productName || basenameOf(root) };

  mkdirSync(join(root, STATE_DIR), { recursive: true });
  writeFileSync(join(root, STATE_DIR, 'progress.json'), JSON.stringify(progress, null, 2));
  if (!opts.noReport) {
    writeFileSync(join(root, STATE_DIR, 'report.html'), renderReport(progress));
    if (progress.certificate) writeFileSync(join(root, STATE_DIR, 'certificate.html'), renderCertificate(progress));
  }
  return progress;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const basenameOf = p => p.split(/[\\/]/).filter(Boolean).pop();

function printSummary(pr) {
  const prev = pr.history.length > 1 ? pr.history[pr.history.length - 2].score : null;
  const delta = prev === null ? '' : ` (${prev} → ${pr.score})`;
  console.log(`\nEmail Readiness Score: ${pr.score}/100${delta}`);
  console.log(pr.missions.map(m => `${m.status === 'done' ? '✔' : m.status === 'current' ? '➤' : m.status === 'na' ? '–' : '·'} ${m.id} ${m.title}`).join('   '));
  const failing = pr.checks.filter(c => c.pass === false && c.status !== NA && c.weight > 0).sort((a, b) => b.weight - a.weight || a.mission - b.mission);
  if (failing.length) {
    console.log(`\nTop things to fix:`);
    for (const c of failing.slice(0, 6)) console.log(`  [${c.status}] ${c.id} — ${c.title}\n      ${c.detail}\n      fix: ${c.fix}`);
    if (failing.length > 6) console.log(`  …and ${failing.length - 6} more in the report.`);
  } else console.log('\nEverything applicable is green.');
  if (pr.certificate) console.log(`\n🎓 Certificate of Inbox Adulthood issued ${pr.certificate.issuedAt} → ${STATE_DIR}/certificate.html`);
  else if (pr.complete) console.log(`\nAll missions done. Run with --certificate for the (entirely unofficial) diploma.`);
  console.log(`\nReport: ${STATE_DIR}/report.html   State: ${STATE_DIR}/progress.json\n`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('doctor.mjs')) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n')); process.exit(0); }
  runDoctor(opts).then(pr => { if (opts.json) console.log(JSON.stringify(pr, null, 2)); else printSummary(pr); })
    .catch(e => { console.error('doctor failed:', e); process.exit(1); });
}
