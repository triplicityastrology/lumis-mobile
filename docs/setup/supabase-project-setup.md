# Supabase Project Setup For Lumis

This is the nontechnical checklist for creating the hosted Supabase project that Lumis mobile will use for Auth, database, Row Level Security, and Edge Functions.

Official docs used for this guide:

- Supabase Expo React Native quickstart: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- Supabase API keys guide: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase native mobile deep linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking

## What You Need Ready

- A Supabase account login email.
- Project name: `lumis-mobile`
- Organization name: `Triplicity Astrology` or `Lumis`
- Region: choose the closest stable region for your first users. For Hong Kong users, Singapore is usually the sensible first choice if available.
- A strong database password saved in your password manager.

## Step 1: Create The Project

1. Go to https://supabase.com/dashboard
2. Sign in or create an account.
3. Click `New project`.
4. Choose or create an organization.
5. Project name: `lumis-mobile`
6. Database password: generate a strong password and save it.
7. Region: pick the nearest region to the target launch market.
8. Pricing plan: Free is fine for development.
9. Click `Create new project`.
10. Wait until Supabase says the project is ready.

## Step 2: Copy The Public Mobile App Values

In the Supabase Dashboard:

1. Open the Lumis project.
2. Open `Connect` or `Project Settings > API Keys`.
3. Copy the `Project URL`.
4. Copy the public client key:
   - Prefer `Publishable key` if Supabase shows the newer key system.
   - If the project only shows legacy keys, copy `anon public`.

These values are safe to place in the Expo app because Row Level Security still protects user data.

Put them in a local `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_if_using_legacy_keys
```

Use either `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`. You do not need both.

## Step 3: Keep Backend Secrets Out Of The Mobile App

Do not put secret keys in Expo/mobile environment variables.

Backend-only values belong in Supabase Edge Function secrets:

```bash
SUPABASE_SERVICE_ROLE_KEY=service_role_or_secret_key
CHART_WORKER_URL=cloudflare_worker_url
CHART_WORKER_SIGNING_SECRET=cloudflare_worker_signing_secret
AZURE_OPENAI_ENDPOINT=azure_openai_endpoint
AZURE_OPENAI_API_KEY=azure_openai_key
OPENROUTER_API_KEY=openrouter_key
```

Codex or a developer can set these later using the Supabase CLI after the project exists.

## Step 4: Run Database Migrations

After the project is created and linked, run the migrations in:

```text
supabase/migrations
```

Current migrations:

- `0001_initial_schema.sql`
- `0002_profile_chat_persistence.sql`

These create the user, birth data, chart profile, balance, Lumis Persona, chat thread, and chat message tables with Row Level Security.

## Step 5: Enable Auth

For the first development build, use email login.

In Supabase Dashboard:

1. Go to `Authentication`.
2. Confirm email provider is enabled.
3. For easiest early testing, email magic link / OTP is enough.
4. Later, configure Apple login before TestFlight/App Store.

For mobile deep links later, add redirect URLs once the app scheme is final. Likely:

```text
lumis://auth/callback
```

## Step 6: Deploy Edge Functions Later

The app has scaffolded functions in:

```text
supabase/functions
```

Current functions:

- `profile`
- `chat-message`
- `config`
- `billing-webhook`

They do not need live deployment for today’s local UI testing. Deploy them once the project, keys, and migrations are ready.

## What To Send Back To Codex

After you create the project, send:

- Project URL
- Publishable key or anon public key
- Project ref from the dashboard URL

Do not send service role keys or secret keys in chat unless you are intentionally using a secure local setup. Prefer keeping those in Supabase secrets.
