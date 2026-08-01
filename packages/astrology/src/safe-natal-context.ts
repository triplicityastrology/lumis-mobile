import {
  NATAL_ASPECT_RULES,
  type NatalAspectType,
  type NatalAspectValue,
} from "./natal-aspects";
import {
  NATAL_FACT_RULE_VERSION,
  isCanonicalNatalAngleKey,
  type BirthTimeCapabilities,
  type CanonicalNatalBodyKey,
  type CanonicalNatalPointKey,
  type CanonicalZodiacSign,
  type NatalDerivedFact,
} from "./natal-facts";
import {
  NATAL_ENGINE_OUTPUT_VERSION,
  type NatalEngineCanonicalFact,
} from "./natal-engine-composer";
import { NATAL_INPUT_CONTRACT_VERSION } from "./natal-input-boundary";

export const NATAL_CONTEXT_VERSION = "natal_context_v1" as const;

export type NatalContextFailure = {
  code:
    | "NATAL_CONTEXT_NOT_OBJECT"
    | "NATAL_CONTEXT_UNKNOWN_FIELD"
    | "NATAL_CONTEXT_OUTPUT_VERSION_INVALID"
    | "NATAL_CONTEXT_SCOPE_INVALID"
    | "NATAL_CONTEXT_PROVENANCE_INVALID"
    | "NATAL_CONTEXT_CAPABILITIES_INVALID"
    | "NATAL_CONTEXT_FACTS_INVALID"
    | "NATAL_CONTEXT_FACT_INVALID"
    | "NATAL_CONTEXT_DUPLICATE_FACT"
    | "NATAL_CONTEXT_ASPECTS_INVALID"
    | "NATAL_CONTEXT_ASPECT_INVALID"
    | "NATAL_CONTEXT_DUPLICATE_ASPECT";
  reason:
    | "malformed_engine_output"
    | "unknown_field"
    | "supported_engine_output_required"
    | "natal_scope_required"
    | "validated_input_provenance_required"
    | "consistent_capabilities_required"
    | "fact_list_required"
    | "approved_canonical_fact_required"
    | "canonical_fact_must_be_unique"
    | "aspect_list_required"
    | "approved_natal_aspect_required"
    | "canonical_aspect_must_be_unique";
  location:
    | "root"
    | "schema_version"
    | "scope"
    | "input_provenance"
    | "capabilities"
    | "facts"
    | "aspects";
};

export type SafeNatalContext = {
  schemaVersion: typeof NATAL_CONTEXT_VERSION;
  scope: "natal";
  provenance: {
    source: "validated_deterministic_natal_engine_output";
    engineOutputVersion: typeof NATAL_ENGINE_OUTPUT_VERSION;
    inputContractVersion: typeof NATAL_INPUT_CONTRACT_VERSION;
    factRuleVersion: typeof NATAL_FACT_RULE_VERSION;
  };
  capabilities: BirthTimeCapabilities;
  facts: NatalEngineCanonicalFact[];
  aspects: NatalDerivedFact<NatalAspectValue>[];
};

export type SafeNatalContextResult =
  | { ok: true; value: SafeNatalContext }
  | { ok: false; error: NatalContextFailure };

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "scope",
  "inputProvenance",
  "capabilities",
  "facts",
  "aspects",
]);
const INPUT_PROVENANCE_FIELDS = new Set([
  "source",
  "contractVersion",
  "sourceFields",
  "rule",
]);
const CAPABILITY_FIELDS = new Set([
  "birthTime",
  "houses",
  "angles",
  "chartRuler",
  "houseRulers",
  "hemisphere",
  "houseStellium",
  "occupancy",
]);
const FACT_FIELDS = new Set([
  "canonicalKey",
  "value",
  "sourceFields",
  "ruleVersion",
  "capabilityRequirement",
  "derived",
  "applicable",
  "reason",
  "provenance",
]);
const FACT_PROVENANCE_FIELDS = new Set(["source", "rule"]);
const ASPECT_VALUE_FIELDS = new Set([
  "pointA",
  "pointB",
  "aspect",
  "separationDegrees",
  "exactAngleDegrees",
  "orbDegrees",
]);
const INPUT_SOURCE_FIELDS = new Set([
  "schemaVersion",
  "chartType",
  "precision",
  "points",
  "houses",
  "houseSystem",
  "moonLocalDayEndpoints",
]);
const BODY_KEYS = new Set<CanonicalNatalBodyKey>([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
  "north_node",
  "south_node",
]);
const POINT_KEYS = new Set<CanonicalNatalPointKey>([
  ...BODY_KEYS,
  "ascendant",
  "medium_coeli",
  "descendant",
  "imum_coeli",
]);
const ZODIAC_SIGNS = new Set<CanonicalZodiacSign>([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
]);
const SAFE_SOURCE_FIELD =
  /^(?:points\[\d+\]\.(?:key|absoluteLongitude)|houses\[\d+\]\.(?:no|cuspLongitude)|moonLocalDayEndpoints\.(?:startLongitude|endLongitude)|chart\.precision)$/;

