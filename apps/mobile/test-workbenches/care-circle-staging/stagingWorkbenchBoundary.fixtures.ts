import {
  CARE_CIRCLE_STAGING_PROJECT_REF,
  CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
  resolveCareCircleWorkbenchBoundary,
} from "./stagingWorkbenchBoundary";

equal(
  resolveCareCircleWorkbenchBoundary({ isDevelopment: true }).enabled,
  false,
  "default is disabled"
);
equal(
  resolveCareCircleWorkbenchBoundary({
    flag: "0",
    isDevelopment: true,
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
    supabaseUrl: CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
  }).enabled,
  false,
  "zero flag is disabled"
);
equal(
  resolveCareCircleWorkbenchBoundary({
    flag: "1",
    isDevelopment: false,
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
    supabaseUrl: CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
  }).enabled,
  false,
  "production mode is disabled"
);
equal(
  resolveCareCircleWorkbenchBoundary({
    flag: "1",
    isDevelopment: true,
    projectRef: "unknown-project",
  }).enabled,
  false,
  "unknown project is disabled"
);
equal(
  resolveCareCircleWorkbenchBoundary({
    flag: "1",
    isDevelopment: true,
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
    supabaseUrl: "https://another-project.supabase.co",
  }).enabled,
  false,
  "staging ref with a non-staging URL is disabled"
);
for (const invalidUrl of [
  "not-a-url",
  "http://bmqhwofmdgebpcihjlnb.supabase.co",
  "https://bmqhwofmdgebpcihjlnb.supabase.co.evil.invalid",
  "https://bmqhwofmdgebpcihjlnb.supabase.co/rest/v1",
]) {
  equal(
    resolveCareCircleWorkbenchBoundary({
      flag: "1",
      isDevelopment: true,
      projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
      supabaseUrl: invalidUrl,
    }).enabled,
    false,
    "malformed, non-HTTPS, or non-origin URL is disabled"
  );
}

const enabled = resolveCareCircleWorkbenchBoundary({
  flag: "1",
  isDevelopment: true,
  projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
  supabaseUrl: CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
});
equal(enabled.enabled, true, "explicit staging development build is enabled");
equal(
  enabled.enabled && enabled.mode,
  "disposable_staging_test_only",
  "enabled mode remains test-only"
);

console.log("Care Circle staging workbench boundary fixtures passed");

function equal(
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}`);
  }
}
