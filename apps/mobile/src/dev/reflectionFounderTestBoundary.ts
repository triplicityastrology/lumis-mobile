export const REFLECTION_TEST_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const REFLECTION_TEST_MIGRATION = "0036";
export const REFLECTION_TEST_MIGRATION_SHA256 = "889a8177e2051af3745a2d3850b8e932011f3605cd933f1c1bce46a4629af1bf";

export type ReflectionFounderTestBoundary = { enabled: true } | { enabled: false; code: string };

export function resolveReflectionFounderTestBoundary(input: {
  enabledFlag?: string;
  deploymentReady?: string;
  isDevelopment: boolean;
  migrationSha256?: string;
  remoteMigrationVersion?: string;
  projectRef?: string;
  supabaseUrl?: string;
}): ReflectionFounderTestBoundary {
  if (!input.isDevelopment || input.enabledFlag !== "1") return { enabled: false, code: "REFLECTION_TEST_DISABLED" };
  if (input.projectRef !== REFLECTION_TEST_PROJECT_REF) return { enabled: false, code: "REFLECTION_TEST_STAGING_REQUIRED" };
  if (!isExactOrigin(input.supabaseUrl)) return { enabled: false, code: "REFLECTION_TEST_STAGING_ORIGIN_REQUIRED" };
  if (input.deploymentReady !== "1") return { enabled: false, code: "REFLECTION_TEST_DEPLOYMENT_REQUIRED" };
  if (input.remoteMigrationVersion !== REFLECTION_TEST_MIGRATION) return { enabled: false, code: "REFLECTION_TEST_PARITY_REQUIRED" };
  if (input.migrationSha256 !== REFLECTION_TEST_MIGRATION_SHA256) return { enabled: false, code: "REFLECTION_TEST_CHECKSUM_REQUIRED" };
  return { enabled: true };
}

function isExactOrigin(value?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname === `${REFLECTION_TEST_PROJECT_REF}.supabase.co` && url.pathname === "/";
  } catch {
    return false;
  }
}