export function projectSafeNatalContext(
  engineOutput: unknown
): SafeNatalContextResult {
  if (!isPlainRecord(engineOutput)) {
    return failure(
      "NATAL_CONTEXT_NOT_OBJECT",
      "malformed_engine_output",
      "root"
    );
  }
  const rootFailure = validateClosedFields(engineOutput, ROOT_FIELDS, "root");
  if (rootFailure) {
    return rootFailure;
  }
  if (engineOutput.schemaVersion !== NATAL_ENGINE_OUTPUT_VERSION) {
    return failure(
      "NATAL_CONTEXT_OUTPUT_VERSION_INVALID",
      "supported_engine_output_required",
      "schema_version"
    );
  }
  if (engineOutput.scope !== "natal") {
    return failure(
      "NATAL_CONTEXT_SCOPE_INVALID",
      "natal_scope_required",
      "scope"
    );
  }
  if (!validateInputProvenance(engineOutput.inputProvenance)) {
    return failure(
      "NATAL_CONTEXT_PROVENANCE_INVALID",
      "validated_input_provenance_required",
      "input_provenance"
    );
  }

  const capabilities = validateCapabilities(engineOutput.capabilities);
  if (!capabilities) {
    return failure(
      "NATAL_CONTEXT_CAPABILITIES_INVALID",
      "consistent_capabilities_required",
      "capabilities"
    );
  }
  const facts = validateFacts(engineOutput.facts);
  if (!facts.ok) {
    return facts;
  }
  const aspects = validateAspects(engineOutput.aspects, capabilities);
  if (!aspects.ok) {
    return aspects;
  }

  return {
    ok: true,
    value: {
      schemaVersion: NATAL_CONTEXT_VERSION,
      scope: "natal",
      provenance: {
        source: "validated_deterministic_natal_engine_output",
        engineOutputVersion: NATAL_ENGINE_OUTPUT_VERSION,
        inputContractVersion: NATAL_INPUT_CONTRACT_VERSION,
        factRuleVersion: NATAL_FACT_RULE_VERSION,
      },
      capabilities,
      facts: facts.value.sort(compareCanonicalKey),
      aspects: aspects.value.sort(compareCanonicalKey),
    },
  };
}

function validateInputProvenance(value: unknown): boolean {
  if (
    !isPlainRecord(value) ||
    validateClosedFields(value, INPUT_PROVENANCE_FIELDS, "input_provenance") ||
    value.source !== "validated_provider_normalised_natal_input" ||
    value.contractVersion !== NATAL_INPUT_CONTRACT_VERSION ||
    value.rule !== "closed_natal_input_contract" ||
    !Array.isArray(value.sourceFields) ||
    value.sourceFields.length < 5
  ) {
    return false;
  }
  const fields = value.sourceFields;
  return (
    fields.every(
      (field): field is string =>
        typeof field === "string" && INPUT_SOURCE_FIELDS.has(field)
    ) &&
    new Set(fields).size === fields.length
  );
}

function validateCapabilities(value: unknown): BirthTimeCapabilities | null {
  if (
    !isPlainRecord(value) ||
    validateClosedFields(value, CAPABILITY_FIELDS, "capabilities") ||
    (value.birthTime !== "supplied" && value.birthTime !== "not_supplied")
  ) {
    return null;
  }
  const timed = value.birthTime === "supplied";
  for (const key of [
    "houses",
    "angles",
    "chartRuler",
    "houseRulers",
    "hemisphere",
    "houseStellium",
    "occupancy",
  ] as const) {
    if (value[key] !== timed) {
      return null;
    }
  }
  return {
    birthTime: value.birthTime,
    houses: timed,
    angles: timed,
    chartRuler: timed,
    houseRulers: timed,
    hemisphere: timed,
    houseStellium: timed,
    occupancy: timed,
  };
}

