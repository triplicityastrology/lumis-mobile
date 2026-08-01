import {
  CARE_CIRCLE_STAGING_PROJECT_REF,
  CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
  resolveCareCircleWorkbenchBoundary,
  resolveFounderCareCircleEntryBoundary,
} from "./stagingWorkbenchBoundary";

equal(
  resolveCareCircleWorkbenchBoundary({ isDevelopment: true }).enabled,
  false,
  "default is disabled"
);

const founderBase = {
  flag: "1",
  projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
  supabaseUrl: CARE_CIRCLE_STAGING_SUPABASE_ORIGIN,
  hasSupabasePublicKey: true,
  deploymentReady: "1",
  isDevelopment: true,
};
equal(
  resolveFounderCareCircleEntryBoundary(founderBase).enabled,
  true,
  "matching Founder entry boundary is enabled"
);
const deploymentNotReady = resolveFounderCareCircleEntryBoundary({
  ...founderBase,
  deploymentReady: undefined,
});
equal(
  deploymentNotReady.enabled,
  false,
  "missing deployment readiness is disabled"
);
equal(
  !deploymentNotReady.enabled && deploymentNotReady.code,
  "CARE_CIRCLE_WORKBENCH_DEPLOYMENT_NOT_READY",
  "missing deployment readiness has a stable safe reason"
);
equal(
  resolveFounderCareCircleEntryBoundary({
    ...founderBase,
    hasSupabasePublicKey: false,
  }).enabled,
  false,
  "missing public client configuration is disabled"
);
equal(
  resolveFounderCareCircleEntryBoundary({
    ...founderBase,
    supabaseUrl: "https://example.invalid",
  }).enabled,
  false,
  "Founder entry cannot bypass the exact staging URL"
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
