# Lumis Mobile Chart Worker

This is a deployable Cloudflare Worker template for the mobile-only signed chart endpoint:

```text
POST /mobile/natal-chart
```

It is based on the current website Worker at:

```text
/Users/rubyku/Documents/Website Chart/worker.js
```

## Current Scope

- Verifies the Supabase Edge Function HMAC signature.
- Rejects missing or unknown `LUMIS_ENV` values before provider work.
- Uses a Durable Object request lock so signed request replays return the original chart without another provider call.
- Expires cached chart replay results after seven days by Durable Object alarm; the alarm clears all storage for that request object.
- Rejects a reused request ID when the signed body digest changes.
- Aborts astrology-api.io after a bounded provider timeout.
- Builds the astrology-api.io natal chart payload server-side.
- Uses Placidus, Tropical zodiac, and the active points from the website flow.
- Returns `chart_v2` for Supabase storage.
- Sanitizes unknown-birth-time charts so they contain no Ascendant, no MC, no houses, and no planet house placements.
- Omits raw astrology-api.io provider output from `chart_v2`.
- Uses restricted CORS headers; signed server-to-server calls do not require public wildcard browser access.
- Exposes a separate signed admin-sync endpoint for ledger-backed Salesforce and Google Sheets delivery.

Run local fixture checks with:

```bash
pnpm run test:worker
```

The fixture checks mock the astrology-api.io response and verify:

- valid signed full-time requests succeed
- invalid signatures are rejected before the provider call
- raw provider output is not exposed in `chart_v2`
- unknown-time requests use the deterministic noon provider fallback
- unknown-time `chart_v2` output removes Ascendant, MC, houses, and planet house placements

## Staging Deployment

The dedicated staging Worker is deployed at:

```text
https://lumis-chart-staging.triplicityastrology.workers.dev
```

It is configured by `wrangler.toml` and has been smoke-tested through the full
Supabase Edge Function -> signed Cloudflare Worker -> astrology-api.io path.
The smoke test requires a populated chart with at least 10 points, 12 houses,
Ascendant, and MC before profile onboarding can pass. This avoids changing the
website production Worker while the mobile integration is under QA.

## Required Cloudflare Secrets

```text
ASTRO_API_KEY=
CHART_WORKER_SIGNING_SECRET=
```

## Required Supabase Secrets

```text
CHART_WORKER_URL=
CHART_WORKER_ENDPOINT=/mobile/natal-chart
CHART_WORKER_SIGNING_SECRET=
CHART_WORKER_TIMEOUT_MS=15000
LUMIS_ENV=staging
```

`CHART_WORKER_SIGNING_SECRET` must match between Supabase and Cloudflare.

## Optional Admin Integration Secrets

Chart creation does not depend on these integrations. Chart/profile transactions
enqueue backend-only `external_sync_events`; the hourly retry function calls the
Worker's signed `/mobile/admin-sync` endpoint separately.

**Deferred milestone:** do not configure these credentials until the proper
Claude Design UI has been ported and founder/user UI testing is complete. Before
activation, PM/data ownership must approve the exact field allowlist, retention,
deletion, staging destination, and retry/idempotency behaviour.

Activation also requires the `AUDIT_DELIVERY_COORDINATOR` Durable Object binding.
The Worker checks each destination for the same idempotency key before creation.
Supabase retries after one hour and three hours, then marks the third failure
`failed_final` for the admin report/replay script.

```text
GOOGLE_MOBILE_SHEET_ID=
GOOGLE_MOBILE_SHEET_NAME=Lumis Mobile Charts
GOOGLE_DELETED_ACCOUNTS_SHEET_NAME=Deleted Accounts
GOOGLE_SERVICE_EMAIL=
GOOGLE_PRIVATE_KEY=
SF_LOGIN_URL=
SF_USERNAME=
SF_PASSWORD=
```

Supabase also requires `EXTERNAL_SYNC_CRON_SECRET` and
`EXTERNAL_SYNC_ENABLED=true`. Keep `EXTERNAL_SYNC_ENABLED` unset or false until
the staging Salesforce sandbox and staging Google Sheet pass QA.

The Google Sheet tab uses 20 columns (`A:T`): timestamp, request ID, chart/session ID,
Supabase user ID, email, name, birth date, birth time, place, timezone, plan,
product, source, flow, chart status, unknown-time flag, chart type, precision,
point count, and house count.

Chart replay protection uses the `CHART_REQUEST_COORDINATOR` binding declared in
`wrangler.toml`. It targets the existing Durable Object class but uses a separate
namespace keyed by `user_id + request_id`. `ASTRO_PROVIDER_TIMEOUT_MS` defaults to
12 seconds and is bounded to 1-30 seconds.

Account deletion uses a separate append-only `Deleted Accounts` tab with seven
columns (`A:G`): idempotency key, user ID, chart/session IDs, requested
timestamp, processed timestamp, status, and source. It contains no email or
email hash, and its stage is `external_cleanup_requested`. The Worker never
updates the original chart row in place. Salesforce Cases are redacted using
saved record IDs plus deterministic Subject lookup, covering late delivery IDs.

## Follow-Up

Before this passes production QA:

- fill the golden chart expected values
- compare Worker `chart_v2` output against `packages/astrology/src/golden-charts.ts`
- after founder UI testing, approve, configure, and smoke-test mobile-specific Google Sheets and Salesforce credentials
