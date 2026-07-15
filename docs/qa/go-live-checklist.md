# Lumis QA Release Gate Checklist

Last reviewed: 2026-07-14

This is the canonical living checklist for staging deployment, founder UI QA, and production go-live. A reported result is not marked complete until QA independently verifies it or records the staging evidence.

Status rules:

- `[x]` independently verified.
- `[ ]` not yet verified or not yet available.
- A deferred feature is not a pass. PM must explicitly exclude it from the release or keep the release blocked.
- Staging-only fixture behavior must never be accepted as production chart behavior.

## Independently Verified So Far

- [x] Workspace TypeScript typecheck passes.
- [x] Chat router fixture tests pass.
- [x] Golden-chart fixture guard tests pass.
- [x] Profile onboarding guard fixture tests pass.
- [x] Unknown-time golden guards reject Ascendant, MC, houses, and planet house placements.
- [x] Local Worker fixture tests accept valid signatures and reject invalid signatures before the provider call.
- [x] Local Worker fixture tests cover full-time output and unknown-time sanitization.
- [x] Current source preflight-rejects complete duplicate profiles before the paid Worker call.
- [x] Current source strips raw provider output and stores only an approved Worker-response summary.
- [x] Current source permits fixture fallback only in explicit non-production environments and otherwise fails closed.
- [x] Mobile and Supabase source do not call `astrology-api.io` directly; only the Cloudflare Worker template does.
- [x] Current source persists signed-in scaffold chat turns to Supabase with `credits_charged = 0` / `scaffold_no_charge`.
- [x] Transactional onboarding creates profile data and one Starter grant in the deployed staging version previously tested.
- [x] Repeat onboarding returns `PROFILE_ALREADY_EXISTS` in the deployed staging version previously tested.
- [x] Exactly one `starter_onboarding` grant exists for the tested account.
- [x] Cross-user RLS blocked access to tested birth data, AI profile, chat thread, and chat message rows.
- [x] Scaffold chat reports an estimated cost with `credits_charged = 0`.
- [x] Scaffold chat leaves the tested Starter balance unchanged.
- [x] Authentication API refresh, sign-out, and sign-back-in succeeded for the temporary QA account.
- [x] Source scan found no visible legacy wording matches for `Astro`, `token`, `unit`, or `chat history` in the tested mobile/shared paths.
- [x] Local Expo web app responded with HTTP 200 during the latest smoke checks.

## Gate A — Before Pushing or Deploying to Staging

- [ ] Push all intended commits and confirm local `main` is not ahead of `origin/main`.
- [ ] Confirm the worktree contains no unrelated or uncommitted changes.
- [ ] Run and record:
  - [x] `pnpm -r typecheck`
  - [x] `pnpm run test:router`
  - [x] `pnpm run test:golden`
  - [x] `pnpm run test:worker`
  - [x] `pnpm run test:profile`
- [x] Confirm no real secrets, API keys, access tokens, service-role keys, or QA passwords are tracked by Git; only documented placeholders are present.
- [ ] Review migration `0008_onboarding_chart_history.sql` against a disposable/staging database backup plan.
- [x] Confirm migration order `0001` through `0008` is complete and recorded in staging.
- [x] Confirm Edge Function environment is explicitly `staging`; missing `LUMIS_ENV` behaves as production. Cloudflare Worker staging configuration remains open.
- [x] Add staging Edge Function/RPC integration coverage proving a complete profile with a Starter grant returns `PROFILE_ALREADY_EXISTS` without calling the Worker.
- [x] Add staging Edge Function/RPC integration coverage proving a legacy profile missing its Starter grant is repaired without calling the Worker or changing its existing user, birth, chart, or recovery metadata.
- [x] Ensure legacy repair uses saved birth/chart data; it must not return or record incoming birth/chart contract fields.
- [x] Ensure legacy repair does not reset saved `display_name`, `buddy_name`, `persona_style`, or internal `role`; the repair-only RPC branch returns before the general user upsert.
- [x] Remove the unused recovery audit payload and claim; repair passes no `p_raw_chart_json` metadata.
- [x] Allow legitimate first/partial onboarding to replace a placeholder display name while keeping the repair branch isolated from all user settings.
- [x] Sanitize the saved chart before any legacy repair copies it into `birth_data_history`; staging audit confirms current active profile/history chart data contains no `rawProviderResponse`.
- [ ] Add Edge Function-level tests for production fail-closed behavior, allowed staging fixture fallback, and Supabase-side raw-provider sanitization. Shared helper tests are complete.
- [x] Make scaffold chat thread creation, user-message insert, assistant-message insert, and thread update one atomic database transaction/RPC.
- [x] Require the active profile/chart version for chat persistence; do not silently fall back to the latest inactive profile.
- [x] Build persisted chart context from the server-side active profile rather than trusting client-supplied chart context.
- [x] Return a safe persistence error code to clients instead of raw database error messages.
- [x] Keep `force_new_thread` active until Supabase confirms the new thread was created, including after a first-message persistence failure.
- [ ] Complete database-backed chat retry/idempotency and real concurrency tests. Staging coverage now passes append, force-new-thread, invalid-turn rollback, active-profile enforcement, and no-charge invariants.

