import {
  FIXED_TEMPLATE_REGISTRY_VERSION,
  loadFixedTemplate,
  type FixedTemplateFailureCode,
} from "./fixed-template-registry";

const solarEn = loadFixedTemplate({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "OUT_OF_SCOPE_SOLAR_RETURN",
  language: "en",
  runtime: "staging",
});
truthy(solarEn.ok, "English Solar Return template loads");
if (solarEn.ok) {
  equal(solarEn.value.templateId, "OUT_OF_SCOPE_SOLAR_RETURN_EN", "approved ID");
  equal(solarEn.value.text, "Solar Return is not part of Lumis.", "approved text");
  equal(solarEn.value.generated, false, "never generated");
}

const solarZh = loadFixedTemplate({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "OUT_OF_SCOPE_SOLAR_RETURN",
  language: "zh-Hant",
  runtime: "staging",
});
truthy(solarZh.ok, "Traditional Chinese Solar Return template loads");
if (solarZh.ok) {
  equal(solarZh.value.templateId, "OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT", "approved zh-Hant ID");
}

const fallback = loadFixedTemplate({
  registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
  familyId: "ROUTER_UNAVAILABLE",
  runtime: "development",
});
truthy(fallback.ok, "missing language uses deterministic safe fallback");
if (fallback.ok) {
  equal(fallback.value.language, "en", "fallback language");
  equal(fallback.value.languageFallbackApplied, true, "fallback marked");
}

expectFailure(
  { registryVersion: "v0", familyId: "ROUTER_UNAVAILABLE", language: "en", runtime: "staging" },
  "FIXED_TEMPLATE_VERSION_UNKNOWN"
);
expectFailure(
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "UNKNOWN", language: "en", runtime: "staging" },
  "FIXED_TEMPLATE_ID_UNKNOWN"
);
expectFailure(
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTER_UNAVAILABLE", language: "zh", runtime: "staging" },
  "FIXED_TEMPLATE_LANGUAGE_UNKNOWN"
);
expectFailure(
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "ROUTE_UNAVAILABLE", language: "en", runtime: "production" },
  "FIXED_TEMPLATE_PRODUCTION_WORDING_REQUIRED"
);
expectFailure(
  { registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: "CRISIS_IMMINENT", language: "en", runtime: "production" },
  "FIXED_TEMPLATE_CLINICAL_REVIEW_REQUIRED"
);

console.log("fixed-template registry fixtures passed");

function expectFailure(input: Record<string, unknown>, code: FixedTemplateFailureCode): void {
  const result = loadFixedTemplate(input);
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
