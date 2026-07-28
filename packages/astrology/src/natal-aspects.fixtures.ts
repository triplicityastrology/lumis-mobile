import {
  NATAL_ASPECT_RULES,
  circularAngularDistance,
  deriveNatalAspects,
  type NatalAspectType,
} from "./natal-aspects";
import { NATAL_FACT_RULE_VERSION } from "./natal-facts";

const expectedRules: Array<[NatalAspectType, number, number]> = [
  ["conjunction", 0, 8],
  ["sextile", 60, 4],
  ["square", 90, 8],
  ["trine", 120, 8],
  ["opposition", 180, 8],
  ["quincunx", 150, 2],
];

equal(NATAL_ASPECT_RULES.length, expectedRules.length, "approved rule count");
for (const [type, angle, orb] of expectedRules) {
  const configured = NATAL_ASPECT_RULES.find((rule) => rule.type === type);
  truthy(configured, `${type} configured`);
  equal(configured?.angle, angle, `${type} angle`);
  equal(configured?.orb, orb, `${type} orb`);

  for (const separation of boundarySeparations(angle, orb)) {
    const fact = onlyAspect(separation);
    equal(fact.value?.aspect, type, `${type} includes ${separation} degrees`);
    equal(
      fact.value?.orbDegrees,
      Math.abs(separation - angle),
      `${type} boundary orb`
    );
    assertFactEnvelope(fact);
  }

  for (const separation of outsideSeparations(angle, orb)) {
    equal(
      aspectsForSeparation(separation).length,
      0,
      `${type} excludes ${separation} degrees`
    );
  }
}

equal(circularAngularDistance(359, 1), 2, "circular wrap distance");
equal(circularAngularDistance(-1, 361), 2, "normalized circular distance");
equal(
  onlyAspect(2, "sun", "moon").value?.aspect,
  "conjunction",
  "wrap-safe conjunction"
);

const forward = deriveNatalAspects({
  points: [
    { key: "Sun", longitude: 0 },
    { key: "Moon", longitude: 60 },
  ],
  birthTime: "supplied",
});
const reversed = deriveNatalAspects({
  points: [
    { key: "Moon", longitude: 60 },
    { key: "Sun", longitude: 0 },
  ],
  birthTime: "supplied",
});
equal(forward.length, 1, "one unordered pair");
equal(reversed.length, 1, "one reversed unordered pair");
equal(
  forward[0]?.canonicalKey,
  reversed[0]?.canonicalKey,
  "unordered pair canonical key"
);

const duplicateAliases = deriveNatalAspects({
  points: [
    { key: "Sun", longitude: 0 },
    { key: "sol", longitude: 0 },
    { key: "Moon", longitude: 60 },
    { key: "Luna", longitude: 60 },
  ],
  birthTime: "supplied",
});
equal(duplicateAliases.length, 1, "duplicate aliases do not duplicate pairs");

const suppliedAngle = deriveNatalAspects({
  points: [
    { key: "ASC", longitude: 0 },
    { key: "Sun", longitude: 120 },
  ],
  birthTime: "supplied",
});
equal(suppliedAngle.length, 1, "supplied-time angle aspect available");
equal(
  suppliedAngle[0]?.capabilityRequirement,
  "birth_time_supplied",
  "angle aspect capability"
);

const suppressedAngle = deriveNatalAspects({
  points: [
    { key: "ASC", longitude: 0 },
    { key: "Sun", longitude: 120 },
  ],
  birthTime: "not_supplied",
});
equal(suppressedAngle.length, 0, "unknown-time angle aspect suppressed");

const excludedPoints = deriveNatalAspects({
  points: [
    { key: "Vertex", longitude: 0 },
    { key: "Solar Return Sun", longitude: 60 },
    { key: "Transit Moon", longitude: 90 },
    { key: "Sun", longitude: 120 },
  ],
  birthTime: "supplied",
});
equal(excludedPoints.length, 0, "excluded scopes produce no natal aspect");

const factShape = JSON.stringify(onlyAspect(60));
doesNotMatch(
  factShape,
  /applying|separating|retrograde|station|node_motion|noon_chart|solar_return|transit|timing|vertex|dice/i,
  "aspect facts contain no inferred or excluded fields"
);

console.log("deterministic natal aspect fixtures passed");

function aspectsForSeparation(separation: number) {
  return deriveNatalAspects({
    points: [
      { key: "Sun", longitude: 0, sourceField: "planets.sun.absoluteLongitude" },
      {
        key: "Moon",
        longitude: separation,
        sourceField: "planets.moon.absoluteLongitude",
      },
    ],
    birthTime: "supplied",
  });
}

function onlyAspect(
  separation: number,
  leftKey = "Sun",
  rightKey = "Moon"
) {
  const facts = deriveNatalAspects({
    points: [
      { key: leftKey, longitude: 359 },
      { key: rightKey, longitude: 359 + separation },
    ],
    birthTime: "supplied",
  });
  equal(facts.length, 1, `${separation} degrees yields one aspect`);
  return facts[0]!;
}

function boundarySeparations(angle: number, orb: number): number[] {
  if (angle === 0) {
    return [0, orb];
  }
  if (angle === 180) {
    return [angle - orb, angle];
  }
  return [angle - orb, angle, angle + orb];
}

function outsideSeparations(angle: number, orb: number): number[] {
  const epsilon = 0.0001;
  if (angle === 0) {
    return [orb + epsilon];
  }
  if (angle === 180) {
    return [angle - orb - epsilon];
  }
  return [angle - orb - epsilon, angle + orb + epsilon];
}

function assertFactEnvelope(fact: {
  canonicalKey: string;
  sourceFields: string[];
  ruleVersion: string;
  capabilityRequirement: string;
  derived: boolean;
  applicable: boolean;
  reason: string;
  provenance: { source: string; rule: string };
}): void {
  truthy(fact.canonicalKey, "aspect canonical key");
  equal(fact.sourceFields.length, 2, "aspect source fields");
  equal(fact.ruleVersion, NATAL_FACT_RULE_VERSION, "aspect rule version");
  truthy(fact.capabilityRequirement, "aspect capability requirement");
  equal(fact.derived, true, "aspect derived flag");
  equal(fact.applicable, true, "aspect applicable");
  equal(fact.reason, "within_approved_natal_aspect_orb", "aspect reason");
  equal(
    fact.provenance.source,
    "founder_approved_knowledge_bank_v0.2",
    "aspect provenance source"
  );
  truthy(fact.provenance.rule, "aspect provenance rule");
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

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) {
    throw new Error(`${label}: found excluded field`);
  }
}
