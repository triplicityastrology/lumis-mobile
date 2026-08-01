import {
  canonicalizeNatalPointKey,
  isCanonicalNatalAngleKey,
  resolveBirthTimeAvailability,
  resolveBirthTimeCapabilities,
  type BirthTimeAvailability,
  type BirthTimeCapabilities,
  type CanonicalNatalPointKey,
} from "./natal-facts";
import { normalizeNatalLongitude } from "./natal-aspects";

export const NATAL_INPUT_CONTRACT_VERSION = "natal_engine_input_v1" as const;

export type NatalInputFailureCode =
  | "NATAL_INPUT_NOT_OBJECT"
  | "NATAL_INPUT_UNKNOWN_FIELD"
  | "NATAL_INPUT_OUT_OF_SCOPE"
  | "NATAL_INPUT_SCHEMA_UNSUPPORTED"
  | "NATAL_INPUT_CHART_TYPE_INVALID"
  | "NATAL_INPUT_PRECISION_INVALID"
  | "NATAL_INPUT_POINTS_INVALID"
  | "NATAL_INPUT_POINT_INVALID"
  | "NATAL_INPUT_POINT_NOT_ALLOWED"
  | "NATAL_INPUT_DUPLICATE_POINT"
  | "NATAL_INPUT_HOUSES_INVALID"
  | "NATAL_INPUT_HOUSE_INVALID"
  | "NATAL_INPUT_DUPLICATE_HOUSE"
  | "NATAL_INPUT_HOUSE_SYSTEM_INVALID"
  | "NATAL_INPUT_TIME_CAPABILITY_MISMATCH"
  | "NATAL_INPUT_MOON_ENDPOINTS_INVALID";

export type NatalInputFailureReason =
  | "malformed_contract"
  | "unknown_field"
  | "prohibited_non_natal_scope"
  | "unsupported_schema"
  | "natal_chart_type_required"
  | "supported_precision_required"
  | "point_list_required"
  | "point_shape_invalid"
  | "point_not_in_natal_allow_list"
  | "canonical_point_must_be_unique"
  | "house_list_required"
  | "house_shape_invalid"
  | "house_number_must_be_unique"
  | "house_system_shape_invalid"
  | "timed_data_requires_supplied_birth_time"
  | "moon_endpoint_shape_invalid";

export type NatalInputFailureLocation =
  | "root"
  | "schema_version"
  | "chart_type"
  | "precision"
  | "points"
  | "houses"
  | "house_system"
  | "moon_local_day_endpoints";

export type NatalInputFailure = {
  code: NatalInputFailureCode;
  reason: NatalInputFailureReason;
  location: NatalInputFailureLocation;
};

export type CanonicalNatalInputPoint = {
  key: CanonicalNatalPointKey;
  longitude: number;
  provenance: {
    source: "validated_provider_normalised_natal_input";
    sourceFields: [string, string];
    rule: "canonical_natal_alias_and_longitude";
  };
};

export type CanonicalNatalInputHouse = {
  no: number;
  cuspLongitude: number;
  provenance: {
    source: "validated_provider_normalised_natal_input";
    sourceFields: [string, string];
    rule: "canonical_natal_house_cusp";
  };
};

export type CanonicalNatalEngineInput = {
  schemaVersion: typeof NATAL_INPUT_CONTRACT_VERSION;
  chartType: "natal";
  birthTime: BirthTimeAvailability;
  capabilities: BirthTimeCapabilities;
  points: CanonicalNatalInputPoint[];
  houses: CanonicalNatalInputHouse[];
  houseSystem?: {
    key: "placidus";
    methodId: string;
    methodVersion: string;
    provenance: {
      source: "validated_provider_normalised_natal_input";
      sourceFields: [
        "houseSystem.key",
        "houseSystem.methodId",
        "houseSystem.methodVersion",
      ];
      rule: "declared_placidus_house_system";
    };
  };
  moonLocalDayEndpoints?: {
    startLongitude: number;
    endLongitude: number;
    methodId?: string;
    methodVersion?: string;
    provenance: {
      source: "validated_provider_normalised_natal_input";
      sourceFields: [
        "moonLocalDayEndpoints.startLongitude",
        "moonLocalDayEndpoints.endLongitude",
      ];
      rule: "canonical_moon_local_day_endpoints";
    };
  };
  provenance: {
    source: "validated_provider_normalised_natal_input";
    contractVersion: typeof NATAL_INPUT_CONTRACT_VERSION;
    sourceFields: string[];
    houseSystem?: { key: "placidus"; methodId: string; methodVersion: string };
    moonEndpointMethod?: { methodId: string; methodVersion: string };
    rule: "closed_natal_input_contract";
  };
};

