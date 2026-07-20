# Lumis QA Release Gate Checklist

Last reviewed: 2026-07-19

This is the canonical living checklist for staging deployment, founder UI QA, and production go-live. A reported result is not marked complete until QA independently verifies it or records the staging evidence.

Status rules:

- `[x]` independently verified.
- `[ ]` not yet verified or not yet available.
- A deferred feature is not a pass. PM must explicitly exclude it from the release or keep the release blocked.
- Staging-only fixture behavior must never be accepted as production chart behavior.

## Independently Verified So Far

- [x] Workspace TypeScript typecheck passes.
- [x] Chat router fixture tests pass.
- [x] Source route-credit values are consistent across the shared configuration, router fixtures, and current `chat-message` scaffold: casual 1, knowledge 3, dice 5, astro timing 5, astro deep 5, out-of-scope 1, and safety 1. This does not verify real charging.
- [ ] Add an automated drift guard or shared import for the duplicated `chat-message` route-credit table before real charging is enabled; today's manual source comparison can become stale.
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
- [x] Current Chat is explicitly classified as scaffold/no-charge; it is not production AI, entitlement enforcement, or atomic credit charging.
- [x] Transactional onboarding creates profile data and one Starter grant in the deployed staging version previously tested.
- [x] Repeat onboarding returns `PROFILE_ALREADY_EXISTS` in the deployed staging version previously tested.
- [x] Exactly one `starter_onboarding` grant exists for the tested account.
- [x] Cross-user RLS blocked access to tested birth data, AI profile, chat thread, and chat message rows.
- [x] Scaffold chat reports an estimated cost with `credits_charged = 0`.
- [x] Scaffold chat leaves the tested Starter balance unchanged.
- [x] Authentication API refresh, sign-out, and sign-back-in succeeded for the temporary QA account.
- [x] Source scan found no visible legacy wording matches for `Astro`, `token`, `unit`, or `chat history` in the tested mobile/shared paths.
- [x] Production web export succeeds through commit `9c7fa65`.
- [ ] Independently rerun the production export after `8cdc6e5` and the active entitlement-ledger edits settle. Technical reports export passed, but QA's previous rerun was interrupted by overlapping Metro/resource pressure.
- [ ] Restore the local Expo preview before visual QA; `http://localhost:8081/` returned connection refused during independent QA of `7003974`.

## Gate A — Before Pushing or Deploying to Staging

- [x] Commits through `7003974` are present on `origin/main`; the branch was no longer ahead during QA verification.
- [x] Worker timeout/replay/environment and Care Circle index-correction source changes are committed as `8cdc6e5` and present on `origin/main`.
- [ ] Separately commit and QA the active entitlement-ledger/staging-smoke edits. They are not part of `8cdc6e5`, are not deployed, and must not be merged into that commit's staging result.
- [ ] Confirm the worktree contains no unrelated or uncommitted changes before deployment. Current non-checklist edits belong to Technical in `0017`, its contract test, the hosted staging smoke script, and the architect-review status note.
- [ ] Run and record:
  - [x] `pnpm -r typecheck` (Technical reports the `8cdc6e5` run passed; QA independently saw shared, billing, and astrology pass, while the mobile phase did not finish under local resource pressure and was stopped rather than counted as a new full rerun.)
  - [x] `pnpm run test:birth-date`
  - [x] `pnpm run test:birth-location`
  - [x] `pnpm run test:entitlement`
  - [x] `pnpm run test:billing-entitlement`
  - [x] `pnpm run test:router`
  - [x] `pnpm run test:golden`
  - [x] `pnpm run test:worker`
  - [x] `pnpm run test:profile`
  - [x] `pnpm run test:chat-persistence`
  - [x] `pnpm run test:external-sync`
  - [x] `pnpm run test:mobile-ui`
