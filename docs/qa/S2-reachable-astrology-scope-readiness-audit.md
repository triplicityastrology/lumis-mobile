# Reachable Astrology Scope Readiness Audit

Status: inactive audit only. No product copy, route, fixture, provider, model,
database, deployment, billing, Dice, or UI behavior is changed by this
document.

## Binding Scope

- The current Knowledge Bank and deterministic chart scope is natal only.
- Transit, timing, date ranking, weekly forecasting, and advanced methods are
  future/deferred.
- Solar Return is permanently outside Lumis scope.
- Dice is a separate product surface and is excluded from the Knowledge Bank.

## Classification

| Classification | Meaning |
| --- | --- |
| Live-looking | Reachable copy or control is presented as a current capability, even if its data is hard-coded |
| Scaffold | Reachable code path exists but does not call an astrology or AI provider |
| Explicit inactive preview | Reachable copy truthfully says the capability is not active |
| Internal fixture | Non-user-facing configuration or rejection-test data |
| In scope | Natal display or calculation allowed by the current authority |

## Reachable Source and Route Audit

| ID | Exact source / route | Reachability | Current nature | Scope risk | Safe recommendation |
| --- | --- | --- | --- | --- | --- |
| AS-01 | `apps/mobile/src/screens/ChartInsightsScreen.tsx`, `Insights` bottom tab and Home birth-chart card | Signed-in chart accounts can open it directly | Live-looking hard-coded weekly forecast: `THIS WEEK'S SKY`, `A week for steady footing`, and current-week Moon wording | High. Static copy looks like a calculated transit/weekly forecast | Hide until approved. An explicitly labelled inactive preview is the only acceptable visible alternative |
| AS-02 | `apps/mobile/App.tsx`, `QUICK_CHAT_PROMPTS` rendered in Talk | Every writable Talk screen exposes a tappable `What should I pay attention to this week?` prompt | Live user control routed into the Chat scaffold | High. It invites a deferred timing answer | Hide until approved; preserve equivalent wording only as internal fixture/test data |
| AS-03 | `apps/mobile/App.tsx`, Talk result for route `astro_timing` | Appears after a timing-classified Chat turn | Live-looking `Timing window · planning aid, not a guarantee` result badge | High. A disclaimer does not turn deferred timing into natal-only scope | Hide until approved. If retained later, it must be an explicitly labelled inactive preview and must not imply a timing result |
| AS-04 | `apps/mobile/App.tsx`, `PERSONA_FOCUSES` value `Timing` | Reachable during Persona setup | Selectable and persisted focus label | Medium-high. It implies timing is an available product focus | Hide until approved or present only as an explicitly labelled inactive preview |
| AS-05 | `apps/mobile/src/screens/LumisHomeScreen.tsx`, signed-out Home promise | Signed-out Home is directly reachable | `Gentle prompts for timing, patterns, and growth.` is live product-positioning copy | Medium. It promises a deferred capability before sign-in | Hide until approved or explicitly label the timing portion as inactive preview scope |
| AS-06 | `packages/shared/src/config/chat-router.ts`, shared classifier and `CHAT_ROUTE_FIXTURES` | Used by mobile and the `chat-message` Edge Function | `this week`, `transit`, `forecast`, and related terms route to `astro_timing` | High integration risk. This is an active routing boundary, not only a fixture | Preserve as internal future fixture/test data, but hide all user-reachable activation until timing is approved |
| AS-07 | `supabase/functions/chat-message/index.ts`, `buildChatResponse` through shared classifier | Authenticated Chat can persist a timing-classified scaffold turn | Backend scaffold only; no model or transit calculation, but returns route `astro_timing` | High presentation risk because the client renders AS-03 | Preserve as internal scaffold/test data only; do not activate or describe it as a live timing service |
| AS-08 | `apps/mobile/src/services/chat.ts`, local `astro_timing` response | Local/unconfigured Chat fallback can reach it | Explicit inactive preview: `Timing guidance is not active in this preview.` It redirects reflection to natal scope | Low. The response itself is truthful and makes no timing claim | Retain as explicitly labelled inactive preview; upstream timing entry points still require AS-02/AS-06 resolution |
| AS-09 | `packages/shared/src/config/routes.ts` and `packages/shared/src/config/entitlements.ts` | Internal route/entitlement configuration; current preview hides billing UI | Future `Transit / timing`, `personal_transits`, and `astro_timing` metadata | Low while not user-reachable; high if used to activate product behavior | Preserve as internal fixture/reference data only; do not activate |
| AS-10 | `packages/shared/src/config/chat-router.ts`, mobile Chat, and Edge Chat Solar Return handling | A user can ask about Solar Return or annual themes | Deterministic English/Traditional Chinese fixed response routes to `out_of_scope` | Correct boundary. Solar Return must never become a preview or future feature | Retain the permanent out-of-scope boundary and its protective fixtures |
| AS-11 | Natal, onboarding, golden, safe-context, and Knowledge Bank validator fixtures under `packages/astrology/src` | Test-only | Solar Return, transit, timing execution, Vertex, annual themes, auspicious scoring, and Dice references are deliberate rejection/contamination fixtures | None while test-only; deleting them would weaken scope protection | Preserve as internal fixture/test data only |
| AS-12 | Natal Moon placements in Home, Insights, chart context, and the pure Moon local-day capability rule | Reachable natal display or inactive deterministic natal infrastructure | Birth-chart Moon data, not current-sky transit data | In scope. It must not be confused with AS-01 weekly Moon copy | Retain as natal scope |
| AS-13 | `apps/mobile/dist-qa/_expo/static/js/web/index-2332b8cea52233a52e72cd6265f491df.js` | Reachable only when the tracked QA web export is served | Generated mirror of AS-01 through AS-05 | Same risk as source; it is not a separate product authority | Do not hand-edit. Rebuild only after an authorized source decision |
| AS-14 | Dice motion timing constants and interpretation wording under `apps/mobile/src/features/dice` | Reachable only within Dice | Separate signed-off Dice domain, not Knowledge Bank transit/timing | Excluded from this audit | Preserve untouched; never import Knowledge Bank timing or natal routing into Dice |

