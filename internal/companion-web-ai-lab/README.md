# Companion — Founder Web AI Lab (INTERNAL, free-text multi-turn)

**This is an internal AI-testing interface. It is NOT the signed-off customer Chat UI and must not be represented as one.**

A **Founder-only** exploratory Companion experience for natural, multi-turn Azure AI testing on
**staging**. The Founder picks a chart (Sun/Moon/Mercury/Saturn) and a Lumis role, then has a normal
conversation — questions, statements, feelings, follow-ups, short replies, topic changes. Each turn
shows the selected role, the server-derived Chart Composition, a concise product-level classification
(safe to proceed / crisis-safety / out-of-scope / horoscope / professional boundary), and the final
Lumis response. It reuses the reviewed routing, persona/Chart-Composition, safety wording, prompt
pipeline, Azure deployment and response workflow — through a disposable, session-only path with **no
persistence, no billing, no member state, and no durable raw-conversation storage**.

Conversation context is held **only in the browser session**. Each request may carry a bounded
rolling context (≤ 12 turns) plus the latest message; **New conversation** and **Clear session**
remove that context immediately. The server holds no conversation state and never writes raw
conversation text to files, databases, exports, analytics, or logs.

The 12 frozen synthetic fixtures remain available as a **separate, optional Regression tests tab** —
not the main experience, not a limit on free-text testing, and not required before free text.

## What it reuses (T350 Normal Chat candidate)

The Lab does not re-implement routing/persona/templates. It reuses the reviewed modules from the
T350 candidate directly:

| Concern | Reused module |
|---|---|
| Deterministic route classification + decisions | `packages/shared/src/config/chat-router.ts`, `routes.ts` |
| Language rule (AC-AI-00 §1) | `packages/shared/src/config/app-language.ts` |
| Chart Composition (Persona Behaviour Mapping v1.2) | `packages/shared/src/config/persona-calculator.ts` |
| Reviewed persona prompt assembly | `supabase/functions/_shared/persona-prompt-pipeline-v1.ts` (+ `persona-behavior-v1.ts`) |
| Byte-exact fixed safety/scope wording v0.2 | `supabase/functions/_shared/fixed-template-registry.ts` |
| Server-side Azure identity + transport | `supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts` |
| Companion prompt-version literal | `supabase/functions/_shared/companion-synthetic-prompt-v1.ts` |

Lab-only code lives in `src/lab-*.ts` (orchestration, safety sub-classification, decision trace,
disposable response) + `public/*` (UI) + `test/*`.

## Authority

Follows, in order: Document Authority Map → AI Routing README → **AC-AI-00 v1.5** (canonical
routing/units/language/safety) → AC-AI-01/02/03 v1.2 (route taxonomy, telemetry privacy, charging
invariant) → **Fixed Template Wording Register v0.2** (byte-exact copy) → **Persona Behaviour
Mapping v1.2 + Reconciliation v0.3** (Chart Composition) → **S2-T23** (no birth time / no cusps /
no ASC). Archive/legacy material is not used as authority.

## Run

```
bash internal/companion-web-ai-lab/scripts/start-companion-web-ai-lab.sh
# then open  http://localhost:8410
```

The provider is reachable only when **all** of the following hold; otherwise a turn still routes and
shows its Chart Composition + classification but makes **zero provider calls**:

1. `LUMIS_AI_ENABLED` is not `false` (immediate kill switch);
2. the executable-identity receipt at `LAB_IDENTITY_RECEIPT_PATH` verifies against the **clean**
   runtime worktree (commit + tree + source-complete package checksum + fixed bindings); and
3. the server-side Azure config is present (`LUMIS_CHAT_AI_ENABLED=true` + `LUMIS_CHAT_AZURE_API_KEY`).

The key is server-side only and never sent to the browser. There is **no** per-question or
900-second usage window and **no** 12-message cap on Founder free text — authorization binds the
running *executable identity*, not a per-turn quota.

To run against staging (server-side only):

```
export LUMIS_CHAT_AI_ENABLED=true
export LUMIS_CHAT_AZURE_API_KEY=<staging key>
export LAB_IDENTITY_RECEIPT_PATH=<path to the identity receipt>   # see "Executable-identity authorization"
bash internal/companion-web-ai-lab/scripts/start-companion-web-ai-lab.sh
```

## Test

```
bash internal/companion-web-ai-lab/scripts/test-companion-web-ai-lab.sh
```

