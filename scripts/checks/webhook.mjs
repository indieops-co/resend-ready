import { check, VERIFIED, INFERRED, UNKNOWN } from '../lib/classify.mjs';
import { grep } from '../lib/fs.mjs';

export async function run(ctx) {
  const { project: p, config } = ctx;
  const out = [];
  const M = 4;

  const routes = p.source.filter(f => /svix-id|webhooks\.verify\s*\(|new\s+Webhook\s*\(|email\.(delivered|bounced|received|sent|complained)/.test(f.text) && /export\s+(async\s+)?function\s+POST|export\s+const\s+POST|\.post\s*\(/.test(f.text));
  ctx.webhookRoutes = routes;
  out.push(check({
    id: 'webhook.route_exists', mission: M, title: 'A POST route handles Resend webhook events',
    status: VERIFIED, pass: routes.length > 0,
    detail: routes.length ? routes.map(f => f.rel).join(', ') : 'No route handler referencing svix headers or email.* events',
    fix: 'Create app/api/resend/webhook/route.ts (see references/snippets/webhook-route.ts) and register its public URL at resend.com/webhooks.',
    weight: 3,
  }));

  const verifying = routes.filter(f => /webhooks\.verify\s*\(|new\s+Webhook\s*\([^)]*\)\s*\.?verify|\.verify\s*\(/.test(f.text));
  out.push(check({
    id: 'webhook.verifies_signature', mission: M, title: 'Webhook verifies the Svix signature',
    status: routes.length ? VERIFIED : UNKNOWN, pass: routes.length ? verifying.length === routes.length : false,
    detail: routes.length ? (verifying.length === routes.length ? 'All webhook routes call verify' : `Unverified: ${routes.filter(f => !verifying.includes(f)).map(f => f.rel).join(', ')}`) : 'No webhook route yet',
    fix: 'resend.webhooks.verify({ payload: await req.text(), headers: { id, timestamp, signature }, webhookSecret }) — throws on invalid.',
    weight: 3,
  }));

  const rawBody = routes.filter(f => /\.text\s*\(\s*\)/.test(f.text));
  const jsonFirst = routes.filter(f => /\.json\s*\(\s*\)/.test(f.text) && !/\.text\s*\(\s*\)/.test(f.text));
  out.push(check({
    id: 'webhook.raw_body', mission: M, title: 'Signature is checked against the raw body', 
    status: routes.length ? INFERRED : UNKNOWN, pass: routes.length ? jsonFirst.length === 0 && rawBody.length > 0 : false,
    detail: routes.length ? (jsonFirst.length ? `Parses JSON without reading raw text: ${jsonFirst.map(f => f.rel).join(', ')}` : 'Routes read req.text() before verifying') : 'No webhook route yet',
    fix: 'const payload = await req.text(); verify(payload, …); const event = JSON.parse(payload) — re-serialized JSON breaks the HMAC.',
    weight: 1,
  }));

  const dedupe = routes.filter(f => /alreadySeen|svix_id|svixId|isDuplicate|seenEvent/.test(f.text));
  out.push(check({
    id: 'webhook.dedupe', mission: M, title: 'Webhook handler is idempotent (dedupes on svix-id)',
    status: routes.length ? INFERRED : UNKNOWN, pass: routes.length ? dedupe.length > 0 : null,
    detail: routes.length ? (dedupe.length ? 'svix-id is stored/checked' : 'No sign of svix-id storage; retries will double-count') : 'No webhook route yet',
    fix: 'Use the svix-id header as a primary key / doc id and skip if it already exists.',
    weight: 1,
  }));

  const tableRefs = grep(p.source, /email_events|emailEvents|EmailEvent\b/);
  out.push(check({
    id: 'store.events_table', mission: M, title: 'Email events are stored in your database',
    status: tableRefs.length ? INFERRED : VERIFIED, pass: tableRefs.length > 0,
    detail: tableRefs.length ? `Referenced in ${tableRefs.slice(0, 5).map(f => f.rel).join(', ')}` : 'No email_events / emailEvents table or collection referenced',
    fix: config.authPlatform === 'firebase' ? 'Create emailEvents/{svixId} docs from the webhook (snippets/store-firestore.ts).' : 'Run snippets/schema-supabase.sql and write from the webhook with the service role (snippets/store-supabase.ts).',
    weight: 2,
  }));

  const adminPages = p.source.filter(f => /\.(tsx|jsx)$/.test(f.rel) && /admin/i.test(f.rel) && /email_events|emailEvents|listRecentEvents|EmailEvent/.test(f.text));
  out.push(check({
    id: 'admin.send_log', mission: M, title: 'Admin page shows the send log',
    status: INFERRED, pass: adminPages.length > 0,
    detail: adminPages.length ? adminPages.map(f => f.rel).join(', ') : 'No admin page renders email events',
    fix: 'Add app/admin/email/page.tsx (snippets/admin-send-log.tsx) behind your admin guard.',
    weight: 2,
  }));

  const testSend = p.source.filter(f => /delivered@resend\.dev|sendTestEmail|TestSendForm/.test(f.text));
  out.push(check({
    id: 'admin.test_send', mission: M, title: 'Admin page can send a test email (optional)',
    status: INFERRED, pass: testSend.length ? true : null,
    detail: testSend.length ? testSend.map(f => f.rel).join(', ') : 'No test-send affordance found — handy for watching webhooks arrive',
    fix: 'snippets/test-send-form.tsx', weight: 0,
  }));

  return out;
}
