# Companion Chat — one shared server-side composition/routing system (mobile wiring, round 1)

**Scope:** Companion Web Lab + mobile normal-Chat product path, server-side Chat route only where required.
**Canonical base:** `74787b3` (`claude-fable/s2-companion-web-ai-lab`) — treated as the latest canonical Companion
prompt implementation. Nothing in its shared assembler, role contracts, Persona Behaviour Mapping v1.3, safety,
routing, persistence, schema, or `+arch_v3` prompt identity is overwritten or recreated by this change.
**Posture:** structural only — no traffic enabled, no deployment, no Foundry/Azure change, no billing/persistence/
schema/safety/routing change. `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY` remain in force.

## 1. The one shared server-side composition/routing system

The single canonical composition/routing system already exists under version control and the Web Lab already
consumes all of it. Nothing here duplicates it.

| Concern | Canonical shared module |
|---|---|
| Route classification + credits + Solar-Return / safety selectors | `packages/shared/src/config/chat-router.ts`, `routes.ts` |
| Language rule (AC-AI-00 §1) | `packages/shared/src/config/app-language.ts` |
| Chart Composition (Persona Behaviour Mapping) | `packages/shared/src/config/persona-calculator.ts` |
| Reviewed persona prompt pipeline | `supabase/functions/_shared/persona-prompt-pipeline-v1.ts` (+ `persona-behavior-v1.ts`, `persona-behavior-mapping-v1.ts` v1.3) |
| **Single canonical Prompt v3 assembler** (Character Summary + Member Comfort Profile blocks) | `supabase/functions/_shared/companion-synthesis-v1.ts` → `assembleCompanionPromptV3(...)` |
| Voice/naturalness | `supabase/functions/_shared/companion-voice-and-naturalness-v1.ts` |
| Byte-exact fixed safety/scope wording v0.2 | `supabase/functions/_shared/fixed-template-registry.ts` |
| Server-side Azure identity + transport | `supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts` |

The Web Lab consumes these directly (`internal/companion-web-ai-lab/src/lab-engine.ts` → `lab-provider.assemblePersona`
→ `assembleCompanionPromptV3`). The Lab keeps **no** independent Prompt v3 assembly (enforced by
`internal/companion-web-ai-lab/scripts/companion-web-ai-lab-contract.mjs`).

## 2. Mobile normal-Chat product path — status and the shared-composition seam

The active mobile product path is `apps/mobile/src/services/chatProductIntegrationRc.ts` (T341) →
`normalChatAiCandidate.ts` → server `supabase/functions/_shared/normal-chat-ai-candidate-v1.ts`. It is **deliberately
disabled**: `CHAT_PRODUCT_INTEGRATION_ENABLED = false`, `CHAT_PRODUCT_TRAFFIC_ENABLED = false`,
`NORMAL_CHAT_AI_INTEGRATION_ENABLED = false`, `NORMAL_CHAT_AI_TRAFFIC_ENABLED = false`, and it requires an accepted
evidence digest that is `null` — all behind `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` / `NO_AZURE_TRAFFIC_AUTHORITY`.
Its provider/composition seam (`NormalChatProviderClient.createProviderClient`) is **dependency-injected and not
implemented**; the candidate itself performs admission, idempotency, atomic commit, and unit accounting only. It
therefore contains **no** prompt/composition of its own today.

**Designated seam (verified, not yet wired):** when the product path is later authorized (traffic + accepted digest +
re-seal, all founder-gated), the injected provider client MUST build its turn through §1's shared modules —
`persona-calculator` → `runPersonaPromptPipeline` → `assembleCompanionPromptV3`, with `fixed-template-registry` for
every fixed disposition — exactly as the Lab does. It must not introduce a second assembler, role contract set, or
fixed-wording source.

### Conflict reported (blocks the literal "wire the candidate" edit this round)

The product-path candidate source files — `apps/mobile/src/services/chatProductIntegrationRc.ts`,
`normalChatAiCandidate.ts`, and `supabase/functions/_shared/normal-chat-ai-candidate-v1.ts`,
`chat-product-path-candidate-v1.ts` — are **sealed** by `s2-t311/-t326/-t341` (`config/*-seal.json`). Adding the
composition import to them changes their sealed source, which would fail `seal --check` and require a founder-gated
re-seal — i.e. it would modify sealed T3xx product artefacts. Per the round-1 posture (treat `74787b3` as canonical,
do not overwrite its work, report conflicts before changing code) this edit is **not** made here. It is the first
step of the next, separately authorized round: add the one-line shared-composition binding at the injected provider
seam and refresh the affected seals.

## 3. What this round changed (structural, seal-safe)

Only un-sealed surfaces were touched. Four files:

