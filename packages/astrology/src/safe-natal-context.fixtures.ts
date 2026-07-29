import { composeNatalEngineOutput } from "./natal-engine-composer";
import { NATAL_INPUT_CONTRACT_VERSION } from "./natal-input-boundary";
import {
  NATAL_CONTEXT_VERSION,
  projectSafeNatalContext,
} from "./safe-natal-context";

const engineResult = composeNatalEngineOutput({
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "full",
  points: [
    { key: "Sun", absoluteLongitude: 0 },
    { key: "Chiron", absoluteLongitude: 60 },
    { key: "True Node", absoluteLongitude: 120 },
    { key: "South Node", absoluteLongitude: 180 },
    { key: "ASC", absoluteLongitude: 190 },
  ],
  houses: Array.from({ length: 12 }, (_value, index) => ({
    no: index + 1,
    cuspLongitude: 190 + index * 30,
  })),
});
truthy(engineResult.ok, "accepted engine output fixture");
if (!engineResult.ok) {
  throw new Error("fixture setup failed");
}

const projected = projectSafeNatalContext(engineResult.value);
truthy(projected.ok, "accepted output projects");
if (projected.ok) {
  equal(projected.value.schemaVersion, NATAL_CONTEXT_VERSION, "context version");
  equal(projected.value.scope, "natal", "natal-only context");
  equal(projected.value.capabilities.angles, true, "capabilities retained");
  sorted(projected.value.facts, "facts");
  sorted(projected.value.aspects, "aspects");
  const aspectPoints = new Set(
    projected.value.aspects.flatMap((aspect) =>
      aspect.value ? [aspect.value.pointA, aspect.value.pointB] : []
    )
  );
  equal(aspectPoints.has("chiron"), true, "Chiron aspect retained");
  equal(aspectPoints.has("north_node"), true, "North Node aspect retained");
  equal(aspectPoints.has("south_node"), true, "South Node aspect retained");
  equal(
    Object.keys(projected.value).sort().join(","),
    "aspects,capabilities,facts,provenance,schemaVersion,scope",
    "closed context shape"
  );
  doesNotMatch(
    JSON.stringify(projected.value),
    /email|accountId|birth_date|latitude|coordinates|rawProviderResponse|solar_return|transit|timing|annual_theme|vertex|billing|entitlement|dice|internalError/i,
    "excluded data absent"
  );
}

const reversedOutput = {
  ...engineResult.value,
  facts: [...engineResult.value.facts].reverse(),
  aspects: [...engineResult.value.aspects].reverse(),
};
const reversed = projectSafeNatalContext(reversedOutput);
truthy(reversed.ok, "reordered accepted output projects");
equal(
  JSON.stringify(reversed),
  JSON.stringify(projected),
  "projector restores deterministic ordering"
);

const noTimeOutput = composeNatalEngineOutput({
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "no_birth_time",
  points: [
    { key: "Sun", absoluteLongitude: 10 },
    { key: "Moon", absoluteLongitude: 42 },
  ],
  houses: [],
  moonLocalDayEndpoints: {
    startLongitude: 42,
    endLongitude: 55,
  },
});
truthy(noTimeOutput.ok, "no-time engine output fixture");
if (noTimeOutput.ok) {
  const noTimeContext = projectSafeNatalContext(noTimeOutput.value);
  truthy(noTimeContext.ok, "no-time output projects");
  if (noTimeContext.ok) {
    equal(noTimeContext.value.capabilities.houses, false, "houses suppressed");
    equal(noTimeContext.value.capabilities.angles, false, "angles suppressed");
    equal(
      noTimeContext.value.facts.some((fact) => /ruler/.test(fact.canonicalKey)),
      false,
      "no timed ruler fact"
    );
  }
}

expectFailure(null, "NATAL_CONTEXT_NOT_OBJECT");
expectFailure(
  { ...engineResult.value, schemaVersion: "natal_engine_output_v0" },
  "NATAL_CONTEXT_OUTPUT_VERSION_INVALID"
);
expectFailure(
  { ...engineResult.value, scope: "solar_return" },
  "NATAL_CONTEXT_SCOPE_INVALID"
);
for (const contamination of [
  { email: "private@example.invalid" },
  { rawBirthData: {} },
  { rawProviderResponse: {} },
  { transit: {} },
  { annual_theme: "excluded" },
  { vertex: {} },
  { billing: {} },
  { entitlement: {} },
  { dice: {} },
  { internalError: "private failure" },
]) {
  expectFailure(
    { ...engineResult.value, ...contamination },
    "NATAL_CONTEXT_UNKNOWN_FIELD"
  );
}

const invalidPoint = clone(engineResult.value);
const firstAspect = invalidPoint.aspects[0];
truthy(firstAspect?.value, "aspect available for mutation");
if (firstAspect?.value) {
  firstAspect.value.pointA = "vertex" as typeof firstAspect.value.pointA;
}
expectFailure(invalidPoint, "NATAL_CONTEXT_ASPECT_INVALID");

const duplicateAspect = clone(engineResult.value);
duplicateAspect.aspects.push(clone(duplicateAspect.aspects[0]));
expectFailure(duplicateAspect, "NATAL_CONTEXT_DUPLICATE_ASPECT");

const safeFailure = projectSafeNatalContext({
  ...engineResult.value,
  privatePayload: "must never echo",
});
equal(safeFailure.ok, false, "safe contamination failure");
doesNotMatch(
  JSON.stringify(safeFailure),
  /must never echo|privatePayload/i,
  "failure does not echo input"
);

console.log("safe natal context projector fixtures passed");

function expectFailure(input: unknown, expectedCode: string): void {
  const result = projectSafeNatalContext(input);
  equal(result.ok, false, `${expectedCode} failure`);
  if (!result.ok) {
    equal(result.error.code, expectedCode, `${expectedCode} code`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${expectedCode} safe shape`
    );
  }
}

function sorted(values: Array<{ canonicalKey: string }>, label: string): void {
  const keys = values.map((value) => value.canonicalKey);
  equal(keys.join(","), [...keys].sort().join(","), `${label} order`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
