import { deriveNatalAspects } from "./natal-aspects";
import { deriveMoonSignFromLocalDayEndpoints } from "./natal-facts";
import {
  NATAL_INPUT_CONTRACT_VERSION,
  validateNatalEngineInput,
  type NatalInputFailureCode,
} from "./natal-input-boundary";

const timedInput = {
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "full",
  points: [
    { key: "Sol", absoluteLongitude: 361 },
    { key: "Luna", absoluteLongitude: 61 },
    { key: "True Node", absoluteLongitude: 181 },
    { key: "ASC", absoluteLongitude: -89 },
    { key: "MC", absoluteLongitude: 1 },
  ],
  houses: Array.from({ length: 12 }, (_value, index) => ({
    no: index + 1,
    cuspLongitude: 271 + index * 30,
  })),
  houseSystem: {
    key: "placidus",
    methodId: "fixture_house_cusps",
    methodVersion: "v1",
  },
};
const timed = validateNatalEngineInput(timedInput);
truthy(timed.ok, "complete timed natal input accepted");
if (timed.ok) {
  equal(timed.value.birthTime, "supplied", "timed birth capability");
  equal(timed.value.capabilities.houses, true, "timed houses available");
  equal(timed.value.capabilities.angles, true, "timed angles available");
  equal(timed.value.points.length, 5, "timed canonical point count");
  equal(timed.value.houses.length, 12, "timed canonical house count");
  equal(pointLongitude(timed.value.points, "sun"), 1, "Sun longitude normalized");
  equal(pointLongitude(timed.value.points, "moon"), 61, "Moon alias canonicalized");
  equal(
    pointLongitude(timed.value.points, "north_node"),
    181,
    "node alias canonicalized"
  );
  equal(
    pointLongitude(timed.value.points, "ascendant"),
    271,
    "ASC alias and longitude canonicalized"
  );
  equal(
    timed.value.provenance.source,
    "validated_provider_normalised_natal_input",
    "input provenance"
  );
  for (const point of timed.value.points) {
    equal(
      point.provenance.source,
      "validated_provider_normalised_natal_input",
      `${point.key} provenance`
    );
    equal(point.provenance.sourceFields.length, 2, `${point.key} source fields`);
  }

  const aspects = deriveNatalAspects({
    points: timed.value.points.map((point) => ({
      key: point.key,
      longitude: point.longitude,
      sourceField: point.provenance.sourceFields[1],
    })),
    birthTime: timed.value.birthTime,
  });
  truthy(aspects.length, "canonical input feeds deterministic aspect engine");
}

const noTimeInput = {
  schemaVersion: NATAL_INPUT_CONTRACT_VERSION,
  chartType: "natal",
  precision: "no_birth_time",
  points: [
    { key: "Sun", absoluteLongitude: 10 },
    { key: "Moon", absoluteLongitude: 45 },
    { key: "South Node", absoluteLongitude: 190 },
  ],
  houses: [],
  moonLocalDayEndpoints: {
    startLongitude: 42,
    endLongitude: 55,
    methodId: "fixture_local_day_moon",
    methodVersion: "v1",
  },
};
const noTime = validateNatalEngineInput(noTimeInput);
truthy(noTime.ok, "no-birth-time natal input accepted");
if (noTime.ok) {
  equal(noTime.value.birthTime, "not_supplied", "no-time capability");
  equal(noTime.value.capabilities.houses, false, "no-time houses suppressed");
  equal(noTime.value.capabilities.angles, false, "no-time angles suppressed");
  equal(noTime.value.houses.length, 0, "no-time houses remain empty");
  equal(
    noTime.value.points.some((point) =>
      point.key === "ascendant" || point.key === "medium_coeli"
    ),
    false,
    "no-time input contains no angles"
  );
  const endpoints = noTime.value.moonLocalDayEndpoints;
  truthy(endpoints, "Moon local-day endpoints retained");
  if (endpoints) {
    const moonFact = deriveMoonSignFromLocalDayEndpoints({
      startLongitude: endpoints.startLongitude,
      endLongitude: endpoints.endLongitude,
      sourceFields: [...endpoints.provenance.sourceFields],
    });
    equal(moonFact.value, "taurus", "Moon endpoint rule receives canonical input");
  }
}