1. `packages/shared/src/config/chat-router.ts` — **additive**. Adds app-boundary fixed-template mirrors
   (`OUT_OF_SCOPE_*`, `PROFESSIONAL_BOUNDARY_*`, `ROUTE_UNAVAILABLE_*`), their language selectors
   (`getOutOfScopeResponse`, `getProfessionalBoundaryResponse`, `getRouteUnavailableResponse`), and the distinct
   `isProfessionalDirectRequest` refinement (regex byte-identical to the reviewed Lab planner `PROFESSIONAL_DIRECT`).
   `classifyChatRoute` route semantics and route credits are unchanged.
2. `apps/mobile/src/services/chat.ts` (legacy, orphaned — imported only as a type by `App.tsx`) — its local path now
   selects **every** disposition from the shared canonical wording and improvises nothing. A direct professional
   request now returns the distinct `PROFESSIONAL_BOUNDARY` wording instead of the previous invented string that
   blended medical/legal/financial into `out_of_scope`. Disabled generative routes surface the canonical
   `ROUTE_UNAVAILABLE` template.
3. `supabase/functions/chat-message/index.ts` (legacy server scaffold) — same canonicalization server-side. Preserves
   its persistence RPC, idempotency, rate-limit, and shared route-credit derivation.
4. `scripts/companion-shared-composition-contract.mjs` — **new** verification/regression. Proves: the app-boundary
   wording is byte-exact with the server registry; the legacy path uses only shared wording with a distinct
   professional_direct outcome and invents no reply text; the single Prompt v3 assembler exists only in
   `companion-synthesis-v1.ts` and no mobile surface reimplements it; the client never imports the server pipeline/
   synthesis; and the product-path traffic gates remain OFF.

The single source of fixed wording remains the server registry; the app-boundary mirror is guarded byte-exact against
it by the new contract (the same drift-guard idiom already used for route credits by `scripts/route-credit-drift.mjs`).

## 4. MOB base (`codex/s2-t350-normal-chat-mobile-live`, `eb22a1a`) — not merged, by design

`eb22a1a` is `b39f21e` (the base it supersedes) + one commit, "harden staging Responses handling", touching
`azure-chat-synthetic-adapter-v1.ts`, `chat-synthetic-gateway-v1.ts`, `chat-synthetic/index.ts`, `founderLiveChat.ts`,
`App.tsx`, `env.d.ts`, and `config/founder-live-chat-candidate.json`. `74787b3` (canonical, 38 commits newer) carries
its own, newer versions of those same files. Merging `eb22a1a` would re-introduce the older Aug‑16 hardening over
`74787b3`'s canonical work — contrary to the round-1 directive to treat `74787b3` as canonical and not overwrite it.
It is therefore intentionally **not** merged, and flagged here for founder confirmation. If any specific hardening in
`eb22a1a` is found to be absent from `74787b3`, it should be ported as a discrete, reviewed change rather than a
whole-branch merge.

## 5. Gap report (for a later, separately authorized round)

- **Product-path composition wiring** is blocked by the T3xx seals + `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` (see §2).
  Next round, under authority: bind the injected provider seam to `assembleCompanionPromptV3` + the pipeline + the
  registry and refresh the affected seals — no new composition.
- **Synthesis layers.** The Character Summary and Member Communication & Comfort Profile blocks are **present and
  consumed** in the canonical base `74787b3`, which is the authorized correction-round commit (it supersedes
  `245bd94` and already carries the Spark-Sun, duplicate-flavour, consolidated-role-contract, failed-response
  continuity, and version-traceability corrections). This round preserves that work untouched and does not redesign
  it; the earlier Technical-Architect workplan framing of these layers as un-started is superseded by `74787b3`. Any
  further synthesis/prompt change is a separate authorized round, not part of this mobile-wiring change.
- **Pre-existing failing fixture (not introduced here):**
  `supabase/functions/chat-message/chat-persistence.fixtures.mjs` asserts an `App.tsx` recovery-UI pattern
  (`>Retry< … >New topic<`) that the current `App.tsx` no longer contains. This fails identically on the untouched
  `74787b3` base (verified by re-running with this change stashed). `App.tsx` is outside this round's scope; flagged
  for the owner to reconcile the fixture with the current recovery wording.

## 6. Local verification (no deployment)

```
node scripts/companion-shared-composition-contract.mjs        # new: shared composition + no-second-system
node scripts/route-credit-drift.mjs                           # route credits unchanged
node scripts/persona-prompt-pipeline-contract.mjs             # app does not import the server pipeline
node scripts/fixed-template-registry-contract.mjs             # registry integrity
node internal/companion-web-ai-lab/scripts/companion-web-ai-lab-contract.mjs   # Lab still owns one shared assembler
tsc -p packages/shared/tsconfig.router-test.json && node .tmp/router-tests/config/chat-router.fixtures.js
```

All of the above pass on this branch. iPhone/server behaviour is unchanged because no traffic is enabled and no
function is deployed; real-device / server verification is handed back to local Technical with this PR SHA once a
subsequent, separately authorized round wires and re-seals the product path.
