export const FOUNDER_BUILD_STATUS_VERSION = "founder_build_status_v1" as const;

export type FounderBundleFeature = {
  id:
    | "persona_comparison"
    | "quota_verification"
    | "care_circle_workbench"
    | "reflection_deletion_readiness"
    | "birth_details_fixes";
  label: string;
  included: true;
  version: string;
};

const BUNDLED_FEATURES: readonly FounderBundleFeature[] = [
  { id: "persona_comparison", label: "Persona comparison", included: true, version: "S2-T90" },
  { id: "quota_verification", label: "Quota verification", included: true, version: "S2-T93" },
  { id: "care_circle_workbench", label: "Care Circle workbench", included: true, version: "S2-T96" },
  { id: "reflection_deletion_readiness", label: "Reflection deletion readiness", included: true, version: "S2-T99" },
  { id: "birth_details_fixes", label: "Birth Details fixes", included: true, version: "S2-T36" },
];

export type FounderBuildStatus = {
  version: typeof FOUNDER_BUILD_STATUS_VERSION;
  sourceCommit: string | null;
  markerStatus: "verified" | "unavailable";
  features: readonly FounderBundleFeature[];
};

export function resolveFounderBuildStatus(sourceCommit: string | undefined): FounderBuildStatus {
  const normalized = sourceCommit?.trim().toLowerCase();
  const validCommit = normalized && /^[0-9a-f]{40}$/.test(normalized) ? normalized : null;
  return {
    version: FOUNDER_BUILD_STATUS_VERSION,
    sourceCommit: validCommit,
    markerStatus: validCommit ? "verified" : "unavailable",
    features: BUNDLED_FEATURES,
  };
}
