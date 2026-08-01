export const PROFILE_TEST_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const PROFILE_TEST_HOST = `${PROFILE_TEST_PROJECT_REF}.supabase.co`;
export const PROFILE_TEST_FUNCTION_SHA256 = "cbb5ef5452e64bb1f21d908052de2540fddc1db8e42cead8964104c927f725fe";

export type ProfileFounderTestBoundary =
  | { enabled: true; functionVersion: number }
  | { enabled: false; code: string };

export function resolveProfileFounderTestBoundary(input: {
  enabledFlag?: string;
  deploymentReady?: string;
  functionSha256?: string;
  functionVersion?: string;
  isDevelopment: boolean;
  projectRef?: string;
  supabaseUrl?: string;
}): ProfileFounderTestBoundary {
  if (!input.isDevelopment || input.enabledFlag !== "1") {
    return { enabled: false, code: "PROFILE_TEST_DISABLED" };
  }
  if (input.projectRef !== PROFILE_TEST_PROJECT_REF) {
    return { enabled: false, code: "PROFILE_TEST_STAGING_REQUIRED" };
  }
  if (!isExactStagingOrigin(input.supabaseUrl)) {
    return { enabled: false, code: "PROFILE_TEST_STAGING_ORIGIN_REQUIRED" };
  }
  if (input.deploymentReady !== "1") {
    return { enabled: false, code: "PROFILE_TEST_DEPLOYMENT_REQUIRED" };
  }
  if (input.functionSha256 !== PROFILE_TEST_FUNCTION_SHA256) {
    return { enabled: false, code: "PROFILE_TEST_FUNCTION_SHA_MISMATCH" };
  }
  if (!/^[1-9][0-9]*$/.test(input.functionVersion ?? "")) {
    return { enabled: false, code: "PROFILE_TEST_FUNCTION_VERSION_REQUIRED" };
  }
  return { enabled: true, functionVersion: Number(input.functionVersion) };
}

function isExactStagingOrigin(value?: string): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname === PROFILE_TEST_HOST && url.pathname === "/";
  } catch {
    return false;
  }
}
