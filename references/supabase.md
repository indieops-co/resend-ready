# Supabase branch

Read this when `progress.json` → `config.authPlatform` is `supabase`.

## Auth emails (magic links, confirmations, resets)

These are sent by Supabase Auth, not by your app code. Two ways to make them leave from your Resend domain:

1. **Resend ↔ Supabase integration** (resend.com/settings/integrations) — pick the Supabase project, pick the domain; Resend configures SMTP on the Supabase side.
2. **Manual Custom SMTP** in Supabase Dashboard → Authentication → SMTP Settings: host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key with sending permission, sender email on your verified subdomain, sender name your product name.

Then, from Resend's Supabase deliverability guide:
- Put a **custom domain on the Supabase project** so links in the email (`https://auth.example.com/auth/v1/...`) match the `from` domain.
- Send auth mail from a dedicated `auth.` subdomain or your transactional subdomain.
- **Disable open/click tracking** on that domain — link rewriting corrupts single-use verification links.
- Optional but smart: point the email template's button at a page you control with a "Sign in" button that then redirects to the real `{{ .ConfirmationURL }}`. Corporate link scanners pre-fetch links and burn single-use tokens; the interstitial stops that.
- Add DMARC (Mission 2 covers it).

The doctor can't see inside your Supabase project. Auth SMTP is a `USER CONFIRMATION REQUIRED` check (`supabase.smtp_configured`).

## Storing email events (Mission 4) and inbound mail (Mission 5)

Snippets: `snippets/schema-supabase.sql`, `snippets/store-supabase.ts`.

- Tables: `email_events` (one row per webhook event) and `inbound_emails` (one row per received email, body fetched from the Receiving API).
- Write from the webhook route with the **service-role** client (`@supabase/supabase-js` created with `SUPABASE_SERVICE_ROLE_KEY`) — the webhook has no user session, and RLS should keep these tables closed to end users.
- Read in the admin page with the server client and an admin check (`profiles.role = 'admin'` or your equivalent). Enable RLS; add a policy that only your admin role can select; the service role bypasses RLS for writes.
- Realtime is optional: subscribe the inbox page to `inbound_emails` inserts for a "new message" badge.

## Env vars the doctor looks for

`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Only the last two may be `NEXT_PUBLIC_`.
