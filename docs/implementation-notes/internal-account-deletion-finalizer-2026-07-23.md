# Internal Account Deletion Finalizer

Date: 2026-07-23

Status: source complete, disabled, not approved for deployment or product use.

## Scope

Draft migration `supabase/migration-drafts/0031_internal_account_deletion_finalizer.sql` and the
`account-deletion-finalize` Edge Function implement the internal DEL-1
finalization stage. They do not connect the mobile Delete Account action.

The finalizer can claim an account only after both approved external deletion
destinations are `delivered` or `manually_resolved`. Claims have a 15-minute
lease so a crashed function can resume. Failed attempts retry after one hour
and three hours; the third failure moves the request to manual review.

## Deletion Order

1. Claim an `external_updates_complete` request transactionally.
2. Remove user-linked operational rows whose foreign keys otherwise use
   `ON DELETE SET NULL`.
3. Delete the Supabase Auth user.
4. Delete `public.users`; application-owned rows cascade from this record.
5. Preserve `account_deletion_requests` and redacted
   `external_sync_events` as backend-only audit evidence.
6. Mark the request `internally_deleted`.

Auth and Postgres cannot share one transaction. If the process stops after
Auth deletion, the lease expires and a retry treats an already-absent Auth
user as safe, then completes the application-data purge.

## Safety Gate

The Edge Function fails closed unless all conditions are met:

- `INTERNAL_ACCOUNT_DELETION_ENABLED=true`
- the caller supplies the private internal-deletion cron secret
- both external deletion destinations are complete
- the database claim is active and unexpired

Keep `INTERNAL_ACCOUNT_DELETION_ENABLED=false` in staging and production until
destructive tests using disposable accounts pass. The mobile deletion control
must remain disconnected.

## Required Hosted QA

- anonymous and authenticated callers cannot execute the finalizer RPCs;
- a request with incomplete external cleanup is never claimed;
- simultaneous claims return a request at most once;
- a stale 15-minute claim can be recovered;
- an already-deleted Auth user can be resumed safely;
- application rows are removed by cascade;
- redacted external events and the deletion request survive;
- one-hour and three-hour retries are scheduled correctly;
- three failures reach manual review;
- a completed request is idempotent.

## Signed Unknown-Time Evidence

`pnpm test:golden-live:secure` now includes a synthetic signed Worker request
that requires:

- `precision = no_birth_time`;
- no Ascendant;
- no MC / Medium Coeli;
- no houses;
- no planet house placements.

This is a privacy/shape invariant only. Unknown-time chart accuracy remains
`pending_reference` until PM/QA approves a trusted reference.

## Deployment Gate

Migration `0030` remains the immediate staging deployment. The draft must not
be moved into `supabase/migrations`, and `account-deletion-finalize` must not
be deployed or enabled, until QA reviews this source batch and a dedicated
destructive-test procedure is ready.
