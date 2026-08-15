# Companion / Normal Chat — Web AI Lab (INTERNAL)

**This is an internal AI-testing interface. It is NOT the signed-off customer Chat UI and must not be represented as one.**

A Founder testing tool that exercises the reviewed Lumis Normal Chat routing, persona/chart
composition, fixed safety/scope wording, and (only when explicitly enabled server-side) one real
staging generative call — all through a disposable, session-only path with **no persistence, no
billing, no member state**.

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

Default-off: with no `LUMIS_CHAT_*` env, the Lab makes **zero provider calls**; generative routes
return the `route_unavailable` fixed copy, while all safety/scope/handoff routes return their exact
deterministic output.

To enable one real staging generative call (server-side only; never sent to the browser):

```
export LUMIS_CHAT_AI_ENABLED=true
export LUMIS_CHAT_AZURE_API_KEY=<staging key>
bash internal/companion-web-ai-lab/scripts/start-companion-web-ai-lab.sh
```

## Test

```
bash internal/companion-web-ai-lab/scripts/test-companion-web-ai-lab.sh
```

Runs the compiled `test/lab-engine.fixtures.ts` (node:test) + the static `scripts/companion-web-ai-lab-contract.mjs`.

## Routing states (distinct, per AC-AI-00 §2)

`crisis_imminent` · `distress_safety_check` · `illegal_boundary` · `professional_direct` ·
`out_of_scope` · `out_of_scope_solar_return` · `astro_timing_handoff` (explicit confirm; ≤3 dates) ·
`dice_handoff` (normal response + Go-to-Dice) · `casual` / `knowledge` / `astro_deep` (generative) ·
`route_unavailable` (provider disabled) · `router_unavailable` (provider failed after one retry) ·
`chart_unavailable` (Mercury required) · `technical_error` (malformed input, pre-provider).

## Security posture

- The browser sends **only** the controlled test context + message to `POST /api/lab/message`.
- All Azure/Supabase credentials and provider configuration remain server-side; the browser bundle
  contains no endpoint or secret (enforced by the contract runner).
- Telemetry is content-free (AC-AI-01/02/03 DEC-03): no message content, birth data, names, or
  private text — routing/outcome metadata only.
- Disposable: `units_charged: 0`, `persistence: "not_committed"`, session-only conversation. No
  customer threads/accounts, billing units, or member state are touched.
- Fixed crisis/safety/out-of-scope wording is never replaced by model output.

## Known documentation note

Persona workbook Worked Example 4 prints `Saturn: Virgo(6)`; the controlled `Calculation_Rules`
formula (and the reused `persona-calculator.ts`) yield `Libra(7)` for that unconfirmed-Moon case
(Sun/Mercury match). The code/formula is authoritative; the printed value is a documentation typo.
Surfaced here for Founder awareness — no source change made.
