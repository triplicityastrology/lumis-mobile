# PM Project Tracker Update — Lumis Mobile

**Reporting period:** 18–22 July 2026  
**Prepared for:** PM / Project Tracker update  
**Inputs:** Technical Codex updates, ⭐ Claude Fable design work, QA reviews, repository history, staging reports, and the canonical go-live checklist

## Executive Summary

Since the 18 July update, the project has made substantial progress in four areas:

1. Backend reliability and security were strengthened across chart generation, entitlements, chat idempotency, billing-period integrity, external-sync privacy, rate limits, observability, and scheduled operational checks.
2. ⭐ Claude Fable's high-fidelity mobile experience was expanded and reconciled into the native Expo app, including navigation, celestial screens, Sky/Insights, Chat, Past Reflections, Profile, Persona, chart reveal/generation, and the feature-flagged Dice ritual.
3. The app was upgraded to Expo SDK 54 and successfully produced web and iOS bundles. Expo Go connection/build has been reported successful, although the complete physical-iPhone regression remains open.
4. PROF-2 birth-detail regeneration now exists in source with a transactional backend and real mobile integration. The initial QA issues were repaired in commit `09fecf0`; deployment and privileged hosted/device verification are still required before the tracker should mark PROF-2 complete.

The project is significantly closer to a controlled staging release, but it is **not production-ready**. Real AI/charging, RevenueCat activation, Care Circle backend enforcement, full account deletion, live Salesforce/Google destination QA, broad birthplace resolution, golden-chart accuracy signoff, and physical-device acceptance remain open.

## Status Definitions Used Below

- **Completed and QA checked:** independently inspected or rerun by QA, with the stated scope.
- **Technical-reported deployed:** Technical supplied deployment evidence; some privileged behavior still requires the secure hosted suite.
- **Source complete / hosted QA pending:** implementation and local contracts exist, but real PostgreSQL, destination, or device behavior is not yet proven.
- **Deferred:** deliberately outside the current milestone and must not be marked complete.

## Completed and QA Checked

### Chart onboarding and signed Worker path

- Transactional onboarding, duplicate-profile rejection, one-time Starter grant protection, legacy recovery, active chart history, and raw-provider-data stripping remain in place.
- Mobile and Supabase do not call `astrology-api.io` directly. Provider calls remain behind the signed Cloudflare Worker.
- Worker safeguards now include:
  - missing/invalid/expired signature rejection;
  - signed body/header identity checks;
  - fail-closed environment and secret handling;
  - provider timeout handling;
  - exact replay and changed-body conflict handling;
  - simultaneous replay protection;
  - seven-day Durable Object replay-cache expiry;
  - safe provider-call telemetry without provider payload leakage;
  - unknown-time removal of ASC, MC, houses, and planet-house placements.
- QA independently confirmed unauthenticated/unsigned HTTP 401 responses from staging `/profile`, `/chat-message`, `/account-deletion-request`, `/external-sync-retry`, and the chart Worker.
- Technical's latest reported Worker version in this reporting period is `def65b99-6a3f-429f-800a-e3c033dd0b2c`.

### Birth-date, location, and chart safety

- Future dates are rejected in mobile, Supabase, and Cloudflare before provider use.
- “Today” is evaluated using the resolved birthplace timezone at final validation; deterministic boundary coverage includes UTC+14, UTC+8, UTC-4, and UTC-10.
- Invalid timezones fail closed.
- Backend-owned location reference data prevents the client from supplying a trusted timezone or spoofed coordinates.
- Current staging resolver coverage remains Hong Kong, London, and New York.
- Big Three display formatting was corrected to degrees/minutes within `0°00′–29°59′`.
- Unknown-time source guards and tests prohibit ASC, MC, houses, and planet-house placements before AI use.

### Entitlements and billing-period integrity

