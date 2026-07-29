# S2-T29 Inactive Notification Device Mobile Client

Status: source-only, inactive, and not imported by the app.

`inactiveNotificationDeviceClient.ts` is a pure injected boundary for future
authenticated device-registration operations. It supports only explicit
register, rotate, logout removal, permission-revocation removal, and
provider-token invalidation actions. Construction and validation do not invoke
the port, and there is no background retry.

Raw device tokens are transient request inputs. They are never logged, stored,
echoed, or projected into success or failure results. Results contain only
stable codes, safe endpoint IDs when supplied, replay state, and the closed
registry projection.

The only eligible notification types are `care_circle_check_in` and
`care_circle_reminder`. Both are always represented as disabled. Any unknown
type or backend response claiming activation is rejected safely.

This module has no React, navigation, permission prompt, Expo Notifications,
APNs/FCM/Expo provider, Supabase, direct Edge call, storage, background task,
scheduler, delivery, release caller, or activation path. Notifications and
Care Circle remain unchanged static previews.
