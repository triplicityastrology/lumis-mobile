# S2-T33 Preview Capability Boundary

Status: inactive source foundation only.

## Reachable Preview Versus Active Capability

A **reachable preview** is an existing screen, route, or piece of static copy
that remains visible solely for founder and design review. Reachability does
not grant authority to calculate, retrieve, deliver, charge, schedule, notify,
or enforce anything.

An **active capability** has separately approved product authority and a
reviewed operation path. It may execute only after its data source, security,
privacy, failure behavior, testing, and activation gates are approved. No
active capability is created by S2-T33.

## Registered Inactive Previews

- `weekly_sky`
- `astrology_timing`
- `advanced_astrology`
- `care_circle`
- `notifications`

All are represented as `reachable_preview`, `inactive`, and
`designReviewOnly`. Their allowed live-operation list is empty.

Solar Return is not a preview: it remains permanently out of scope. Dice is a
separate product surface and is not registered in this astrology/preview
boundary.

## Fail-Closed Operations

`guardPreviewOperation` denies every registered attempt to:

- call an astrology or AI provider;
- calculate timing or transits;
- retrieve AI or Knowledge Bank content;
- charge credits or enforce an entitlement;
- schedule work;
- send or act on a notification;
- perform a Care Circle operation.

Malformed requests, unknown surfaces, unknown operations, and extra fields
also fail closed with stable non-echoing codes. The boundary invokes no
callback and has no network, storage, provider, scheduler, billing, or UI
dependency.

## Integration State

The module has no mobile caller. Existing preview screens, copy, visual design,
and navigation remain unchanged. Care Circle and Notifications remain static
previews. Future code must not infer activation from route visibility or from
the presence of internal route, entitlement, fixture, or preview metadata.

No deployment, migration, staging action, provider/model call, Chat/AI
integration, billing change, notification action, Care Circle activation, or
Dice change is authorized by this foundation.
