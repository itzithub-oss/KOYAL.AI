# KOYAL AI

## Run locally

1. Open Command Prompt in this folder.
2. Run `npm install`.
3. Create or update `.env.local` with the following values:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

4. Run `npm run dev`.
5. Open http://localhost:3000.

Never commit `.env.local`, API keys, or passwords.

## Account login

KOYAL AI uses Supabase Auth for email/password registration and login. Phone number is optional signup metadata and is not verified; no Twilio or SMS provider is used by this login flow.

In Supabase, enable the Email provider. Configure the project's Site URL and allowed redirect URLs for both local development (`http://localhost:3000`) and the deployed KOYAL AI domain. If email confirmation is enabled, users must confirm their address before logging in. Supabase's default email sender may have delivery and rate limits; configure SMTP for reliable production email delivery.

The browser uses only the Supabase publishable/legacy anon key. Never expose a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

The current account feature authenticates users and keeps their login session across reloads. Existing chat history, profile, tasks, memories, feather balance, and demo subscription selections remain browser-local; cross-device synchronization and secure coupon redemption are separate work.

## FIND UP setup

FIND UP is integrated into the KOYAL dashboard and uses the existing Supabase project.

1. Open the Supabase SQL Editor for the project and run `supabase/migrations/202611190001_find_up.sql`.
2. Add these server-side environment variables in Vercel and local `.env.local`:
   - `SUPABASE_SERVICE_ROLE_KEY` — the Supabase service-role secret. Keep it server-only; never prefix it with `NEXT_PUBLIC_`.
   - `FIND_UP_ADMIN_EMAILS` — comma-separated email addresses allowed to review and manage listings. These users must also have a valid KOYAL Supabase Auth account.
3. The existing `NEXT_PUBLIC_SUPABASE_URL` value is reused by the server if `SUPABASE_URL` is not separately set.
4. Redeploy after applying the migration and adding environment variables.

New partnership submissions enter as `PENDING`. Only `APPROVED` listings appear in public Find Up search. Credential verification is a separate administrator action; approval alone does not create a verified badge. Owner contact details and private document metadata are not returned by the public search API.

Find Up currently uses deterministic hybrid text matching (category terms, service keywords, synonyms, location, price and typo tolerance), not vector embeddings. Secure document upload/storage, configurable category taxonomy, geospatial radius ranking, audit-log writes and production rate limiting still require follow-up implementation/configuration. Do not collect or upload sensitive identity or credential documents until a private Supabase Storage bucket and access policies have been configured.