## Gate B — After Staging Deployment, Before Founder UI QA

These checks require deployed staging services but do not require finished UI.

### Database and onboarding

- [x] Apply migration `0008_onboarding_chart_history.sql` successfully in staging.
- [x] Apply migration `0009_chat_turn_persistence_rpc.sql` successfully in staging.
- [x] Confirm each existing chart user has exactly one active `ai_profiles` row (2 staging users audited on 2026-07-15).
- [x] Confirm each existing chart user has exactly one active `birth_data_history` row (2 staging users audited on 2026-07-15).
- [x] Confirm active AI profile and active history share the same `chart_version`.
- [x] Confirm `birth_data.active_chart_version` matches the active AI profile/history.
- [x] Confirm the active AI profile has a non-null `birth_data_history_id` pointing to the active history.
- [ ] Confirm the existing QA profile was backfilled without changing its saved birth data or chart.
- [x] Create a legacy partial case with birth data and AI profile but no Starter grant; confirm onboarding repairs the missing grant/history linkage without a Worker/provider call or chart overwrite.
- [x] Onboard a fresh staging user and confirm the response includes:
  - [x] `chart_version = 1`
  - [x] non-null `birth_data_history_id`
  - [x] non-null `ai_profile_id`
- [x] Repeat onboarding for the same user and confirm no additional birth data, history, AI profile, or Starter grant is created.
- [ ] Run concurrent onboarding attempts and confirm one successful transaction and no duplicate Starter/history/profile rows.
- [ ] Force Worker failure and confirm `CHART_WORKER_FAILED` with no partial user profile, birth data, history, AI profile, or Starter grant rows.

### Signed Worker contract

- [ ] Deploy the mobile Worker endpoint to staging.
- [ ] Configure matching `CHART_WORKER_SIGNING_SECRET` values in Supabase and Cloudflare.
- [ ] Configure `CHART_WORKER_URL`, `CHART_WORKER_ENDPOINT`, timeout, and `LUMIS_ENV=staging`.
- [ ] Confirm a valid signed request succeeds.
- [ ] Confirm invalid, missing, and expired signatures are rejected before the provider call.
- [ ] Confirm request timestamp, request ID, user ID, calculation version, environment, and birth fields arrive correctly.
- [x] Confirm repeat onboarding is rejected before any Worker/provider call.
- [ ] Confirm Worker timeout and provider error return controlled failures without provider debug details.
- [ ] Confirm Worker response and stored `chart_v2` contain no `rawProviderResponse`.
- [ ] Confirm stored backend metadata contains only the approved response summary.
- [ ] Confirm production-mode missing Worker configuration fails closed and never saves fixtures.
- [x] Confirm fixture fallback works in explicitly configured staging; source tests cover the allowed environment list and production fail-closed behavior.
- [ ] Confirm CORS behavior is restricted to the intended origin and is not relied on for server-to-server security.

### Chart data and version routing