expectFailure(
  { ...timedInput, houseSystem: undefined },
  "NATAL_INPUT_HOUSE_SYSTEM_INVALID"
);
expectFailure(
  {
    ...noTimeInput,
    moonLocalDayEndpoints: { startLongitude: 42, endLongitude: 55 },
  },
  "NATAL_INPUT_MOON_ENDPOINTS_INVALID"
);

expectFailure(null, "NATAL_INPUT_NOT_OBJECT");
expectFailure({}, "NATAL_INPUT_SCHEMA_UNSUPPORTED");
expectFailure(
  { ...noTimeInput, points: [{ key: "Sun", absoluteLongitude: "10" }] },
  "NATAL_INPUT_POINT_INVALID"
);
expectFailure(
  {
    ...noTimeInput,
    points: [
      { key: "Sun", absoluteLongitude: 10 },
      { key: "Sol", absoluteLongitude: 10 },
    ],
  },
  "NATAL_INPUT_DUPLICATE_POINT"
);
expectFailure(
  {
    ...noTimeInput,
    points: [{ key: "Sun", absoluteLongitude: 10, retrograde: false }],
  },
  "NATAL_INPUT_UNKNOWN_FIELD"
);
expectFailure(
  { ...noTimeInput, providerDebug: true },
  "NATAL_INPUT_UNKNOWN_FIELD"
);
expectFailure(
  {
    ...noTimeInput,
    points: [
      ...noTimeInput.points,
      { key: "ASC", absoluteLongitude: 100 },
    ],
  },
  "NATAL_INPUT_TIME_CAPABILITY_MISMATCH"
);
expectFailure(
  {
    ...noTimeInput,
    houses: [{ no: 1, cuspLongitude: 100 }],
  },
  "NATAL_INPUT_TIME_CAPABILITY_MISMATCH"
);

for (const prohibited of [
  { solar_return: {} },
  { transits: [] },
  { timing: {} },
  { annual_theme: "excluded" },
]) {
  expectFailure({ ...noTimeInput, ...prohibited }, "NATAL_INPUT_OUT_OF_SCOPE");
}
for (const pointKey of [
  "Vertex",
  "Solar Return Sun",
  "Transit Moon",
  "Timing Point",
  "SR",
  "SR Sun",
]) {
  expectFailure(
    {
      ...noTimeInput,
      points: [{ key: pointKey, absoluteLongitude: 10 }],
    },
    "NATAL_INPUT_OUT_OF_SCOPE"
  );
}
expectFailure(
  { ...noTimeInput, chartType: "solar_return" },
  "NATAL_INPUT_OUT_OF_SCOPE"
);

const safeFailure = validateNatalEngineInput({
  ...noTimeInput,
  annual_theme: "private provider text must not echo",
});
equal(safeFailure.ok, false, "safe failure returned");
doesNotMatch(
  JSON.stringify(safeFailure),
  /private provider text|annual_theme/i,
  "failure does not echo rejected data"
);

console.log("provider-normalised natal input boundary fixtures passed");

function expectFailure(input: unknown, expectedCode: NatalInputFailureCode): void {
  const result = validateNatalEngineInput(input);
  equal(result.ok, false, `${expectedCode} failure`);
  if (!result.ok) {
    equal(result.error.code, expectedCode, `${expectedCode} code`);
    truthy(result.error.reason, `${expectedCode} reason`);
    truthy(result.error.location, `${expectedCode} location`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${expectedCode} safe error shape`
    );
  }
}

function pointLongitude(
  points: Array<{ key: string; longitude: number }>,
  key: string
): number | undefined {
  return points.find((point) => point.key === key)?.longitude;
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
    throw new Error(`${label}: found prohibited output`);
  }
}
