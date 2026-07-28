# Inactive Care Circle Operation Boundary

Status: source-only, not deployed, and not called by the mobile app.

## Boundary

`supabase/functions/care-circle/index.ts` is the sole intended mutation
boundary above migration `0034_reusable_care_pairing_operations.sql`.

- The function verifies the caller through Supabase Auth.
- It never trusts a client-supplied user ID, capability, request digest, code
  fingerprint, relationship state, or active-Carer count.
- It uses a stable `client_request_id` and computes the request digest.
- Mutation RPCs are service-role-only and receive the verified actor ID.
- Participant responses contain only safe IDs, state, expiry, pause, and
  idempotency fields.
- Domain failures use fixed safe messages from `48004` through `48013`.
- No raw database/provider error is returned or logged.

## Reusable Pairing Code

Product and API vocabulary is **pairing code**. The physical
`care_link_codes` table name is a legacy compatibility detail and must not
appear in UI or public API copy.

The Edge boundary deterministically derives a high-entropy twelve-character
pairing code from the verified Caree and stable request ID using a backend-only
HMAC secret. It stores only a separate keyed fingerprint. The raw pairing code
exists only in request memory and the authenticated Caree response.

The same active fingerprint may create separate pending requests for multiple
Carers until its one-hour expiry. It is not marked consumed after use.
Rotation/revocation blocks later uses but does not change pending or active
relationships. Only a Caree acceptance under the capacity lock activates a
relationship.

## Inactive Operations

- Caree creates/rotates or revokes a pairing code.
- Carer submits a pairing code and creates a pending request.
- Caree accepts or declines.
- Caree pauses/resumes existing check-in settings.
- Either relationship participant removes the relationship.

No app caller, code display, QR scanner, reminder, check-in, notification,
delivery provider, scheduler, billing, entitlement UI, or emergency behavior
is activated.

## Configuration And Deployment Gate

The future Edge deployment requires:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CARE_CIRCLE_PAIRING_SECRET` with at least 32 characters

No configuration is added by this source task. Before any staging deployment,
run disposable authenticated PostgreSQL tests for owner/participant isolation,
replay/conflict, reusable-code concurrency, expiry/revocation, six simultaneous
acceptances, pause/remove, and account deletion. Production and app activation
remain prohibited until PM and QA approve those results.

## Forward-Only Recovery

Migration `0034` is forward-only. If staging verification later fails:

1. leave the static preview in place;
2. do not deploy or disable the Edge caller;
3. preserve pairing and relationship audit rows;
4. repair the schema or RPC with a later corrective migration;
5. never restore authenticated access to the older direct mutation RPCs.
