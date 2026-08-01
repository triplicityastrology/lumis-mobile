import {
  NATAL_ASPECT_RULES,
  type NatalAspectType,
} from "./natal-aspects";
import { composeNatalEngineOutput } from "./natal-engine-composer";
import {
  PROVIDER_NEUTRAL_NATAL_VERSION,
  adaptProviderNeutralNatalPayload,
} from "./provider-neutral-natal-adapter";
import { projectSafeNatalContext } from "./safe-natal-context";

const EPSILON = 0.0001;
const expectedRules: Array<[NatalAspectType, number, number]> = [
  ["conjunction", 0, 8],
  ["sextile", 60, 4],
  ["square", 90, 8],
  ["trine", 120, 8],
  ["opposition", 180, 8],
  ["quincunx", 150, 2],
];

equal(NATAL_ASPECT_RULES.length, expectedRules.length, "approved aspect count");
for (const [aspect, angle, orb] of expectedRules) {
  const rule = NATAL_ASPECT_RULES.find((candidate) => candidate.type === aspect);
  truthy(rule, `${aspect} rule exists`);
  equal(rule?.angle, angle, `${aspect} exact angle`);
  equal(rule?.orb, orb, `${aspect} approved orb`);

  for (const edge of aspectEdges(angle, orb)) {
    expectAspect(edge.inside, aspect, `${aspect} ${edge.side} just inside`);
    expectAspect(edge.boundary, aspect, `${aspect} ${edge.side} boundary`);
    expectNoAspect(edge.outside, `${aspect} ${edge.side} just outside`);
  }
}

const wrapped = composeFromPoints([
  { name: "Sun", longitude: 359 },
  { name: "Moon", longitude: 1 },
]);
equal(wrapped.aspects.length, 1, "circular wrap yields one aspect");
equal(
  wrapped.aspects[0]?.value?.aspect,
  "conjunction",
  "circular wrap conjunction"
);
equal(
  wrapped.aspects[0]?.value?.separationDegrees,
  2,
  "circular wrap distance"
);

const aliased = adaptProviderNeutralNatalPayload(
  payload({
    points: [
      { name: "Sol", longitude: 1 },
      { name: "Luna", longitude: 61 },
      { name: "True Node", longitude: 121 },
      { name: "South Node", longitude: 181 },
      { name: "Chiron", longitude: 241 },
    ],
  })
);
truthy(aliased.ok, "canonical aliases accepted");
if (aliased.ok) {
  equal(
    aliased.value.engineInput.points.map((point) => point.key).join(","),
    "chiron,moon,north_node,south_node,sun",
    "aliases canonicalized and sorted"
  );
}

expectAdapterFailure(
  payload({
    points: [
      { name: "Sun", longitude: 1 },
      { name: "Sol", longitude: 1 },
    ],
  }),
  "NATAL_ADAPTER_DUPLICATE_POINT",
  "duplicate canonical alias"
);

const timed = composeLifecycle(
  payload({
    precision: "full",
    points: [
      { name: "Sun", longitude: 0 },
      { name: "Moon", longitude: 60 },
      { name: "ASC", longitude: 190 },
    ],
    houses: houses(190),
    houseSystem: {
      key: "placidus",
      methodId: "fixture_house_cusps",
      methodVersion: "v1",
    },
  })
);
equal(timed.capabilities.birthTime, "supplied", "timed birth-time capability");
equal(timed.capabilities.houses, true, "timed houses available");
equal(timed.capabilities.angles, true, "timed angles available");

const noTime = composeLifecycle(
  payload({
    precision: "no_birth_time",
    points: [
      { name: "Sun", longitude: 0 },
      { name: "Moon", longitude: 60 },
      { name: "Chiron", longitude: 120 },
      { name: "True Node", longitude: 180 },
      { name: "South Node", longitude: 240 },
    ],
    houses: [],
    moonLocalDayEndpoints: {
      startLongitude: 60,
      endLongitude: 61,
      methodId: "fixture_local_day_moon",
      methodVersion: "v1",
    },
  })
);
equal(
  noTime.capabilities.birthTime,
  "not_supplied",
  "no-time birth-time capability"
);
equal(noTime.capabilities.houses, false, "no-time houses suppressed");
equal(noTime.capabilities.angles, false, "no-time angles suppressed");
equal(
  noTime.facts.some((fact) => /house|ruler|angle/.test(fact.canonicalKey)),
  false,
  "no timed facts survive"
);

const chatContext = composeLifecycle(
  payload({
    points: [
      { name: "Sun", longitude: 0 },
      { name: "Chiron", longitude: 60 },
      { name: "True Node", longitude: 120 },
      { name: "South Node", longitude: 180 },
    ],
  })
);
const chatPoints = new Set(
  chatContext.aspects.flatMap((aspect) =>
    aspect.value ? [aspect.value.pointA, aspect.value.pointB] : []
  )
);
equal(chatPoints.has("chiron"), true, "Chiron retained in Chat-safe context");
equal(
  chatPoints.has("north_node"),
  true,
  "North Node retained in Chat-safe context"
);
equal(
  chatPoints.has("south_node"),
  true,
  "South Node retained in Chat-safe context"
);
doesNotMatch(
  JSON.stringify(chatContext),
  /rawBirth|email|account|coordinates|providerPayload|rawProviderResponse|dice/i,
  "Chat-safe context excludes private and Dice data"
);