- `account_entitlements` is now authoritative; the app no longer infers plan membership from credit allocation.
- Active, grace-period, expired, and cancelled entitlement states are represented with server-side expiry behavior.
- Starter entitlement is created during onboarding.
- Provider references are hidden from normal authenticated reads.
- Persona updates and provider entitlement events use protected backend RPCs and allowlists.
- Provider-event handling now includes:
  - append-only event storage;
  - payload-digest conflict rejection;
  - deterministic equal-time ordering;
  - replay/idempotency coverage;
  - forward repair migration `0027` for environments that received the earlier `0017` definition.
- Canonical billing-period keys support `calendar:YYYY-MM` and future stable `revenuecat:...` IDs.
- Duplicate billing cleanup no longer sums accidental duplicate grants.
- Concurrent logical-period coverage expects one balance row and one allocation.

### Chat, Past Reflections, and route consistency

- Chat persistence remains transactional across thread creation, user message, assistant message, and thread update.
- `client_msg_id` supports exact retry/double-tap suppression and conflict rejection when the same ID is reused with changed context.
- Chat uses the shared route-cost table, preventing route-credit drift.
- Monthly balance uniqueness and chat usage indexes are present.
- Rate limits exist for `/profile` and `/chat-message`.
- Active profile/chart-version ownership is required when continuing a thread.
- Older or archived chart-version threads remain visible as read-only Past Reflections.
- Safe persistence errors reach mobile, and failed turns are not shown as successful.
- **Important tracker classification:** Chat is still `scaffold_no_charge`; it persists messages but does not yet provide production AI, entitlement charging, or atomic credit deduction.

### External sync, privacy, and account-deletion preparation

- Durable `external_sync_events` records support Salesforce and Google Sheets delivery state, idempotency, retries, final/manual-review states, reporting, and script-based replay.
- Retry design supports immediate, +1 hour, and +3 hour attempts, followed by `failed_final`.
- Production Salesforce/Google credentials remain intentionally disabled pending staging destination QA.
- PM-approved deletion behavior is represented in source:
  - Salesforce Cases are redacted;
  - Google Sheets receives an append-only `Deleted Accounts` marker rather than an in-place edit;
  - exports are blocked after deletion starts;
  - in-flight exports may finish and are then cleaned up;
  - late/duplicate Salesforce Cases are rediscovered and redacted;
  - deletion storage avoids raw email and email hashes;
  - recent sign-in is required.
- Strict external-sync retention now uses an operational allowlist rather than a PII blacklist.
- Completed or expired records cannot retain email, name, birth details, plan, payment amount, marketing consent, chart URL, or future unlisted payload fields.
- Expired payloads are redacted at claim/replay time and cannot be delivered or manually replayed.
- Provider-attempt telemetry uses append-only rows and per-request database locking so a lower concurrent count cannot overwrite a higher count.

### Runtime guardrails, operations, and CI

- Runtime request IDs and payload-free operational events cover the app, Edge Functions, Worker, and external-sync path.
- Health snapshots, alerts, retention cleanup, and daily external-sync failure reports exist in source.
- Migration `0025` provides backend-only cron verification without returning cron commands or secrets.
- Technical reports migrations `0001–0025` have local/remote parity and that `0023–0025` are deployed.
- The secure hosted suite now checks RLS, chat replay, provider concurrency, strict redaction, deletion races, rate limits, entitlements, all three cron schedules, health/alerts/retention/reports, and disposable-user cleanup.
- GitHub Actions source runs typecheck, local tests, and a production export on pull requests and `main`.
- Invalid Git refs `main 2` / `HEAD 2` were repaired, and branch tracking returned to normal.

### Expo SDK 54

- Expo upgraded to `54.0.36` with React Native `0.81.5` and React `19.1.0`.
- Expo Doctor reported 18/18 checks passed.
- Expo Crypto was added for secure Dice randomness in Expo Go.
- Typecheck, local regression suites, Dice distribution tests, web export, and iOS Hermes bundle passed.
- Expo Go connection and iOS bundle build were reported successful.
- Physical motion, permissions, lifecycle, safe-area, and full restored-session testing remains open.