- [x] Confirm no real secrets, API keys, access tokens, service-role keys, or QA passwords are tracked by Git; only documented placeholders are present.
- [ ] Review migration `0008_onboarding_chart_history.sql` against a disposable/staging database backup plan.
- [x] Confirm migration order `0001` through `0013` has local/remote parity in the linked staging database (`supabase migration list --linked`, independently checked 2026-07-17). The new `resolve_active_plan_tier` RPC responds on staging, providing evidence that migration `0014` is present, but full migration-list parity should be recorded again.
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
- [x] Live unsigned request to the updated staging Worker returns `401 UNAUTHORIZED` with restricted CORS (QA repeated this on 2026-07-19). Technical reports deployed version `4b60a581-0dc4-4259-9060-2b174f2afd58`; QA could not independently query the exact version because Wrangler has no non-interactive API token.
- [x] Configure matching `CHART_WORKER_SIGNING_SECRET` values in Supabase and Cloudflare.
- [x] Configure `CHART_WORKER_URL`, `CHART_WORKER_ENDPOINT`, timeout, and `LUMIS_ENV=staging`.
- [x] Confirm a valid signed request succeeds through Supabase, Cloudflare, and astrology-api.io.
- [x] Confirm invalid, missing, and expired signatures are rejected before the provider call.
- [x] Confirm signed request/body identity checks and the mobile calculation contract are enforced.
- [x] Confirm repeat onboarding is rejected before any Worker/provider call.
- [x] Source/fixture QA confirms the provider request is aborted after bounded `ASTRO_PROVIDER_TIMEOUT_MS`, returns safe `504 ASTROLOGY_API_TIMEOUT`, clears the timer, and does not expose provider diagnostics.
- [ ] Run the signed staging timeout/provider-failure case and confirm the deployed Worker returns the same controlled errors without provider debug details.
- [x] Source/fixture QA confirms exact signed replays use one provider call and return the saved chart, while changed-body reuse of the same user/request ID returns `409 CHART_REQUEST_CONFLICT`.
- [ ] Run signed staging replay, changed-body conflict, and simultaneous duplicate-request tests; verify only one provider call/result is created and inspect Durable Object storage behavior.
- [ ] Define and implement a retention/deletion policy for completed chart responses stored by `CHART_REQUEST_COORDINATOR`; source currently persists the cached chart without an alarm, TTL, or cleanup path.
- [x] Confirm the live Worker response and stored `chart_v2` contain no `rawProviderResponse`.
- [x] Confirm the live full-time chart contains populated planets, 12 houses, Ascendant, and MC.
- [x] Confirm stored backend metadata contains only the approved response summary.
- [x] Local Worker fixtures prove missing/invalid `LUMIS_ENV`, missing provider key, and missing replay coordinator fail closed before provider access.
- [ ] Confirm the deployed production-mode/misconfiguration behavior fails closed and never saves fixtures; an unsigned staging 401 alone does not exercise this configuration path.
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

- [x] Apply migration `0011_explicit_reflection_thread.sql` and redeploy `chat-message` to staging; an independent unauthenticated request returns gateway-level HTTP 401.
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

### Account entitlements

