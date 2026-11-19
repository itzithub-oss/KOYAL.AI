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
