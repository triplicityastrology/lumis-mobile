# S2-T35 Care Circle Staging Test Workbench

Status: inactive, test-only mobile workbench. It is not a release feature.

## Isolation Boundary

The workbench has its own Expo entry under
`apps/mobile/test-workbenches/care-circle-staging`. The release
`apps/mobile/index.ts`, `App.tsx`, normal navigation, and static Care Circle
preview do not import it.

The workbench is fail-closed unless all three conditions are true:

1. `EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1`;
2. the build is a development build;
3. `EXPO_PUBLIC_SUPABASE_PROJECT_REF` exactly equals staging project
   `bmqhwofmdgebpcihjlnb`.

Default and production builds remain disabled. The separate test entry displays
only a blocked state when configuration is unavailable. When enabled, it
requires a real disposable staging email/password session before rendering any
operation. Password input is cleared immediately, and neither credentials nor
account identifiers are returned, logged, or shown after authentication.

The workbench loads the authenticated account's backend capability projection
before enabling Caree or Carer controls. A visual role switch cannot grant a
role the backend has denied. The signed-in strip shows only capability labels,
never an email or account identifier, and supports explicit account switching
through real Supabase sign-out.

## Controlled Test Scope

Every mutation uses the existing `createInactiveCareCircleClient` with explicit
user action and a fresh request ID:

- Caree creates or rotates a reusable pairing code;
- Carer submits the transient code, producing only
  `pending_caree_acceptance`;
- Caree accepts or declines a pending request;
- Caree pauses/resumes Care Circle or removes an accepted Carer.

Pending requests are loaded only on an explicit Refresh action through the
existing participant-safe `list_care_relationships()` projection. A pending
request has no active authority. The display counts accepted Carers against the
transactional backend maximum of five. In the deliberately enabled test
workbench only, the sixth pending
request remains available as a labelled backend-rejection check; it must return
the safe capacity conflict and leave the accepted count at five. Successful
submit, accept, decline, and remove operations immediately reload the safe
projection. Carers can see whether their own relationship is pending or active
and may remove themselves from either state.

## Pairing-Code Safety

The raw code is accepted only as transient Carer input or displayed in the
deliberately enabled Caree workbench after a successful create/rotate result.
It is held in component memory only, cleared on role changes and rotation, and
never logged, persisted, included in errors, analytics, fixtures, snapshots, or
relationship projections. An invalid, expired, replaced, or revoked code maps
to the existing safe unavailable-code result and cannot create a pending
request. A displayed expired code is marked unusable.

## Explicit Exclusions

There is no QR scanner, camera, push notification, scheduler, reminder,
provider setup, payment, entitlement, emergency behavior, analytics, local
storage, release activation, migration, deployment, or automatic/background
retry.

## Future Disposable-Staging Command

Do not run until PM authorizes disposable staging validation. From the active
worktree:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"

set -a
source apps/mobile/.env
set +a

EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1 \
EXPO_PUBLIC_SUPABASE_PROJECT_REF=bmqhwofmdgebpcihjlnb \
PATH="/Users/rubyku/.local/node22/bin:$PATH" \
"/Users/rubyku/.local/node22/bin/pnpm" \
--dir apps/mobile exec expo start \
test-workbenches/care-circle-staging \
--tunnel \
--port 8081 \
--clear
```

This command starts only the separate workbench entry. It does not deploy a
function or migration, configure a provider, create a user, or enable the
release app. Sign in only with disposable staging credentials created under
the separately approved evidence procedure. The real staging workflow remains
unavailable until migrations `0032`, `0033`, `0034` and the reviewed inactive
`care-circle` function have passed their deployment gates.
