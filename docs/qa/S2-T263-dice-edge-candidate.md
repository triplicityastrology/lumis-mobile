# S2-T263 Dice Edge candidate

## Scope

This candidate replaces the stale v0.3 `dice-synthetic` entry with the T257
canonical server-only port. The request has one closed `authorization` field;
all questions, landed symbols, prompts and `fixture_id` values come only from
the fixed server registry. The signed Technical-80 authority is consumed once
through `consume_lumis_dice_synthetic_authority_v1` before provider access.

`LUMIS_AI_ENABLED=false` is the default. Disabled requests return
`DICE_AI_DISABLED` before Azure or Supabase client construction. The sole
approved hostname is `lumis-foundry-stg-sea-20260731.services.ai.azure.com`.

The deployment profile is names-only: alias `lumis-ai-chat-stg`, model
`gpt-5-mini`, model version `2025-08-07`, deployment type `GlobalStandard`,
upgrade policy `NoAutoUpgrade`, guardrail `Microsoft.DefaultV2`, and limits of
10,000 TPM / 10 RPM. A separate sanitized USD pricing record is checksum-bound;
its full 120-case, 240-attempt maximum estimate is $0.192. It contains no CSV,
billing, subscription or resource identifier, or credential. No endpoint path,
key, email, masked field, or screenshot belongs in the manifest or receipt.
The Azure API version is also `null` and unverified; even when the feature flag
is true, the candidate returns `DICE_AZURE_TRAFFIC_NOT_AUTHORIZED` before Azure
or Supabase client construction. Separate evidence and authority are required
before any provider traffic can be admitted.

The API route family is checksum-bound as `v1` from sanitized Foundry evidence
and the official [Microsoft Foundry Responses API v1 reference](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses).
Preview and legacy date-formatted API-version routes are rejected. The observed
deployment path itself is not retained. This evidence grants no deployment,
normal-chat, or Azure-traffic authority.

## Local verification

The T263 local gate compiles the handler, bundles the actual Edge entry, runs
the loopback Azure protocol emulator, and checks source, privacy, receipt and
exact-diff contracts. The emulator covers success, DefaultV2 block,
DefaultV2 partial, malformed output, 401 and 403 without retry, one transient
retry, abort timeout, and output beyond the 300-token cap. It uses no external
network, deployment, migration, Supabase project or Azure resource.

Evidence is metadata-only for 30 days. It excludes raw provider payloads,
prompts, questions, client secrets, member context and units. Normal routes,
unit charging and product persistence remain zero. Migration `0039` is reused
unchanged and was not executed by this task.

## Post-deploy receipt

After a separately authorized deployment, feed only the independently observed
disabled probe into:

```sh
node scripts/s2-t263-dice-edge-receipt.mjs \
  --disabled-code DICE_AI_DISABLED \
  --provider-calls 0
```

The generator fails closed for nonzero provider calls and emits no secrets or
provider content.

## Failure and rollback

Any configuration, authority, durable-store, provider protocol, schema, token,
deadline or bundle failure fails closed with a stable Dice code and no raw log.
Rollback is code-only: redeploy parent commit `083af57` for `dice-synthetic` and
verify `LUMIS_AI_ENABLED=false` plus a receipt with `provider_calls=0`. Do not
roll back or drop migration `0039`; its metadata-only authority rows expire and
are purged at 30 days. No data restoration, unit correction or customer-history
cleanup is required because this route creates none of those effects.
