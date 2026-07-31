import type { ChartPlanet, ChartV2 } from "@lumis/shared";

import { composeNatalEngineOutput, type NatalEngineOutput } from "./natal-engine-composer";
import {
  canonicalizeNatalPointKey,
  canonicalizeZodiacSign,
  isCanonicalNatalAngleKey,
  zodiacSignForNatalLongitude,
  type BirthTimeCapabilities,
  type CanonicalNatalPointKey,
} from "./natal-facts";
import {
  PROVIDER_NATAL_ADAPTER_VERSION,
  PROVIDER_NEUTRAL_NATAL_VERSION,
  adaptProviderNeutralNatalPayload,
} from "./provider-neutral-natal-adapter";
import { projectSafeNatalContext } from "./safe-natal-context";

export const NATAL_CHART_PROJECTION_VERSION = "natal_chart_projection_v1" as const;
export const NATAL_CHART_SOURCE_ID =
  "triplicity_cloudflare_worker_mobile_natal_v1_chart_v2" as const;

export type NatalChartLifecycleFailureCode =
  | "NATAL_LIFECYCLE_NOT_OBJECT"
  | "NATAL_LIFECYCLE_UNKNOWN_FIELD"
  | "NATAL_LIFECYCLE_OUT_OF_SCOPE"
  | "NATAL_LIFECYCLE_CHART_INVALID"
  | "NATAL_LIFECYCLE_SOURCE_INVALID"
  | "NATAL_LIFECYCLE_PRECISION_MISMATCH"
  | "NATAL_LIFECYCLE_POINT_INVALID"
  | "NATAL_LIFECYCLE_ABSOLUTE_LONGITUDE_REQUIRED"
  | "NATAL_LIFECYCLE_DUPLICATE_POINT"
  | "NATAL_LIFECYCLE_HOUSE_INVALID"
  | "NATAL_LIFECYCLE_ANGLE_MISMATCH"
  | "NATAL_LIFECYCLE_SOUTH_NODE_MISMATCH"
  | "NATAL_LIFECYCLE_PIPELINE_REJECTED";

export type NatalChartLifecycleFailure = {
  code: NatalChartLifecycleFailureCode;
  reason:
    | "closed_chart_v2_required"
    | "unknown_chart_field"
    | "natal_scope_required"
    | "designated_chart_source_required"
    | "authoritative_precision_required"
    | "canonical_point_required"
    | "authoritative_absolute_longitude_required"
    | "canonical_point_must_be_unique"
    | "ordered_twelve_cusps_required"
    | "canonical_angle_sources_must_agree"
    | "south_node_must_match_north_node_opposition"
    | "validated_natal_pipeline_required";
};

export type NatalChartProjectionPlacement = {
  key: CanonicalNatalPointKey;
  absoluteLongitude: number;
  sign: string;
  degree: number;
  derived: boolean;
};

export type NatalChartProjection = {
  schemaVersion: typeof NATAL_CHART_PROJECTION_VERSION;
  scope: "natal";
  authority: "non_authoritative_recomputed_projection";
  precision: "full" | "no_birth_time";
  capabilities: BirthTimeCapabilities;
  placements: NatalChartProjectionPlacement[];
  engineOutput: NatalEngineOutput;
  provenance: {
    sourceChartContract: "chart_v2";
    sourceId: typeof NATAL_CHART_SOURCE_ID;
    sourceCalculatedAt: string;
    sourceSnapshotFingerprint: string;
    providerNeutralContractVersion: typeof PROVIDER_NEUTRAL_NATAL_VERSION;
    adapterVersion: typeof PROVIDER_NATAL_ADAPTER_VERSION;
    engineOutputVersion: "natal_engine_output_v1";
    projectionRule: "recompute_from_immutable_chart_snapshot";
  };
};

export type NatalChartLifecycleResult =
  | { ok: true; value: ChartV2 & { natalProjection: NatalChartProjection } }
  | { ok: false; error: NatalChartLifecycleFailure };

const ROOT_FIELDS = new Set([
  "version",
  "chartType",
  "precision",
  "source",
  "calculatedAt",
  "planets",
  "houses",
  "angles",
]);
const PLANET_FIELDS = new Set([
  "key",
  "label",
  "sign",
  "degree",
  "house",
  "retrograde",
  "absoluteLongitude",
]);
const HOUSE_FIELDS = new Set(["no", "sign", "cuspDegree"]);
const ANGLE_FIELDS = new Set(["ascendant", "mediumCoeli"]);
const PROHIBITED_SCOPE = /solar.?return|annual.?theme|transit|timing|vertex|dice/i;
const SOUTH_NODE_TOLERANCE = 0.02;