- [x] Source migration `0014_authoritative_account_entitlements.sql` replaces credit-allocation plan inference with a backend-owned current entitlement containing plan, product, lifecycle status, validity window, and provider references.
- [x] Source enforces Starter/Essential/Prime product-to-tier consistency and supports `active`, `grace_period`, `expired`, and `cancelled`; the server RPC falls back to Starter outside an active validity window.
- [x] New onboarding receives an active Starter entitlement transactionally through the one-time Starter-grant insert trigger, and existing user rows are backfilled idempotently.
- [x] Mobile restore obtains the plan from `resolve_active_plan_tier` and no longer reads `monthly_balance.allocated` to infer membership.
- [x] Source RLS restricts direct rows to the owning authenticated user, and the security-definer resolver rejects a non-service caller requesting another user ID.
- [x] The staging RPC exists and an anonymous public-key request is denied with PostgreSQL code `42501`; this confirms deployment presence but not authenticated owner/cross-user behavior.
- [ ] Run the new hosted entitlement cases with disposable authenticated users: Starter creation, active and grace paid tiers, time expiry, expired/cancelled fallback, product mismatch rejection, direct cross-user row denial, and cross-user RPC denial.
- [x] Forward migration `0015_entitlement_provider_privacy.sql` removes the shared-label uniqueness error by renaming the field to unique `provider_event_id` and rebuilding the index against the new meaning.
- [x] Forward migration `0015` adds a `BEFORE UPDATE` trigger that refreshes `account_entitlements.updated_at`.
- [x] Forward migration `0015` drops authenticated row policy/table access to provider references; mobile receives only the safe plan tier through the resolver RPC.
- [x] Technical's hosted deployment record says migrations `0015` and `0016` are applied and `/profile` was redeployed. The staging resolver's anonymous denial is independently evidenced; privileged authenticated owner/cross-user/direct-table cases remain open below.
- [x] Source migration `0017_persona_policy_and_entitlement_events.sql` adds a backend-only append ledger keyed by provider/event ID, stores a digest rather than raw webhook payload, suppresses duplicate IDs, and prevents older event timestamps from rolling back the current entitlement.
- [x] Source grants the provider-event ledger only `SELECT`/`INSERT` to service role and exposes a service-only transactional apply RPC; local contract fixtures cover duplicate and older-event ordering behavior.
- [ ] Commit the current Technical fix that treats a repeated provider/event ID with a different `payload_digest` as `ENTITLEMENT_EVENT_INTEGRITY_CONFLICT`; its local source contract passes, but it is uncommitted and not deployed. Add the hosted database proof that the mismatch cannot mutate current entitlement.
- [ ] Commit the current deterministic equal-timestamp ordering fix (higher provider event ID wins). Its local fixture passes, but it is uncommitted and must be exercised against PostgreSQL.
- [ ] Apply migration `0017` and run the new hosted provider-event scenarios against PostgreSQL before enabling RevenueCat webhooks.

### Salesforce and Google Sheets operational logging

