# Care Circle Backend Foundation

Status: inactive source foundation only.

## Migration Order

1. Existing deployed head remains `0030_safe_salesforce_deletion_subject_json.sql`.
2. `0031` remains reserved by the unapproved DEL-1 draft in
   `supabase/migration-drafts`.
3. `0032_care_circle_backend_foundation.sql` corrects consent direction,
   protects relationship storage, and adds inactive code, settings, round,
   capability, idempotency, limit, and deletion foundations.
4. `0033_inactive_notification_foundation.sql` adds inactive registration
   storage without delivery.
5. `0034_reusable_care_pairing_operations.sql` adds service-only atomic
   operations for the reusable one-hour Caree pairing-code model.
6. No Care Circle caller, scheduler, delivery path, or UI may be activated
   until hosted database and device acceptance passes.

## Forward-Only Recovery

Migration `0032` is forward-only. It must not be removed or reversed as an
emergency response.

If a staging defect is found:

1. keep the release app on the static preview;
2. do not deploy or enable callers for the new RPCs;
3. preserve the corrected `pending_caree_acceptance` direction;
4. preserve all relationship and audit rows;
5. apply a later corrective migration;
6. never recreate the misleading maximum-five index.

The migration deliberately fails when a legacy `revoked` relationship exists,
because the old row does not identify whether the Caree or Carer removed it.
Those rows require a redacted manual audit and an explicit corrective mapping
before migration.

## Source-Level Guarantees

- The Caree owns code material; only keyed fingerprints are stored.
- Product and API language uses **pairing code**. The physical
  `care_link_codes` name remains only for forward schema compatibility.
- A pairing code has a one-hour validity ceiling, may create separate pending
  requests for multiple Carers, and remains reusable until expiry, rotation,
  or revocation.
- Pairing-code use never grants access. Only the Caree's transactional
  acceptance activates a relationship.
- Expiry, rotation, or revocation blocks later uses without changing existing
  pending or active relationships.
- Pairing-code rows have a 90-day backend retention marker.
- Sensitive relationship, code, round, idempotency, event, and error tables
  are server-only.
- Authenticated users receive relationship data only through a safe projection.
- Caree capability is resolved from backend account mode and entitlement.
- Acceptance serializes by Caree and counts active relationships under the same
  transaction before allowing a fifth-or-lower active link.
- Pause is stored in Caree settings. Grace is stored in check-in rounds.
- Account-owned operational rows use cascading user foreign keys.
- Removing one Carer does not close a Caree round while another active Carer
  remains.
- `0034` revokes authenticated access to the older direct acceptance/removal
  RPCs. Its mutation RPCs are service-only and intended solely for the inactive
  authenticated Edge boundary.

## Verification Boundary

`pnpm test:care-circle-backend` is a source/migration contract. PostgreSQL RLS,
advisory-lock concurrency, migration backfill, and five-carer race scenarios
are intentionally not executed locally because this task authorizes no
database deployment and the workspace has no disposable PostgreSQL target.

Before staging deployment, prepare:

- a backup and row-count audit for `care_relationships`;
- confirmation that no legacy `revoked` rows exist, or an approved mapping;
- a disposable two-user and six-concurrent-Carer hosted test;
- direct anonymous, owner, participant, and unrelated-user RLS tests;
- deletion cascade evidence;
- a forward corrective migration and last-known-safe function recovery plan.

No notification, reminder, QR/camera, emergency, or active Care Circle behavior
is created by this foundation.
