# Lumis QA Release Gate Checklist

Last reviewed: 2026-07-16

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
- [x] Production web export succeeds for commit `e90ea99`.
- [ ] Restore the local Expo preview before visual QA; `http://localhost:8081/` again returned connection refused during QA of `e90ea99` despite the handoff saying it returned HTTP 200.

## Gate A — Before Pushing or Deploying to Staging

- [x] Confirm intended commits are pushed; `e46f8ed`, `e90ea99`, and the checklist-only follow-up `d83b84e` are on `origin/main`.
- [x] Confirm the worktree contains no unrelated or uncommitted changes before this QA checklist update.
- [ ] Run and record:
  - [x] `pnpm -r typecheck`
  - [x] `pnpm run test:router`
  - [x] `pnpm run test:golden`
  - [x] `pnpm run test:worker`
  - [x] `pnpm run test:profile`
  - [x] `pnpm run test:chat-persistence`
  - [x] `pnpm run test:external-sync`
  - [x] `pnpm run test:mobile-ui`
- [x] Confirm no real secrets, API keys, access tokens, service-role keys, or QA passwords are tracked by Git; only documented placeholders are present.
- [ ] Review migration `0008_onboarding_chart_history.sql` against a disposable/staging database backup plan.
- [x] Confirm migration order `0001` through `0010` is complete and recorded in staging.
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
- [x] Apply migration `0010_strip_legacy_raw_provider_response.sql` successfully in staging and verify its history-write guard with an injected disposable payload.
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

- [x] Deploy the dedicated `lumis-chart-staging` mobile Worker endpoint.
- [x] Configure matching `CHART_WORKER_SIGNING_SECRET` values in Supabase and Cloudflare.
- [x] Configure `CHART_WORKER_URL`, `CHART_WORKER_ENDPOINT`, timeout, and `LUMIS_ENV=staging`.
- [x] Confirm a valid signed request succeeds through Supabase, Cloudflare, and astrology-api.io.
- [x] Confirm invalid, missing, and expired signatures are rejected before the provider call.
- [x] Confirm signed request/body identity checks and the mobile calculation contract are enforced.
- [x] Confirm repeat onboarding is rejected before any Worker/provider call.
- [ ] Confirm Worker timeout and provider error return controlled failures without provider debug details.
- [x] Confirm the live Worker response and stored `chart_v2` contain no `rawProviderResponse`.
- [x] Confirm the live full-time chart contains populated planets, 12 houses, Ascendant, and MC.
- [x] Confirm stored backend metadata contains only the approved response summary.
- [ ] Confirm production-mode missing Worker configuration fails closed and never saves fixtures.
- [x] Confirm fixture fallback works in explicitly configured staging; source tests cover the allowed environment list and production fail-closed behavior.
- [x] Confirm CORS behavior is restricted to the intended origin and is not relied on for server-to-server security.

### Chart data and version routing

- [ ] Populate the four golden cases with expected values captured from the already-verified website/Worker output.
- [ ] Mark golden cases `ready` only after expected values are populated.
- [ ] Compare live Worker `chart_v2` output against the golden cases.
- [ ] Verify Hong Kong full-time output.
- [ ] Verify Hong Kong unknown-time output.
- [ ] Verify London DST conversion and output.
- [ ] Verify New York DST conversion and output.
- [ ] Confirm unknown-time output has no Ascendant, MC, houses, or planet house placements end to end.
- [ ] Inspect the actual signed Cloudflare Worker response for every unknown-time integration case: no Ascendant/ASC, no MC/Medium Coeli, empty or absent houses, and no planet house placements.
- [ ] Confirm prompts, stored context, and AI responses make no claims based on Ascendant, MC, houses, or planet house placements when birth time is unknown.
- [ ] Confirm full-time output retains expected Ascendant, MC, houses, and placements.
- [ ] Confirm mobile account restore selects the active chart version, not merely an older or newer inactive profile.
- [ ] After a successful regeneration, confirm future chats use the new active chart version.
- [ ] Confirm Past Reflections retain their original `chart_version` and are never rerouted to a different historical chart.

### Chat and Past Reflections

