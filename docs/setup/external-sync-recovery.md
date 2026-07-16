# External Sync Recovery

Salesforce and Google Sheets delivery is disabled by default. Chart creation is
never blocked by either destination.

## Data Flow

1. A successful chart version inserts two backend-only `external_sync_events`.
2. The hourly `external-sync-retry` invocation claims due rows with
   `FOR UPDATE SKIP LOCKED`.
3. The Edge Function signs a request to Cloudflare `/mobile/admin-sync`.
4. Cloudflare checks the destination for the same idempotency key before create.
5. Supabase records the external ID or schedules the next attempt.
6. Failures retry after one hour and three hours. The third failure becomes
   `failed_final`.
7. A daily invocation with `{ "mode": "daily_report" }` records the current
   failed-final report in `external_sync_daily_reports`.

`processing` is an additional internal transient state used while a worker owns
a delivery claim. Stale processing claims are recovered after 15 minutes.
`resolved_by` and `resolved_at` identify delivered and manually resolved events.

## Activation Gate

Do not set `EXTERNAL_SYNC_ENABLED=true` until all of these are true:

- Salesforce credentials point to staging/sandbox.
- Google credentials point to a separate staging Sheet.
- `EXTERNAL_SYNC_CRON_SECRET` is configured.
- Migration `0012_external_sync_delivery_ledger.sql` is applied.
- Migration `0013_account_deletion_external_sync.sql` is applied.
- The Worker and `external-sync-retry` function are deployed.
- QA has passed delivery, timeout, retry, duplicate, and manual replay tests.

Configure two authenticated schedules after QA:

- Hourly: POST `{}` to `external-sync-retry`.
- Daily: POST `{ "mode": "daily_report" }` to the same function.

Both requests must include `X-Lumis-Cron-Secret`.

## Admin Commands

Use backend-only environment variables; never place the service role key in the
mobile app or commit it.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm external-sync:report
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm external-sync:replay -- <event_id>
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm external-sync:resolve -- <event_id> <operator_id>
```

Manual replay preserves the same idempotency key. It resets the automatic
attempt window and increments `manual_replay_count`.

An authenticated deletion request cancels undelivered chart-export events and
enqueues one idempotent event per destination. Salesforce redacts known Case
records. Google Sheets appends a marker to the separate `Deleted Accounts` tab;
it never edits the original chart row. Marker columns are:

```text
Idempotency Key | User ID | Session IDs | Email Hash | Requested At | Processed At | Status | Source
```

The operational Sheet should use `VLOOKUP`, `XLOOKUP`, or equivalent against
the marker tab to mark or exclude deleted accounts. `cancelled_due_to_deletion`
is used for chart-export events that must no longer be delivered.

## Account Deletion Follow-Up

The external update queue is implemented, but destructive internal account
deletion remains a separate `DEL-1` step. Do not connect the mobile Delete
Account action until its confirmation UI and final internal deletion sequence
have passed staging QA. Production activation still requires live Salesforce
sandbox and staging `Deleted Accounts` marker tests.