export type NatalInputBoundaryResult =
  | { ok: true; value: CanonicalNatalEngineInput }
  | { ok: false; error: NatalInputFailure };

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "chartType",
  "precision",
  "points",
  "houses",
  "houseSystem",
  "moonLocalDayEndpoints",
]);
const POINT_FIELDS = new Set(["key", "absoluteLongitude"]);
const HOUSE_FIELDS = new Set(["no", "cuspLongitude"]);
const HOUSE_SYSTEM_FIELDS = new Set(["key", "methodId", "methodVersion"]);
const MOON_ENDPOINT_FIELDS = new Set([
  "startLongitude",
  "endLongitude",
  "methodId",
  "methodVersion",
]);
const SAFE_METHOD_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const PROHIBITED_SCOPE_TOKENS = [
  "solarreturn",
  "returnchart",
  "annualtheme",
  "transit",
  "timing",
  "vertex",
];

export function validateNatalEngineInput(
  input: unknown
): NatalInputBoundaryResult {
  if (!isPlainRecord(input)) {
    return failure(
      "NATAL_INPUT_NOT_OBJECT",
      "malformed_contract",
      "root"
    );
  }

  const rootFieldFailure = validateClosedFields(input, ROOT_FIELDS, "root");
  if (rootFieldFailure) {
    return rootFieldFailure;
  }
  if (input.schemaVersion !== NATAL_INPUT_CONTRACT_VERSION) {
    return failure(
      "NATAL_INPUT_SCHEMA_UNSUPPORTED",
      "unsupported_schema",
      "schema_version"
    );
  }
  if (
    typeof input.chartType === "string" &&
    isProhibitedNatalScopeIdentifier(input.chartType)
  ) {
    return failure(
      "NATAL_INPUT_OUT_OF_SCOPE",
      "prohibited_non_natal_scope",
      "chart_type"
    );
  }
  if (input.chartType !== "natal") {
    return failure(
      "NATAL_INPUT_CHART_TYPE_INVALID",
      "natal_chart_type_required",
      "chart_type"
    );
  }
  if (input.precision !== "full" && input.precision !== "no_birth_time") {
    return failure(
      "NATAL_INPUT_PRECISION_INVALID",
      "supported_precision_required",
      "precision"
    );
  }
  if (!Array.isArray(input.points) || input.points.length === 0) {
    return failure(
      "NATAL_INPUT_POINTS_INVALID",
      "point_list_required",
      "points"
    );
  }
  if (!Array.isArray(input.houses)) {
    return failure(
      "NATAL_INPUT_HOUSES_INVALID",
      "house_list_required",
      "houses"
    );
  }

  const pointResult = canonicalizePoints(input.points);
  if (!pointResult.ok) {
    return pointResult;
  }
  const houseResult = canonicalizeHouses(input.houses);
  if (!houseResult.ok) {
    return houseResult;
  }
  const houseSystemResult = canonicalizeHouseSystem(input.houseSystem);
  if (!houseSystemResult.ok) return houseSystemResult;
  const moonResult = canonicalizeMoonEndpoints(input.moonLocalDayEndpoints);
  if (!moonResult.ok) {
    return moonResult;
  }

  const birthTime = resolveBirthTimeAvailability(input.precision);
  if (
    birthTime === "not_supplied" &&
    (houseResult.value.length > 0 ||
      houseSystemResult.value !== null ||
      pointResult.value.some((point) => isCanonicalNatalAngleKey(point.key)))
  ) {
    return failure(
      "NATAL_INPUT_TIME_CAPABILITY_MISMATCH",
      "timed_data_requires_supplied_birth_time",
      houseResult.value.length > 0 ? "houses" : "points"
    );
  }
  if (houseResult.value.length > 0 && houseSystemResult.value === null) {
    return failure(
      "NATAL_INPUT_HOUSE_SYSTEM_INVALID",
      "house_system_shape_invalid",
      "house_system"
    );
  }

  const sourceFields = [
    "schemaVersion",
    "chartType",
    "precision",
    "points",
    "houses",
    ...(houseSystemResult.value ? ["houseSystem"] : []),
    ...(moonResult.value ? ["moonLocalDayEndpoints"] : []),
  ];

  return {
    ok: true,
    value: {
      schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
      chartType: "natal",
      birthTime,
      capabilities: resolveBirthTimeCapabilities(birthTime),
      points: pointResult.value,
      houses: houseResult.value,
      ...(houseSystemResult.value
        ? { houseSystem: houseSystemResult.value }
        : {}),
      ...(moonResult.value
        ? { moonLocalDayEndpoints: moonResult.value }
        : {}),
      provenance: {
        source: "validated_provider_normalised_natal_input",
        contractVersion: NATAL_INPUT_CONTRACT_VERSION,
        sourceFields,
        ...(houseSystemResult.value
          ? {
              houseSystem: {
                key: houseSystemResult.value.key,
                methodId: houseSystemResult.value.methodId,
                methodVersion: houseSystemResult.value.methodVersion,
              },
            }
          : {}),
        ...(moonResult.value?.methodId && moonResult.value.methodVersion
          ? {
              moonEndpointMethod: {
                methodId: moonResult.value.methodId,
                methodVersion: moonResult.value.methodVersion,
              },
            }
          : {}),
        rule: "closed_natal_input_contract",
      },
    },
  };
}

