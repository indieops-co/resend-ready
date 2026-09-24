import { check, VERIFIED, UNKNOWN, na } from '../lib/classify.mjs';
import { txt, mx, web, rootDomain } from '../lib/dns.mjs';
import { grep } from '../lib/fs.mjs';

const IDS = ['dns.dkim', 'dns.spf', 'dns.return_path_mx', 'dns.dmarc', 'dns.dkim_single', 'dns.spf_single', 'dns.return_path_clean', 'code.reply_to'];
const missionFor = id => (id === 'code.reply_to' ? 3 : 2);

export async function run(ctx) {
  const { config } = ctx;
  const M = 2;
  const domains = [...new Set([...(config.sendingDomains || []), ...(ctx.inferredSendingDomains || [])])];
  ctx.sendingDomains = domains;
  if (!domains.length) {
    return IDS.map(id => check({ id, mission: missionFor(id), title: id, status: UNKNOWN, pass: false,
      detail: 'No sending domain known. Run with --set sendingDomains=notifications.yourdomain.com (comma-separate several) or add a from: literal in code.', fix: 'Mission 2 starts with choosing the subdomain.', weight: 2 }));
  }
  if (ctx.offline) {
    return IDS.map(id => check({ id, mission: missionFor(id), title: `${id} (${domains.join(', ')})`, status: UNKNOWN, pass: false, detail: 'Offline run (--offline)', weight: 2 }));
  }
  const out = [];
  const rp = config.returnPathLabel || 'send';
  const agg = { dkim: [], spf: [], rpmx: [], dmarc: [], dkimDup: [], spfDup: [], rpWeb: [], noMx: [] };
  const roots = new Set();
  for (const d of domains) {
    const dkim = await txt(`resend._domainkey.${d}`);
    agg.dkim.push({ d, ok: dkim && dkim.some(v => /p=/.test(v)), null: dkim === null, v: dkim });
    const spf = await txt(`${rp}.${d}`);
    agg.spf.push({ d, ok: spf && spf.some(v => /v=spf1/i.test(v) && /amazonses\.com/i.test(v)), null: spf === null, v: spf });
    const rpmx = await mx(`${rp}.${d}`);
    agg.rpmx.push({ d, ok: rpmx && rpmx.some(r => /amazonses\.com/i.test(r.exchange)), null: rpmx === null, v: rpmx });

    // Duplicates. A second DKIM TXT on the same selector is what you get by ADDING
    // the record when moving a domain between Resend accounts instead of REPLACING
    // it, and verification then depends on which one a resolver hands back. Two
    // SPF records on one name is worse: RFC 7208 makes it a PermError, so the
    // check does not fail-soft, it fails.
    const dkimRecs = (dkim || []).filter(v => /p=/.test(v));
    agg.dkimDup.push({ d, ok: dkimRecs.length <= 1, null: dkim === null, n: dkimRecs.length, v: dkimRecs });
    const spfRecs = (spf || []).filter(v => /^\s*v=spf1/i.test(v));
    agg.spfDup.push({ d: `${rp}.${d}`, ok: spfRecs.length <= 1, null: spf === null, n: spfRecs.length, v: spfRecs });

    // Web records on the return-path name. It exists only to receive bounces, so
    // an A/AAAA/CNAME there means the DNS host is treating it as a website
    // subdomain — the same automation that silently overwrites Resend's SPF/MX.
    const rpw = await web(`${rp}.${d}`);
    agg.rpWeb.push({ d: `${rp}.${d}`, ok: rpw !== null && rpw.length === 0, null: rpw === null, v: rpw });

    // Can a human reply to mail from this domain?
    const dmx = await mx(d);
    agg.noMx.push({ d, receives: dmx === null ? null : dmx.length > 0 });
    roots.add(rootDomain(d));
  }
  for (const r of roots) {
    const rootSpf = await txt(r);
    const rootSpfRecs = (rootSpf || []).filter(v => /^\s*v=spf1/i.test(v));
    agg.spfDup.push({ d: r, ok: rootSpfRecs.length <= 1, null: rootSpf === null, n: rootSpfRecs.length, v: rootSpfRecs });
    const dm = await txt(`_dmarc.${r}`);
    const rec = dm && dm.find(v => /v=DMARC1/i.test(v));
    agg.dmarc.push({ d: r, ok: !!rec, null: dm === null, v: rec, policy: rec ? (rec.match(/\bp=(\w+)/i) || [])[1] : null });
  }
  const summarize = (arr, what) => arr.map(x => `${x.d}: ${x.null ? 'lookup failed' : (x.ok ? 'ok' : `missing ${what}`)}`).join('; ');
  const st = arr => arr.some(x => x.null) ? UNKNOWN : VERIFIED;
  out.push(check({ id: 'dns.dkim', mission: M, title: 'DKIM record published (resend._domainkey)', status: st(agg.dkim), pass: agg.dkim.every(x => x.ok),
    detail: summarize(agg.dkim, 'TXT with p='), fix: 'Copy the DKIM TXT from the domain\'s Records tab in Resend into your DNS (no proxying).', weight: 3, evidence: agg.dkim.map(x => x.v) }));
  out.push(check({ id: 'dns.spf', mission: M, title: `SPF on the return-path subdomain (${rp}.<domain>)`, status: st(agg.spf), pass: agg.spf.every(x => x.ok),
    detail: summarize(agg.spf, 'v=spf1 include:amazonses.com'), fix: `Add the TXT record for ${rp}.<domain> exactly as Resend shows it.`, weight: 3, evidence: agg.spf.map(x => x.v) }));
  out.push(check({ id: 'dns.return_path_mx', mission: M, title: `Return-path MX (${rp}.<domain> → feedback-smtp)`, status: st(agg.rpmx), pass: agg.rpmx.every(x => x.ok),
    detail: summarize(agg.rpmx, 'MX to amazonses.com'), fix: `Add the MX record for ${rp}.<domain> (priority 10) from the Records tab.`, weight: 2, evidence: agg.rpmx.map(x => x.v) }));
  out.push(check({ id: 'dns.dmarc', mission: M, title: 'DMARC on the root domain', status: st(agg.dmarc), pass: agg.dmarc.every(x => x.ok),
    detail: agg.dmarc.map(x => `${x.d}: ${x.null ? 'lookup failed' : (x.ok ? `p=${x.policy || '?'}` : 'no v=DMARC1 record')}`).join('; '),
    fix: 'Add TXT _dmarc.<root> = "v=DMARC1; p=none; rua=mailto:dmarc@<root>" now; tighten to quarantine/reject once reports look clean.', weight: 2, evidence: agg.dmarc.map(x => x.v) }));

  const dupDkim = agg.dkimDup.filter(x => !x.ok && !x.null);
  out.push(check({ id: 'dns.dkim_single', mission: M, title: 'Exactly one DKIM record on the selector', status: st(agg.dkimDup), pass: agg.dkimDup.every(x => x.ok),
    detail: dupDkim.length ? dupDkim.map(x => `resend._domainkey.${x.d}: ${x.n} records`).join('; ') : 'One DKIM record per selector (or none — see dns.dkim)',
    fix: 'Delete the stale one. Moving a domain to another Resend account or team issues a NEW key on the same `resend` selector: REPLACE the TXT value, never add a second record beside it.',
    weight: 2, evidence: dupDkim.map(x => x.v) }));

  const dupSpf = agg.spfDup.filter(x => !x.ok && !x.null);
  out.push(check({ id: 'dns.spf_single', mission: M, title: 'No name carries two SPF records', status: st(agg.spfDup), pass: agg.spfDup.every(x => x.ok),
    detail: dupSpf.length ? dupSpf.map(x => `${x.d}: ${x.n} v=spf1 records`).join('; ') : 'At most one v=spf1 record per name',
    fix: 'RFC 7208: two SPF records on one name is a PermError and receivers treat the whole check as failed — merge them into a single record with both includes.',
    weight: 3, evidence: dupSpf.map(x => x.v) }));

  const polluted = agg.rpWeb.filter(x => !x.ok && !x.null);
  out.push(check({ id: 'dns.return_path_clean', mission: M, title: 'Return-path subdomain has no web records', status: st(agg.rpWeb), pass: agg.rpWeb.every(x => x.ok),
    detail: polluted.length ? polluted.map(x => `${x.d}: ${x.v.join(', ')}`).join('; ') : 'Return-path names carry only the SPF TXT and the bounce MX',
    fix: 'Harmless in itself, but it means your DNS host is managing this name as a website subdomain — the automation that adds an A record is usually the same one that overwrites Resend SPF/MX with its own. Remove the A/CNAME in the DNS editor (never by deleting the subdomain, which takes the MX with it), and re-run the doctor after ANY change at your registrar.',
    weight: 1, evidence: polluted.map(x => x.v) }));

  // Reply-ability. Computed here rather than in code.mjs because it needs the MX
  // answer: a from-address on a domain that cannot receive turns every human
  // reply into a bounce, and transactional mail gets replied to constantly.
  const sendSites = grep(ctx.project.source, /\.emails\.send\s*\(|\.batch\.send\s*\(/);
  const withReply = sendSites.filter(f => /\breply[_]?[Tt]o\s*:/.test(f.text));
  const deadEnds = agg.noMx.filter(x => x.receives === false).map(x => x.d);
  if (!sendSites.length) {
    out.push(na('code.reply_to', 3, 'Replies reach a human', 'No emails.send( call sites yet.'));
  } else {
    out.push(check({ id: 'code.reply_to', mission: 3, title: 'Replies reach a human', status: VERIFIED,
      pass: deadEnds.length === 0 || withReply.length === sendSites.length,
      detail: deadEnds.length === 0
        ? `Sending domains accept mail (${agg.noMx.filter(x => x.receives).map(x => x.d).join(', ') || 'none checked'}) — a reply lands in a real inbox`
        : `${deadEnds.join(', ')} has no MX, and ${sendSites.length - withReply.length}/${sendSites.length} send site(s) pass no replyTo`,
      fix: "Pass replyTo: with an address a person reads. A sending subdomain has no inbox by design, so without it every reply bounces — and people DO reply to transactional mail, especially anything that sounds like bad news.",
      weight: 2, evidence: [deadEnds] }));
  }
  return out;
}