export async function attachNatalChartProjection(
  input: unknown,
  timeUnknown: boolean
): Promise<NatalChartLifecycleResult> {
  if (!isRecord(input)) {
    return failure("NATAL_LIFECYCLE_NOT_OBJECT", "closed_chart_v2_required");
  }
  for (const field of Object.keys(input)) {
    if (!ROOT_FIELDS.has(field)) {
      return failure(
        PROHIBITED_SCOPE.test(field)
          ? "NATAL_LIFECYCLE_OUT_OF_SCOPE"
          : "NATAL_LIFECYCLE_UNKNOWN_FIELD",
        PROHIBITED_SCOPE.test(field) ? "natal_scope_required" : "unknown_chart_field"
      );
    }
  }
  if (
    (input.chartType !== undefined && input.chartType !== "natal") ||
    (typeof input.chartType === "string" && PROHIBITED_SCOPE.test(input.chartType))
  ) {
    return failure("NATAL_LIFECYCLE_OUT_OF_SCOPE", "natal_scope_required");
  }
  if (
    input.version !== "chart_v2" ||
    !Array.isArray(input.planets) ||
    !Array.isArray(input.houses) ||
    !isRecord(input.angles) ||
    typeof input.calculatedAt !== "string" ||
    !Number.isFinite(Date.parse(input.calculatedAt))
  ) {
    return failure("NATAL_LIFECYCLE_CHART_INVALID", "closed_chart_v2_required");
  }
  if (input.source !== "triplicity_cloudflare_worker") {
    return failure("NATAL_LIFECYCLE_SOURCE_INVALID", "designated_chart_source_required");
  }
  const precision = timeUnknown ? "no_birth_time" : "full";
  if (input.precision !== precision) {
    return failure("NATAL_LIFECYCLE_PRECISION_MISMATCH", "authoritative_precision_required");
  }
  if (Object.keys(input.angles).some((field) => !ANGLE_FIELDS.has(field))) {
    return failure("NATAL_LIFECYCLE_UNKNOWN_FIELD", "unknown_chart_field");
  }

  const pointResult = mapChartPoints(input.planets, precision, input.angles);
  if (!pointResult.ok) return pointResult;
  const houseResult = mapChartHouses(input.houses, precision);
  if (!houseResult.ok) return houseResult;

  const payload = {
    schemaVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
    chartType: "natal",
    precision,
    source: { sourceId: NATAL_CHART_SOURCE_ID },
    points: pointResult.points.map((point) => ({
      name: point.key,
      longitude: point.absoluteLongitude,
    })),
    houses: houseResult.houses.map((house) => ({
      number: house.no,
      cuspLongitude: house.cuspLongitude,
    })),
  };
  const adapted = adaptProviderNeutralNatalPayload(payload);
  if (!adapted.ok) {
    return failure("NATAL_LIFECYCLE_PIPELINE_REJECTED", "validated_natal_pipeline_required");
  }
  const composed = composeNatalEngineOutput(adapted.value.engineInput);
  if (!composed.ok || !projectSafeNatalContext(composed.value).ok) {
    return failure("NATAL_LIFECYCLE_PIPELINE_REJECTED", "validated_natal_pipeline_required");
  }

  const baseChart = cloneClosedChart(input, precision);
  const fingerprint = await sha256Hex(stableStringify(baseChart));
  const projection: NatalChartProjection = {
    schemaVersion: NATAL_CHART_PROJECTION_VERSION,
    scope: "natal",
    authority: "non_authoritative_recomputed_projection",
    precision,
    capabilities: { ...composed.value.capabilities },
    placements: pointResult.points
      .map((point) => ({ ...point }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    engineOutput: composed.value,
    provenance: {
      sourceChartContract: "chart_v2",
      sourceId: NATAL_CHART_SOURCE_ID,
      sourceCalculatedAt: input.calculatedAt,
      sourceSnapshotFingerprint: fingerprint,
      providerNeutralContractVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
      adapterVersion: PROVIDER_NATAL_ADAPTER_VERSION,
      engineOutputVersion: "natal_engine_output_v1",
      projectionRule: "recompute_from_immutable_chart_snapshot",
    },
  };

  return { ok: true, value: { ...baseChart, natalProjection: projection } };
}

export function readNatalChartProjection(
  value: unknown,
  expectedPrecision: "full" | "no_birth_time"
): NatalChartProjection | null {
  if (!isRecord(value) || value.schemaVersion !== NATAL_CHART_PROJECTION_VERSION) return null;
  if (
    value.scope !== "natal" ||
    value.authority !== "non_authoritative_recomputed_projection" ||
    value.precision !== expectedPrecision ||
    !isRecord(value.provenance) ||
    value.provenance.sourceChartContract !== "chart_v2" ||
    value.provenance.sourceId !== NATAL_CHART_SOURCE_ID ||
    value.provenance.providerNeutralContractVersion !== PROVIDER_NEUTRAL_NATAL_VERSION ||
    value.provenance.adapterVersion !== PROVIDER_NATAL_ADAPTER_VERSION ||
    value.provenance.engineOutputVersion !== "natal_engine_output_v1" ||
    value.provenance.projectionRule !== "recompute_from_immutable_chart_snapshot" ||
    typeof value.provenance.sourceCalculatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.provenance.sourceCalculatedAt)) ||
    typeof value.provenance.sourceSnapshotFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.provenance.sourceSnapshotFingerprint) ||
    !Array.isArray(value.placements) ||
    !isRecord(value.capabilities)
  ) return null;

  const context = projectSafeNatalContext(value.engineOutput);
  if (!context.ok || context.value.capabilities.birthTime !== (expectedPrecision === "full" ? "supplied" : "not_supplied")) return null;
  if (stableStringify(value.capabilities) !== stableStringify(context.value.capabilities)) return null;
  const placements = value.placements.map(readPlacement);
  if (placements.some((placement) => placement === null)) return null;
  const safePlacements = placements.filter((placement): placement is NatalChartProjectionPlacement => placement !== null);
  if (
    new Set(safePlacements.map((placement) => placement.key)).size !== safePlacements.length ||
    (expectedPrecision === "no_birth_time" && safePlacements.some((placement) =>
      isCanonicalNatalAngleKey(placement.key) || placement.key === "moon"
    ))
  ) return null;

  return {
    schemaVersion: NATAL_CHART_PROJECTION_VERSION,
    scope: "natal",
    authority: "non_authoritative_recomputed_projection",
    precision: expectedPrecision,
    capabilities: { ...context.value.capabilities },
    placements: safePlacements.sort((left, right) => left.key.localeCompare(right.key)),
    engineOutput: value.engineOutput as NatalEngineOutput,
    provenance: { ...(value.provenance as NatalChartProjection["provenance"]) },
  };
}

