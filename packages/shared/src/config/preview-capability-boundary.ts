export const PREVIEW_CAPABILITY_BOUNDARY_VERSION =
  "preview_capability_boundary_v1" as const;

export const PREVIEW_SURFACES = [
  "weekly_sky",
  "astrology_timing",
  "advanced_astrology",
  "care_circle",
  "notifications",
] as const;

export const PROHIBITED_PREVIEW_OPERATIONS = [
  "provider_call",
  "timing_calculation",
  "transit_calculation",
  "ai_retrieval",
  "billing_charge",
  "entitlement_enforcement",
  "scheduler_action",
  "notification_action",
  "care_circle_operation",
] as const;

export type PreviewSurface = (typeof PREVIEW_SURFACES)[number];
export type ProhibitedPreviewOperation =
  (typeof PROHIBITED_PREVIEW_OPERATIONS)[number];

export type PreviewCapabilityState = {
  boundaryVersion: typeof PREVIEW_CAPABILITY_BOUNDARY_VERSION;
  surface: PreviewSurface;
  visibility: "reachable_preview";
  activation: "inactive";
  designReviewOnly: true;
  allowedLiveOperations: readonly [];
};

export type PreviewCapabilityDenial =
  | {
      ok: false;
      code: "PREVIEW_CAPABILITY_INACTIVE";
      reason: "reachable_preview_is_not_active_capability";
      surface: PreviewSurface;
      operation: ProhibitedPreviewOperation;
    }
  | {
      ok: false;
      code: "PREVIEW_CAPABILITY_REQUEST_INVALID";
      reason: "closed_preview_boundary_required";
    }
  | {
      ok: false;
      code: "PREVIEW_CAPABILITY_SURFACE_NOT_REGISTERED";
      reason: "surface_is_not_an_approved_preview";
    }
  | {
      ok: false;
      code: "PREVIEW_CAPABILITY_OPERATION_NOT_REGISTERED";
      reason: "operation_is_not_permitted_by_preview_boundary";
    };

const SURFACE_SET = new Set<string>(PREVIEW_SURFACES);
const OPERATION_SET = new Set<string>(PROHIBITED_PREVIEW_OPERATIONS);
const REQUEST_FIELDS = new Set(["surface", "operation"]);

export function getPreviewCapabilityState(
  surface: PreviewSurface
): PreviewCapabilityState {
  return {
    boundaryVersion: PREVIEW_CAPABILITY_BOUNDARY_VERSION,
    surface,
    visibility: "reachable_preview",
    activation: "inactive",
    designReviewOnly: true,
    allowedLiveOperations: [],
  };
}

export function guardPreviewOperation(
  input: unknown
): PreviewCapabilityDenial {
  if (!isPlainRecord(input) || !hasOnlyFields(input, REQUEST_FIELDS)) {
    return {
      ok: false,
      code: "PREVIEW_CAPABILITY_REQUEST_INVALID",
      reason: "closed_preview_boundary_required",
    };
  }
  if (typeof input.surface !== "string" || !SURFACE_SET.has(input.surface)) {
    return {
      ok: false,
      code: "PREVIEW_CAPABILITY_SURFACE_NOT_REGISTERED",
      reason: "surface_is_not_an_approved_preview",
    };
  }
  if (
    typeof input.operation !== "string" ||
    !OPERATION_SET.has(input.operation)
  ) {
    return {
      ok: false,
      code: "PREVIEW_CAPABILITY_OPERATION_NOT_REGISTERED",
      reason: "operation_is_not_permitted_by_preview_boundary",
    };
  }

  return {
    ok: false,
    code: "PREVIEW_CAPABILITY_INACTIVE",
    reason: "reachable_preview_is_not_active_capability",
    surface: input.surface as PreviewSurface,
    operation: input.operation as ProhibitedPreviewOperation,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): boolean {
  return Object.keys(value).every((field) => allowed.has(field));
}
