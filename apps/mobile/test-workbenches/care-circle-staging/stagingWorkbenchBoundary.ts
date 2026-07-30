export const CARE_CIRCLE_STAGING_PROJECT_REF =
  "bmqhwofmdgebpcihjlnb" as const;
export const CARE_CIRCLE_STAGING_WORKBENCH_FLAG =
  "EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH" as const;

export type CareCircleWorkbenchBoundary =
  | {
      enabled: true;
      mode: "disposable_staging_test_only";
      projectRef: typeof CARE_CIRCLE_STAGING_PROJECT_REF;
    }
  | {
      enabled: false;
      code:
        | "CARE_CIRCLE_WORKBENCH_DISABLED"
        | "CARE_CIRCLE_WORKBENCH_DEVELOPMENT_ONLY"
        | "CARE_CIRCLE_WORKBENCH_STAGING_REQUIRED";
    };

export function resolveCareCircleWorkbenchBoundary(input: {
  flag?: string;
  projectRef?: string;
  isDevelopment: boolean;
}): CareCircleWorkbenchBoundary {
  if (input.flag !== "1") {
    return { enabled: false, code: "CARE_CIRCLE_WORKBENCH_DISABLED" };
  }
  if (!input.isDevelopment) {
    return {
      enabled: false,
      code: "CARE_CIRCLE_WORKBENCH_DEVELOPMENT_ONLY",
    };
  }
  if (input.projectRef !== CARE_CIRCLE_STAGING_PROJECT_REF) {
    return {
      enabled: false,
      code: "CARE_CIRCLE_WORKBENCH_STAGING_REQUIRED",
    };
  }

  return {
    enabled: true,
    mode: "disposable_staging_test_only",
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
  };
}
