import {
  NATAL_FACT_RULE_VERSION,
  canonicalizeNatalPointKey,
  deriveMoonSignFromLocalDayEndpoints,
  deriveTimedNatalFact,
  deriveTraditionalChartRuler,
  deriveTraditionalHouseRuler,
  resolveBirthTimeAvailability,
  resolveBirthTimeCapabilities,
  traditionalRulerForSign,
  type TimedNatalCapability,
} from "./natal-facts";

const aliasCases = [
  ["Sun", "sun"],
  ["Luna", "moon"],
  ["True Node", "north_node"],
  ["north_node", "north_node"],
  ["Descending Node", "south_node"],
  ["ASC", "ascendant"],
  ["Rising Sign", "ascendant"],
  ["MC", "medium_coeli"],
  ["Medium Caeli", "medium_coeli"],
  ["DC", "descendant"],
  ["IC", "imum_coeli"],
] as const;

for (const [alias, expected] of aliasCases) {
  equal(canonicalizeNatalPointKey(alias), expected, `alias ${alias}`);
}
equal(canonicalizeNatalPointKey("Vertex"), null, "Vertex remains excluded");
equal(canonicalizeNatalPointKey("Solar Return Sun"), null, "Solar Return remains excluded");
equal(canonicalizeNatalPointKey("SR Moon"), null, "SR remains excluded");

equal(resolveBirthTimeAvailability("full"), "supplied", "full precision");
equal(
  resolveBirthTimeAvailability("no_birth_time"),
  "not_supplied",
  "unknown-time precision"
);

const noTimeCapabilities = resolveBirthTimeCapabilities("not_supplied");
for (const [name, available] of Object.entries(noTimeCapabilities)) {
  if (name !== "birthTime") {
    equal(available, false, `${name} suppressed without birth time`);
  }
}

const timedCapabilities: TimedNatalCapability[] = [
  "houses",
  "angles",
  "chart_ruler",
  "house_rulers",
  "hemisphere",
  "house_stellium",
  "occupancy",
];
for (const capability of timedCapabilities) {
  const fact = deriveTimedNatalFact({
    canonicalKey: `fixture_${capability}`,
    capability,
    birthTime: "not_supplied",
    sourceFields: [`fixture.${capability}`, "chart.precision"],
    value: "must-not-survive",
    provenanceRule: `fixture_${capability}`,
  });
  assertFactEnvelope(fact, `fixture_${capability}`);
  equal(fact.applicable, false, `${capability} fact not applicable`);
  equal(fact.value, null, `${capability} value suppressed`);
  equal(
    fact.reason,
    "suppressed_birth_time_not_supplied",
    `${capability} reason`
  );
}

const suppliedOccupancy = deriveTimedNatalFact({
  canonicalKey: "house_01_occupancy",
  capability: "occupancy",
  birthTime: "supplied",
  sourceFields: ["planets[].house", "chart.precision"],
  value: ["sun"],
  provenanceRule: "house_occupancy",
});
equal(suppliedOccupancy.applicable, true, "timed fact available");
equal(suppliedOccupancy.reason, "available_birth_time_supplied", "timed reason");

const stableMoon = deriveMoonSignFromLocalDayEndpoints({
  startLongitude: 42.25,
  endLongitude: 55.75,
});
assertFactEnvelope(stableMoon, "moon_sign");
equal(stableMoon.applicable, true, "Moon stable within local day");
equal(stableMoon.value, "taurus", "Moon stable sign");

const boundaryMoon = deriveMoonSignFromLocalDayEndpoints({
  startLongitude: 29.999,
  endLongitude: 30,
});
equal(boundaryMoon.applicable, false, "Moon boundary suppressed");
equal(boundaryMoon.value, null, "Moon boundary has no asserted sign");
equal(
  boundaryMoon.reason,
  "suppressed_moon_local_day_boundary",
  "Moon boundary reason"
);

const yearBoundaryMoon = deriveMoonSignFromLocalDayEndpoints({
  startLongitude: 359.9,
  endLongitude: 360.1,
});
equal(yearBoundaryMoon.applicable, false, "Moon year boundary suppressed");

const missingMoon = deriveMoonSignFromLocalDayEndpoints({
  startLongitude: null,
  endLongitude: 42,
});
equal(
  missingMoon.reason,
  "suppressed_moon_local_day_endpoints_missing",
  "Moon endpoints required"
);

const rulerCases = [
  ["Aries", "mars"],
  ["Taurus", "venus"],
  ["Gemini", "mercury"],
  ["Cancer", "moon"],
  ["Leo", "sun"],
  ["Virgo", "mercury"],
  ["Libra", "venus"],
  ["Scorpio", "mars"],
  ["Sagittarius", "jupiter"],
  ["Capricorn", "saturn"],
  ["Aquarius", "saturn"],
  ["Pisces", "jupiter"],
] as const;
for (const [sign, ruler] of rulerCases) {
  equal(traditionalRulerForSign(sign), ruler, `${sign} traditional ruler`);
}

const houseTen = deriveTraditionalHouseRuler({
  house: 10,
  cuspSign: "Aquarius",
  birthTime: "supplied",
});
assertFactEnvelope(houseTen, "house_10_ruler");
equal(houseTen.value, "saturn", "house_10_ruler uses traditional ruler");

const suppressedHouseTen = deriveTraditionalHouseRuler({
  house: 10,
  cuspSign: "Aquarius",
  birthTime: "not_supplied",
});
equal(suppressedHouseTen.applicable, false, "house_10_ruler suppressed");
equal(suppressedHouseTen.value, null, "suppressed house ruler has no value");

const chartRuler = deriveTraditionalChartRuler({
  ascendantSign: "Scorpio",
  birthTime: "supplied",
});
equal(chartRuler.value, "mars", "traditional Scorpio chart ruler");
equal(
  deriveTraditionalChartRuler({
    ascendantSign: "Scorpio",
    birthTime: "not_supplied",
  }).value,
  null,
  "chart ruler suppressed without birth time"
);

console.log("deterministic natal canonicalisation and capability fixtures passed");

function assertFactEnvelope(
  fact: {
    canonicalKey: string;
    sourceFields: string[];
    ruleVersion: string;
    capabilityRequirement: string;
    derived: boolean;
    reason: string;
    provenance: { source: string; rule: string };
  },
  canonicalKey: string
): void {
  equal(fact.canonicalKey, canonicalKey, `${canonicalKey} canonical key`);
  equal(fact.ruleVersion, NATAL_FACT_RULE_VERSION, `${canonicalKey} rule version`);
  equal(fact.derived, true, `${canonicalKey} derived flag`);
  truthy(fact.sourceFields.length, `${canonicalKey} source fields`);
  truthy(fact.capabilityRequirement, `${canonicalKey} capability requirement`);
  truthy(fact.reason, `${canonicalKey} reason`);
  equal(
    fact.provenance.source,
    "founder_approved_knowledge_bank_v0.2",
    `${canonicalKey} provenance source`
  );
  truthy(fact.provenance.rule, `${canonicalKey} provenance rule`);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function truthy(value: unknown, label: string): void {
  if (!value) {
    throw new Error(`${label}: expected a truthy value`);
  }
}
