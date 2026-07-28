# Inactive Shared Notification Foundation

Status: source-only and inactive.

## Boundary

Migration `0033_inactive_notification_foundation.sql` follows the inactive Care
Circle foundation. It creates encrypted device-registration storage,
content-free audit metadata, opt-out-only preferences, and a closed
notification-type registry.

Only these registry keys exist:

- `care_circle_check_in`
- `care_circle_reminder`

Both are constrained to `enabled = false`. No marketing, billing, payment, AI,
generic, emergency, urgent-response, or carer-acknowledgement type is accepted.

The `notification-device` Edge Function is source only and is not deployed. It
has no provider API call, notification-send operation, delivery queue,
permission request, or scheduler. The release Notifications and Care Circle
screens remain static previews.

## Privacy And Lifecycle

- The backend accepts a provider token only over an authenticated request.
- Before persistence, it creates a SHA-256 lookup fingerprint and encrypts the
  token with a backend-only 256-bit AES-GCM key.
- Raw provider tokens, notification bodies, private content, emails, birth
  details, charts, and messages are absent from audit storage.
- Registration is idempotent by authenticated user and request ID.
- Token rotation is serialized by installation ID.
- Logout, permission revocation, invalid-provider response, and account
  deletion use immediate-delete contracts.
- Account deletion also has a foreign-key cascade fail-safe.
- Endpoints inactive for 90 days are removed by a service-only maintenance
  primitive.
- Registration requests and content-free audit metadata are retained for at
  most 90 days.
- Account deletion nulls the audit user reference while preserving only
  minimal operational evidence until expiry.

## Forward-Only Recovery

Migration `0033` is forward-only. If staging uncovers a defect:

1. keep both release screens in preview mode;
2. do not deploy the Edge Function;
3. keep every registry row disabled;
4. do not create provider credentials, delivery queues, or schedules;
5. apply a later corrective migration.

## Verification Boundary

`pnpm test:notification-foundation` is a source/migration contract. This task
does not execute the migration, deploy the Edge Function, register a real
device, request permission, or contact Expo, APNs, or FCM.

Before a staging deployment is authorized, prepare:

- a migration backup and legacy `notifications` row audit;
- a backend-only 32-byte token-encryption secret;
- disposable owner, second-user, and anonymous RLS tests;
- concurrent registration, exact replay, changed-digest conflict, token
  rotation, logout, permission-revocation, and account-deletion tests;
- 90-day endpoint and audit pruning tests with a controlled database clock;
- explicit PM activation approval for each registry type;
- a separate provider/delivery implementation and safety review.

There is no scheduler and no delivery guarantee. Future Care Circle delivery
must never be described as an emergency or urgent-response service.
