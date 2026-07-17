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

### Run the privileged staging QA suite safely

In Supabase **Settings → API Keys**, create a dedicated secret key for this QA
run. Its value must begin with `sb_secret_`. Do not use the legacy
`service_role` JWT. Use the guarded launcher so the dedicated key is entered
with hidden Terminal input and never appears in shell history:

```bash
pnpm test:staging-backend:secure
```

The launcher is locked to the Lumis staging project. It prints a QA run ID,
creates disposable users, runs the hosted race, RLS, persistence, and deletion
checks, and normally removes the disposable records in a cleanup step. Never
put the secret key in `.env`, Expo configuration, Codex, screenshots, or chat
messages. A dedicated key can be deleted independently in Supabase when the QA
work is complete; do not rotate the project's legacy JWT secret for this test.

If Terminal or Node is stopped before normal cleanup finishes, use the printed
run ID:

```bash
pnpm test:staging-backend:cleanup -- 1750000000000-abcd1234
```

The cleanup command prompts invisibly for the same dedicated `sb_secret_` key,
finds only disposable users belonging to that run ID, and removes their records.

## Step 3: Keep Backend Secrets Out Of The Mobile App

Do not put secret keys in Expo/mobile environment variables.

Backend-only values belong in Supabase Edge Function secrets:

```bash
SUPABASE_SECRET_KEYS=Supabase_managed_JSON_object_of_named_secret_keys
CHART_WORKER_URL=cloudflare_worker_url
CHART_WORKER_ENDPOINT=/mobile/natal-chart
CHART_WORKER_SIGNING_SECRET=cloudflare_worker_signing_secret
CHART_WORKER_TIMEOUT_MS=15000
LUMIS_ENV=staging
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
- `0003_care_notifications_usage.sql`
- `0004_birth_details_change_policy.sql`
- `0005_starter_grant_guard.sql`
- `0006_profile_onboarding_transaction.sql`
- `0007_lock_migration_reports_access.sql`
- `0008_onboarding_chart_history.sql`
- `0009_chat_turn_persistence_rpc.sql`
- `0010_strip_legacy_raw_provider_response.sql`
- `0011_explicit_reflection_thread.sql`
- `0012_external_sync_delivery_ledger.sql`
- `0013_account_deletion_external_sync.sql`
- `0014_authoritative_account_entitlements.sql`

These create the user, birth data, versioned chart profile, balance, Lumis Persona,
Past Reflection thread, message, and authoritative current-plan tables with Row
Level Security. They also add transactional onboarding/chat RPCs, protected
restoration of a selected thread, and server-time plan expiry resolution. Credit
allocation does not determine an account's plan.

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
- `external-sync-retry`
- `account-deletion-request`

They do not need live deployment for today’s local UI testing. Deploy them once the project, keys, and migrations are ready.

## What To Send Back To Codex

After you create the project, send:

- Project URL
- Publishable key or anon public key
- Project ref from the dashboard URL

Do not send service role keys or secret keys in chat unless you are intentionally using a secure local setup. Prefer keeping those in Supabase secrets.
