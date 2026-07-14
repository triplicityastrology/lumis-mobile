# QA remediation status - 2026-07-14

## Scope

This pass covers the technical scaffold and QA remediation work before the first hosted Supabase staging deployment.

## Source-level status

- Deep chart reading is gated from Lumis Essential upward, not Starter.
- Birth-detail editing is represented as a controlled chart/profile regeneration policy in UI and schema scaffold.
- Starter onboarding grant is protected by a one-time database guard.
- Profile onboarding writes now go through `complete_profile_onboarding`, so user, birth data, AI profile, and Starter grant commit together.
- Legacy duplicate Starter grant rows are quarantined by migration `0005`, with report rows written to `migration_reports`.
- `migration_reports` is locked to backend/service-role access, with a forward hardening migration in `0007` for environments where `0005` was already applied.
- Chat scaffold explicitly reports estimated cost/no-charge mode and must not be treated as real billing.
- User-facing terminology fixes are in place for Lumis/Past Reflections in the scaffold screens.

## Verified locally

- Workspace TypeScript typecheck passed.
- Router fixture tests passed.
- Local Expo web server responded with `HTTP 200` on `http://localhost:8081` after launching outside the sandbox.
- No tracked `.env`, Supabase access token, service-role value, Apple/Google credentials, or API keys were found before push. Search hits were placeholders, code variable names, or non-secret schema fields.

## Not completed in this stage

- Hosted Supabase migrations have not yet been applied in this pass.
- Supabase Edge Functions have not yet been deployed in this pass.
- SQL migrations/RPC have been statically reviewed but not executed against a staging Postgres database in this pass.
- Real chat credit charging, `message_usage`, entitlement enforcement, and idempotent chat persistence remain future backend work.
- PROF-2 `/profile/birth-details/change` endpoint remains future backend work.
- Real signed Cloudflare chart worker integration remains future backend work.
- Care Circle backend enforcement remains future backend work.

## Next recommended step

Push the current repo state to GitHub, then deploy migrations `0003` through `0007` and Edge Functions to staging Supabase only. Run a signed-in smoke test before any production deployment.
