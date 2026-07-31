export const CARE_CIRCLE_STAGING_PROJECT_REF =
  "bmqhwofmdgebpcihjlnb" as const;
export const CARE_CIRCLE_STAGING_SUPABASE_ORIGIN =
  "https://bmqhwofmdgebpcihjlnb.supabase.co" as const;
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
        | "CARE_CIRCLE_WORKBENCH_STAGING_REQUIRED"
        | "CARE_CIRCLE_WORKBENCH_STAGING_URL_REQUIRED";
    };

export function resolveCareCircleWorkbenchBoundary(input: {
  flag?: string;
  projectRef?: string;
  supabaseUrl?: string;
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
  if (!isExactStagingSupabaseUrl(input.supabaseUrl)) {
    return {
      enabled: false,
      code: "CARE_CIRCLE_WORKBENCH_STAGING_URL_REQUIRED",
    };
  }

  return {
    enabled: true,
    mode: "disposable_staging_test_only",
    projectRef: CARE_CIRCLE_STAGING_PROJECT_REF,
  };
}

function isExactStagingSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return (
      parsed.origin === CARE_CIRCLE_STAGING_SUPABASE_ORIGIN &&
      parsed.protocol === "https:" &&
      parsed.hostname === `${CARE_CIRCLE_STAGING_PROJECT_REF}.supabase.co` &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}
