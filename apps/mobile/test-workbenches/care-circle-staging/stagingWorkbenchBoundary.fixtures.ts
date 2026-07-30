import {
  CARE_CIRCLE_STAGING_PROJECT_REF,
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
  }).enabled,
  false,
  "zero flag is disabled"
);
equal(
  resolveCareCircleWorkbenchBoundary({
    flag: "1",
    isDevelopment: false,
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
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

const enabled = resolveCareCircleWorkbenchBoundary({
  flag: "1",
  isDevelopment: true,
  projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
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
