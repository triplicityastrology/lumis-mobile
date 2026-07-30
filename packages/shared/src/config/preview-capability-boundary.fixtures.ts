import {
  PREVIEW_SURFACES,
  PROHIBITED_PREVIEW_OPERATIONS,
  getPreviewCapabilityState,
  guardPreviewOperation,
} from "./preview-capability-boundary";

for (const surface of PREVIEW_SURFACES) {
  const state = getPreviewCapabilityState(surface);
  equal(state.visibility, "reachable_preview", `${surface} remains visible`);
  equal(state.activation, "inactive", `${surface} remains inactive`);
  equal(state.designReviewOnly, true, `${surface} is design-review only`);
  equal(
    state.allowedLiveOperations.length,
    0,
    `${surface} exposes no live operation`
  );

  for (const operation of PROHIBITED_PREVIEW_OPERATIONS) {
    const decision = guardPreviewOperation({ surface, operation });
    equal(decision.ok, false, `${surface}/${operation} must fail closed`);
    equal(
      decision.code,
      "PREVIEW_CAPABILITY_INACTIVE",
      `${surface}/${operation} uses stable inactive code`
    );
  }
}

for (const unregisteredSurface of ["solar_return", "dice", "transit_live"]) {
  const decision = guardPreviewOperation({
    surface: unregisteredSurface,
    operation: "provider_call",
  });
  equal(
    decision.code,
    "PREVIEW_CAPABILITY_SURFACE_NOT_REGISTERED",
    `${unregisteredSurface} cannot become an approved preview`
  );
}

for (const malformed of [
  null,
  [],
  {},
  { surface: "weekly_sky" },
  { surface: "weekly_sky", operation: "provider_call", execute: true },
]) {
  const decision = guardPreviewOperation(malformed);
  equal(decision.ok, false, "malformed requests fail closed");
}

equal(
  guardPreviewOperation({
    surface: "weekly_sky",
    operation: "unknown_operation",
  }).code,
  "PREVIEW_CAPABILITY_OPERATION_NOT_REGISTERED",
  "unknown operations cannot pass the boundary"
);

console.log("inactive preview capability boundary fixtures passed");

function equal(
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}`);
  }
}