## Fixtures and Mocks

The following are safe only as internal development evidence:

- router fixtures that expect `astro_timing`;
- prohibited-scope fixtures containing Solar Return, transit, timing execution,
  Vertex, annual themes, auspicious scoring, or Dice contamination;
- `timing_future` Knowledge Bank draft tags, which are metadata-only and do not
  authorize timing execution;
- future route and entitlement configuration for `astro_timing` and
  `personal_transits`.

They must not be interpreted as founder approval for a reachable feature.

## Readiness Decision

The current preview is **not ready to present weekly-sky or timing output as a
live capability**. AS-01 through AS-07 require a separately authorized product
decision and source repair. Until then, the safe choices are:

1. hide the reachable control/copy until approved;
2. retain it only as an explicitly labelled inactive preview that cannot imply
   a calculated result; or
3. preserve it as internal fixture/test data only.

This audit originally recommended hiding AS-01 through AS-05. That
recommendation is superseded by the founder correction below; the
technical/release-boundary warning remains valid.

The natal chart displays in AS-12 and the permanent Solar Return exclusion in
AS-10 are aligned with current scope. No transit, timing, date ranking, weekly
forecast, or advanced-method accuracy claim is approved by this audit.

## Future Activation Gates

Any later timing or transit work requires new founder authority, an approved
calculation/data source, validation and provenance rules, no-birth-time policy,
privacy review, deterministic failure behavior, device QA, and separate
activation approval. A disclaimer alone is not an activation gate.

No provider/model call, Chat/AI integration, Knowledge Bank retrieval,
migration, deployment, billing change, Dice change, translation, or UI redesign
was performed for this audit.

## Founder Correction - 2026-07-30

The implementation/release-boundary finding remains valid. It does **not**
authorise a weekly-sky, transit, timing, or AI capability, and none of AS-01
through AS-07 may be represented in QA, release claims, or capability registers
as live functionality.

The recommendation to hide AS-01 through AS-05 is superseded. Those
founder-review astrology surfaces remain reachable as clearly controlled
preview/design-reference states, using the same
presentation-versus-capability principle as Care Circle and Notifications.
Their underlying calculation, routing, data, AI, entitlement, persistence,
deployment, and release gates remain inactive and separately required. AS-06
and AS-07 remain internal routing/scaffold implementation warnings, not
activation approval.
