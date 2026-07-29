# S2-T19 Natal Lifecycle Integration Test Plan

Status: inactive, non-networked, source-level test plan.

This plan prepares future verification of the pure natal lifecycle:

```text
provider_neutral_natal_v1
  -> natal_engine_input_v1
  -> natal_engine_output_v1
  -> natal_context_v1
```

It does not connect the lifecycle to a provider, persistence, restoration,
Edge Functions, Chat, Knowledge Bank retrieval, AI, mobile UI, migration,
deployment, billing, or Dice.

## Test harness boundary

When separately authorised, the executable fixture should call only:

1. `adaptProviderNeutralNatalPayload`;
2. `validateNatalEngineInput`;
3. `composeNatalEngineOutput`;
4. `projectSafeNatalContext`.

The fixture must use static synthetic objects committed with the test. It must
not read environment variables, make network calls, load customer records, or
write files, logs, databases, analytics, or snapshots containing payloads.

Every failure assertion must compare stable error code, reason, and location
only. Assertion messages must never include actual input or output values.

## Required fixture matrix

| ID | Scenario | Required assertions |
|---|---|---|
| `NL-001` | Complete timed natal chart | Adapter accepts; boundary accepts; capabilities enable timed facts; chart ruler and houses include `house_10_ruler`; context remains natal-only. |
| `NL-002` | No-birth-time natal chart | Houses and angles are absent before validation; timed capabilities are false; no house/chart-ruler facts survive; Moon endpoint rule is deterministic. |
| `NL-003` | Chiron and Nodes | Approved aspects involving `chiron`, `north_node`, and `south_node` survive into `natal_context_v1` for future Lumis Chat context only; no standalone extra placement is invented. |
| `NL-004` | Malformed provider payload | Adapter returns a stable non-echoing `NATAL_ADAPTER_*` failure; later stages are not called. |
| `NL-005` | Duplicate aliases | `Sun` plus `Sol`, `Moon` plus `Luna`, and equivalent node/angle aliases fail before composition. |
| `NL-006` | Scope contamination | Solar Return, contextual `SR`, transit, timing, annual-theme, Vertex, unknown chart types, and unknown fields fail closed at the earliest boundary. |
| `NL-007` | Exact-orb aspects | Conjunction 8 degrees, sextile 4 degrees, square 8 degrees, trine 8 degrees, opposition 8 degrees, and quincunx 2 degrees are included; each just-outside case is absent. |
| `NL-008` | Deterministic ordering | Repeated identical input is byte-stable; input point order does not alter canonical fact/aspect key order; projector restores canonical ordering. |
| `NL-009` | PII exclusion | No email, account/user identifier, birth date/time, coordinates, raw provider response, token, URL, secret, internal error, or customer payload reaches engine output, safe context, failure output, or evidence. |
| `NL-010` | Closed output contracts | Every extra root or nested field is rejected; output shapes contain only their versioned allow-lists. |
| `NL-011` | No-time contamination | Angles, houses, house rulers, and timed placements in no-birth-time input fail before `natal_engine_input_v1`. |
| `NL-012` | Dice exclusion | Dice imports no natal adapter, boundary, composer, or context module and receives no natal lifecycle data. |

## Determinism evidence

The future fixture must:

- run each accepted case twice and compare serialized safe outputs;
- reverse provider-neutral point and house order where semantically equivalent;
- assert canonical-key ordering for facts and aspects;
- assert unordered aspect pairs appear once;
- assert stable contract and rule versions;
- avoid timestamps, random IDs, locale-sensitive formatting, and system clocks.

## Privacy and scope evidence

The future fixture must recursively inspect keys and values in successful and
failed outputs. It must prove absence of:

- raw birth date, raw birth time, place, coordinates, email, account/user IDs;
- raw provider payloads, request/response bodies, credentials, URLs, or tokens;
- Solar Return, `SR`, transit, timing, annual-theme, Vertex;
- billing, entitlements, plans, payment, credits;
- Dice fields, questions, throws, interpretation, or history;
- stack traces, raw errors, or assertion actual/expected diagnostics.

Synthetic source and calculation identifiers may exist only in the adapter
result. They must be bounded opaque fixture identifiers and must not enter
`natal_engine_input_v1`, `natal_engine_output_v1`, or `natal_context_v1`.

## Future activation gates

None of the following is authorised or proven by this plan:

### Persistence gate

- Define an approved versioned storage envelope.
- Add forward-only schema design, RLS, ownership, deletion, retention, and
  idempotency review.
- Prove no raw provider payload or private birth data is duplicated into the
  deterministic fact/context envelope.

### Account-restoration gate

- Prove the stored version reloads into the same deterministic output.
- Prove active chart-version ownership and historical-version isolation.
- Prove no missing/temporary restore state creates a replacement chart.

### Edge and Chat integration gate

- Define an authenticated server-only operation boundary.
- Prove active-chart selection and cross-user denial.
- Preserve safe error codes without exposing raw payloads.
- Keep Chiron and Nodes available only in approved Lumis Chat natal context.

### Knowledge Bank retrieval gate

- Approve retrieval keys and document authority/version matching.
- Prove retrieved material is natal-only and does not introduce Solar Return,
  timing, transit, annual-theme, Vertex, or scoring.
- Prove no generative call occurs before deterministic retrieval gates pass.

### User-facing interpretation gate

- Obtain founder/PM approval for copy, language, safety, and capability
  presentation.
- Complete device accessibility and unknown-birth-time QA.
- Keep derived facts invisible until interpretation and provenance presentation
  are explicitly approved.

## Dice exclusion

Dice is fully excluded from this lifecycle. No Dice package, screen, physics
module, history, question, result, or future interpretation path may import,
call, receive, persist, or display the natal adapter, validated input, engine
output, or safe natal context.

## Current local validation

The current command validates this plan's completeness and inactive boundary:

```text
pnpm test:natal-lifecycle-plan
```

It performs static local checks only. It does not execute the future lifecycle
integration fixture, invoke AI, call a provider, access Supabase, apply a
migration, deploy anything, or expose output to a user.

## Future completion evidence

After each separate gate is authorised, evidence must record:

- exact reviewed commit;
- fixture IDs executed;
- pass/fail counts and first stable failure code;
- redacted schema/version assertions;
- PII scan result;
- explicit confirmation that no customer data or secret was used;
- remaining inactive gates.

Until every applicable gate is separately approved and tested, the natal
lifecycle remains inactive technical infrastructure.
