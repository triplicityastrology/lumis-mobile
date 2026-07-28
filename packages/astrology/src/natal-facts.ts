import type { ChartPrecision } from "@lumis/shared";

export const NATAL_FACT_RULE_VERSION = "knowledge_bank_v0.2" as const;

export type CanonicalNatalBodyKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "chiron"
  | "north_node"
  | "south_node";

export type CanonicalNatalAngleKey =
  | "ascendant"
  | "medium_coeli"
  | "descendant"
  | "imum_coeli";

export type CanonicalNatalPointKey =
  | CanonicalNatalBodyKey
  | CanonicalNatalAngleKey;

export type CanonicalZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type BirthTimeAvailability = "supplied" | "not_supplied";

export type TimedNatalCapability =
  | "houses"
  | "angles"
  | "chart_ruler"
  | "house_rulers"
  | "hemisphere"
  | "house_stellium"
  | "occupancy";

export type NatalFactCapabilityRequirement =
  | "none"
  | "birth_time_supplied"
  | "moon_local_day_endpoints";

export type NatalFactReason =
  | "available_without_birth_time"
  | "available_birth_time_supplied"
  | "suppressed_birth_time_not_supplied"
  | "available_moon_local_day_same_sign"
  | "suppressed_moon_local_day_boundary"
  | "suppressed_moon_local_day_endpoints_missing"
  | "within_approved_natal_aspect_orb"
  | "unsupported_canonical_input";

export type NatalDerivedFact<T> = {
  canonicalKey: string;
  value: T | null;
  sourceFields: string[];
  ruleVersion: typeof NATAL_FACT_RULE_VERSION;
  capabilityRequirement: NatalFactCapabilityRequirement;
  derived: true;
  applicable: boolean;
  reason: NatalFactReason;
  provenance: {
    source: "founder_approved_knowledge_bank_v0.2";
    rule: string;
  };
};

export type BirthTimeCapabilities = {
  birthTime: BirthTimeAvailability;
  houses: boolean;
  angles: boolean;
  chartRuler: boolean;
  houseRulers: boolean;
  hemisphere: boolean;
  houseStellium: boolean;
  occupancy: boolean;
};

const POINT_ALIASES: Readonly<Record<string, CanonicalNatalPointKey>> = {
  sun: "sun",
  sol: "sun",
  moon: "moon",
  luna: "moon",
  mercury: "mercury",
  venus: "venus",
  mars: "mars",
  jupiter: "jupiter",
  saturn: "saturn",
  uranus: "uranus",
  neptune: "neptune",
  pluto: "pluto",
  chiron: "chiron",
  northnode: "north_node",
  truenode: "north_node",
  ascendingnode: "north_node",
  southnode: "south_node",
  descendingnode: "south_node",
  asc: "ascendant",
  ascendant: "ascendant",
  rising: "ascendant",
  risingsign: "ascendant",
  mc: "medium_coeli",
  midheaven: "medium_coeli",
  mediumcoeli: "medium_coeli",
  mediumcaeli: "medium_coeli",
  dsc: "descendant",
  dc: "descendant",
  descendant: "descendant",
  ic: "imum_coeli",
  imumcoeli: "imum_coeli",
  imumcaeli: "imum_coeli",
  nadir: "imum_coeli",
};

const SIGN_ALIASES: Readonly<Record<string, CanonicalZodiacSign>> = {
  aries: "aries",
  ari: "aries",
  taurus: "taurus",
  tau: "taurus",
  gemini: "gemini",
  gem: "gemini",
  cancer: "cancer",
  can: "cancer",
  leo: "leo",
  virgo: "virgo",
  vir: "virgo",
  libra: "libra",
  lib: "libra",
  scorpio: "scorpio",
  sco: "scorpio",
  sagittarius: "sagittarius",
  sag: "sagittarius",
  capricorn: "capricorn",
  cap: "capricorn",
  aquarius: "aquarius",
  aqu: "aquarius",
  pisces: "pisces",
  pis: "pisces",
};

const TRADITIONAL_RULERS: Readonly<
  Record<CanonicalZodiacSign, CanonicalNatalBodyKey>
