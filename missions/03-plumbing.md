# Mission 3 — Plumbing

**Why it matters:** ten different `new Resend(` calls with ten different `from:` strings is how "we changed the sender and forgot the invoice email" happens. One module, sane defaults, errors that don't vanish.

**What the doctor checks:** `sdk.installed`, `env.api_key_present`, `env.api_key_server_only`, `env.gitignored`, `env.no_committed_secrets`, `code.no_client_send`, `code.email_module`, `code.no_resend_dev_from`, `env.from_configured`, `code.reply_to`, `code.text_fallback`, `code.checks_error`; informational `code.idempotency`, `sdk.react_email`; and for auth platforms, the human check `supabase.smtp_configured` / `firebase.smtp_configured`.

## Do this

1. `npm i resend`. Put `RESEND_API_KEY=re_…` in `.env.local` (a **sending-only** key for the app; keep full-access keys for humans). Confirm `.env*.local` is in `.gitignore`. If a key ever appeared in a `NEXT_PUBLIC_` variable or in source, rotate it now — assume it's public.
2. **Create the email module** (`lib/email.ts`, from `references/snippets/email.ts`) with: the single exported `resend` client, a `FROM` map keyed by purpose (transactional → `notifications.` domain, marketing → `updates.`), a `sendEmail()` that always sends a text part, always tags, accepts an idempotency key, and **checks `error`** — the SDK resolves the promise even when the API refuses.
3. **Migrate existing sends** to `sendEmail()`. Show each diff; don't overwrite. Remove every `onboarding@resend.dev` — including, especially, the ones that are not literals:

   ```ts
   const from = process.env.RESEND_FROM ?? 'Acme <onboarding@resend.dev>';  // ← the dangerous line
   ```

   That fallback ships. It fires the moment `RESEND_FROM` is missing **in whichever environment is doing the sending**, and `onboarding@resend.dev` delivers *only to the Resend account owner* — so the developer's own test arrives, every customer's email is rejected, and nothing in the logs says why. Delete the fallback and let a missing variable throw; a loud failure at boot beats silent non-delivery for weeks. `code.no_resend_dev_from` catches the line, `env.from_configured` catches the missing variable.

   Then set the variable **everywhere the code runs**, not just in `.env.local`: Vercel env vars, Supabase Edge Function secrets, Fly secrets, your CI. Production reads from the deployment store, and the repo's env file is the copy least likely to be the one in force.

4. **Make replies reachable.** A sending subdomain has no inbox — `notifications.acme.com` cannot receive mail — so a `From:` there sends every human reply into a bounce. People reply to transactional email constantly, and most of all to anything that reads like bad news. Pass `replyTo:` with an address a person actually reads. `code.reply_to` checks the sending domain's MX and warns only when replies would genuinely go nowhere.
5. **Auth platform SMTP** — auth emails don't go through your code:
   - Supabase: `references/supabase.md` (integration or Custom SMTP: `smtp.resend.com`, 465, user `resend`, password = API key; custom project domain so links match the sender).
   - Firebase: `references/firebase.md` (Authentication → Templates → SMTP settings; custom action handler page).
   Then `--confirm supabase.smtp_configured` / `--confirm firebase.smtp_configured`.
6. **Send one real email** from a server context using `sendEmail()` — to an address on a provider you do **not** control, not your own. Your own address is exactly the one that still works while everything is broken (see the `onboarding@resend.dev` trap above), so testing with it proves almost nothing. Confirm it arrives, and that the headers show DKIM and SPF passing if Mission 2 is done.

## Branches

- **React Email**: if they want designed templates, `npm i @react-email/components`, pass `react:` instead of `html:` — the SDK renders text automatically in that path. Resend's dashboard Templates (with `{{variables}}`) are the no-build alternative.
- **Firebase "Trigger Email" extension**: works via SMTP but hides errors in Firestore docs; prefer the SDK from a Cloud Function or Route Handler.
- **Edge runtime**: the SDK is fetch-based and runs on Edge/Workers; the key still comes from server env.

## Done when

All Mission 3 checks pass (INFERRED passes are fine; they're heuristics on your code). `supabase.`/`firebase.smtp_configured` confirmed where applicable.