function mapChartPoints(
  values: unknown[],
  precision: "full" | "no_birth_time",
  angles: Record<string, unknown>
):
  | { ok: true; points: NatalChartProjectionPlacement[] }
  | { ok: false; error: NatalChartLifecycleFailure } {
  const points: NatalChartProjectionPlacement[] = [];
  const seen = new Set<CanonicalNatalPointKey>();
  let suppliedSouth: number | null = null;

  for (const value of values) {
    if (!isRecord(value) || Object.keys(value).some((field) => !PLANET_FIELDS.has(field)) || typeof value.key !== "string") {
      return failure("NATAL_LIFECYCLE_POINT_INVALID", "canonical_point_required");
    }
    const key = canonicalizeNatalPointKey(value.key);
    if (!key) return failure("NATAL_LIFECYCLE_POINT_INVALID", "canonical_point_required");
    if (seen.has(key)) return failure("NATAL_LIFECYCLE_DUPLICATE_POINT", "canonical_point_must_be_unique");
    seen.add(key);
    if (precision === "no_birth_time" && (isCanonicalNatalAngleKey(key) || value.house !== undefined)) {
      return failure("NATAL_LIFECYCLE_PRECISION_MISMATCH", "authoritative_precision_required");
    }
    // A no-time Moon calculated from noon is not admitted without the approved
    // local-day endpoint method. The safe projection marks it unavailable.
    if (precision === "no_birth_time" && key === "moon") continue;
    const longitude = readLongitude(value.absoluteLongitude);
    if (longitude === null) {
      return failure("NATAL_LIFECYCLE_ABSOLUTE_LONGITUDE_REQUIRED", "authoritative_absolute_longitude_required");
    }
    if (key === "south_node") {
      suppliedSouth = longitude;
      continue;
    }
    points.push(toPlacement(key, longitude, false));
  }

  const north = points.find((point) => point.key === "north_node");
  if (north) {
    const derivedSouth = normalizeLongitude(north.absoluteLongitude + 180);
    if (suppliedSouth !== null && circularDistance(suppliedSouth, derivedSouth) > SOUTH_NODE_TOLERANCE) {
      return failure("NATAL_LIFECYCLE_SOUTH_NODE_MISMATCH", "south_node_must_match_north_node_opposition");
    }
    points.push(toPlacement("south_node", derivedSouth, true));
  } else if (suppliedSouth !== null) {
    return failure("NATAL_LIFECYCLE_SOUTH_NODE_MISMATCH", "south_node_must_match_north_node_opposition");
  }

  for (const [field, key] of [["ascendant", "ascendant"], ["mediumCoeli", "medium_coeli"]] as const) {
    const angle = angles[field];
    if (precision === "no_birth_time" && angle !== undefined) {
      return failure("NATAL_LIFECYCLE_PRECISION_MISMATCH", "authoritative_precision_required");
    }
    if (angle === undefined) continue;
    if (!isRecord(angle)) return failure("NATAL_LIFECYCLE_POINT_INVALID", "canonical_point_required");
    const angleLongitude = readLongitude(angle.absoluteLongitude);
    const point = points.find((candidate) => candidate.key === key);
    if (angleLongitude === null || !point || circularDistance(angleLongitude, point.absoluteLongitude) > 0.001) {
      return failure("NATAL_LIFECYCLE_ANGLE_MISMATCH", "canonical_angle_sources_must_agree");
    }
  }

  return { ok: true, points };
}

