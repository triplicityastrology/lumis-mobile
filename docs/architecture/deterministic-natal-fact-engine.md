# Deterministic Natal Fact Engine

Status: source-only, pure calculation foundation. No provider, AI, persistence,
mobile UI, migration, or deployment integration.

Rule authority: founder-approved Knowledge Bank v0.2 rules supplied for S2-T14.

## Part 1 implementation

`packages/astrology/src/natal-facts.ts` provides:

- canonical natal body and angle keys with bounded aliases;
- explicit `supplied` / `not_supplied` birth-time capability resolution;
- suppression of houses, angles, chart ruler, house rulers, hemisphere,
  house-stellium, and occupancy facts when time is not supplied;
- the Moon local-day endpoint rule, which asserts a Moon sign only when both
  endpoints are available and remain in the same zodiac sign;
- traditional sign rulers, chart ruler, and house-ruler facts, including the
  stable `house_10_ruler` key.

Every derived result includes its canonical key, source fields, rule version,
capability requirement, derived flag, applicability, safe reason, and
provenance rule. Suppressed facts retain metadata but carry no value.

The alias registry intentionally has no Solar Return, transit, timing, Vertex,
or Dice keys. Existing provider normalization and chart sanitization remain
unchanged.

## Current boundary

- This module derives structural facts only. It produces no interpretation,
  score, dignity, prediction, annual theme, or favorable/unfavorable label.
- It does not infer an unknown Moon sign from a noon chart.
- It does not infer houses or angles from absent birth time.
- It does not change the existing `chart_v2` provider contract.

## Part 2 implementation

`packages/astrology/src/natal-aspects.ts` derives unordered natal pairs from
canonical points and normalized circular longitude:

| Aspect | Exact angle | Inclusive orb |
|---|---:|---:|
| Conjunction | 0 degrees | 8 degrees |
| Sextile | 60 degrees | 4 degrees |
| Square | 90 degrees | 8 degrees |
| Trine | 120 degrees | 8 degrees |
| Opposition | 180 degrees | 8 degrees |
| Quincunx | 150 degrees | 2 degrees |

Input aliases are canonicalized and duplicate aliases cannot create duplicate
pairs. Pair order and fact keys are stable regardless of input order. Angle
aspects require supplied birth time and are omitted otherwise.

Aspect facts expose separation, exact angle, orb, source fields, rule version,
capability requirement, derived/applicable flags, safe reason, and provenance.
They do not infer applying/separating status, retrograde or station state, node
motion conventions, a noon chart, Solar Return, transit/timing, Vertex, or Dice
meaning.

## Integration boundary

The engine is not yet wired into provider normalization, persisted chart JSON,
Chat context, Knowledge Bank retrieval, or mobile rendering. The existing
`NatalWheel` display calculation remains unchanged; replacing that UI-local
logic requires a separately authorised integration and visual regression pass.

## Provider-normalised natal input boundary

`packages/astrology/src/natal-input-boundary.ts` is the closed, inactive adapter
in front of the deterministic engines. It accepts only
`natal_engine_input_v1` with:

- `chartType: natal`;
- `precision: full | no_birth_time`;
- explicit point aliases and absolute longitudes;
- an explicit house list;
- optional Moon local-day endpoint longitudes.

It rejects unknown fields, malformed values, duplicate canonical aliases,
timed data in a no-birth-time chart, and any Solar Return, transit, timing,
Vertex, `SR`, return-chart, or annual-theme scope. Rejections expose only a
stable code, controlled reason, and bounded location. They never echo input.

Successful output contains canonical point keys, normalized longitudes,
resolved birth-time capabilities, deterministic source-field provenance, and
no interpretation. This boundary is not wired to a provider, persistence,
mobile UI, Chat, AI retrieval, or Dice. It has no credentials, network call,
database operation, migration, or deployment path.

## Deterministic natal engine composer

`packages/astrology/src/natal-engine-composer.ts` is the inactive composition
boundary for the three accepted deterministic layers. It validates the closed
`natal_engine_input_v1` contract before deriving anything, then returns only a
versioned `natal_engine_output_v1` envelope containing:

- validated input provenance;
- resolved birth-time capabilities;
- canonical Moon/ruler facts supported by the accepted fact engine;
- approved natal aspects supported by the accepted aspect engine.

Facts and aspects use stable canonical-key ordering. Invalid and prohibited
input returns the input boundary's bounded, non-echoing error unchanged. Solar
Return, transit, timing, Vertex, annual-theme, and unknown fields cannot enter
composition.

This output is inactive technical infrastructure and is not exposed to users.
It performs no Knowledge Bank retrieval, interpretation, Chat or AI context,
provider request, persistence, mobile/UI integration, migration, deployment,
billing, or Dice integration.

## Provider-neutral natal adapter

`packages/astrology/src/provider-neutral-natal-adapter.ts` is inactive technical
infrastructure before `natal_engine_input_v1`. It accepts only the closed
`provider_neutral_natal_v1` payload:

- `chartType: natal`;
- `precision: full | no_birth_time`;
- bounded safe source and calculation identifiers;
- approved natal point names and finite longitudes;
- numbered house cusps;
- optional Moon local-day endpoints.
- timed house data is admitted by the provider adapter only with an explicit
  `placidus` declaration and bounded calculation method/version provenance;
- supplied no-birth-time Moon local-day endpoints require a bounded named
  method/version, and their absence never triggers a noon substitution.
  The adapter omits any exact no-time Moon point; only the endpoint stability
  rule may produce the bounded Moon-sign fact.

The designated `triplicity_cloudflare_worker` `chart_v2` lifecycle mapping
declares its approved Placidus cusp contract as
`triplicity_worker_placidus_cusps` / `chart_v2`. Other provider-neutral callers
must supply their own validated declaration; the adapter does not infer one.

The adapter rejects unknown fields, duplicate canonical aliases, non-natal chart
types, Solar Return or contextual `SR`, transit, timing, annual-theme, Vertex,
and timed data in a no-birth-time payload. A successful result contains only the
mapped `natal_engine_input_v1` object and bounded adapter provenance. It carries
no raw provider payload downstream. Failures contain only stable code, reason,
and location fields and never echo rejected values.

The adapter makes no provider or network call and has no credentials,
persistence, mobile/UI, Chat/AI, Knowledge Bank retrieval, migration,
deployment, billing, or Dice integration. It is not exposed to users.

## Safe natal context projector

`packages/astrology/src/safe-natal-context.ts` is inactive technical
infrastructure after `natal_engine_output_v1`. It accepts only the closed,
runtime-validated engine output and returns `natal_context_v1` with:

- deterministic engine/input/fact version provenance;
- the birth-time capability matrix;
- approved canonical Moon and traditional-ruler facts;
- approved natal aspects in stable canonical-key order.

The projector preserves approved aspects involving Chiron and the North and
South Nodes for future Lumis Chat context. It does not create standalone
placements or infer additional facts. It rejects every unknown field and
excludes raw birth data, account identifiers, coordinates, raw provider
responses, internal errors, Solar Return, transit, timing, annual-theme,
Vertex, billing/entitlements, and Dice data.

This module performs no AI/provider call, Chat integration, Knowledge Bank
retrieval, persistence, logging, mobile/UI work, migration, or deployment. It
is not imported by Dice, is not exposed to users, and cannot produce a
user-visible interpretation.
