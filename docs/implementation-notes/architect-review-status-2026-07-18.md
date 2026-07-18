# Architect Review Technical Status

This handoff reconciles `AC-ADMIN-11` with the repository state on 2026-07-18.
"Source complete" does not mean hosted or production QA is complete.

| # | Architect item | Status | Evidence and remaining risk |
|---|---|---|---|
| 1 | Apply and staging-QA `0015` and `0016` | Deployed, hosted QA incomplete | `supabase/migrations/0015_entitlement_provider_privacy.sql` and `0016_trusted_birth_location_resolver.sql` have staging parity, and `/profile` was redeployed. `pnpm test:billing-entitlement`, `test:birth-location`, and anonymous denial checks pass. The privileged owner/cross-user/spoof suite still needs a dedicated staging secret key. |
| 2 | Astrology provider timeout | Deployed, signed live QA pending | `workers/chart-mobile/worker.js` aborts astrology-api.io after a bounded `ASTRO_PROVIDER_TIMEOUT_MS`; `pnpm test:worker` covers controlled `504 ASTROLOGY_API_TIMEOUT`. Staging Worker version `4b60a581-0dc4-4259-9060-2b174f2afd58` has the 12-second setting. Run the signed live smoke with hidden credentials. |
| 3 | Signed chart replay/idempotency | Deployed, signed live QA pending | The Worker uses `CHART_REQUEST_COORDINATOR`, keyed by user/request ID and signed-body digest. Exact replays return the saved chart; changed-body reuse returns `CHART_REQUEST_CONFLICT`. Local Worker fixtures pass and the staging binding is deployed. Durable Object storage size, replay, and concurrency still need the signed live smoke. |
| 4 | Fail closed for missing/invalid `LUMIS_ENV` | Deployed; configuration fixture passed | `workers/chart-mobile/worker.js` accepts an explicit environment allowlist only. Worker fixtures prove missing/unknown values skip provider access. Staging deploy exposes explicit `LUMIS_ENV=staging`; an unsigned live call returned `401 UNAUTHORIZED`. |
| 5 | Append-only provider-event ledger | Source complete, migration pending | `supabase/migrations/0017_persona_policy_and_entitlement_events.sql` adds backend-only `entitlement_provider_events` and an idempotent, ordered apply RPC. `pnpm test:billing-entitlement` passes. Apply `0017`, then run hosted duplicate/out-of-order/RLS checks before RevenueCat. |
| 6 | Keep Chat scaffold/no-charge | Complete for current scaffold | `supabase/functions/chat-message/index.ts` returns `scaffold_no_charge` and `credits_charged: 0`; transactional persistence is in migration `0011`. Real AI routing, atomic charging, refund/idempotency, and RevenueCat entitlement enforcement remain blocked. |
| 7 | Golden chart references | Not complete | `packages/astrology/src/golden-charts.ts` has four structurally validated cases, all `pending_reference`. `pnpm test:golden` verifies shape and unknown-time restrictions, not astronomical accuracy. Trusted independent expected positions are still required. |
| 8 | Birthplace resolver beta policy | Closed test scope implemented; beta decision open | `0016` intentionally resolves Hong Kong, London, and New York only. `/profile` ignores spoofed client coordinates/timezone and uses canonical rows. This is suitable for controlled technical testing, not a broad beta. Recommendation: implement a production geocoding plus historical-timezone resolver before external beta. PM must confirm scope. |
| 9 | External-sync schedules | Recovery source complete; schedules intentionally inactive | `0012`, `0013`, `external-sync-retry`, and `docs/setup/external-sync-recovery.md` implement hourly retry, daily reports, final failure, and replay. No schedule should be activated while `EXTERNAL_SYNC_ENABLED` and destination credentials remain disabled. Staging schedules and live destination QA remain required after UI testing. |
| 10 | Misleading Care Circle max-five index | Source complete, migration pending | `0018_remove_misleading_care_max_index.sql` removes the falsely named redundant index and documents that the remaining index only prevents duplicate pairs. `pnpm test:care-circle` passes. A real maximum must be transactional when the Care Circle backend is built. |
| 11 | Keep Delete Account disconnected | Complete for current UI | `apps/mobile/src/screens/LumisProfileScreen.tsx` shows a pending-security notice and does not invoke the destructive endpoint. External cleanup scaffolding is not internal DEL-1 deletion. Recent-auth and hosted deletion QA remain gates. |
| 12 | Split `App.tsx` and introduce navigation | Not complete; implementation sequence defined | `App.tsx` still owns a string-based screen state. Before major feature expansion: add a proven native navigation library, move onboarding and account flows into stacks, retain the four primary tabs, add typed route params/deep links, then move remaining inline screens into modules. Restore/back/deep-link/device tests are required during the refactor. |

## Verification Commands

```bash
pnpm typecheck
pnpm test:router
pnpm test:birth-date
pnpm test:birth-location
pnpm test:entitlement
pnpm test:billing-entitlement
pnpm test:care-circle
pnpm test:profile
pnpm test:golden
pnpm test:chat-persistence
pnpm test:external-sync
pnpm test:worker
pnpm test:mobile-ui
```

All commands passed locally for this source state. Wrangler `deploy --dry-run`
also packaged both Durable Object bindings successfully. The Expo production
export was attempted again but Metro stalled at 0% in the Codex process; the
previous QA export for the current mobile source passed, and this batch does not
change mobile runtime source.

## Do Not Mark Complete

Real AI chat, real charging, RevenueCat webhooks, Care Circle backend, internal
account deletion, golden-chart accuracy, production place/timezone resolution,
live Salesforce/Google Sheets QA, and production go-live remain open.
