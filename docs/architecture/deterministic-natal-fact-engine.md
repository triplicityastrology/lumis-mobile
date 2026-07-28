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

Part 2 will add deterministic natal-aspect calculation under the same metadata
contract.