## ⭐ Claude Fable Design and Mobile UI Work

The following items came from ⭐ Claude Fable and should be protected during Technical refactors or merge-conflict resolution.

### ⭐ Native visual system and navigation

- Native Expo/React Native implementation retained; no WebView embedding of the design prototype.
- Navy/gold celestial visual system added across the main experience, including stars, glows, horizon treatment, shooting stars, and reduced-motion handling.
- Persistent four-destination navigation established:
  - Talk;
  - Insights;
  - Dice;
  - You.
- Chat safe-area ownership was corrected so its tab bar reaches the physical bottom consistently with the other tabs.
- ⭐ Claude replaced 66 independent JavaScript star animations with two native-driven grouped pulses to reduce navigation hitching. Source performance intent is clear, but visual/device approval of the lighter synchronized twinkle remains open.
- Notification bells route Chat, Sky/Insights, Dice, and Profile to the shared Notifications screen.
- Splash, Welcome, Home, Chat, Past Reflections, Profile, Persona, chart reveal, and chart-generation states use the shared celestial language.

### ⭐ Chat, Sky, and Past Reflections

- Chat uses the navy/gold Claude-style layout and removes implementation/testing language from user-facing copy.
- Past Reflections supports saved-thread restoration, search, empty states, Continue/Read-only actions, new-topic entry, and Saved Insights framing.
- Chat exposes Past Reflections, new-topic, notification, and Persona/Sky entry points.
- Sky/Insights branding was corrected:
  - title changed to `Sky`;
  - tab-level Back button removed;
  - notification bell retained;
  - natal wheel placed in a glass panel with the approved label/caption.
- Restored accounts with an active chart route to Chat and load the latest continuable conversation; signed-in accounts without a chart return to chart onboarding.

### ⭐ Persona, Profile, and onboarding

- Claude-style Persona selection and “Give Lumis a face” flows were added.
- Ten celestial avatars, custom Lumis name, focus, selected-state accessibility, and same-account restoration are supported.
- Saved Persona name/avatar appear in Chat and Profile.
- Three-step birth onboarding uses Date → Time → Birthplace.
- Claude-style chart-generation progress and dynamic chart reveal are present.
- The Birth Details regeneration experience now uses the full generating/reveal visual treatment rather than a small spinner modal.

### ⭐ Dice ritual

- Feature-flagged ritual flow added with question entry, ready/mix, throw/tumble/settle/result states, animated dice, accelerometer behavior, tap fallback, haptics, reduced motion, reflection copy, and Chat handoff.
- Secure randomness and deterministic physics/face-reading/distribution fixtures are present.
- Past Rolls and interpretation foundations exist in source.
- The older three-step Dice flow remains as a fallback while the ritual flag is evaluated.
- **Important tracker classification:** throwing Dice is a UI/local behavior. Real `route.dice` AI interpretation, 5-credit charging, entitlement enforcement, usage linkage, and production persistence are not complete.

### ⭐ Claude preservation record

- A dedicated preservation inventory now documents Claude-owned behavior that Technical must reconcile rather than overwrite:
  - `docs/design/claude-fable-preservation-inventory-2026-07-21.md`.
- Remaining Claude/device gates include visual comparison against the reference screens, grouped-star approval, fonts, unread badges, system navigation behavior, motion/accessibility testing, and intentionally deferred chat-bubble/composer polish.

## PROF-2 Birth-Details Regeneration

### Source completed in commit `09fecf0`

- Migration `0026_birth_details_regeneration.sql` adds the backend-only request/reservation ledger.
- `/profile/birth-details/change` authenticates the user, resolves trusted location data, validates inputs, reserves the change, calls the signed Worker, and commits through a transactional RPC.
- Maximum three successful lifetime changes are enforced server-side.
- Failed regeneration leaves the previous chart active and does not consume a change.
- Successful regeneration atomically:
  - supersedes the previous birth history;
  - deactivates the previous AI profile;
  - creates the next chart version/history/profile;
  - updates `birth_data.active_chart_version`;
  - increments the successful-change counter.
