import {
  canonicalizeNatalPointKey,
  isCanonicalNatalAngleKey,
  type CanonicalNatalPointKey,
} from "./natal-facts";
import {
  NATAL_INPUT_CONTRACT_VERSION,
  isProhibitedNatalScopeIdentifier,
  validateNatalEngineInput,
} from "./natal-input-boundary";

export const PROVIDER_NEUTRAL_NATAL_VERSION =
  "provider_neutral_natal_v1" as const;
export const PROVIDER_NATAL_ADAPTER_VERSION =
  "provider_natal_adapter_v1" as const;

export type ProviderNatalAdapterFailureCode =
  | "NATAL_ADAPTER_NOT_OBJECT"
  | "NATAL_ADAPTER_UNKNOWN_FIELD"
  | "NATAL_ADAPTER_OUT_OF_SCOPE"
  | "NATAL_ADAPTER_SCHEMA_UNSUPPORTED"
  | "NATAL_ADAPTER_CHART_TYPE_INVALID"
  | "NATAL_ADAPTER_PRECISION_INVALID"
  | "NATAL_ADAPTER_SOURCE_INVALID"
  | "NATAL_ADAPTER_POINTS_INVALID"
  | "NATAL_ADAPTER_POINT_INVALID"
  | "NATAL_ADAPTER_POINT_NOT_ALLOWED"
  | "NATAL_ADAPTER_DUPLICATE_POINT"
  | "NATAL_ADAPTER_HOUSES_INVALID"
  | "NATAL_ADAPTER_HOUSE_INVALID"
  | "NATAL_ADAPTER_DUPLICATE_HOUSE"
  | "NATAL_ADAPTER_HOUSE_SYSTEM_INVALID"
  | "NATAL_ADAPTER_MOON_ENDPOINTS_INVALID"
  | "NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH"
  | "NATAL_ADAPTER_MAPPED_INPUT_INVALID";

export type ProviderNatalAdapterFailure = {
  code: ProviderNatalAdapterFailureCode;
  reason:
    | "malformed_payload"
    | "unknown_field"
    | "prohibited_non_natal_scope"
    | "unsupported_schema"
    | "natal_chart_type_required"
    | "supported_precision_required"
    | "safe_source_identifiers_required"
    | "point_list_required"
    | "point_shape_invalid"
    | "point_not_in_natal_allow_list"
    | "canonical_point_must_be_unique"
    | "house_list_required"
    | "house_shape_invalid"
    | "house_number_must_be_unique"
    | "declared_placidus_house_system_required"
    | "moon_endpoint_shape_invalid"
    | "timed_data_requires_supplied_birth_time"
    | "mapped_input_rejected";
  location:
    | "root"
    | "schema_version"
    | "chart_type"
    | "precision"
    | "source"
    | "points"
    | "houses"
    | "house_system"
    | "moon_local_day_endpoints";
};

export type ProviderNeutralNatalEngineInput = {
  schemaVersion: typeof NATAL_INPUT_CONTRACT_VERSION;
  chartType: "natal";
  precision: "full" | "no_birth_time";
  points: Array<{ key: CanonicalNatalPointKey; absoluteLongitude: number }>;
  houses: Array<{ no: number; cuspLongitude: number }>;
  houseSystem?: {
    key: "placidus";
    methodId: string;
    methodVersion: string;
  };
  moonLocalDayEndpoints?: {
    startLongitude: number;
    endLongitude: number;
    methodId: string;
    methodVersion: string;
  };
};

export type ProviderNatalAdapterValue = {
  engineInput: ProviderNeutralNatalEngineInput;
  provenance: {
    adapterVersion: typeof PROVIDER_NATAL_ADAPTER_VERSION;
    sourceContractVersion: typeof PROVIDER_NEUTRAL_NATAL_VERSION;
    sourceId: string;
    calculationId?: string;
    source: "validated_provider_neutral_natal_payload";
  };
};

