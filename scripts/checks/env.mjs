import { check, VERIFIED, INFERRED, UNKNOWN } from '../lib/classify.mjs';
import { grep } from '../lib/fs.mjs';

export async function run(ctx) {
  const { project: p } = ctx;
  const out = [];
  const M = 3;

  const key = p.envValue('RESEND_API_KEY');
  const inFile = p.envKeys.has('RESEND_API_KEY');
  out.push(check({
    id: 'env.api_key_present', mission: M, title: 'RESEND_API_KEY is configured',
    status: key ? VERIFIED : (inFile ? INFERRED : VERIFIED),
    pass: !!key,
    detail: key ? `Found ${inFile ? 'in an env file' : 'in the process environment'}${/^re_/.test(key) ? ' (shape looks right)' : ' — but it does not start with re_, double-check it'}` : 'Not found in .env* files or the environment',
    fix: 'Create a sending-permission key at resend.com/api-keys and put RESEND_API_KEY=re_… in .env.local (server-only).',
    weight: 3,
  }));

  const publicKeyEnv = [...p.envKeys].filter(k => /^NEXT_PUBLIC_.*RESEND/i.test(k));
  const publicKeySrc = grep(p.source, /NEXT_PUBLIC_[A-Z_]*RESEND/);
  const leaks = [...publicKeyEnv, ...publicKeySrc.map(f => f.rel)];
  out.push(check({
    id: 'env.api_key_server_only', mission: M, title: 'Resend key never exposed to the browser',
    status: VERIFIED, pass: leaks.length === 0,
    detail: leaks.length ? `NEXT_PUBLIC_ Resend variable found: ${leaks.join(', ')}` : 'No NEXT_PUBLIC_*RESEND* variables anywhere',
    fix: 'Rename to RESEND_API_KEY, read it only in Route Handlers / Server Actions / server components, and rotate the exposed key.',
    weight: 3,
  }));

  const clientSend = p.source.filter(f => /['"]use client['"]/.test(f.text) && /from\s+['"]resend['"]/.test(f.text));
  out.push(check({
    id: 'code.no_client_send', mission: M, title: 'No Resend SDK import in client components',
    status: VERIFIED, pass: clientSend.length === 0,
    detail: clientSend.length ? `'use client' files importing resend: ${clientSend.map(f => f.rel).join(', ')}` : 'Client components do not import the SDK',
    fix: 'Move the send into a Server Action or Route Handler and call it from the client.',
    weight: 2,
  }));

  const literal = p.source.filter(f => /\bre_[A-Za-z0-9]{24,}\b/.test(f.text) || /\bwhsec_[A-Za-z0-9+/=]{20,}\b/.test(f.text));
  out.push(check({
    id: 'env.no_committed_secrets', mission: M, title: 'No API keys or webhook secrets hard-coded in source',
    status: VERIFIED, pass: literal.length === 0,
    detail: literal.length ? `Secret-shaped literals in: ${literal.map(f => f.rel).join(', ')}` : 'No secret-shaped string literals in source',
    fix: 'Move the value to an env var, then rotate it at resend.com — assume anything in git history is public.',
    weight: 3,
  }));

  const gi = p.gitignore;
  const ignored = gi.split(/\r?\n/).some(l => { const t = l.trim(); return t === '.env' || t === '.env*' || t === '.env.*' || t === '.env.local' || t === '.env*.local' || t === '*.local' || t === '.env.local*' || t === '/.env' || t === '/.env.local'; });
  const hasLocalEnv = p.envFiles.some(f => f.name === '.env.local' || f.name === '.env');
  out.push(check({
    id: 'env.gitignored', mission: M, title: '.env.local / .env is git-ignored',
    status: gi ? VERIFIED : UNKNOWN, pass: gi ? ignored : false,
    detail: gi ? (ignored ? 'Env files are ignored' : 'No .env / .env.local / .env* rule in .gitignore') : 'No .gitignore found',
    fix: hasLocalEnv ? 'Add ".env*.local" and ".env" to .gitignore (Next.js templates include ".env*.local").' : 'Add ".env*.local" to .gitignore before you create one.',
    weight: 2,
  }));

  const secret = p.envValue('RESEND_WEBHOOK_SECRET');
  out.push(check({
    id: 'env.webhook_secret_present', mission: 4, title: 'RESEND_WEBHOOK_SECRET is configured',
    status: VERIFIED, pass: !!secret,
    detail: secret ? `Found${/^whsec_/.test(secret) ? ' (shape looks right)' : ' — expected it to start with whsec_'}` : 'Not found',
    fix: 'Create the webhook at resend.com/webhooks, copy its signing secret into RESEND_WEBHOOK_SECRET.',
    weight: 2,
  }));

  return out;
}