- Past Reflections retain their original chart version.
- The initial QA gaps were repaired:
  - stable mobile `client_request_id` across retry;
  - same request ID reused for Worker replay;
  - resumable same-digest expired reservations;
  - committed duplicates resolved before rate limiting;
  - authoritative chart/account reload after success or duplicate recovery;
  - old selected Chat state cleared before future new-version Chat;
  - strict server-side date/time/type validation before Worker use;
  - distinct mobile handling for `49001`, `49002`, and `49003`;
  - explicit unknown-time copy covering ASC, MC, houses, and planet-house placements;
  - duplicate celestial background removed from the generating overlay.
- Local PROF-2 contracts and hosted PostgreSQL scenarios exist.

### Still required before PROF-2 can be marked complete

- Apply migration `0026` to staging.
- Redeploy the updated `/profile` function.
- Run the privileged hosted PROF-2 cases against real PostgreSQL and the signed Worker.
- Verify exactly one provider call across concurrent/retried requests.
- Verify failure/timeout/ambiguous-response recovery, limit enforcement, rollback, authoritative restore, new-version Chat routing, and old-thread read-only behavior.
- Run the complete mobile flow on an iPhone.

## Golden Chart Accuracy

- Structural golden guards continue to pass, including strict unknown-time exclusions.
- A PM-approved reference path was added on 22 July using official Triplicity website Worker/KV-backed chart sessions rather than direct provider calls.
- Three known-time reference cases have now been retrieved, sanitized, populated, and marked `ready`:
  - Hong Kong;
  - Malaysia;
  - Shenzhen, including its timezone/coordinate caveat.
- Each ready fixture contains 14 supported points and 12 house cusps. QA independently re-fetched the live official records and matched all 42 points and 36 house cusps with no mismatches.
- Fixture privacy checks found no customer names or email addresses; synthetic case names and only the required calculation inputs/expected values are retained.
- Privacy follow-up: the committed narrative document `docs/qa/golden-chart-official-website-fixtures-2026-07-22.md` still contains the real names and email addresses from the three source records. It needs an immediate forward redaction, and PM/security should decide whether Git history must also be cleaned.
- PM-approved tolerances are enforced for planets, ASC, MC, house cusps, signs, and house assignments.
- A reproducible generator and readable signed mobile-Worker comparison command now exist.
- **Do not mark chart accuracy complete yet.** The signed mobile Worker comparison has not run because it requires the Worker signing secret through hidden input.
- A separate approved unknown-time reference remains required.

## QA Evidence Recorded During This Period

- Workspace/type-level checks and focused regression suites were repeatedly rerun successfully.
- Production Expo web exports passed repeatedly.
- Dice geometry, face-reading, settle behavior, and seeded 1,000-roll distribution tests passed.
- Mobile UI contracts passed across current non-billing surfaces.
- Backend guardrail, external-sync, Worker, profile, chat-persistence, entitlement, date/location, router, and golden-structure tests passed within their stated source scope.
- Live unauthenticated security checks returned HTTP 401 for the four deployed Edge Functions and Worker.
- Earlier hosted evidence remains valid for onboarding transactionality, duplicate prevention, Starter recovery, chart-version invariants, transactional scaffold chat, zero charging, RLS, and same-account restoration.
- The canonical source of QA truth remains:
  - `docs/qa/go-live-checklist.md`.

## Manual or Privileged QA Still Required

### Dedicated Supabase secret-key suite

- The full hosted suite requires a separately revocable `sb_secret_` staging QA key entered through hidden Terminal input.
- The key must never be pasted into chat, logged, committed, or retained after the run.
- Until the suite completes, the tracker should not close hosted RLS/concurrency/scheduler/retention/PROF-2 gates merely because the test source exists.

### Physical iPhone