for (const [label, contamination] of [
  ["solar return", { solar_return: {} }],
  ["transit", { transit: {} }],
  ["timing", { timing: {} }],
  ["annual theme", { annual_theme: "blocked" }],
  ["Dice", { dice: {} }],
] as const) {
  expectAdapterFailure(
    { ...payload(), ...contamination },
    label === "Dice"
      ? "NATAL_ADAPTER_UNKNOWN_FIELD"
      : "NATAL_ADAPTER_OUT_OF_SCOPE",
    `${label} contamination`
  );
}
expectAdapterFailure(
  payload({ points: [{ name: "Vertex", longitude: 1 }] }),
  "NATAL_ADAPTER_OUT_OF_SCOPE",
  "Vertex contamination"
);

const stablePayload = payload({
  points: [
    { name: "Moon", longitude: 61 },
    { name: "Sun", longitude: 1 },
    { name: "Chiron", longitude: 121 },
  ],
});
equal(
  JSON.stringify(composeLifecycle(stablePayload)),
  JSON.stringify(composeLifecycle(stablePayload)),
  "repeated lifecycle output is byte-stable"
);

console.log("deterministic natal regression corpus passed");

function aspectEdges(
  angle: number,
  orb: number
): Array<{
  side: "lower" | "upper";
  inside: number;
  boundary: number;
  outside: number;
}> {
  if (angle === 0) {
    return [
      {
        side: "upper",
        inside: orb - EPSILON,
        boundary: orb,
        outside: orb + EPSILON,
      },
    ];
  }
  if (angle === 180) {
    return [
      {
        side: "lower",
        inside: angle - orb + EPSILON,
        boundary: angle - orb,
        outside: angle - orb - EPSILON,
      },
    ];
  }
  return [
    {
      side: "lower",
      inside: angle - orb + EPSILON,
      boundary: angle - orb,
      outside: angle - orb - EPSILON,
    },
    {
      side: "upper",
      inside: angle + orb - EPSILON,
      boundary: angle + orb,
      outside: angle + orb + EPSILON,
    },
  ];
}

function expectAspect(
  separation: number,
  expected: NatalAspectType,
  label: string
): void {
  const output = composeFromPoints([
    { name: "Sun", longitude: 0 },
    { name: "Moon", longitude: separation },
  ]);
  equal(output.aspects.length, 1, `${label} count`);
  equal(output.aspects[0]?.value?.aspect, expected, label);
}

function expectNoAspect(separation: number, label: string): void {
  const output = composeFromPoints([
    { name: "Sun", longitude: 0 },
    { name: "Moon", longitude: separation },
  ]);
  equal(output.aspects.length, 0, label);
}

function composeFromPoints(
  points: Array<{ name: string; longitude: number }>
) {
  const adapted = adaptProviderNeutralNatalPayload(payload({ points }));
  truthy(adapted.ok, "aspect payload adapts");
  if (!adapted.ok) {
    throw new Error("aspect fixture setup failed");
  }
  const composed = composeNatalEngineOutput(adapted.value.engineInput);
  truthy(composed.ok, "aspect payload composes");
  if (!composed.ok) {
    throw new Error("aspect fixture setup failed");
  }
  return composed.value;
}

function composeLifecycle(input: unknown) {
  const adapted = adaptProviderNeutralNatalPayload(input);
  truthy(adapted.ok, "lifecycle payload adapts");
  if (!adapted.ok) {
    throw new Error("lifecycle fixture setup failed");
  }
  const composed = composeNatalEngineOutput(adapted.value.engineInput);
  truthy(composed.ok, "lifecycle payload composes");
  if (!composed.ok) {
    throw new Error("lifecycle fixture setup failed");
  }
  const context = projectSafeNatalContext(composed.value);
  truthy(context.ok, "lifecycle output projects");
  if (!context.ok) {
    throw new Error("lifecycle fixture setup failed");
  }
  return context.value;
}

function payload(
  overrides: Partial<{
    precision: "full" | "no_birth_time";
    points: Array<{ name: string; longitude: number }>;
    houses: Array<{ number: number; cuspLongitude: number }>;
    moonLocalDayEndpoints: {
      startLongitude: number;
      endLongitude: number;
      methodId: string;
      methodVersion: string;
    };
    houseSystem: {
      key: "placidus";
      methodId: string;
      methodVersion: string;
    };
  }> = {}
) {
  return {
    schemaVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
    chartType: "natal",
    precision: "full" as const,
    source: {
      sourceId: "regression-corpus",
      calculationId: "synthetic-case",
    },
    points: [
      { name: "Sun", longitude: 0 },
      { name: "Moon", longitude: 60 },
    ],
    houses: [],
    ...overrides,
  };
}

function houses(start: number) {
  return Array.from({ length: 12 }, (_value, index) => ({
    number: index + 1,
    cuspLongitude: start + index * 30,
  }));
}

function expectAdapterFailure(
  input: unknown,
  code: string,
  label: string
): void {
  const result = adaptProviderNeutralNatalPayload(input);
  equal(result.ok, false, `${label} rejected`);
  if (!result.ok) {
    equal(result.error.code, code, `${label} safe code`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${label} safe failure shape`
    );
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: assertion failed`);
  }
}

function truthy(value: unknown, label: string): void {
  if (!value) {
    throw new Error(`${label}: assertion failed`);
  }
}

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) {
    throw new Error(`${label}: prohibited output`);
  }
}
