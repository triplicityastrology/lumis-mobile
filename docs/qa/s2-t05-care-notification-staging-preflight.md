# S2-T05 Care Circle / Notification Staging Preflight

Status: non-deploying technical control.

Approved staging project ref: `bmqhwofmdgebpcihjlnb`

## Purpose

This package checks that migrations `0032` and `0033`, their legacy
assumptions, and the disposable hosted-test inventory remain complete. The
local command reads repository files only. It does not connect to Supabase,
apply a migration, create a user, call a provider, or change configuration.

```sh
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
pnpm test:s2-foundation-preflight
```

Any other project ref must fail before further work.

## Migration Order And Preconditions

1. Confirm the target is non-production staging.
2. Confirm staging currently ends at migration `0030`.
3. Keep the unapproved internal-deletion migration `0031` in
   `supabase/migration-drafts`.
4. Audit `care_relationships` for legacy `revoked` rows. Migration `0032`
   deliberately stops if any exist because the historical removal actor is
   unknown.
5. Confirm legacy `invitation_token_hash` values are fingerprints, never raw
   codes.
6. Count and privacy-review legacy `notifications` rows before `0033` removes
   participant access to that body-bearing scaffold.
7. Take a staging backup before any separately authorized migration run.
8. Apply `0032` before `0033`; never reorder or partially copy their SQL.

Both migrations are forward-only. Recovery means keeping Care Circle and
Notifications as static previews and applying a later corrective migration.
Neither migration should be removed or reversed as emergency recovery.

## Disposable Hosted Test Package

The machine-readable contract is:

`supabase/tests/0032_0033_disposable_staging_plan.json`

A future credentialed executor must:

- refuse every project except `bmqhwofmdgebpcihjlnb`;
- generate fresh run-scoped users and reject pre-existing IDs;
- record only opaque run IDs and pass/fail assertions;
- run fixture writes in transactions where concurrency permits;
- clean every run-scoped Auth and application row;
- report cleanup failure without selecting unrelated users;
- never print email, token material, code fingerprints, chart/birth data,
  private messages, secrets, or provider payloads.

Required cases cover:

- Care Circle owner projection, anonymous/cross-user denial, Caree-owned code
  authority, six-way acceptance race, idempotency, pause/grace/removal, and
  deletion cascades;
- notification closed registry, registration races, digest conflicts, token
  rotation, logout/revocation/provider-invalid deletion, account deletion, and
  exact 90-day endpoint/audit/request pruning.

## Execution Gate

This task does not supply or run a credentialed executor. Before hosted
execution, PM must separately authorize:

1. staging migration deployment;
2. a disposable-user executor reviewed against the JSON contract;
3. hidden-input staging credentials;
4. migration and function version capture;
5. cleanup and redacted evidence storage.

No provider credential, push delivery, scheduler, UI, camera/QR flow, device
permission, emergency behavior, or Care Circle activation belongs in this
preflight.

## Evidence Record

Store only:

- exact Git commit;
- migration filenames and checksums;
- staging project ref;
- opaque run ID;
- assertion names and pass/fail;
- migration/function versions;
- cleanup count and status.

Do not store user IDs, emails, codes, tokens, private payloads, or SQL row
contents.