export type ProviderNatalAdapterResult =
  | { ok: true; value: ProviderNatalAdapterValue }
  | { ok: false; error: ProviderNatalAdapterFailure };

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "chartType",
  "precision",
  "source",
  "points",
  "houses",
  "houseSystem",
  "moonLocalDayEndpoints",
]);
const SOURCE_FIELDS = new Set(["sourceId", "calculationId"]);
const POINT_FIELDS = new Set(["name", "longitude"]);
const HOUSE_FIELDS = new Set(["number", "cuspLongitude"]);
const HOUSE_SYSTEM_FIELDS = new Set(["key", "methodId", "methodVersion"]);
const MOON_ENDPOINT_FIELDS = new Set([
  "startLongitude",
  "endLongitude",
  "methodId",
  "methodVersion",
]);
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;

export function adaptProviderNeutralNatalPayload(
  payload: unknown
): ProviderNatalAdapterResult {
  if (!isPlainRecord(payload)) {
    return failure("NATAL_ADAPTER_NOT_OBJECT", "malformed_payload", "root");
  }
  const rootFailure = validateClosedFields(payload, ROOT_FIELDS, "root");
  if (rootFailure) {
    return rootFailure;
  }
  if (payload.schemaVersion !== PROVIDER_NEUTRAL_NATAL_VERSION) {
    return failure(
      "NATAL_ADAPTER_SCHEMA_UNSUPPORTED",
      "unsupported_schema",
      "schema_version"
    );
  }
  if (
    typeof payload.chartType === "string" &&
    isProhibitedNatalScopeIdentifier(payload.chartType)
  ) {
    return failure(
      "NATAL_ADAPTER_OUT_OF_SCOPE",
      "prohibited_non_natal_scope",
      "chart_type"
    );
  }
  if (payload.chartType !== "natal") {
    return failure(
      "NATAL_ADAPTER_CHART_TYPE_INVALID",
      "natal_chart_type_required",
      "chart_type"
    );
  }
  if (payload.precision !== "full" && payload.precision !== "no_birth_time") {
    return failure(
      "NATAL_ADAPTER_PRECISION_INVALID",
      "supported_precision_required",
      "precision"
    );
  }

  const sourceResult = validateSource(payload.source);
  if (!sourceResult.ok) {
    return sourceResult;
  }
  const pointResult = mapPoints(payload.points);
  if (!pointResult.ok) {
    return pointResult;
  }
  const houseResult = mapHouses(payload.houses);
  if (!houseResult.ok) {
    return houseResult;
  }
  const houseSystemResult = mapHouseSystem(payload.houseSystem);
  if (!houseSystemResult.ok) {
    return houseSystemResult;
  }
  const moonResult = mapMoonEndpoints(payload.moonLocalDayEndpoints);
  if (!moonResult.ok) {
    return moonResult;
  }

  if (
    payload.precision === "no_birth_time" &&
    (houseResult.value.length > 0 ||
      houseSystemResult.value !== null ||
      pointResult.value.some((point) => isCanonicalNatalAngleKey(point.key)))
  ) {
    return failure(
      "NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH",
      "timed_data_requires_supplied_birth_time",
      houseResult.value.length > 0
        ? "houses"
        : houseSystemResult.value
          ? "house_system"
          : "points"
    );
  }
  if (houseResult.value.length > 0 && houseSystemResult.value === null) {
    return failure(
      "NATAL_ADAPTER_HOUSE_SYSTEM_INVALID",
      "declared_placidus_house_system_required",
      "house_system"
    );
  }
  if (payload.precision !== "no_birth_time" && moonResult.value !== null) {
    return failure(
      "NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH",
      "timed_data_requires_supplied_birth_time",
      "moon_local_day_endpoints"
    );
  }

  const admittedPoints = pointResult.value.filter(
    (point) => !(payload.precision === "no_birth_time" && point.key === "moon")
  );
  const engineInput: ProviderNeutralNatalEngineInput = {
    schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
    chartType: "natal",
    precision: payload.precision,
    points: admittedPoints,
    houses: houseResult.value,
    ...(houseSystemResult.value
      ? { houseSystem: houseSystemResult.value }
      : {}),
    ...(moonResult.value
      ? { moonLocalDayEndpoints: moonResult.value }
      : {}),
  };
  if (!validateNatalEngineInput(engineInput).ok) {
    return failure(
      "NATAL_ADAPTER_MAPPED_INPUT_INVALID",
      "mapped_input_rejected",
      "root"
    );
  }

  return {
    ok: true,
    value: {
      engineInput,
      provenance: {
        adapterVersion: PROVIDER_NATAL_ADAPTER_VERSION,
        sourceContractVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
        sourceId: sourceResult.value.sourceId,
        ...(sourceResult.value.calculationId
          ? { calculationId: sourceResult.value.calculationId }
          : {}),
        source: "validated_provider_neutral_natal_payload",
      },
    },
  };
}

