import { check, VERIFIED } from '../lib/classify.mjs';

export async function run(ctx) {
  const { deps } = ctx.project;
  const out = [];
  out.push(check({
    id: 'sdk.installed', mission: 3, title: 'resend SDK is a dependency',
    status: VERIFIED, pass: !!deps.resend,
    detail: deps.resend ? `resend ${deps.resend}` : 'resend is not in package.json',
    fix: 'npm i resend', weight: 2,
  }));
  const rx = deps['@react-email/components'] || deps['react-email'];
  out.push(check({
    id: 'sdk.react_email', mission: 3, title: 'React Email available for templates (optional)',
    status: VERIFIED, pass: !!rx || null,
    detail: rx ? `@react-email/components ${rx}` : 'Not installed — fine if you use Resend Templates or raw HTML',
    fix: 'npm i @react-email/components, then pass react: <Welcome/> instead of html:', weight: 0,
  }));
  out.push(check({
    id: 'sdk.svix', mission: 4, title: 'Webhook verification library', status: VERIFIED,
    pass: (!!deps.resend || !!deps.svix) || null,
    detail: deps.svix ? `svix ${deps.svix} (manual verify)` : (deps.resend ? 'Using resend.webhooks.verify from the SDK' : 'Neither resend nor svix installed'),
    fix: 'The resend SDK includes webhooks.verify; svix is only needed if you verify manually.', weight: 0,
  }));
  const platform = deps['@supabase/supabase-js'] || deps['@supabase/ssr'] ? 'supabase' : (deps.firebase || deps['firebase-admin'] ? 'firebase' : null);
  ctx.detectedPlatform = platform;
  return out;
}