- [ ] Apply migration `0011_explicit_reflection_thread.sql` and redeploy `chat-message` to staging.
- [x] Source restore selects only an active `ai_profiles` row and has no inactive-profile fallback.
- [x] Source loads up to 20 owned Past Reflection threads and can request an exact selected thread.
- [x] Transactional RPC checks selected-thread ownership, active status, and exact active `chart_version` before appending.
- [ ] Preserve safe RPC error codes such as `REFLECTION_THREAD_NOT_AVAILABLE` through the Edge response and show a clear unsaved/error state in mobile; source now handles safe codes, but mobile must also reject every `persistence_mode = not_persisted` response when `persistence_error` is null.
- [x] Keep inactive or older-chart threads visible as explicitly read-only; only active threads matching the current chart version may continue.
- [ ] Staging-test latest-thread continuation, selected-thread continuation, new-topic creation, cross-user rejection, chart-version rejection, and no partial messages on failure.
- [ ] Confirm the restored 20-thread/turn query pattern performs acceptably on mobile networks and does not expose another user's messages through RLS.

### Security and RLS

- [x] Re-run cross-user RLS checks for `birth_data`, `birth_data_history`, and `ai_profiles`.
- [x] Confirm authenticated users cannot read `migration_reports`.
- [x] Confirm authenticated users cannot invoke backend-only onboarding RPCs directly.
- [x] Confirm live Worker responses, active profile/history data, and profile responses contain no `rawProviderResponse`.
- [x] Confirm service-role, provider, and Worker signing secrets are present only in backend secret stores and are not tracked in Git.

### Salesforce and Google Sheets operational logging

