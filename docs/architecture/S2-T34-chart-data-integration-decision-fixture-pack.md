# S2-T34 Chart Data Integration Decision Fixture Pack

Status: pure, synthetic, inactive decision-readiness infrastructure.

This pack exercises the seven open S2-T23 chart-data authority choices without
selecting any policy. Every valid probe represents unresolved or ambiguous
synthetic natal evidence and fails closed with a stable non-echoing code. There
is intentionally no success path.

## Decision Matrix

| Open founder choice | Synthetic ambiguity exercised | Stable failure code | Decision that later unblocks integration |
| --- | --- | --- | --- |
| Absolute-longitude completeness | A required body has no authoritative absolute longitude; display degree cannot substitute | `CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED` | Decide whether deterministic integration requires every approved body longitude or permits a separately approved reconstruction/fallback policy |
| House-cusp authority | Provider absolute cusps and sign/degree reconstruction are both plausible but neither is designated | `CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED` | Choose the authoritative absolute cusp source or approve one named reconstruction rule |
| Canonical angle source | Planet-list and angle-object Ascendant values disagree | `CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED` | Designate the canonical angle representation and mismatch behavior |
| Moon no-time endpoint source | Local-day Moon endpoints are absent and their calculator/source is unapproved | `CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED` | Approve an endpoint source/calculation contract or keep the no-time Moon fact unavailable |
| Chart source/version provenance | A synthetic source ID exists but the authoritative calculation version is missing | `CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED` | Approve required source/version identifiers and retention |
| South Node source | A supplied value and opposite-point derivation agree, but neither source policy is authoritative | `CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED` | Require a supplied South Node or approve deterministic derivation from the North Node |
| Recomputed versus persisted output | Synthetic recomputed and persisted derived outputs have no designated authority | `CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED` | Choose recomputation from immutable input or separately versioned persistence, including mismatch recovery |

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

Later integration remains blocked until the founder resolves all seven choices
and Technical adds the corresponding source contract, migration/persistence
decision where applicable, privacy review, and hosted/device evidence.
