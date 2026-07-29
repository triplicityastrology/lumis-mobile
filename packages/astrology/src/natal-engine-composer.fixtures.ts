import {
  NATAL_ENGINE_OUTPUT_VERSION,
  composeNatalEngineOutput,
} from "./natal-engine-composer";
import { NATAL_INPUT_CONTRACT_VERSION } from "./natal-input-boundary";

const timedInput = {
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "full",
  points: [
    { key: "Moon", absoluteLongitude: 8 },
    { key: "ASC", absoluteLongitude: 190 },
    { key: "Sun", absoluteLongitude: 0 },
    { key: "Mars", absoluteLongitude: 60 },
  ],
  houses: Array.from({ length: 12 }, (_value, index) => ({
    no: index + 1,
    cuspLongitude: 190 + index * 30,
  })),
};

const timed = composeNatalEngineOutput(timedInput);
truthy(timed.ok, "timed natal composition succeeds");
if (timed.ok) {
  equal(timed.value.schemaVersion, NATAL_ENGINE_OUTPUT_VERSION, "output version");
  equal(timed.value.scope, "natal", "natal-only output scope");
  equal(timed.value.capabilities.houses, true, "timed house capability");
  equal(timed.value.capabilities.angles, true, "timed angle capability");
  equal(
    timed.value.inputProvenance.contractVersion,
    NATAL_INPUT_CONTRACT_VERSION,
    "validated input provenance"
  );
  equal(
    timed.value.facts.some((fact) => fact.canonicalKey === "chart_ruler"),
    true,
    "chart ruler composed"
  );
  equal(
    timed.value.facts.some((fact) => fact.canonicalKey === "house_10_ruler"),
    true,
    "house 10 ruler composed"
  );
  equal(timed.value.facts.length, 13, "only approved timed ruler facts");
  sortedCanonicalKeys(timed.value.facts, "timed facts");
  sortedCanonicalKeys(timed.value.aspects, "timed aspects");
  onlyOutputFields(timed.value);
}

const noTimeInput = {
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "no_birth_time",
  points: [
    { key: "Sun", absoluteLongitude: 0 },
    { key: "Moon", absoluteLongitude: 60 },
  ],
  houses: [],
  moonLocalDayEndpoints: {
    startLongitude: 42,
    endLongitude: 55,
  },
};

const noTime = composeNatalEngineOutput(noTimeInput);
truthy(noTime.ok, "no-birth-time composition succeeds");
if (noTime.ok) {
  equal(noTime.value.capabilities.houses, false, "no-time houses suppressed");
  equal(noTime.value.capabilities.angles, false, "no-time angles suppressed");
  equal(noTime.value.facts.length, 1, "only approved no-time Moon fact");
  equal(noTime.value.facts[0]?.canonicalKey, "moon_sign", "Moon fact key");
  equal(noTime.value.facts[0]?.value, "taurus", "Moon endpoint fact");
  equal(
    noTime.value.facts.some((fact) => /ruler|house|angle/.test(fact.canonicalKey)),
    false,
    "no timed fact survives"
  );
}

const exactOrb = composeNatalEngineOutput({
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "full",
  points: [
    { key: "Sun", absoluteLongitude: 0 },
    { key: "Moon", absoluteLongitude: 8 },
  ],
  houses: [],
});
truthy(exactOrb.ok, "exact-orb input composes");
if (exactOrb.ok) {
  equal(exactOrb.value.aspects.length, 1, "one exact-orb aspect");
  equal(exactOrb.value.aspects[0]?.value?.aspect, "conjunction", "aspect type");
  equal(exactOrb.value.aspects[0]?.value?.orbDegrees, 8, "inclusive exact orb");
}

const repeated = composeNatalEngineOutput(timedInput);
equal(
  JSON.stringify(repeated),
  JSON.stringify(timed),
  "same validated input produces byte-stable output"
);

for (const [input, code] of [
  [null, "NATAL_INPUT_NOT_OBJECT"],
  [{ ...noTimeInput, unexpected: true }, "NATAL_INPUT_UNKNOWN_FIELD"],
  [{ ...noTimeInput, chartType: "solar_return" }, "NATAL_INPUT_OUT_OF_SCOPE"],
  [{ ...noTimeInput, transit: {} }, "NATAL_INPUT_OUT_OF_SCOPE"],
  [{ ...noTimeInput, annual_theme: "excluded" }, "NATAL_INPUT_OUT_OF_SCOPE"],
  [
    {
      ...noTimeInput,
      points: [{ key: "Vertex", absoluteLongitude: 10 }],
    },
    "NATAL_INPUT_OUT_OF_SCOPE",
  ],
] as const) {
  const result = composeNatalEngineOutput(input);
  equal(result.ok, false, `${code} rejected`);
  if (!result.ok) {
    equal(result.error.code, code, `${code} preserved`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${code} safe failure shape`
    );
    doesNotMatch(
      JSON.stringify(result.error),
      /excluded|annual_theme|solar_return|vertex/i,
      `${code} does not echo input`
    );
  }
}

console.log("deterministic natal engine composer fixtures passed");

function onlyOutputFields(value: Record<string, unknown>): void {
  equal(
    Object.keys(value).sort().join(","),
    "aspects,capabilities,facts,inputProvenance,schemaVersion,scope",
    "closed output shape"
  );
}

function sortedCanonicalKeys(
  values: Array<{ canonicalKey: string }>,
  label: string
): void {
  const keys = values.map((value) => value.canonicalKey);
  equal(keys.join(","), [...keys].sort().join(","), `${label} deterministic order`);
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