function mapChartHouses(
  values: unknown[],
  precision: "full" | "no_birth_time"
):
  | { ok: true; houses: Array<{ no: number; cuspLongitude: number }> }
  | { ok: false; error: NatalChartLifecycleFailure } {
  if (precision === "no_birth_time") {
    return values.length === 0
      ? { ok: true, houses: [] }
      : failure("NATAL_LIFECYCLE_PRECISION_MISMATCH", "authoritative_precision_required");
  }
  if (values.length !== 12) return failure("NATAL_LIFECYCLE_HOUSE_INVALID", "ordered_twelve_cusps_required");
  const houses: Array<{ no: number; cuspLongitude: number }> = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!isRecord(value) || Object.keys(value).some((field) => !HOUSE_FIELDS.has(field))) {
      return failure("NATAL_LIFECYCLE_HOUSE_INVALID", "ordered_twelve_cusps_required");
    }
    const sign = typeof value.sign === "string" ? canonicalizeZodiacSign(value.sign) : null;
    const degree = typeof value.cuspDegree === "number" ? value.cuspDegree : NaN;
    if (value.no !== index + 1 || !sign || !Number.isFinite(degree) || degree < 0 || degree >= 30) {
      return failure("NATAL_LIFECYCLE_HOUSE_INVALID", "ordered_twelve_cusps_required");
    }
    houses.push({ no: index + 1, cuspLongitude: signLongitude(sign) + degree });
  }
  return { ok: true, houses };
}

function cloneClosedChart(input: Record<string, unknown>, precision: "full" | "no_birth_time"): ChartV2 {
  return {
    version: "chart_v2",
    precision,
    source: "triplicity_cloudflare_worker",
    calculatedAt: input.calculatedAt as string,
    planets: (input.planets as ChartPlanet[]).map((planet) => ({ ...planet })),
    houses: (input.houses as ChartV2["houses"]).map((house) => ({ ...house })),
    angles: {
      ...((input.angles as Record<string, ChartPlanet>).ascendant
        ? { ascendant: { ...(input.angles as Record<string, ChartPlanet>).ascendant } }
        : {}),
      ...((input.angles as Record<string, ChartPlanet>).mediumCoeli
        ? { mediumCoeli: { ...(input.angles as Record<string, ChartPlanet>).mediumCoeli } }
        : {}),
    },
  };
}

function readPlacement(value: unknown): NatalChartProjectionPlacement | null {
  if (!isRecord(value) || typeof value.key !== "string") return null;
  const key = canonicalizeNatalPointKey(value.key);
  const longitude = readLongitude(value.absoluteLongitude);
  if (!key || longitude === null || typeof value.sign !== "string" || typeof value.degree !== "number" || typeof value.derived !== "boolean") return null;
  const canonical = toPlacement(key, longitude, value.derived);
  return canonical.sign === value.sign && Math.abs(canonical.degree - value.degree) < 0.000001 ? canonical : null;
}

function toPlacement(key: CanonicalNatalPointKey, longitude: number, derived: boolean): NatalChartProjectionPlacement {
  const sign = zodiacSignForNatalLongitude(longitude);
  if (!sign) throw new Error("canonical longitude invariant failed");
  return { key, absoluteLongitude: longitude, sign, degree: longitude % 30, derived };
}

function readLongitude(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 360 ? value : null;
}

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function signLongitude(sign: string): number {
  return ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"].indexOf(sign) * 30;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function failure(code: NatalChartLifecycleFailureCode, reason: NatalChartLifecycleFailure["reason"]): { ok: false; error: NatalChartLifecycleFailure } {
  return { ok: false, error: { code, reason } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