> = {
  aries: "mars",
  taurus: "venus",
  gemini: "mercury",
  cancer: "moon",
  leo: "sun",
  virgo: "mercury",
  libra: "venus",
  scorpio: "mars",
  sagittarius: "jupiter",
  capricorn: "saturn",
  aquarius: "saturn",
  pisces: "jupiter",
};

const ZODIAC_SIGNS = Object.freeze(
  Object.keys(TRADITIONAL_RULERS) as CanonicalZodiacSign[]
);

export function canonicalizeNatalPointKey(
  input: string
): CanonicalNatalPointKey | null {
  return POINT_ALIASES[normalizeAlias(input)] ?? null;
}

export function canonicalizeZodiacSign(
  input: string
): CanonicalZodiacSign | null {
  return SIGN_ALIASES[normalizeAlias(input)] ?? null;
}

export function isCanonicalNatalAngleKey(
  key: CanonicalNatalPointKey
): key is CanonicalNatalAngleKey {
  return (
    key === "ascendant" ||
    key === "medium_coeli" ||
    key === "descendant" ||
    key === "imum_coeli"
  );
}

export function resolveBirthTimeAvailability(
  precision: ChartPrecision
): BirthTimeAvailability {
  return precision === "full" ? "supplied" : "not_supplied";
}

export function resolveBirthTimeCapabilities(
  birthTime: BirthTimeAvailability
): BirthTimeCapabilities {
  const timedFactsAvailable = birthTime === "supplied";

  return {
    birthTime,
    houses: timedFactsAvailable,
    angles: timedFactsAvailable,
    chartRuler: timedFactsAvailable,
    houseRulers: timedFactsAvailable,
    hemisphere: timedFactsAvailable,
    houseStellium: timedFactsAvailable,
    occupancy: timedFactsAvailable,
  };
}

export function deriveTimedNatalFact<T>(input: {
  canonicalKey: string;
  capability: TimedNatalCapability;
  birthTime: BirthTimeAvailability;
  sourceFields: string[];
  value: T;
  provenanceRule: string;
}): NatalDerivedFact<T> {
  const applicable = capabilityAvailable(
    resolveBirthTimeCapabilities(input.birthTime),
    input.capability
  );

  return createFact({
    canonicalKey: input.canonicalKey,
    value: applicable ? input.value : null,
    sourceFields: input.sourceFields,
    capabilityRequirement: "birth_time_supplied",
    applicable,
    reason: applicable
      ? "available_birth_time_supplied"
      : "suppressed_birth_time_not_supplied",
    provenanceRule: input.provenanceRule,
  });
}

export function deriveMoonSignFromLocalDayEndpoints(input: {
  startLongitude: number | null | undefined;
  endLongitude: number | null | undefined;
  sourceFields?: string[];
}): NatalDerivedFact<CanonicalZodiacSign> {
  const sourceFields = input.sourceFields ?? [
    "moon.local_day_start_longitude",
    "moon.local_day_end_longitude",
  ];
  const startSign = zodiacSignForLongitude(input.startLongitude);
  const endSign = zodiacSignForLongitude(input.endLongitude);

  if (!startSign || !endSign) {
    return createFact<CanonicalZodiacSign>({
      canonicalKey: "moon_sign",
      value: null,
      sourceFields,
      capabilityRequirement: "moon_local_day_endpoints",
      applicable: false,
      reason: "suppressed_moon_local_day_endpoints_missing",
      provenanceRule: "moon_local_day_endpoint_sign_stability",
    });
  }

  const applicable = startSign === endSign;
  return createFact({
    canonicalKey: "moon_sign",
    value: applicable ? startSign : null,
    sourceFields,
    capabilityRequirement: "moon_local_day_endpoints",
    applicable,
    reason: applicable
      ? "available_moon_local_day_same_sign"
      : "suppressed_moon_local_day_boundary",
    provenanceRule: "moon_local_day_endpoint_sign_stability",
  });
}