- [ ] Apply migration `0012_external_sync_delivery_ledger.sql`, deploy `external-sync-retry`, and deploy the updated Worker to staging with external delivery disabled.
- [ ] Apply migration `0013_account_deletion_external_sync.sql` and deploy the authenticated `account-deletion-request` function to staging without connecting the destructive mobile Delete Account action.
- [x] PM approves Salesforce and Google Sheets as destinations and the operational field allowlist: email, name, birth date/time/place/timezone, chart/session ID or URL where applicable, plan/tier, paid amount where applicable, user ID, chart status, `time_unknown`, source, marketing consent, chart type, and operational notes/error status.
- [ ] Document retention periods for each approved external field and destination; PM has approved the MVP deletion mechanism below.
- [x] Make `audit` required in the shared signed-Worker contract and update the live Worker smoke request to include the required audit payload.
- [x] Do not send raw provider responses, complete chart JSON, access tokens, signing secrets, service-role keys, or provider keys; source uses an explicit audit-record projection and rejects `rawProviderResponse` recursively.
- [x] Restrict outbound fields to the PM-approved allowlist; do not treat approval as permission to send fields that are unnecessary for a given destination or flow.
- [ ] Keep Salesforce and Google credentials only in Cloudflare secret storage.
- [ ] Use a Salesforce sandbox/staging destination and separate staging Google Sheet, with explicit environment/source labels during QA.
- [x] Keep logging non-blocking: Salesforce/Sheets timeout or failure must not fail, delay, or roll back successful chart generation/onboarding.
- [x] Add request-ID idempotency so concurrent Worker retries cannot create duplicate Cases or Sheet rows; the Durable Object reserves each destination independently.
- [x] Replace the terminal at-most-once failure state with backend-only `external_sync_events` records containing event/user/chart IDs, destination, idempotency key, status, attempt count/timestamps, safe last error, and external record reference.
- [ ] Complete the notice-mandated ledger schema with `resolved_by` and `resolved_at`, and add the `cancelled_due_to_deletion` status; document whether internal `processing` remains as an additional transient status.
- [x] Implement safe automatic retries using the same idempotency key: immediate, approximately +1 hour, and +3 hours, then `failed_final` after three failed attempts.
- [x] Add source-level daily reporting plus a service-role-only admin report/replay script; replay preserves the original idempotency key.
- [ ] Configure authenticated hourly retry and daily report schedules in staging and verify their execution history.
- [ ] QA-simulate against staging: transient failure, successful retry without duplicates, exhausted retries, visible final/manual-review state, and safe manual replay. Local contract/Worker fixtures pass.
- [x] Redact downstream response bodies and diagnostics from client responses and ordinary logs.
- [x] Add fixture tests for success, timeout, authentication failure, rate limiting, malformed response, redaction, duplicate concurrency, and destination failure isolation.
- [ ] Run a live staging test with both integrations enabled and verify exactly one correctly redacted Case and Sheet row, then clean up the disposable records; a hosted chart smoke test while credentials are absent does not verify these integrations.
- [x] Keep all Salesforce/Google credentials disabled until staging delivery, retry, idempotency, reporting, and manual recovery pass QA.
- [x] Source implementation queues account-deletion propagation that redacts known Salesforce Cases and records the external outcome.
- [x] Source implementation appends an idempotent Google marker to a separate `Deleted Accounts` tab and never edits the original Chart Leads/main-Sheet row in place.
- [x] Source waits for a normally completing already-claimed chart export, captures its late Salesforce Case ID, rediscovers by deterministic Subject, and then queues deletion cleanup.
- [x] Source bounds abandoned/stale `processing` chart exports with a 15-minute deletion lease, cancels the stale export, and continues deterministic deletion cleanup; staging execution remains open.
- [x] Source discovers and redacts every Salesforce Case matching a deterministic Subject across paginated query results; fixture coverage includes duplicates and pagination.
- [ ] Validate every Salesforce `nextRecordsUrl` before forwarding the session bearer token: require the same trusted Salesforce origin and expected query path so a malformed absolute pagination URL cannot redirect the credential elsewhere.
- [x] Source blocks new chart-export rows after an account deletion request exists and cancels non-processing pending exports; staging must still exercise the actual chart enqueue path and a concurrent enqueue/delete boundary.
- [x] Source removes raw email and email hashes from deletion requests, ledger payloads, and Google deletion markers.
- [x] Source deletion marker is restricted to lookup/operational fields: idempotency key, `user_id`, chart/session IDs, requested/processed timestamps, status, and source.
- [ ] Configure and verify `VLOOKUP` / `XLOOKUP` or equivalent admin-view formulas so main-Sheet rows are visibly marked or excluded when a matching deletion marker exists.
- [ ] Route Salesforce updates and Google deletion markers through the external-sync ledger, retry, final-failure, reporting, and manual-replay controls; failed deletion work must remain visible for review.
- [ ] Staging-test successful deletion propagation, duplicate deletion requests, temporary destination failures and retry, max failure/manual review, safe replay, formula/view behavior, and the external outcome audit record. Hosted smoke scenarios now cover normal late completion and a stale 15-minute claim in source, but they have not run against deployed migration `0013` yet.
- [x] Source requires `last_sign_in_at` within 10 minutes before accepting an external account-deletion request; staging-test stale and recent sessions before connecting the destructive UI.
- [ ] Implement and staging-test the final DEL-1 internal deletion sequence only after external cleanup is safely queued; ensure direct/admin deletion cannot bypass ledger redaction and external cleanup.
- [x] Source uses `external_cleanup_requested` for the Google marker and Salesforce cleanup language, and reserves `internally_deleted` for the later DEL-1 completion stage; staging verification remains open.

## Gate C — When the Founder/User UI Is Ready

