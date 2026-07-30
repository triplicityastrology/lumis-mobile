export const CHART_DATA_AUTHORITY_PROBE_VERSION =
  "chart_data_authority_probe_v1" as const;

export const CHART_DATA_AUTHORITY_DECISIONS = [
  "absolute_longitude_completeness",
  "house_cusp_authority",
  "canonical_angle_source",
  "moon_no_time_endpoint_source",
  "chart_source_version_provenance",
  "south_node_source",
  "derived_output_policy",
] as const;

export type ChartDataAuthorityDecision =
  (typeof CHART_DATA_AUTHORITY_DECISIONS)[number];

export type ChartDataAuthorityFailureCode =
  | "CHART_AUTHORITY_PROBE_INVALID"
  | "CHART_AUTHORITY_DECISION_UNKNOWN"
  | "CHART_AUTHORITY_AMBIGUITY_INVALID"
  | "CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED"
  | "CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED"
  | "CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED"
  | "CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED"
  | "CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED"
  | "CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED"
  | "CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED";

export type ChartDataAuthorityProbeFailure = {
  ok: false;
  error: {
    code: ChartDataAuthorityFailureCode;
    reason:
      | "closed_synthetic_probe_required"
      | "known_decision_required"
      | "decision_specific_ambiguity_required"
      | "founder_decision_required";
    decision?: ChartDataAuthorityDecision;
  };
};

type DecisionDefinition = {
  failureCode: Exclude<
    ChartDataAuthorityFailureCode,
    | "CHART_AUTHORITY_PROBE_INVALID"
    | "CHART_AUTHORITY_DECISION_UNKNOWN"
    | "CHART_AUTHORITY_AMBIGUITY_INVALID"
  >;
  ambiguities: readonly string[];
};

const DECISION_DEFINITIONS: Record<
  ChartDataAuthorityDecision,
  DecisionDefinition
> = {
  absolute_longitude_completeness: {
    failureCode:
      "CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED",
    ambiguities: [
      "required_body_longitude_missing",
      "display_degree_cannot_establish_absolute_longitude",
    ],
  },
  house_cusp_authority: {
    failureCode: "CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED",
    ambiguities: [
      "absolute_cusp_source_not_designated",
      "reconstruction_rule_not_approved",
    ],
  },
  canonical_angle_source: {
    failureCode: "CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED",
    ambiguities: [
      "duplicate_angle_sources_disagree",
      "canonical_angle_representation_not_designated",
    ],
  },
  moon_no_time_endpoint_source: {
    failureCode: "CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED",
    ambiguities: [
      "local_day_endpoints_unavailable",
      "endpoint_calculation_source_not_approved",
    ],
  },
  chart_source_version_provenance: {
    failureCode: "CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED",
    ambiguities: [
      "calculation_version_missing",
      "authoritative_source_identity_not_approved",
    ],
  },
  south_node_source: {
    failureCode: "CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED",
    ambiguities: [
      "provider_value_and_derivation_policy_unresolved",
      "south_node_source_missing",
    ],
  },
  derived_output_policy: {
    failureCode: "CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED",
    ambiguities: [
      "recompute_or_persist_unresolved",
      "derived_version_authority_missing",
    ],
  },
};

const PROBE_FIELDS = new Set([
  "schemaVersion",
  "dataClass",
  "fixtureKind",
  "decision",
  "ambiguity",
]);
const DECISION_SET = new Set<string>(CHART_DATA_AUTHORITY_DECISIONS);

export function probeUnresolvedChartDataAuthority(
  input: unknown
): ChartDataAuthorityProbeFailure {
  if (
    !isPlainRecord(input) ||
    !hasOnlyFields(input, PROBE_FIELDS) ||
    input.schemaVersion !== CHART_DATA_AUTHORITY_PROBE_VERSION ||
    input.dataClass !== "synthetic_non_personal_natal" ||
    (input.fixtureKind !== "timed_natal" &&
      input.fixtureKind !== "no_birth_time_natal")
  ) {
    return failure(
      "CHART_AUTHORITY_PROBE_INVALID",
      "closed_synthetic_probe_required"
    );
  }
  if (
    typeof input.decision !== "string" ||
    !DECISION_SET.has(input.decision)
  ) {
    return failure(
      "CHART_AUTHORITY_DECISION_UNKNOWN",
      "known_decision_required"
    );
  }

  const decision = input.decision as ChartDataAuthorityDecision;
  const definition = DECISION_DEFINITIONS[decision];
  if (
    typeof input.ambiguity !== "string" ||
    !definition.ambiguities.includes(input.ambiguity)
  ) {
    return failure(
      "CHART_AUTHORITY_AMBIGUITY_INVALID",
      "decision_specific_ambiguity_required",
      decision
    );
  }

  return failure(
    definition.failureCode,
    "founder_decision_required",
    decision
  );
}

function failure(
  code: ChartDataAuthorityFailureCode,
  reason: ChartDataAuthorityProbeFailure["error"]["reason"],
  decision?: ChartDataAuthorityDecision
): ChartDataAuthorityProbeFailure {
  return {
    ok: false,
    error: {
      code,
      reason,
      ...(decision ? { decision } : {}),
    },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): boolean {
  return Object.keys(value).every((field) => allowed.has(field));
}