function canonicalizeHouseSystem(
  value: unknown
):
  | { ok: true; value: CanonicalNatalEngineInput["houseSystem"] | null }
  | { ok: false; error: NatalInputFailure } {
  if (value === undefined) return { ok: true, value: null };
  if (!isPlainRecord(value)) {
    return failure(
      "NATAL_INPUT_HOUSE_SYSTEM_INVALID",
      "house_system_shape_invalid",
      "house_system"
    );
  }
  const fieldFailure = validateClosedFields(
    value,
    HOUSE_SYSTEM_FIELDS,
    "house_system"
  );
  if (fieldFailure) return fieldFailure;
  if (
    value.key !== "placidus" ||
    typeof value.methodId !== "string" ||
    !SAFE_METHOD_IDENTIFIER.test(value.methodId) ||
    typeof value.methodVersion !== "string" ||
    !SAFE_METHOD_IDENTIFIER.test(value.methodVersion)
  ) {
    return failure(
      "NATAL_INPUT_HOUSE_SYSTEM_INVALID",
      "house_system_shape_invalid",
      "house_system"
    );
  }
  return {
    ok: true,
    value: {
      key: "placidus",
      methodId: value.methodId,
      methodVersion: value.methodVersion,
      provenance: {
        source: "validated_provider_normalised_natal_input",
        sourceFields: [
          "houseSystem.key",
          "houseSystem.methodId",
          "houseSystem.methodVersion",
        ],
        rule: "declared_placidus_house_system",
      },
    },
  };
}