- [x] Apply migration `0012_external_sync_delivery_ledger.sql` and deploy `external-sync-retry`; an independent unauthenticated request returns gateway-level HTTP 401. Technical reports external delivery remains disabled.
- [x] Apply migration `0013_account_deletion_external_sync.sql` and deploy the authenticated `account-deletion-request` function to staging without connecting the destructive mobile Delete Account action; an independent unauthenticated request returns gateway-level HTTP 401.
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
- [ ] Configure authenticated hourly retry and daily report schedules in staging and verify their execution history. Source recovery logic exists, but Technical confirms schedules are intentionally inactive while integrations/credentials are disabled; this is not scheduler evidence.
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
- [x] Validate every Salesforce `nextRecordsUrl` before forwarding the session bearer token: source requires the authenticated Salesforce origin and expected query path, and a hostile-pagination fixture proves the token is not forwarded.
- [x] Source blocks new chart-export rows after an account deletion request exists and cancels non-processing pending exports; staging must still exercise the actual chart enqueue path and a concurrent enqueue/delete boundary.
- [x] Source removes raw email and email hashes from deletion requests, ledger payloads, and Google deletion markers.
- [x] Source deletion marker is restricted to lookup/operational fields: idempotency key, `user_id`, chart/session IDs, requested/processed timestamps, status, and source.
- [ ] Configure and verify `VLOOKUP` / `XLOOKUP` or equivalent admin-view formulas so main-Sheet rows are visibly marked or excluded when a matching deletion marker exists.
- [ ] Route Salesforce updates and Google deletion markers through the external-sync ledger, retry, final-failure, reporting, and manual-replay controls; failed deletion work must remain visible for review.
- [ ] Staging-test successful deletion propagation, duplicate deletion requests, temporary destination failures and retry, max failure/manual review, safe replay, formula/view behavior, and the external outcome audit record. Hosted smoke scenarios now cover normal late completion and a stale 15-minute claim in source, but they have not run against deployed migration `0013` yet.
- [ ] Run the full hosted race/RLS suite now that migrations/functions are deployed. This requires a dedicated, separately deletable staging `sb_secret_` QA key via hidden Terminal input only; never paste, log, commit, or retain the key after the test, and clean up all disposable users/data.
- [x] Source launcher `test:staging-backend:secure` is locked to the Lumis staging project, reads a dedicated `sb_secret_` key through hidden input, rejects legacy JWT keys, sends the secret only through `apikey`, does not write it to a file or command history, and invokes normal-path disposable-user cleanup in a `finally` block.
- [x] Launcher/setup wording now distinguishes independently deletable secret keys from the long-lived legacy `service_role` JWT and no longer recommends routine legacy-key rotation.
- [x] Current source accepts the optional pnpm `--` and the advertised crash-cleanup invocation reaches the hidden-key prompt with the correct run ID; a real cleanup against disposable staging data remains part of the privileged hosted gate.
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
- [x] Remove the remaining visible `Supabase`/`local demo` implementation wording from Notifications and local-session Chat replies.
- [x] Expand the implementation-copy guard to raw JSX text and `services/chat.ts`; the broader guard passes.
- [ ] Confirm Reload restores the same active chart and balance.
- [x] Source Past Reflections displays saved account reflections plus distinct no-reflections, no-chart, and no-search-results states; interactive/device verification remains open.
- [x] Source Past Reflections includes functional client-side title/message search, `Start a new topic`, `Continue reflection`/`Read reflection`, read-only labeling, and the approved `Saved Insights` hierarchy.
- [x] Saved Insights is explicitly marked unavailable; the empty state no longer instructs users to use a nonexistent `Save insight` action.
- [x] Chat now exposes a visible Past Reflections header action, and source restore loads the latest continuable conversation by `updated_at DESC`.
- [x] Remove all credit pills, per-message credit estimates, and `test mode`/no-charge labels from Chat and other non-Profile/Paywall surfaces; Notifications and Care Circle billing wording was removed in `e24c037`.
- [x] Expand `test:mobile-ui` across all current screen modules and the non-Paywall portion of `App.tsx`; the broader literal-string billing scan passes across five current non-billing source surfaces.
- [x] Source provides one shared persistent four-tab bar for Talk, Insights, Dice, and You across the four primary tab screens; interactive navigation, back behavior, and restored-session entry still require device/browser QA.
- [x] Source implements the designed three-step Ask → Shake/Tap → Result Dice flow with octagonal planet/sign/house dice, animated glyph rolling, accelerometer detection, tap fallback, reflective result, and a prefilled Chat handoff.
- [x] Dice Back/reset and unmount cleanup share timer cancellation, reset rolling state, and prevent a delayed Result screen from reopening.
- [ ] Build and test on a physical iPhone: motion permission copy, permission denial, accelerometer availability/error handling, shake threshold/debounce, cleanup, reduced-motion expectations, and tap fallback.
- [ ] Connect Dice to the approved backend interpretation, persistence, entitlement, charging, idempotency, and failure states before treating it as production-functional; the current result and roll are local UI behavior.
- [x] Source expands Profile with current birth data, Persona, credit balance, Care Circle preview, notifications, privacy/support, export, and deletion entries; unfinished/destructive actions show non-operational security-review notices rather than calling a backend.
- [x] Profile membership/plan labels use the authoritative entitlement resolver, and Main focus loads from `users.focus` with `Not set` for an empty value; hardcoded `Starter member`, plan `Starter`, and `Personal growth` are removed.
- [x] Plan display no longer uses the allocation-to-plan heuristic; it resolves the authoritative server-side entitlement. RevenueCat webhook ingestion and hosted lifecycle verification remain open in Gate B.
- [ ] Device-test Profile scrolling, row navigation, Care Circle preview-state reset, notices, long names/emails/places, unknown-time display, and accessibility; do not connect Delete Account until DEL-1 and recent-auth confirmation pass hosted QA.
- [x] Source Profile rows allow two-line wrapping and expose full label/value accessibility labels; visual truncation, dynamic type, and screen-reader behavior remain in the device test above.
- [x] Source onboarding now uses the active three-step Date → Time → Birthplace flow, with back navigation and per-step validation.
- [x] Source unknown-time copy explicitly excludes Ascendant/ASC, MC, houses, and planet house placements before chart creation.
- [x] Source birthplace suggestions match the three locations currently supported by the local resolver: Hong Kong, London, and New York; broader production-grade place/timezone resolution remains a separate backend scope.
- [x] Mobile, Supabase `/profile`, and Cloudflare Worker source reject malformed/future birth dates before chart generation; deterministic shared tests cover a nominal today/tomorrow boundary, leap years, malformed input, and `2099`, and the Worker fixture proves a future date skips the provider call.
- [x] Local-calendar birth-date validation now uses the phone timezone at the early mobile step and the resolved birthplace timezone for final mobile, Supabase, and Worker validation. Deterministic tests cover UTC+14, UTC+8, UTC-4, UTC-10, and invalid-zone fail-closed behavior, fixing the reproduced Hong Kong-midnight defect.
- [x] Source migration `0016_trusted_birth_location_resolver.sql` adds a service-only backend reference/resolver for the current Hong Kong, London, and New York locations. `/profile` ignores client `tz_str`, canonicalizes place/country/coordinates/timezone before date validation, Worker signing, and persistence, and keeps duplicate/repair preflight ahead of resolution.
- [x] Source contracts require resolver/table service-only privileges and trusted fields throughout the onboarding path; hosted smoke scenarios cover spoofed country, spoofed coordinates, canonical Hong Kong resolution, and anonymous denial.
- [ ] Run the privileged hosted resolver/entitlement/Persona scenarios against deployed migrations `0015`/`0016`; then apply `0017` only after its active integrity/order fixes are committed and run the provider-event scenarios against PostgreSQL. The hosted script contains the checks but QA has not executed it with the dedicated staging secret key.
- [ ] Expand the backend-owned resolver beyond its three staging cities using an authoritative geocoding/timezone source, with ambiguity handling and historical timezone QA; do not fall back to client-provided coordinates/timezone.
- [x] Source adds the Claude-style chart-generation progress state with four user-facing steps and removes implementation-oriented preparation wording; visual timing, reduced motion, error transition, and screen-reader announcement remain device/browser QA.
- [x] Staging `/profile` and the chart Worker independently return HTTP 401 for unauthenticated/unsigned POSTs (QA repeated both on 2026-07-19). Technical reports Worker version `4b60a581-0dc4-4259-9060-2b174f2afd58`; QA could not prove the exact version or signed timeout/replay/timezone response without deployment credentials/signing material.
- [x] Source ports the data-driven Claude-style chart reveal with full/unknown-time precision copy, dynamic wheel/placements, and no ASC/houses for unknown-time charts; visual and golden-display verification remain open.
- [x] Big Three formatting now normalizes within the sign and renders floored degrees/minutes in `0°00′–29°59′`; the old `Math.round`/`30°` display defect is removed.
- [x] Source ports the Claude-style Persona selection with celestial background, role icons, visible selected styling, example responses, persisted Persona choice, and sanctuary navigation.
- [x] Source adds the separate “Give Lumis a face” step with ten avatar choices, a 24-character custom name, optional focus, Supabase/local persistence, backward-compatible local restore defaults, and same-account restore fields.
- [x] Saved Persona name and selected avatar are rendered in Chat and Profile; avatar/focus are restored into app state and the Persona editor.
- [ ] Live-test same-email Persona identity persistence: choose a non-default avatar/name/focus, sign out/in or relaunch, confirm exact restore in Chat/Profile/Persona editor, change it again, and confirm no stale local values override Supabase.
- [x] Source migration `0017` cleans legacy invalid avatar/focus values, adds database allowlist constraints, removes broad direct user updates, and exposes an owner-scoped protected Persona RPC that derives the internal role server-side.
- [x] Mobile saves Persona identity only through `update_lumis_persona`; source hosted scenarios cover approved persistence, invalid-avatar rejection, and direct-write denial.
- [ ] Apply migration `0017` and live-test protected Persona update, invalid input, direct user-table denial, same-email restoration, and selected-avatar rendering in Chat/Profile.
- [x] Persona-style and avatar choices expose radio roles and selected accessibility state.
- [ ] Device-test Persona screen-reader announcements/grouping, focus order, dynamic type, save failure, and double-submit prevention; focus chips should also receive an explicit selectable role if presented as a single-choice group.
- [ ] Visually/device-test all three onboarding steps: keyboard behavior, back-state preservation, unknown-time toggle, unsupported/no-result birthplace search, error announcement, small-screen scrolling, dynamic type, and screen-reader roles/states.
- [ ] Confirm Paywall lists `Out-of-scope or safety reply — 1 credit` and other approved credit costs.
- [ ] Try chart creation again and confirm the UI explains that a chart already exists without showing a generic Edge Function error or raw backend code.
- [ ] Compare mobile chart display side by side with the existing website for the same test inputs.
- [ ] Confirm unknown-time UI hides ASC, MC, houses, and house-dependent interpretations.
- [ ] Confirm full-time UI renders the expected planets, signs, degrees, ASC, MC, and houses.
- [ ] Confirm there is no visible legacy wording: standalone product `Astro`, `buddy`, `token`, `unit`, `History`, or `Chat History`; approved copy consistently uses Lumis, Lumis Persona, credits, and Past Reflections.
- [ ] Confirm signed-in restore never falls back to a misleading `local demo` label.
- [ ] Port and verify chart-generation loading, chat typing, splash, and unknown-time states from the handoff.
- [ ] Obtain/implement the missing design states: network/auth/chart-generation/chat-send errors, signed-in no-chart, explicit signed-out/expired-session, empty Past Reflections, empty Saved Insights, and zero-notification inbox.
- [x] Source adds notification bells to Chat, Insights/Sky, Dice, and Profile, and every entry point routes to the shared Notifications screen; unread-badge and interactive device verification remain part of visual QA.
- [ ] Add and visually verify the approved unread badge on all four main-tab notification bells; the new Chat and Insights controls currently render bell icons without a badge.
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
- [ ] Split the monolithic `App.tsx` and adopt production-grade native navigation, or obtain an explicit PM/Technical debt acceptance with regression coverage for deep links, restored sessions, back behavior, and tab state.
- [ ] PROF-2 birth-detail change endpoint: three successful-change limit, error codes `49001`/`49002`/`49003`, atomic regeneration, and rollback behavior.
- [x] Source migration `0018_remove_misleading_care_max_index.sql` removes the falsely named legacy index and explicitly states that the remaining active-pair index prevents duplicate pairs only; `test:care-circle` passes.
- [ ] Apply migration `0018` to staging and confirm the misleading index is absent without weakening duplicate-pair protection.
- [ ] Care Circle backend: paid gate, QR/link flow, transactional/concurrency-safe maximum five active carers, pending/active lifecycle, and carer RLS boundary. The maximum-five rule is not currently enforced.
- [ ] Production chat/thread/history persistence and message-usage accounting.
- [ ] Full bilingual copy layer and automated terminology scan.
- [ ] Integration/concurrency tests for credits, PROF-2, Care Circle, chart version routing, and RLS.

## Final Release Decision

- [ ] Technical owner confirms deployment configuration.
- [ ] QA confirms every applicable required item is checked with evidence.
- [ ] PM explicitly accepts or removes every deferred item.
- [ ] Founder/product owner approves the final UI smoke test.
- [ ] Production release is authorized.