export function deriveTraditionalHouseRuler(input: {
  house: number;
  cuspSign: string;
  birthTime: BirthTimeAvailability;
  sourceField?: string;
}): NatalDerivedFact<CanonicalNatalBodyKey> {
  const sourceFields = [
    input.sourceField ?? `houses[${Math.max(0, input.house - 1)}].sign`,
    "chart.precision",
  ];
  const sign = canonicalizeZodiacSign(input.cuspSign);
  const validHouse = Number.isInteger(input.house) && input.house >= 1 && input.house <= 12;

  if (!sign || !validHouse) {
    return createFact<CanonicalNatalBodyKey>({
      canonicalKey: validHouse
        ? `house_${String(input.house).padStart(2, "0")}_ruler`
        : "house_ruler",
      value: null,
      sourceFields,
      capabilityRequirement: "birth_time_supplied",
      applicable: false,
      reason: "unsupported_canonical_input",
      provenanceRule: "traditional_sign_rulership",
    });
  }

  return deriveTimedNatalFact({
    canonicalKey: `house_${String(input.house).padStart(2, "0")}_ruler`,
    capability: "house_rulers",
    birthTime: input.birthTime,
    sourceFields,
    value: TRADITIONAL_RULERS[sign],
    provenanceRule: "traditional_sign_rulership",
  });
}

export function deriveTraditionalChartRuler(input: {
  ascendantSign: string;
  birthTime: BirthTimeAvailability;
  sourceField?: string;
}): NatalDerivedFact<CanonicalNatalBodyKey> {
  const sourceFields = [
    input.sourceField ?? "angles.ascendant.sign",
    "chart.precision",
  ];
  const sign = canonicalizeZodiacSign(input.ascendantSign);

  if (!sign) {
    return createFact<CanonicalNatalBodyKey>({
      canonicalKey: "chart_ruler",
      value: null,
      sourceFields,
      capabilityRequirement: "birth_time_supplied",
      applicable: false,
      reason: "unsupported_canonical_input",
      provenanceRule: "traditional_ascendant_sign_rulership",
    });
  }

  return deriveTimedNatalFact({
    canonicalKey: "chart_ruler",
    capability: "chart_ruler",
    birthTime: input.birthTime,
    sourceFields,
    value: TRADITIONAL_RULERS[sign],
    provenanceRule: "traditional_ascendant_sign_rulership",
  });
}

export function traditionalRulerForSign(
  sign: string
): CanonicalNatalBodyKey | null {
  const canonicalSign = canonicalizeZodiacSign(sign);
  return canonicalSign ? TRADITIONAL_RULERS[canonicalSign] : null;
}

function createFact<T>(input: {
  canonicalKey: string;
  value: T | null;
  sourceFields: string[];
  capabilityRequirement: NatalFactCapabilityRequirement;
  applicable: boolean;
  reason: NatalFactReason;
  provenanceRule: string;
}): NatalDerivedFact<T> {
  return {
    canonicalKey: input.canonicalKey,
    value: input.value,
    sourceFields: [...input.sourceFields],
    ruleVersion: NATAL_FACT_RULE_VERSION,
    capabilityRequirement: input.capabilityRequirement,
    derived: true,
    applicable: input.applicable,
    reason: input.reason,
    provenance: {
      source: "founder_approved_knowledge_bank_v0.2",
      rule: input.provenanceRule,
    },
  };
}

function capabilityAvailable(
  capabilities: BirthTimeCapabilities,
  capability: TimedNatalCapability
): boolean {
  const capabilityMap: Record<TimedNatalCapability, boolean> = {
    houses: capabilities.houses,
    angles: capabilities.angles,
    chart_ruler: capabilities.chartRuler,
    house_rulers: capabilities.houseRulers,
    hemisphere: capabilities.hemisphere,
    house_stellium: capabilities.houseStellium,
    occupancy: capabilities.occupancy,
  };
  return capabilityMap[capability];
}

function zodiacSignForLongitude(
  longitude: number | null | undefined
): CanonicalZodiacSign | null {
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return null;
  }

  const normalized = ((longitude % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(normalized / 30)] ?? null;
}

function normalizeAlias(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