- [ ] Populate the four golden cases with expected values captured from the already-verified website/Worker output.
- [ ] Mark golden cases `ready` only after expected values are populated.
- [ ] Compare live Worker `chart_v2` output against the golden cases.
- [ ] Verify Hong Kong full-time output.
- [ ] Verify Hong Kong unknown-time output.
- [ ] Verify London DST conversion and output.
- [ ] Verify New York DST conversion and output.
- [ ] Confirm unknown-time output has no Ascendant, MC, houses, or planet house placements end to end.
- [ ] Confirm full-time output retains expected Ascendant, MC, houses, and placements.
- [ ] Confirm mobile account restore selects the active chart version, not merely an older or newer inactive profile.
- [ ] After a successful regeneration, confirm future chats use the new active chart version.
- [ ] Confirm Past Reflections retain their original `chart_version` and are never rerouted to a different historical chart.

### Security and RLS

- [x] Re-run cross-user RLS checks for `birth_data`, `birth_data_history`, and `ai_profiles`.
- [x] Confirm authenticated users cannot read `migration_reports`.
- [x] Confirm authenticated users cannot invoke backend-only onboarding RPCs directly.
- [x] Confirm active profile/history data and profile responses contain no `rawProviderResponse`; full live Worker metadata verification remains open until Worker deployment.
- [ ] Confirm service-role and Worker signing secrets are present only in backend secret stores.

## Gate C — When the Founder/User UI Is Ready

- [ ] Complete the same-email magic-link flow in the real UI: sign out, sign in, follow the link, reload/reopen, and confirm session restoration.
- [ ] Confirm Founder test status says `Supabase profile loaded` for an account with a chart.
- [ ] Confirm the birth-chart card says it loaded from Supabase staging, not local demo.
- [ ] Confirm Reload restores the same active chart and balance.
- [ ] Confirm Past Reflections displays saved Supabase reflections or clearly states that none exist.
- [ ] Confirm Open Lumis chat uses the restored Supabase profile and scaffold no-charge label.
- [ ] Try chart creation again and confirm the UI explains that a chart already exists without showing a generic Edge Function error or raw backend code.
- [ ] Compare mobile chart display side by side with the existing website for the same test inputs.
- [ ] Confirm unknown-time UI hides ASC, MC, houses, and house-dependent interpretations.
- [ ] Confirm full-time UI renders the expected planets, signs, degrees, ASC, MC, and houses.
- [ ] Confirm there is no visible legacy wording: `Astro`, `token`, `unit`, or `chat history`.
- [ ] Confirm signed-in restore never falls back to a misleading `local demo` label.
- [ ] Test loading, empty, offline, timeout, Worker failure, and duplicate-profile error states.

## Gate D — Before Production Go-Live

- [ ] Repeat all Gate B checks in a production-like pre-release environment with production behavior enabled.
- [ ] Confirm production secrets and URLs are separate from staging.
- [ ] Confirm production cannot save fixture charts under any missing-secret or failure condition.
- [ ] Confirm observability records request IDs and safe summaries without birth details, secrets, or raw provider payloads.
- [ ] Complete integration and concurrency coverage for onboarding, credits, RLS, chart history, and regeneration.
- [ ] Complete automated forbidden-terminology and bilingual-copy checks.
- [ ] Document rollback procedures for migrations, Edge Functions, and Worker deployment.
- [ ] Record final QA evidence, date, environment, commit SHA, migration version, Worker version, and approver.

### Features that must be completed or explicitly excluded by PM

- [ ] Full CHAT-1 to CHAT-4: JWT enforcement, entitlement gate, atomic credit deduction, persistence, usage records, and idempotency.
- [ ] PROF-2 birth-detail change endpoint: three successful-change limit, error codes `49001`/`49002`/`49003`, atomic regeneration, and rollback behavior.
- [ ] Care Circle backend: paid gate, QR/link flow, maximum five active carers, pending/active lifecycle, and carer RLS boundary.
- [ ] Production chat/thread/history persistence and message-usage accounting.
- [ ] Full bilingual copy layer and automated terminology scan.
- [ ] Integration/concurrency tests for credits, PROF-2, Care Circle, chart version routing, and RLS.

## Final Release Decision

- [ ] Technical owner confirms deployment configuration.
- [ ] QA confirms every applicable required item is checked with evidence.
- [ ] PM explicitly accepts or removes every deferred item.
- [ ] Founder/product owner approves the final UI smoke test.
- [ ] Production release is authorized.
