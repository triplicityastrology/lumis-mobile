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
