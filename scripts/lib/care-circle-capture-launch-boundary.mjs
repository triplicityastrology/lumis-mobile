export function classifyCapturePort({ ownerCwds, expectedRoot, mobileDir }) {
  if (!Array.isArray(ownerCwds) || ownerCwds.some((cwd) => typeof cwd !== "string")) {
    return "owner_unverified";
  }
  if (ownerCwds.length === 0) return "free";
  return ownerCwds.every((cwd) => cwd === expectedRoot || cwd === mobileDir)
    ? "same_project_stale"
    : "another_project";
}
