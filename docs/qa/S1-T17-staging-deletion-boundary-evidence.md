# S1-T17 Staging Deletion-Boundary Evidence

Date: 2026-07-28

Environment: Lumis non-production staging (`bmqhwofmdgebpcihjlnb`)

## Scope Finding

The internally destructive DEL-1 finalizer is **not deployed**. Its SQL remains
in `supabase/migration-drafts/0031_internal_account_deletion_finalizer.sql`, and
the `account-deletion-finalize` Edge Function remains disabled pending
destructive staging approval.

The deployed boundary currently:

1. authenticates a recently signed-in user;
2. queues Salesforce and Google deletion-marker work;
3. blocks new chart exports for that user;
4. retains the Auth account and application records;
5. requires a future approved internal finalizer before destructive deletion.

This proof does not claim that internal account deletion is live.

## Hosted Boundary Checks

The staging run uses generated disposable users only and verifies:

- another authenticated user cannot read the target's deletion request;
- another authenticated user cannot invoke the backend-only deletion enqueue
  RPC for the target;
- an authenticated owner can queue external cleanup;
- the owner Auth record and `public.users` record remain present after external
  cleanup is requested;
- in-flight export completion is captured before deletion cleanup;
- new exports are blocked after deletion begins;
- abandoned export claims expire into deterministic deletion cleanup;
- expired external-sync payloads are redacted and cannot be claimed or replayed;
- normal run-ID cleanup targets only the disposable users created by the run.

Hosted command:

```sh
pnpm test:staging-backend:secure
```

Successful run ID: `1785213885840-48dada84df624`

Hosted result: passed (`ok: true`, scope `full`). The run completed every
boundary, race, retention, and RLS assertion listed above.

## Current Record Boundary

### Removed by the future approved two-stage finalizer

Auth-owned rows cascade when the disposable Auth user is deleted:

- `dice_throws`
- `api_rate_limit_windows`
- `chart_provider_call_events`
- `chart_provider_call_attempt_events`

Application-owned rows cascade when `public.users` is deleted:

- `birth_data`
- `ai_profiles`
- `birth_data_history`
- `birth_detail_change_requests`
- `monthly_balance`
- `account_entitlements`
- `entitlement_provider_events`
- `chat_threads`
- `chat_messages`
- `notifications`
- Care Circle relationships where the user is a participant, plus their
  relationship events

Before those two parent rows are deleted, the draft finalizer explicitly
removes rows from tables whose foreign key otherwise becomes null:

- `message_usage`
- `runtime_request_events`

### Intentionally retained for deletion audit/recovery

These backend-only records deliberately do not cascade from `public.users`:

- `account_deletion_requests`
- `external_sync_events`

They retain minimal operational delivery/deletion evidence and remain protected
from `anon` and `authenticated` access. Their final retention period remains a
privacy/operations policy gate.

### Shared or non-user reference data

These records are not owned by a single account and are not deleted:

- `birth_location_reference`
- `migration_reports`
- `external_sync_daily_reports`
- `runtime_alerts`

## Dice Status

`dice_throws` is present in the active migration set as migration `0019`; it is
not a future-only schema object in this repository. Its destructive cleanup is
owned by the Auth-user `ON DELETE CASCADE`, but an end-to-end finalizer deletion
cannot be claimed until DEL-1 is deployed and separately approved.

Any newer migration draft or table absent from the staging migration list is
outside this proof.

## Safety and Cleanup

- No founder or pre-existing account is selected by the harness.
- Disposable IDs are generated inside the run and held only in memory/output as
  opaque run-scoped identifiers.
- Evidence contains no email, birth data, token, callback URL, provider payload,
  or secret.
- The dedicated staging key is accepted only through hidden Terminal input.
- Cleanup is scoped to the hosted QA run ID and is verified after the run.

The successful runner reached its normal `finally` cleanup path and emitted no
cleanup-failure message for any run-scoped disposable user. The dedicated key
was not written to a file or command history.

Three earlier disposable attempts stopped before acceptance while the harness
was corrected:

- the first revealed that the deletion fixture lacked its required
  `public.users` row;
- the next isolated the deployed safe cancellation-code variants;
- the corrected final run passed.

Each stopped run also reached the same `finally` cleanup path without reporting
a disposable-user cleanup failure. No existing/founder account was selected.

## Remaining Gate

Before internal DEL-1 can be accepted:

1. move migration `0031` out of drafts only under a separate authorization;
2. deploy the disabled finalizer only to staging;
3. seed all deployed user-owned table families for one disposable user;
4. prove external cleanup completion is required;
5. run the finalizer and verify every cascade/set-null preparation rule;
6. prove audit retention and cross-user/service-role boundaries;
7. verify retry, stale-claim, and manual-review behavior;
8. delete all disposable evidence.
