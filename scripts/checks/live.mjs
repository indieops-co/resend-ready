// Optional, read-only calls to the Resend API. Enabled with --live. Never prints the key.
import { check, VERIFIED, UNKNOWN } from '../lib/classify.mjs';

async function api(path, key) {
  const res = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function run(ctx) {
  const out = [];
  const key = ctx.project.envValue('RESEND_API_KEY');
  if (!ctx.liveMode) return out;
  if (!key) return [check({ id: 'live.api', mission: 1, title: 'Live API check', status: UNKNOWN, pass: null, detail: 'No RESEND_API_KEY available for --live', weight: 0 })];
  try {
    const domains = (await api('/domains', key)).data || [];
    ctx.live = { domains };
    const want = ctx.sendingDomains || [];
    for (const d of want) {
      const m = domains.find(x => x.name === d);
      out.push(check({ id: `live.domain.${d}`, mission: 2, title: `Resend reports ${d} as verified`, status: VERIFIED, pass: m?.status === 'verified',
        detail: m ? `status=${m.status}, region=${m.region}` : 'Domain not found in this Resend team', fix: 'Add the domain in Resend and finish DNS verification.', weight: 2 }));
    }
    let hooks = null;
    try { hooks = (await api('/webhooks', key)).data || []; } catch { hooks = null; }
    if (hooks) {
      const events = new Set(hooks.flatMap(h => h.events || []));
      out.push(check({ id: 'live.webhook_registered', mission: 4, title: 'A webhook endpoint is registered in Resend', status: VERIFIED, pass: hooks.length > 0,
        detail: hooks.length ? `${hooks.length} endpoint(s); events: ${[...events].join(', ') || 'none listed'}` : 'No webhooks registered', fix: 'resend.com/webhooks → Add Webhook → your /api/resend/webhook URL.', weight: 1 }));
      if (ctx.config.receiving !== false) out.push(check({ id: 'live.received_event_enabled', mission: 5, title: 'email.received is enabled on a webhook', status: VERIFIED, pass: events.has('email.received'),
        detail: events.has('email.received') ? 'Enabled' : 'Not enabled on any endpoint', fix: 'Edit the webhook and tick email.received.', weight: 1 }));
    }
  } catch (e) {
    out.push(check({ id: 'live.api', mission: 1, title: 'Live API check', status: UNKNOWN, pass: null, detail: `Resend API call failed: ${e.message}`, weight: 0 }));
  }
  return out;
}