function validateFacts(
  value: unknown
):
  | { ok: true; value: NatalEngineCanonicalFact[] }
  | { ok: false; error: NatalContextFailure } {
  if (!Array.isArray(value)) {
    return failure(
      "NATAL_CONTEXT_FACTS_INVALID",
      "fact_list_required",
      "facts"
    );
  }
  const facts: NatalEngineCanonicalFact[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const fact = validateFact(candidate);
    if (!fact) {
      return failure(
        "NATAL_CONTEXT_FACT_INVALID",
        "approved_canonical_fact_required",
        "facts"
      );
    }
    if (seen.has(fact.canonicalKey)) {
      return failure(
        "NATAL_CONTEXT_DUPLICATE_FACT",
        "canonical_fact_must_be_unique",
        "facts"
      );
    }
    seen.add(fact.canonicalKey);
    facts.push(fact);
  }
  return { ok: true, value: facts };
}

function validateFact(value: unknown): NatalEngineCanonicalFact | null {
  if (
    !isPlainRecord(value) ||
    validateClosedFields(value, FACT_FIELDS, "facts") ||
    typeof value.canonicalKey !== "string" ||
    !isSafeSourceFields(value.sourceFields) ||
    value.ruleVersion !== NATAL_FACT_RULE_VERSION ||
    value.derived !== true ||
    typeof value.applicable !== "boolean" ||
    !isPlainRecord(value.provenance) ||
    validateClosedFields(value.provenance, FACT_PROVENANCE_FIELDS, "facts") ||
    value.provenance.source !== "founder_approved_knowledge_bank_v0.2"
  ) {
    return null;
  }

  if (value.canonicalKey === "moon_sign") {
    if (
      value.capabilityRequirement !== "moon_local_day_endpoints" ||
      value.provenance.rule !== "moon_local_day_endpoint_sign_stability" ||
      !(
        (value.applicable &&
          typeof value.value === "string" &&
          ZODIAC_SIGNS.has(value.value as CanonicalZodiacSign) &&
          value.reason === "available_moon_local_day_same_sign") ||
        (!value.applicable &&
          value.value === null &&
          (value.reason === "suppressed_moon_local_day_boundary" ||
            value.reason === "suppressed_moon_local_day_endpoints_missing"))
      )
    ) {
      return null;
    }
    return copyFact(value) as NatalDerivedFact<CanonicalZodiacSign>;
  }

  if (!/^(?:chart_ruler|house_(?:0[1-9]|1[0-2])_ruler)$/.test(value.canonicalKey)) {
    return null;
  }
  if (
    value.capabilityRequirement !== "birth_time_supplied" ||
    typeof value.value !== "string" ||
    !BODY_KEYS.has(value.value as CanonicalNatalBodyKey) ||
    value.applicable !== true ||
    value.reason !== "available_birth_time_supplied" ||
    (value.canonicalKey === "chart_ruler"
      ? value.provenance.rule !== "traditional_ascendant_sign_rulership"
      : value.provenance.rule !== "traditional_sign_rulership")
  ) {
    return null;
  }
  return copyFact(value) as NatalDerivedFact<CanonicalNatalBodyKey>;
}

function validateAspects(
  value: unknown,
  capabilities: BirthTimeCapabilities
):
  | { ok: true; value: NatalDerivedFact<NatalAspectValue>[] }
  | { ok: false; error: NatalContextFailure } {
  if (!Array.isArray(value)) {
    return failure(
      "NATAL_CONTEXT_ASPECTS_INVALID",
      "aspect_list_required",
      "aspects"
    );
  }
  const aspects: NatalDerivedFact<NatalAspectValue>[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const aspect = validateAspect(candidate, capabilities);
    if (!aspect) {
      return failure(
        "NATAL_CONTEXT_ASPECT_INVALID",
        "approved_natal_aspect_required",
        "aspects"
      );
    }
    if (seen.has(aspect.canonicalKey)) {
      return failure(
        "NATAL_CONTEXT_DUPLICATE_ASPECT",
        "canonical_aspect_must_be_unique",
        "aspects"
      );
    }
    seen.add(aspect.canonicalKey);
    aspects.push(aspect);
  }
  return { ok: true, value: aspects };
}

