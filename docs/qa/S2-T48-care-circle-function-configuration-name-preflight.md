# S2-T48 Care Circle Function Configuration-Name Preflight

Status: inactive, local-only control. It does not inspect an environment,
contact Supabase, deploy a function, or activate Care Circle.

The preflight binds a future temporary-PAT deployment review to staging project
`bmqhwofmdgebpcihjlnb`, the reviewed inactive `care-circle` source checksum, and
exactly four configuration names:

- `CARE_CIRCLE_PAIRING_SECRET`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Only names are supplied. The tool never reads, accepts, prints, hashes, or
compares configuration values. A missing, duplicate, malformed, or extra name
fails closed with one stable `STOP_S2_T48_*` code.

Notification, Expo/APNs/FCM provider, scheduler/cron, billing/payment, Stripe,
and RevenueCat configuration are outside the approved function deployment
scope and must be absent. Passing this local check is not evidence that remote
configuration exists and does not authorize deployment.

```bash
pnpm test:s2-care-circle-function-config-preflight
```