- [ ] Rebuild the Claude handoff natively in Expo React Native/TypeScript; do not embed or ship the HTML/React prototype through a WebView.
- [ ] Compare the native implementation against all 14 Navy/English reference screenshots at 390×844 for layout, hierarchy, spacing, typography, copy, and navigation.
- [ ] Preserve both Warm and Navy theme token sets pending the final theme decision; do not delete either as a development-only option.
- [ ] Self-host Newsreader, Hanken Grotesk, Noto Serif TC, and Noto Sans TC for native/offline use and verify typography in both languages.
- [ ] Independently visually verify the celestial background at 390×844 against the Claude reference. Source in `e24c037` matches the supplied seeded RNG, exact 66 star positions, per-star opacity/duration/delay, individual twinkle, shooting-star timing/keyframes, gradient tails, glows, milky-way band, and horizon contract; Technical reports completing a visual comparison, but QA browser comparison was unavailable in this session.
- [x] Source respects reduced-motion settings by disabling star twinkle and shooting-star motion while retaining the static celestial layers; device-level accessibility verification remains part of visual QA.
- [ ] Keep the natal wheel data-driven from real chart longitudes/houses/angles; do not reproduce the screenshot with hand-positioned pixels.
- [ ] Remove prototype-only phone frame, status-bar/notch simulation, Tweaks panel, and Screens/dev menu from the shipped app.
- [ ] Complete the same-email magic-link flow in the real UI: sign out, sign in, follow the link, reload/reopen, and confirm session restoration.
- [x] Source routes a restored signed-in account with an active chart/Persona directly to Chat and selects the most recently updated continuable thread; real magic-link/relaunch verification remains in the flow item above.
- [x] Source returns a signed-in account without a chart to the Home/chart-onboarding state with clear user-facing copy; device-level state verification remains open.
- [ ] Remove all remaining visible implementation wording. `e90ea99` cleans the primary restore/auth/profile messages, but Notifications still says `Supabase notifications table` and local-session chat replies still say `The local demo would route...`.
- [ ] Expand the implementation-copy guard beyond quoted literals and its selected files: scan raw JSX text nodes and `services/chat.ts` so the two current visible violations fail automatically.
- [ ] Confirm Reload restores the same active chart and balance.
- [ ] Confirm Past Reflections displays saved account reflections or a specifically designed empty state; search may remain visibly non-functional only if PM accepts it as v1 visual-only scope.
- [ ] Confirm Past Reflections includes the approved search, `Start a new topic`, `Continue reflection`, and `Saved Insights` hierarchy.
- [x] Chat now exposes a visible Past Reflections header action, and source restore loads the latest continuable conversation by `updated_at DESC`.
- [x] Remove all credit pills, per-message credit estimates, and `test mode`/no-charge labels from Chat and other non-Profile/Paywall surfaces; Notifications and Care Circle billing wording was removed in `e24c037`.
- [x] Expand `test:mobile-ui` across all current screen modules and the non-Paywall portion of `App.tsx`; the broader literal-string billing scan passes across five current non-billing source surfaces.
- [x] Source provides one shared persistent four-tab bar for Talk, Insights, Dice, and You across the four primary tab screens; interactive navigation, back behavior, and restored-session entry still require device/browser QA.
- [ ] Complete Dice beyond the current local random UI: match the designed three-step/octagon presentation, add shake-to-roll as progressive enhancement with tap fallback, save the reflection, route it into Chat, and connect the approved backend/credit behavior before calling the feature production-functional.
- [ ] Complete the dedicated Profile screen against the handoff: membership, birth data, Persona change, plan/credits, Care Circle, privacy, support, export, and delete-account rows with their approved backend/state boundaries.
- [ ] Confirm Paywall lists `Out-of-scope or safety reply — 1 credit` and other approved credit costs.
- [ ] Try chart creation again and confirm the UI explains that a chart already exists without showing a generic Edge Function error or raw backend code.
- [ ] Compare mobile chart display side by side with the existing website for the same test inputs.
- [ ] Confirm unknown-time UI hides ASC, MC, houses, and house-dependent interpretations.
- [ ] Confirm full-time UI renders the expected planets, signs, degrees, ASC, MC, and houses.
- [ ] Confirm there is no visible legacy wording: standalone product `Astro`, `buddy`, `token`, `unit`, `History`, or `Chat History`; approved copy consistently uses Lumis, Lumis Persona, credits, and Past Reflections.
- [ ] Confirm signed-in restore never falls back to a misleading `local demo` label.
- [ ] Port and verify chart-generation loading, chat typing, splash, and unknown-time states from the handoff.
- [ ] Obtain/implement the missing design states: network/auth/chart-generation/chat-send errors, signed-in no-chart, explicit signed-out/expired-session, empty Past Reflections, empty Saved Insights, and zero-notification inbox.
- [ ] Add the notification bell with unread badge to Chat, Insights/Sky, Dice, and Profile; Dice/Profile are wired in `e46f8ed`, but Chat and Insights still have no bell. Every entry point must open the same Notifications sheet.
- [ ] Verify actionable carer requests versus read-only notification rows, while clearly treating Care Circle/notification data and actions as UI-only until their backend contracts pass QA.
- [ ] Confirm the message action sheet contains the approved visual actions; backend-disconnected no-op/toast behavior may ship in v1 only if PM accepts it.
- [ ] Test loading, empty, offline, timeout, Worker failure, duplicate-profile, chat persistence, and restored-session error states without raw technical errors.

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
