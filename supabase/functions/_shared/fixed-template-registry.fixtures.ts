import {
  FIXED_TEMPLATE_REGISTRY_VERSION,
  createFixedTemplateServerLoader,
  type FixedTemplateFailureCode,
} from "./fixed-template-registry";

const stagingLoader = createFixedTemplateServerLoader(() => "staging");
const developmentLoader = createFixedTemplateServerLoader(() => "development");
const productionLoader = createFixedTemplateServerLoader(() => "production");

const solarEn = stagingLoader({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "OUT_OF_SCOPE_SOLAR_RETURN",
  language: "en",
});
truthy(solarEn.ok, "English Solar Return template loads");
if (solarEn.ok) {
  equal(solarEn.value.templateId, "OUT_OF_SCOPE_SOLAR_RETURN_EN", "approved ID");
  equal(solarEn.value.text, "Solar Return is not part of Lumis.", "approved text");
  equal(solarEn.value.generated, false, "never generated");
}

const solarZh = stagingLoader({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "OUT_OF_SCOPE_SOLAR_RETURN",
  language: "zh-Hant",
});
truthy(solarZh.ok, "Traditional Chinese Solar Return template loads");
if (solarZh.ok) {
  equal(solarZh.value.templateId, "OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT", "approved zh-Hant ID");
}

const fallback = developmentLoader({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "ROUTER_UNAVAILABLE",
});
truthy(fallback.ok, "missing language uses deterministic safe fallback");
if (fallback.ok) {
  equal(fallback.value.language, "en", "fallback language");
  equal(fallback.value.languageFallbackApplied, true, "fallback marked");
}

expectFailure(
  stagingLoader,
  { registryVersion: "v0", familyId: "ROUTER_UNAVAILABLE", language: "en" },
  "FIXED_TEMPLATE_VERSION_UNKNOWN"
);
expectFailure(
  stagingLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "UNKNOWN", language: "en" },
  "FIXED_TEMPLATE_ID_UNKNOWN"
);
expectFailure(
  stagingLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTER_UNAVAILABLE", language: "zh" },
  "FIXED_TEMPLATE_LANGUAGE_UNKNOWN"
);
expectFailure(
  productionLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTE_UNAVAILABLE", language: "en" },
  "FIXED_TEMPLATE_PRODUCTION_WORDING_REQUIRED"
);
expectFailure(
  productionLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "CRISIS_IMMINENT", language: "en" },
  "FIXED_TEMPLATE_CLINICAL_REVIEW_REQUIRED"
);
expectFailure(
  productionLoader,
  {
    registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
    familyId: "CRISIS_IMMINENT",
    language: "en",
    runtime: "staging",
  },
  "FIXED_TEMPLATE_LOOKUP_INVALID"
);
expectFailure(
  productionLoader,
  {
    registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
    familyId: "ROUTE_UNAVAILABLE",
    language: "en",
    runtime: "staging",
  },
  "FIXED_TEMPLATE_LOOKUP_INVALID"
);

const missingRuntimeLoader = createFixedTemplateServerLoader(() => undefined);
expectFailure(
  missingRuntimeLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTER_UNAVAILABLE" },
  "FIXED_TEMPLATE_RUNTIME_UNKNOWN"
);
const unknownRuntimeLoader = createFixedTemplateServerLoader(() => "preview");
expectFailure(
  unknownRuntimeLoader,
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTER_UNAVAILABLE" },
  "FIXED_TEMPLATE_RUNTIME_UNKNOWN"
);

console.log("fixed-template registry fixtures passed");

function expectFailure(
  loader: (input: Record<string, unknown>) => ReturnType<typeof stagingLoader>,
  input: Record<string, unknown>,
  code: FixedTemplateFailureCode
): void {
  const result = loader(input);
  equal(result.ok, false, `${code} rejected`);
  if ("error" in result) {
    equal(result.error.code, code, `${code} stable code`);
    equal(Object.keys(result.error).join(","), "code", `${code} non-echoing`);
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}
