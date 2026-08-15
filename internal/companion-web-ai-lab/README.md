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

## Live 12-case window (fixture-gated AI)

Microsoft flagged that live AI must not accept unrestricted browser free text. Corrected:

- **Free text is offline-only.** `POST /api/lab/message` never contacts a provider (routing/persona/
  template preview only), even when a key is present. The UI labels it accordingly.
- **Live AI runs only for the closed 12-fixture window.** `POST /api/lab/live` accepts **only**
  `{ schema_version, fixture_id }`; the server retrieves the frozen synthetic text (and its frozen
  role+chart) and runs it through the reused `ChatSyntheticRun` gateway. Arbitrary browser text can
  never reach Azure.
- **Reused authority:** the 12 fixtures are `FOUNDER_CHAT_FIXTURE_IDS` (6 EN / 6 zh-Hant) with frozen
  text from `chat-synthetic-registry-v1.ts`; the window is validated by the repo's own
  `validateFounderChatWindowAuthority` bound to the authorized packet.
- **Packet enforced server-side** (scope `FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY`): 12 logical cases,
  6 EN / 6 zh-Hant, ≤24 attempts, concurrency 1, one retry, shared 12s deadline, 1200 input / 300
  output token caps, 900s window, single use.
- **Atomic single-use ledger** (`src/lab-live-window.ts`): a promise-chain mutex (concurrency 1) plus
  a durable, content-free ledger file so browser refresh, server restart, replay and concurrent
  requests cannot bypass the limits. The window disables in `finally` on completion, expiry, cap
  breach or deviation.
- **Receipt** returned per live turn (window id, packet SHA, registry/package checksums, used/remaining).

### Immutable authorization receipt (the server never mints its own window)

The window is authorized by an **immutable receipt file** loaded before startup, not by the server
clock. `src/lab-live-receipt.ts`:

- The server **loads + verifies** one receipt (`LAB_LIVE_RECEIPT_PATH`) and its exact
  `receipt_checksum` **before any Azure key or client is accessed**. It never constructs or refreshes
  an authorization from `now`.
- The receipt is bound to: the carried Founder packet `05b7a182…`, accepted Dice evidence
  `f9503a7a…`, the registry checksum, the recomputed package checksum, the continuation lineage
  commit `4862809…`, the exact 12 fixture IDs and caps, and **fixed** `issued_at`/`valid_until`
  (≤ 900 s). Verification reuses the repo's `validateFounderChatWindowAuthority`.
- A missing, altered, expired, previously-consumed, or identity-mismatched receipt is rejected
  **before provider construction** (`LAB_LIVE_RECEIPT_MISSING/_CHECKSUM_MISMATCH/_IDENTITY_MISMATCH/_EXPIRED`).
- A receipt-bound **seal** (`<receipt>.seal`) makes the single-use window survive ledger deletion:
  deleting the working ledger after activation fails closed (`LAB_LIVE_LEDGER_MISSING`) — no replay,
  no new window. Restart keeps both files and continues; expiry is the receipt's fixed `valid_until`.
- Operators/tests mint a receipt out of band via `mintLocalReceipt(issuedAtMs, validUntilMs)`; the
  server request path never calls it.

Checksums (recomputable via the config/status endpoints):

| Item | SHA-256 |
|---|---|
| Authorized packet (carried) | `05b7a182de81f8de64d0c91475b24568d4470fd13ff716f16f372acb3e6e19b0` |
| Accepted Dice evidence (bound) | `f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612` |
| Registry checksum (12 bound fixtures) | `b25a0718bf8bd56fab00f3588e136fd57e2490fd15092ccd5caded0b25305a3f` |
| Package checksum (recomputed) | `c99e02ea4ba2a14fcfe21afa71f6444e7e65798cd27ee8235b1af08ddf48a5ef` |
| Continuation commit (bound) | `4862809e6946b79b5abe1dbaa870d3ed4292971a` |
| Window id | `a618ec71b3a2eea3400dca0f4a0a12f6` |

To exercise the live window, set `LUMIS_CHAT_AI_ENABLED=true` + `LUMIS_CHAT_AZURE_API_KEY=<staging key>`
server-side, place a valid receipt at `LAB_LIVE_RECEIPT_PATH`, start the Lab, pick an authorized
fixture, and click **Run live fixture**. Optional `LAB_LIVE_LEDGER_PATH` overrides the working-ledger
location (default `<worktree>/.tmp/lab-live-window-ledger.json`).

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
