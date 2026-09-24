import { check, VERIFIED, INFERRED, UNKNOWN, na } from '../lib/classify.mjs';
import { grep } from '../lib/fs.mjs';
import { mx } from '../lib/dns.mjs';

export async function run(ctx) {
  const { project: p, config } = ctx;
  const M = 5;
  if (config.receiving === false) {
    return ['inbound.handler','inbound.fetches_content','store.inbound_table','admin.inbox','code.reply_threading','dns.receiving_mx']
      .map(id => na(id, M, id, 'Receiving is off in Mission 0 config (set receiving=true to enable)'));
  }
  const out = [];
  const handler = grep(p.source, /email\.received/);
  out.push(check({ id: 'inbound.handler', mission: M, title: 'Webhook handles email.received', status: VERIFIED, pass: handler.length > 0,
    detail: handler.length ? handler.map(f => f.rel).join(', ') : 'No handler for email.received', fix: "if (event.type === 'email.received') { … } in the webhook route; enable the event at resend.com/webhooks.", weight: 3 }));

  const fetches = grep(p.source, /receiving\.get\s*\(/);
  out.push(check({ id: 'inbound.fetches_content', mission: M, title: 'Handler fetches the body via the Receiving API', status: VERIFIED, pass: fetches.length > 0,
    detail: fetches.length ? fetches.map(f => f.rel).join(', ') : 'The email.received payload is metadata only; nothing calls resend.emails.receiving.get()',
    fix: 'const { data } = await resend.emails.receiving.get(event.data.email_id) → data.html / data.text / data.headers', weight: 3 }));

  const table = grep(p.source, /inbound_emails|inboundEmails|InboundEmail\b/);
  out.push(check({ id: 'store.inbound_table', mission: M, title: 'Inbound emails are stored', status: table.length ? INFERRED : VERIFIED, pass: table.length > 0,
    detail: table.length ? `Referenced in ${table.slice(0, 5).map(f => f.rel).join(', ')}` : 'No inbound_emails / inboundEmails table or collection referenced',
    fix: 'schema-supabase.sql (inbound_emails) or inboundEmails/{emailId} docs; store message_id — you need it to reply.', weight: 2 }));

  const inbox = p.source.filter(f => /\.(tsx|jsx)$/.test(f.rel) && /admin|inbox/i.test(f.rel) && /inbound_emails|inboundEmails|listInbound|InboundEmail/.test(f.text));
  out.push(check({ id: 'admin.inbox', mission: M, title: 'Admin inbox page lists received mail', status: INFERRED, pass: inbox.length > 0,
    detail: inbox.length ? inbox.map(f => f.rel).join(', ') : 'No admin page renders inbound_emails', fix: 'snippets/admin-inbox.tsx behind your admin guard.', weight: 2 }));

  const reply = grep(p.source, /['"]In-Reply-To['"]/);
  out.push(check({ id: 'code.reply_threading', mission: M, title: 'Replies thread correctly (In-Reply-To / References)', status: VERIFIED, pass: reply.length > 0,
    detail: reply.length ? reply.map(f => f.rel).join(', ') : "No send sets an In-Reply-To header", fix: "headers: { 'In-Reply-To': message_id, References: message_id }, subject 'Re: …' (snippets/reply-action.ts)", weight: 2 }));

  const rd = config.receivingDomain;
  if (!rd) {
    out.push(check({ id: 'dns.receiving_mx', mission: M, title: 'Receiving MX record on the inbox domain', status: UNKNOWN, pass: false,
      detail: 'No receiving domain configured. Using a *.resend.app address? Confirm with --confirm dns.receiving_mx. Custom domain? --set receivingDomain=inbox.yourdomain.com',
      fix: 'Either is fine to start; a custom subdomain looks better on replies.', weight: 1 }));
  } else if (ctx.offline) {
    out.push(check({ id: 'dns.receiving_mx', mission: M, title: `Receiving MX on ${rd}`, status: UNKNOWN, pass: false, detail: 'Offline run (--offline)', weight: 1 }));
  } else {
    const rec = await mx(rd);
    const hasResend = rec && rec.length && /resend|amazonaws|amazonses/i.test(rec[0].exchange);
    out.push(check({ id: 'dns.receiving_mx', mission: M, title: `Receiving MX on ${rd}`, status: rec === null ? UNKNOWN : (hasResend ? INFERRED : VERIFIED), pass: !!hasResend,
      detail: rec === null ? 'DNS lookup failed' : (rec.length ? `Lowest-priority MX: ${rec[0].exchange} (${rec[0].priority})${hasResend ? '' : ' — not Resend; mail will go there instead'}` : 'No MX record'),
      fix: `Enable Receiving on ${rd} in the Resend dashboard and add the MX it shows. It must be the lowest priority value on that name — so use a subdomain, not the domain your company inbox uses.`,
      weight: 2, evidence: rec || [] }));
  }
  return out;
}
