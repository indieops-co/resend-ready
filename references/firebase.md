# Firebase branch

Read this when `progress.json` → `config.authPlatform` is `firebase`.

## Auth emails (verification, password reset, email-link sign-in)

Firebase Auth sends these itself. In Firebase Console → Authentication → Templates → **SMTP settings**, enable a custom SMTP server: host `smtp.resend.com`, port `465` (or `587`), username `resend`, password = a Resend API key with sending permission, sender address on your verified Resend subdomain. Customize the sender name and, in Templates, the action URL so it points at your own domain (a custom action handler page) rather than `<project>.firebaseapp.com`.

Same deliverability notes as Supabase: tracking off on that domain, DMARC on the root, consistent `from` identity. Corporate link scanners can consume single-use action links — a custom action handler page that requires a click before applying the code (`applyActionCode` / `signInWithEmailLink`) is the fix.

The doctor can't see inside the Firebase console. Auth SMTP is a `USER CONFIRMATION REQUIRED` check (`firebase.smtp_configured`).

## App-originated email

Send only from a server context: Next.js Route Handler / Server Action, or a Cloud Function (2nd gen) triggered by a Firestore write. Never call the Resend SDK from client components — the key would ship to the browser. The Firebase "Trigger Email from Firestore" extension is an alternative (it uses SMTP; Resend's SMTP creds work), but it hides send errors in Firestore docs rather than returning them — the doctor treats it as `INFERRED` if it sees the `mail` collection pattern.

## Storing email events (Mission 4) and inbound mail (Mission 5)

Snippet: `snippets/store-firestore.ts`.

- Collections: `emailEvents/{svixId}` (doc id = `svix-id`, which gives you free deduplication on retries) and `inboundEmails/{emailId}`.
- Write with `firebase-admin` from the webhook route (initialize once with a service account or Application Default Credentials).
- Read in the admin page with `firebase-admin` on the server and a custom claim (`admin: true`) check; lock the collections down in Firestore rules so clients can't read them directly.

## Env vars the doctor looks for

`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and one of `FIREBASE_SERVICE_ACCOUNT_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` (server-only). `NEXT_PUBLIC_FIREBASE_*` config values are fine on the client; the Resend key is not.
