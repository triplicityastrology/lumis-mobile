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

## Activation Gate

Do not set `EXTERNAL_SYNC_ENABLED=true` until all of these are true:

- Salesforce credentials point to staging/sandbox.
- Google credentials point to a separate staging Sheet.
- `EXTERNAL_SYNC_CRON_SECRET` is configured.
- Migration `0012_external_sync_delivery_ledger.sql` is applied.
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
```

Manual replay preserves the same idempotency key. It resets the automatic
attempt window and increments `manual_replay_count`.

## Account Deletion Follow-Up

Salesforce account-deletion propagation and the final Google policy (delete,
anonymise, or mark deleted) remain a separate implementation gate. Production
activation must not proceed until that policy and its external audit log pass QA.
