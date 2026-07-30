import {
  CHART_DATA_AUTHORITY_PROBE_VERSION,
  probeUnresolvedChartDataAuthority,
  type ChartDataAuthorityDecision,
  type ChartDataAuthorityFailureCode,
} from "./chart-data-authority-decision-gate";

const syntheticTimedNatal = {
  fixtureId: "synthetic_timed_natal_authority_probe",
  chartType: "natal",
  precision: "full",
  points: [
    { key: "sun", absoluteLongitude: 14 },
    { key: "moon", absoluteLongitude: 82 },
    { key: "ascendant", absoluteLongitude: 191 },
    { key: "medium_coeli", absoluteLongitude: 101 },
  ],
  houses: Array.from({ length: 12 }, (_, index) => ({
    no: index + 1,
    cuspLongitude: (191 + index * 30) % 360,
  })),
} as const;

const syntheticNoTimeNatal = {
  fixtureId: "synthetic_no_time_natal_authority_probe",
  chartType: "natal",
  precision: "no_birth_time",
  points: [
    { key: "sun", absoluteLongitude: 14 },
    { key: "moon", absoluteLongitude: 82 },
    { key: "north_node", absoluteLongitude: 205 },
    { key: "south_node", absoluteLongitude: 25 },
  ],
  houses: [],
} as const;

const cases: Array<{
  decision: ChartDataAuthorityDecision;
  fixtureKind: "timed_natal" | "no_birth_time_natal";
  ambiguity: string;
  expectedCode: ChartDataAuthorityFailureCode;
  syntheticEvidence: unknown;
}> = [
  {
    decision: "absolute_longitude_completeness",
    fixtureKind: "timed_natal",
    ambiguity: "required_body_longitude_missing",
    expectedCode:
      "CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticTimedNatal,
      points: [
        syntheticTimedNatal.points[0],
        { key: "moon", absoluteLongitude: null },
      ],
    },
  },
  {
    decision: "house_cusp_authority",
    fixtureKind: "timed_natal",
    ambiguity: "absolute_cusp_source_not_designated",
    expectedCode: "CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticTimedNatal,
      cuspCandidates: {
        providerAbsolute: syntheticTimedNatal.houses,
        reconstructedFromSignDegree: syntheticTimedNatal.houses,
      },
    },
  },
  {
    decision: "canonical_angle_source",
    fixtureKind: "timed_natal",
    ambiguity: "duplicate_angle_sources_disagree",
    expectedCode: "CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticTimedNatal,
      angleCandidates: {
        pointAscendant: 191,
        angleObjectAscendant: 192,
      },
    },
  },
  {
    decision: "moon_no_time_endpoint_source",
    fixtureKind: "no_birth_time_natal",
    ambiguity: "local_day_endpoints_unavailable",
    expectedCode: "CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticNoTimeNatal,
      moonLocalDayEndpoints: null,
    },
  },
  {
    decision: "chart_source_version_provenance",
    fixtureKind: "timed_natal",
    ambiguity: "calculation_version_missing",
    expectedCode: "CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticTimedNatal,
      provenance: {
        sourceId: "synthetic_source",
        calculationVersion: null,
      },
    },
  },
  {
    decision: "south_node_source",
    fixtureKind: "no_birth_time_natal",
    ambiguity: "provider_value_and_derivation_policy_unresolved",
    expectedCode: "CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticNoTimeNatal,
      southNodeCandidates: {
        supplied: 25,
        derivedFromNorthNode: 25,
        authority: "unresolved",
      },
    },
  },
  {
    decision: "derived_output_policy",
    fixtureKind: "timed_natal",
    ambiguity: "recompute_or_persist_unresolved",
    expectedCode:
      "CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED",
    syntheticEvidence: {
      ...syntheticTimedNatal,
      derivedOutputCandidates: {
        recomputed: "synthetic_digest_a",
        persisted: "synthetic_digest_b",
        authority: "unresolved",
      },
    },
  },
];

for (const testCase of cases) {
  const result = probeUnresolvedChartDataAuthority({
    schemaVersion: CHART_DATA_AUTHORITY_PROBE_VERSION,
    dataClass: "synthetic_non_personal_natal",
    fixtureKind: testCase.fixtureKind,
    decision: testCase.decision,
    ambiguity: testCase.ambiguity,
  });

  equal(result.ok, false, `${testCase.decision} fails closed`);
  equal(
    result.error.code,
    testCase.expectedCode,
    `${testCase.decision} uses its stable code`
  );
  equal(
    result.error.reason,
    "founder_decision_required",
    `${testCase.decision} remains unchosen`
  );
  const serializedFailure = JSON.stringify(result);
  const fixtureId = (
    testCase.syntheticEvidence as { fixtureId: string }
  ).fixtureId;
  if (serializedFailure.includes(fixtureId)) {
    throw new Error(`${testCase.decision} echoed its fixture identifier`);
  }
  equal(
    Object.keys(result.error).sort().join(","),
    "code,decision,reason",
    `${testCase.decision} returns only the closed failure projection`
  );
}

equal(cases.length, 7, "all seven authority choices are covered");

for (const invalid of [
  null,
  {},
  {
    schemaVersion: CHART_DATA_AUTHORITY_PROBE_VERSION,
    dataClass: "live_chart",
    fixtureKind: "timed_natal",
    decision: "absolute_longitude_completeness",
    ambiguity: "required_body_longitude_missing",
  },
  {
    schemaVersion: CHART_DATA_AUTHORITY_PROBE_VERSION,
    dataClass: "synthetic_non_personal_natal",
    fixtureKind: "timed_natal",
    decision: "unknown_decision",
    ambiguity: "unknown",
  },
  {
    schemaVersion: CHART_DATA_AUTHORITY_PROBE_VERSION,
    dataClass: "synthetic_non_personal_natal",
    fixtureKind: "timed_natal",
    decision: "house_cusp_authority",
    ambiguity: "required_body_longitude_missing",
  },
]) {
  const result = probeUnresolvedChartDataAuthority(invalid);
  equal(result.ok, false, "invalid probes fail closed");
}

console.log("inactive chart-data authority decision fixtures passed");

function equal(
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}`);
  }
}