function validateAspect(
  value: unknown,
  capabilities: BirthTimeCapabilities
): NatalDerivedFact<NatalAspectValue> | null {
  if (
    !isPlainRecord(value) ||
    validateClosedFields(value, FACT_FIELDS, "aspects") ||
    typeof value.canonicalKey !== "string" ||
    !isSafeSourceFields(value.sourceFields) ||
    value.ruleVersion !== NATAL_FACT_RULE_VERSION ||
    value.derived !== true ||
    value.applicable !== true ||
    value.reason !== "within_approved_natal_aspect_orb" ||
    !isPlainRecord(value.provenance) ||
    validateClosedFields(value.provenance, FACT_PROVENANCE_FIELDS, "aspects") ||
    value.provenance.source !== "founder_approved_knowledge_bank_v0.2" ||
    !isPlainRecord(value.value) ||
    validateClosedFields(value.value, ASPECT_VALUE_FIELDS, "aspects")
  ) {
    return null;
  }
  const aspectValue = value.value;
  if (
    typeof aspectValue.pointA !== "string" ||
    !POINT_KEYS.has(aspectValue.pointA as CanonicalNatalPointKey) ||
    typeof aspectValue.pointB !== "string" ||
    !POINT_KEYS.has(aspectValue.pointB as CanonicalNatalPointKey) ||
    aspectValue.pointA.localeCompare(aspectValue.pointB) >= 0 ||
    typeof aspectValue.aspect !== "string"
  ) {
    return null;
  }
  const rule = NATAL_ASPECT_RULES.find(
    (candidate) => candidate.type === aspectValue.aspect
  );
  if (
    !rule ||
    !isFiniteRange(aspectValue.separationDegrees, 0, 180) ||
    aspectValue.exactAngleDegrees !== rule.angle ||
    !isFiniteRange(aspectValue.orbDegrees, 0, rule.orb) ||
    Math.abs(
      aspectValue.orbDegrees -
        Math.abs(aspectValue.separationDegrees - rule.angle)
    ) > 1e-9
  ) {
    return null;
  }
  const pointA = aspectValue.pointA as CanonicalNatalPointKey;
  const pointB = aspectValue.pointB as CanonicalNatalPointKey;
  const capabilityRequirement =
    isCanonicalNatalAngleKey(pointA) || isCanonicalNatalAngleKey(pointB)
      ? "birth_time_supplied"
      : "none";
  if (
    value.capabilityRequirement !== capabilityRequirement ||
    (capabilityRequirement === "birth_time_supplied" && !capabilities.angles) ||
    value.canonicalKey !==
      `natal_aspect:${pointA}:${pointB}:${rule.type}` ||
    value.provenance.rule !==
      `natal_${rule.type}_${rule.angle}_orb_${rule.orb}`
  ) {
    return null;
  }
  return {
    canonicalKey: value.canonicalKey,
    value: {
      pointA,
      pointB,
      aspect: rule.type as NatalAspectType,
      separationDegrees: aspectValue.separationDegrees,
      exactAngleDegrees: rule.angle,
      orbDegrees: aspectValue.orbDegrees,
    },
    sourceFields: [...value.sourceFields],
    ruleVersion: NATAL_FACT_RULE_VERSION,
    capabilityRequirement,
    derived: true,
    applicable: true,
    reason: "within_approved_natal_aspect_orb",
    provenance: {
      source: "founder_approved_knowledge_bank_v0.2",
      rule: value.provenance.rule,
    },
  };
}

function copyFact(value: Record<string, unknown>): NatalDerivedFact<unknown> {
  const provenance = value.provenance as Record<string, unknown>;
  return {
    canonicalKey: value.canonicalKey as string,
    value: value.value,
    sourceFields: [...(value.sourceFields as string[])],
    ruleVersion: NATAL_FACT_RULE_VERSION,
    capabilityRequirement: value.capabilityRequirement as NatalDerivedFact<unknown>["capabilityRequirement"],
    derived: true,
    applicable: value.applicable as boolean,
    reason: value.reason as NatalDerivedFact<unknown>["reason"],
    provenance: {
      source: "founder_approved_knowledge_bank_v0.2",
      rule: provenance.rule as string,
    },
  };
}

function isSafeSourceFields(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (field) => typeof field === "string" && SAFE_SOURCE_FIELD.test(field)
    )
  );
}

function isFiniteRange(
  value: unknown,
  minimum: number,
  maximum: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function compareCanonicalKey(
  left: { canonicalKey: string },
  right: { canonicalKey: string }
): number {
  return left.canonicalKey.localeCompare(right.canonicalKey);
}

function validateClosedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  location: NatalContextFailure["location"]
): { ok: false; error: NatalContextFailure } | null {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      return failure("NATAL_CONTEXT_UNKNOWN_FIELD", "unknown_field", location);
    }
  }
  return null;
}

function failure(
  code: NatalContextFailure["code"],
  reason: NatalContextFailure["reason"],
  location: NatalContextFailure["location"]
): { ok: false; error: NatalContextFailure } {
  return { ok: false, error: { code, reason, location } };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
