# Snippets

Small on purpose. Each one shows *the seam where Resend touches your code*, not a whole page. Adapt names, paths, and auth checks to the project you're in; never paste over an existing file.

| File | Mission | What it shows |
|---|---|---|
| `email.ts` | 3 | The one email module every send goes through (from defaults, text fallback, tags, idempotency, error handling) |
| `webhook-route.ts` | 4 + 5 | `app/api/resend/webhook/route.ts` — raw body, signature verify, dedupe, dispatch by event type |
| `schema-supabase.sql` | 4 + 5 | Two tables + RLS |
| `store-supabase.ts` | 4 + 5 | Service-role writes from the webhook |
| `store-firestore.ts` | 4 + 5 | `firebase-admin` writes, doc id = svix-id |
| `admin-send-log.tsx` | 4 | Server component: latest events, status pills, bounce reason |
| `test-send-form.tsx` | 4 | Server Action + form: send a test to `delivered@resend.dev` (or yourself) and watch the log fill in |
| `admin-inbox.tsx` | 5 | Inbox list + thread view reading `inbound_emails` |
| `reply-action.ts` | 5 | Server Action that replies in-thread with `In-Reply-To` / `References` |
| `marketing-send.ts` | 6 | A hand-rolled marketing send with `List-Unsubscribe` headers (or: just use Broadcasts) |

All snippets assume Next.js App Router, TypeScript, and the `resend` SDK. `@/` is your usual path alias.