- Magic-link return, sign-out/sign-in, session restoration, and same-email data restoration.
- Four-tab navigation, status/safe areas, keyboard behavior, background/foreground restoration, icons, SVGs, and accessibility.
- Full Dice gesture path: permission allowed/denied, shake/flick discrimination, debounce, tap fallback, Back/unmount, repeated throws, reduced motion, haptics, performance, and temperature.
- PROF-2 date/time/place selection, generating/reveal flow, errors, retry, restored chart, and new Chat context.

### External destinations

- Salesforce sandbox delivery and idempotent recovery.
- Separate staging Google Sheet delivery and `Deleted Accounts` marker behavior.
- Temporary failure → retry success.
- Three-attempt final failure and manual replay without duplicates.
- Admin visibility/reporting and deletion propagation.
- Production credentials must remain disabled until these pass.

## Items That Must Remain Open in the PM Tracker

- Real AI responses and full CHAT-1–CHAT-4 enforcement.
- Atomic production credit charging and usage records.
- RevenueCat webhook activation and live entitlement lifecycle QA.
- Real Dice interpretation route and 5-credit charge.
- Care Circle backend: paid gate, QR/link workflow, pending/active lifecycle, transactional maximum five carers, and carer RLS.
- DEL-1 final internal account deletion sequence.
- Live Salesforce/Google staging and recovery QA.
- Signed mobile-Worker golden comparison and unknown-time reference signoff.
- Production-grade geocoding and historical timezone resolution beyond three staging cities.
- Production-grade native navigation/App split or explicit PM acceptance of the current manual screen-state debt.
- Full bilingual copy layer and automated forbidden-terminology scan.
- Complete physical-iPhone, accessibility, reduced-motion, and magic-link acceptance.
- Production-like deployment rehearsal, rollback evidence, and final release approval.

## Repository and Tracker Notes

- `origin/main` currently includes commit `09fecf0`, containing the current screen integration, PROF-2 source, golden-reference documentation, and entitlement repair migration.
- The official golden fixtures, generator, signed-Worker comparison scripts, and related package/test edits are currently uncommitted source work. Two hosted-QA script edits are also uncommitted. They should be reviewed and committed without sweeping in unrelated files.
- Do not use a broad “all tests passed” tracker status without its scope. Keep these labels distinct:
  - local/source tests passed;
  - deployed security check passed;
  - privileged hosted suite passed;
  - physical-device QA passed;
  - destination integration QA passed;
  - chart-accuracy QA passed.

## Suggested PM Tracker Summary

### Mark completed

- Expo SDK 54 upgrade and build compatibility.
- Signed Worker guardrails, timeout/replay/TTL/fail-closed source work.
- Authoritative entitlement model and provider-event integrity source work.
- Canonical billing-period uniqueness and duplicate-grant cleanup.
- Transactional scaffold chat persistence and client-message idempotency source work.
- External-sync ledger, recovery framework, strict retention allowlist, and backend scheduler-verification source work.
- ⭐ Claude native UI foundation, four-tab shell, celestial design, Persona/Profile/Past Reflections/Sky screens, and feature-flagged Dice ritual source work.
- PROF-2 source implementation and remediation in `09fecf0`.

### Mark deployed but awaiting privileged evidence

- Migrations through `0025` and the currently reported staging Edge/Worker versions.
- Runtime schedules, privacy enforcement, concurrency guards, and RLS cases covered by the secure hosted suite.

### Keep in progress

- PROF-2 migration `0026`/function deployment and hosted/device verification.
- Entitlement repair migration `0027` deployment and hosted verification.
- Signed Worker comparison for the three ready official golden cases, plus a separate approved unknown-time reference.
- Physical-iPhone navigation, magic-link, accessibility, and Dice regression.

### Keep deferred / not started for production

- Real AI and charging.
- RevenueCat production activation.
- Care Circle backend.
- DEL-1 internal deletion.
- Live Salesforce/Google delivery.
- Broad production location/timezone resolver.
- Full bilingual system and production-native navigation refactor.