function canonicalizePoints(
  points: unknown[]
):
  | { ok: true; value: CanonicalNatalInputPoint[] }
  | { ok: false; error: NatalInputFailure } {
  const canonicalPoints: CanonicalNatalInputPoint[] = [];
  const seen = new Set<CanonicalNatalPointKey>();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!isPlainRecord(point)) {
      return failure(
        "NATAL_INPUT_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    const fieldFailure = validateClosedFields(point, POINT_FIELDS, "points");
    if (fieldFailure) {
      return fieldFailure;
    }
    if (typeof point.key !== "string") {
      return failure(
        "NATAL_INPUT_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    if (
      isProhibitedNatalScopeIdentifier(point.key)
    ) {
      return failure(
        "NATAL_INPUT_OUT_OF_SCOPE",
        "prohibited_non_natal_scope",
        "points"
      );
    }
    const key = canonicalizeNatalPointKey(point.key);
    if (!key) {
      return failure(
        "NATAL_INPUT_POINT_NOT_ALLOWED",
        "point_not_in_natal_allow_list",
        "points"
      );
    }
    const longitude =
      typeof point.absoluteLongitude === "number"
        ? normalizeNatalLongitude(point.absoluteLongitude)
        : null;
    if (longitude == null) {
      return failure(
        "NATAL_INPUT_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    if (seen.has(key)) {
      return failure(
        "NATAL_INPUT_DUPLICATE_POINT",
        "canonical_point_must_be_unique",
        "points"
      );
    }
    seen.add(key);
    canonicalPoints.push({
      key,
      longitude,
      provenance: {
        source: "validated_provider_normalised_natal_input",
        sourceFields: [
          `points[${index}].key`,
          `points[${index}].absoluteLongitude`,
        ],
        rule: "canonical_natal_alias_and_longitude",
      },
    });
  }

  return {
    ok: true,
    value: canonicalPoints.sort((left, right) =>
      left.key.localeCompare(right.key)
    ),
  };
}

function canonicalizeHouses(
  houses: unknown[]
):
  | { ok: true; value: CanonicalNatalInputHouse[] }
  | { ok: false; error: NatalInputFailure } {
  const canonicalHouses: CanonicalNatalInputHouse[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index];
    if (!isPlainRecord(house)) {
      return failure(
        "NATAL_INPUT_HOUSE_INVALID",
        "house_shape_invalid",
        "houses"
      );
    }
    const fieldFailure = validateClosedFields(house, HOUSE_FIELDS, "houses");
    if (fieldFailure) {
      return fieldFailure;
    }
    if (
      typeof house.no !== "number" ||
      !Number.isInteger(house.no) ||
      house.no < 1 ||
      house.no > 12
    ) {
      return failure(
        "NATAL_INPUT_HOUSE_INVALID",
        "house_shape_invalid",
        "houses"
      );
    }
    const cuspLongitude =
      typeof house.cuspLongitude === "number"
        ? normalizeNatalLongitude(house.cuspLongitude)
        : null;
    if (cuspLongitude == null) {
      return failure(
        "NATAL_INPUT_HOUSE_INVALID",
        "house_shape_invalid",
        "houses"
      );
    }
    if (seen.has(house.no)) {
      return failure(
        "NATAL_INPUT_DUPLICATE_HOUSE",
        "house_number_must_be_unique",
        "houses"
      );
    }
    seen.add(house.no);
    canonicalHouses.push({
      no: house.no,
      cuspLongitude,
      provenance: {
        source: "validated_provider_normalised_natal_input",
        sourceFields: [
          `houses[${index}].no`,
          `houses[${index}].cuspLongitude`,
        ],
        rule: "canonical_natal_house_cusp",
      },
    });
  }

  return {
    ok: true,
    value: canonicalHouses.sort((left, right) => left.no - right.no),
  };
}

function canonicalizeMoonEndpoints(
  value: unknown
):
  | {
      ok: true;
      value: CanonicalNatalEngineInput["moonLocalDayEndpoints"] | null;
    }
  | { ok: false; error: NatalInputFailure } {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (!isPlainRecord(value)) {
    return failure(
      "NATAL_INPUT_MOON_ENDPOINTS_INVALID",
      "moon_endpoint_shape_invalid",
      "moon_local_day_endpoints"
    );
  }
  const fieldFailure = validateClosedFields(
    value,
    MOON_ENDPOINT_FIELDS,
    "moon_local_day_endpoints"
  );
  if (fieldFailure) {
    return fieldFailure;
  }
  const startLongitude =
    typeof value.startLongitude === "number"
      ? normalizeNatalLongitude(value.startLongitude)
      : null;
  const endLongitude =
    typeof value.endLongitude === "number"
      ? normalizeNatalLongitude(value.endLongitude)
      : null;
  if (
    startLongitude == null ||
    endLongitude == null ||
    typeof value.methodId !== "string" ||
    !SAFE_METHOD_IDENTIFIER.test(value.methodId) ||
    typeof value.methodVersion !== "string" ||
    !SAFE_METHOD_IDENTIFIER.test(value.methodVersion)
  ) {
    return failure(
      "NATAL_INPUT_MOON_ENDPOINTS_INVALID",
      "moon_endpoint_shape_invalid",
      "moon_local_day_endpoints"
    );
  }

  return {
    ok: true,
    value: {
      startLongitude,
      endLongitude,
      methodId: value.methodId,
      methodVersion: value.methodVersion,
      provenance: {
        source: "validated_provider_normalised_natal_input",
        sourceFields: [
          "moonLocalDayEndpoints.startLongitude",
          "moonLocalDayEndpoints.endLongitude",
        ],
        rule: "canonical_moon_local_day_endpoints",
      },
    },
  };
}

function validateClosedFields(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  location: NatalInputFailureLocation
): { ok: false; error: NatalInputFailure } | null {
  for (const field of Object.keys(value)) {
    if (allowedFields.has(field)) {
      continue;
    }
    if (isProhibitedNatalScopeIdentifier(field)) {
      return failure(
        "NATAL_INPUT_OUT_OF_SCOPE",
        "prohibited_non_natal_scope",
        location
      );
    }
    return failure("NATAL_INPUT_UNKNOWN_FIELD", "unknown_field", location);
  }
  return null;
}

export function isProhibitedNatalScopeIdentifier(value: string): boolean {
  const normalized = normalizeToken(value);
  const identifierTokens = value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return (
    identifierTokens.includes("sr") ||
    PROHIBITED_SCOPE_TOKENS.some((token) => normalized.includes(token))
  );
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function failure(
  code: NatalInputFailureCode,
  reason: NatalInputFailureReason,
  location: NatalInputFailureLocation
): { ok: false; error: NatalInputFailure } {
  return {
    ok: false,
    error: { code, reason, location },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
