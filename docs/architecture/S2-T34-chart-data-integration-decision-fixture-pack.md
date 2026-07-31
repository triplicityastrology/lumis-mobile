# S2-T34 Chart Data Integration Decision Fixture Pack

Status: retained pure, synthetic, inactive pre-decision regression corpus.

This pack was created before the seven S2-T23 decisions were recorded on
2026-07-30. Those decisions are now closed and reconciled in
`S2-T23-current-chart-data-authority-matrix.md`. The fixtures remain useful as
negative tests: ambiguous input that violates a settled authority rule still
fails closed with its original stable non-echoing code. There is intentionally
no success path in this historical probe module.

## Decision Matrix

| Settled founder choice | Synthetic ambiguity exercised | Stable legacy failure code | Current authority |
| --- | --- | --- | --- |
| Absolute-longitude completeness | A required body has no authoritative absolute longitude; display degree cannot substitute | `CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED` | Designated API absolute longitude is required; fail closed |
| House-cusp authority | Cusp source is ambiguous | `CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED` | Declared timed house system and ordered cusp array; none without time |
| Canonical angle source | Planet-list and angle-object Ascendant values disagree | `CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED` | Structured timed angles; duplicate values must agree |
| Moon no-time endpoint source | Local-day Moon endpoints are absent | `CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED` | Named versioned endpoint method or Moon fact unavailable; never noon |
| Chart source/version provenance | Calculation version is missing | `CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED` | Immutable source/version snapshot provenance |
| South Node source | Supplied and derived values disagree | `CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED` | North Node plus 180 degrees, marked derived |
| Recomputed versus persisted output | Persisted output claims authority over its source snapshot | `CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED` | Recompute from immutable snapshot; cache is non-authoritative |

## Safety Boundary

- Fixtures contain synthetic non-personal natal values only.
- The probe accepts only its closed version, synthetic data classification,
  timed/no-time fixture kind, known decision, and decision-specific ambiguity.
- Failures return only code, stable reason, and decision key. They never return
  fixture evidence or scalar values.
- Unknown decisions, cross-decision ambiguities, extra fields, non-synthetic
  classification, and malformed inputs fail closed.
- The module is not exported from the astrology package public index and has no
  production caller.

## Explicit Non-Integration

This pack makes no provider or network call, reads no credential, and has no
persistence, mobile/UI, Chat/AI, Knowledge Bank retrieval, Dice, billing,
migration, deployment, staging, or logging integration. It does not authorize
chart-data wiring or user-visible derived facts.

The Founder choices are resolved. Integration remains subject to source
contracts, privacy review, and hosted/device evidence; this negative fixture
pack does not itself authorise or implement integration.
