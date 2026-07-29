import { validateNatalEngineInput } from "./natal-input-boundary";
import {
  PROVIDER_NATAL_ADAPTER_VERSION,
  PROVIDER_NEUTRAL_NATAL_VERSION,
  adaptProviderNeutralNatalPayload,
  type ProviderNatalAdapterFailureCode,
} from "./provider-neutral-natal-adapter";

const timedPayload = {
  schemaVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
  chartType: "natal",
  precision: "full",
  source: {
    sourceId: "staging-source",
    calculationId: "calc_001",
  },
  points: [
    { name: "Moon", longitude: 61 },
    { name: "ASC", longitude: 271 },
    { name: "Sol", longitude: 361 },
    { name: "MC", longitude: 1 },
  ],
  houses: Array.from({ length: 12 }, (_value, index) => ({
    number: index + 1,
    cuspLongitude: 271 + index * 30,
  })),
};

const timed = adaptProviderNeutralNatalPayload(timedPayload);
truthy(timed.ok, "valid timed payload");
if (timed.ok) {
  equal(
    timed.value.provenance.adapterVersion,
    PROVIDER_NATAL_ADAPTER_VERSION,
    "adapter version"
  );
  equal(timed.value.provenance.sourceId, "staging-source", "safe source ID");
  equal(timed.value.provenance.calculationId, "calc_001", "calculation ID");
  equal(timed.value.engineInput.chartType, "natal", "natal mapping");
  equal(timed.value.engineInput.points[0]?.key, "ascendant", "stable point order");
  equal(timed.value.engineInput.houses.length, 12, "timed houses mapped");
  truthy(
    validateNatalEngineInput(timed.value.engineInput).ok,
    "mapped timed input passes accepted boundary"
  );
  doesNotMatch(
    JSON.stringify(timed.value),
    /rawProviderResponse|providerPayload|email|birth_date/i,
    "no raw provider payload downstream"
  );
}

const noTimePayload = {
  schemaVersion: PROVIDER_NEUTRAL_NATAL_VERSION,
  chartType: "natal",
  precision: "no_birth_time",
  source: { sourceId: "staging-source" },
  points: [
    { name: "Sun", longitude: 10 },
    { name: "Moon", longitude: 42 },
    { name: "Chiron", longitude: 130 },
    { name: "True Node", longitude: 190 },
    { name: "South Node", longitude: 10 },
  ],
  houses: [],
  moonLocalDayEndpoints: {
    startLongitude: 42,
    endLongitude: 55,
  },
};

const noTime = adaptProviderNeutralNatalPayload(noTimePayload);
truthy(noTime.ok, "valid no-birth-time payload");
if (noTime.ok) {
  equal(noTime.value.engineInput.houses.length, 0, "no-time houses empty");
  equal(
    noTime.value.engineInput.points.some((point) =>
      point.key === "ascendant" || point.key === "medium_coeli"
    ),
    false,
    "no-time angles absent"
  );
  truthy(
    validateNatalEngineInput(noTime.value.engineInput).ok,
    "mapped no-time input passes accepted boundary"
  );
}

expectFailure(null, "NATAL_ADAPTER_NOT_OBJECT");
expectFailure({}, "NATAL_ADAPTER_SCHEMA_UNSUPPORTED");
expectFailure(
  {
    ...noTimePayload,
    points: [{ name: "Sun", longitude: "10" }],
  },
  "NATAL_ADAPTER_POINT_INVALID"
);
expectFailure(
  {
    ...noTimePayload,
    points: [
      { name: "Sun", longitude: 10 },
      { name: "Sol", longitude: 10 },
    ],
  },
  "NATAL_ADAPTER_DUPLICATE_POINT"
);
expectFailure(
  {
    ...noTimePayload,
    points: [...noTimePayload.points, { name: "ASC", longitude: 10 }],
  },
  "NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH"
);
expectFailure(
  {
    ...noTimePayload,
    houses: [{ number: 1, cuspLongitude: 10 }],
  },
  "NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH"
);
expectFailure(
  {
    ...noTimePayload,
    points: [{ name: "Sun", longitude: 10, house: 1 }],
  },
  "NATAL_ADAPTER_UNKNOWN_FIELD"
);

for (const payload of [
  { ...noTimePayload, chartType: "solar_return" },
  { ...noTimePayload, solar_return: {} },
  { ...noTimePayload, transit: {} },
  { ...noTimePayload, timing: {} },
  { ...noTimePayload, annual_theme: "excluded" },
  {
    ...noTimePayload,
    points: [{ name: "Vertex", longitude: 10 }],
  },
  {
    ...noTimePayload,
    points: [{ name: "SR Sun", longitude: 10 }],
  },
]) {
  expectFailure(payload, "NATAL_ADAPTER_OUT_OF_SCOPE");
}

const privateFailure = adaptProviderNeutralNatalPayload({
  ...noTimePayload,
  providerPayload: "private raw provider material",
});
equal(privateFailure.ok, false, "unknown provider payload rejected");
doesNotMatch(
  JSON.stringify(privateFailure),
  /private raw provider material|providerPayload/i,
  "failure never echoes raw payload"
);

console.log("provider-neutral natal adapter fixtures passed");

function expectFailure(
  input: unknown,
  expectedCode: ProviderNatalAdapterFailureCode
): void {
  const result = adaptProviderNeutralNatalPayload(input);
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