function mapHouseSystem(
  value: unknown
):
  | { ok: true; value: ProviderNeutralNatalEngineInput["houseSystem"] | null }
  | { ok: false; error: ProviderNatalAdapterFailure } {
  if (value === undefined) return { ok: true, value: null };
  if (!isPlainRecord(value)) {
    return failure(
      "NATAL_ADAPTER_HOUSE_SYSTEM_INVALID",
      "declared_placidus_house_system_required",
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
    !SAFE_IDENTIFIER.test(value.methodId) ||
    typeof value.methodVersion !== "string" ||
    !SAFE_IDENTIFIER.test(value.methodVersion)
  ) {
    return failure(
      "NATAL_ADAPTER_HOUSE_SYSTEM_INVALID",
      "declared_placidus_house_system_required",
      "house_system"
    );
  }
  return {
    ok: true,
    value: {
      key: "placidus",
      methodId: value.methodId,
      methodVersion: value.methodVersion,
    },
  };
}

function validateSource(
  source: unknown
):
  | { ok: true; value: { sourceId: string; calculationId?: string } }
  | { ok: false; error: ProviderNatalAdapterFailure } {
  if (!isPlainRecord(source)) {
    return failure(
      "NATAL_ADAPTER_SOURCE_INVALID",
      "safe_source_identifiers_required",
      "source"
    );
  }
  const fieldFailure = validateClosedFields(source, SOURCE_FIELDS, "source");
  if (fieldFailure) {
    return fieldFailure;
  }
  if (
    typeof source.sourceId !== "string" ||
    !SAFE_IDENTIFIER.test(source.sourceId) ||
    (source.calculationId !== undefined &&
      (typeof source.calculationId !== "string" ||
        !SAFE_IDENTIFIER.test(source.calculationId)))
  ) {
    return failure(
      "NATAL_ADAPTER_SOURCE_INVALID",
      "safe_source_identifiers_required",
      "source"
    );
  }
  return {
    ok: true,
    value: {
      sourceId: source.sourceId,
      ...(typeof source.calculationId === "string"
        ? { calculationId: source.calculationId }
        : {}),
    },
  };
}

function mapPoints(
  points: unknown
):
  | {
      ok: true;
      value: ProviderNeutralNatalEngineInput["points"];
    }
  | { ok: false; error: ProviderNatalAdapterFailure } {
  if (!Array.isArray(points) || points.length === 0) {
    return failure(
      "NATAL_ADAPTER_POINTS_INVALID",
      "point_list_required",
      "points"
    );
  }
  const mapped: ProviderNeutralNatalEngineInput["points"] = [];
  const seen = new Set<CanonicalNatalPointKey>();
  for (const point of points) {
    if (!isPlainRecord(point)) {
      return failure(
        "NATAL_ADAPTER_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    const fieldFailure = validateClosedFields(point, POINT_FIELDS, "points");
    if (fieldFailure) {
      return fieldFailure;
    }
    if (typeof point.name !== "string") {
      return failure(
        "NATAL_ADAPTER_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    if (isProhibitedNatalScopeIdentifier(point.name)) {
      return failure(
        "NATAL_ADAPTER_OUT_OF_SCOPE",
        "prohibited_non_natal_scope",
        "points"
      );
    }
    const key = canonicalizeNatalPointKey(point.name);
    if (!key) {
      return failure(
        "NATAL_ADAPTER_POINT_NOT_ALLOWED",
        "point_not_in_natal_allow_list",
        "points"
      );
    }
    if (typeof point.longitude !== "number" || !Number.isFinite(point.longitude)) {
      return failure(
        "NATAL_ADAPTER_POINT_INVALID",
        "point_shape_invalid",
        "points"
      );
    }
    if (seen.has(key)) {
      return failure(
        "NATAL_ADAPTER_DUPLICATE_POINT",
        "canonical_point_must_be_unique",
        "points"
      );
    }
    seen.add(key);
    mapped.push({ key, absoluteLongitude: point.longitude });
  }
  return {
    ok: true,
    value: mapped.sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function mapHouses(
  houses: unknown
):
  | {
      ok: true;
      value: ProviderNeutralNatalEngineInput["houses"];
    }
  | { ok: false; error: ProviderNatalAdapterFailure } {
  if (!Array.isArray(houses)) {
    return failure(
      "NATAL_ADAPTER_HOUSES_INVALID",
      "house_list_required",
      "houses"
    );
  }
  const mapped: ProviderNeutralNatalEngineInput["houses"] = [];
  const seen = new Set<number>();
  for (const house of houses) {
    if (!isPlainRecord(house)) {
      return failure(
        "NATAL_ADAPTER_HOUSE_INVALID",
        "house_shape_invalid",
        "houses"
      );
    }
    const fieldFailure = validateClosedFields(house, HOUSE_FIELDS, "houses");
    if (fieldFailure) {
      return fieldFailure;
    }
    if (
      typeof house.number !== "number" ||
      !Number.isInteger(house.number) ||
      house.number < 1 ||
      house.number > 12 ||
      typeof house.cuspLongitude !== "number" ||
      !Number.isFinite(house.cuspLongitude)
    ) {
      return failure(
        "NATAL_ADAPTER_HOUSE_INVALID",
        "house_shape_invalid",
        "houses"
      );
    }
    if (seen.has(house.number)) {
      return failure(
        "NATAL_ADAPTER_DUPLICATE_HOUSE",
        "house_number_must_be_unique",
        "houses"
      );
    }
    seen.add(house.number);
    mapped.push({
      no: house.number,
      cuspLongitude: house.cuspLongitude,
    });
  }
  return {
    ok: true,
    value: mapped.sort((left, right) => left.no - right.no),
  };
}

function mapMoonEndpoints(
  value: unknown
):
  | {
      ok: true;
      value:
        | ProviderNeutralNatalEngineInput["moonLocalDayEndpoints"]
        | null;
    }
  | { ok: false; error: ProviderNatalAdapterFailure } {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (!isPlainRecord(value)) {
    return failure(
      "NATAL_ADAPTER_MOON_ENDPOINTS_INVALID",
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
  if (
    typeof value.startLongitude !== "number" ||
    !Number.isFinite(value.startLongitude) ||
    typeof value.endLongitude !== "number" ||
    !Number.isFinite(value.endLongitude) ||
    typeof value.methodId !== "string" ||
    !SAFE_IDENTIFIER.test(value.methodId) ||
    typeof value.methodVersion !== "string" ||
    !SAFE_IDENTIFIER.test(value.methodVersion)
  ) {
    return failure(
      "NATAL_ADAPTER_MOON_ENDPOINTS_INVALID",
      "moon_endpoint_shape_invalid",
      "moon_local_day_endpoints"
    );
  }
  return {
    ok: true,
    value: {
      startLongitude: value.startLongitude,
      endLongitude: value.endLongitude,
      methodId: value.methodId,
      methodVersion: value.methodVersion,
    },
  };
}

function validateClosedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  location: ProviderNatalAdapterFailure["location"]
): { ok: false; error: ProviderNatalAdapterFailure } | null {
  for (const field of Object.keys(value)) {
    if (allowed.has(field)) {
      continue;
    }
    if (isProhibitedNatalScopeIdentifier(field)) {
      return failure(
        "NATAL_ADAPTER_OUT_OF_SCOPE",
        "prohibited_non_natal_scope",
        location
      );
    }
    return failure("NATAL_ADAPTER_UNKNOWN_FIELD", "unknown_field", location);
  }
  return null;
}

function failure(
  code: ProviderNatalAdapterFailure["code"],
  reason: ProviderNatalAdapterFailure["reason"],
  location: ProviderNatalAdapterFailure["location"]
): { ok: false; error: ProviderNatalAdapterFailure } {
  return { ok: false, error: { code, reason, location } };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