Compiles then runs `test/lab-engine.fixtures.ts`, `test/lab-identity.fixtures.ts`,
`test/lab-conversation.fixtures.ts`, `test/lab-regression.fixtures.ts` (node:test) + the static
`scripts/companion-web-ai-lab-contract.mjs`.

## Executable-identity authorization (scope `FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING`)

Microsoft, QA, Technical and the Founder superseded the fixture-first / 900-second design. Live AI is
now authorized by the **running executable identity**, not a per-question window:

- `src/lab-identity.ts` binds: the **final commit**, the **final Git tree**, a **source-complete
  package checksum** (sha256 over the tracked contents of `internal/companion-web-ai-lab`), the
  Founder-only reviewer, the staging environment, the fixed prompt/system version
  (`companion_synthetic_prompt_v1+persona_v1`), the Azure deployment identity, and the disable control
  `LUMIS_AI_ENABLED`.
- **No commit self-reference.** The immutable receipt is generated **after** the final commit exists;
  at runtime the server verifies the receipt's commit/tree/package against the **clean** runtime
  worktree **before** any Azure key or client is accessed.
- `authorizeProvider` order is: **kill switch → executable identity → server-side Azure config**. A
  wrong commit / tree / package, a dirty worktree, a tampered binding, a missing receipt, or
  `LUMIS_AI_ENABLED=false` each fails **before** provider construction (zero Azure access).
- The server only **loads and verifies** a receipt; it never mints one.

### Generate the identity receipt (operator, after the final commit)

```
LAB_IDENTITY_RECEIPT_PATH=/absolute/path/identity-receipt.json \
  node internal/companion-web-ai-lab/scripts/mint-identity-receipt.mjs
```

The generator refuses to run against a dirty worktree, writes the receipt to
`LAB_IDENTITY_RECEIPT_PATH`, and prints the bound commit / tree / package checksum. Point the server
at the same `LAB_IDENTITY_RECEIPT_PATH` to authorize the provider path.

## Routing states (distinct, per AC-AI-00 §2)

`crisis_imminent` · `distress_safety_check` · `illegal_boundary` · `professional_direct` ·
`out_of_scope` · `out_of_scope_solar_return` · `astro_timing_handoff` (explicit confirm; ≤3 dates) ·
`dice_handoff` (normal response + Go-to-Dice) · `casual` / `knowledge` / `astro_deep` (generative) ·
`route_unavailable` (provider disabled) · `router_unavailable` (provider failed after one retry) ·
`chart_unavailable` (Mercury required) · `technical_error` (malformed input, pre-provider).

## Endpoints

- `GET /api/lab/config` — non-secret config: roles, signs, languages, `max_context_turns`,
  provider readiness, kill-switch state, executable-identity status, model identity, regression list.
- `GET /api/lab/identity/status` — content-free executable-identity status.
- `POST /api/lab/conversation` — the main free-text, multi-turn turn:
  `{ schema_version:"companion_web_ai_lab_request_v1", role_code, chart{sun,moon,mercury,saturn,moon_confirmed}, message, app_language_preference, context:[{role,text}] }`.
- `POST /api/lab/regression` — one optional frozen fixture:
  `{ schema_version:"companion_web_ai_lab_regression_request_v1", fixture_id }`.

## Security posture

- The browser sends **only** the controlled chart context + role + latest message + a bounded
  browser-held rolling context to `POST /api/lab/conversation`; the regression tab sends only a
  `fixture_id`. The browser never contacts Azure and holds no credentials.
- All Azure/Supabase credentials and provider configuration remain server-side; the browser bundle
  contains no endpoint or secret (enforced by the contract runner).
- Provider access is gated by the executable-identity authorization + the `LUMIS_AI_ENABLED` kill
  switch, verified against the clean worktree **before** any Azure key access.
- Raw conversation text is never persisted or logged. Telemetry is content-free
  (AC-AI-01/02/03 DEC-03): routing/outcome metadata only — no message content, context, birth data,
  names, or private text. No chain-of-thought, provider internals, or raw system prompts are exposed.
- Disposable: `units_charged: 0`, `persistence: "not_committed"`, session-only conversation. No
  customer threads/accounts, billing units, or member state are touched.
- Fixed crisis/safety/out-of-scope wording is never replaced by model output.

## Known documentation note

Persona workbook Worked Example 4 prints `Saturn: Virgo(6)`; the controlled `Calculation_Rules`
formula (and the reused `persona-calculator.ts`) yield `Libra(7)` for that unconfirmed-Moon case
(Sun/Mercury match). The code/formula is authoritative; the printed value is a documentation typo.
Surfaced here for Founder awareness — no source change made.
