# S2-T28 Inactive Care Circle Mobile Client Boundary

Status: source-only, inactive, and not imported by the app.

`inactiveCareCircleClient.ts` is a pure injected adapter for the existing
inactive Care Circle Edge contract. Construction performs no work. A future
caller must provide both an injected port and explicit user-action data for
every operation.

The closed operation set covers pairing-code creation/rotation, pairing-code
submission, Caree acceptance/decline, pause/resume, and participant removal.
Pairing-code submission can return only `pending_caree_acceptance`; activation
requires a separate Caree acceptance.

Raw pairing codes are transient. They may enter one explicit submit request or
the immediate successful create/rotate response. They are not stored, logged,
included in failures, or returned by any later operation. Backend and transport
details are reduced to stable, non-echoing client codes and fixed messages.

This module has no React or navigation import, Supabase client, direct Edge
call, storage, background retry, release caller, code/QR interface, reminder,
notification, billing, entitlement, emergency, or activation behavior. The
release Care Circle screen remains an unchanged static preview.
