const PROHIBITED_BACKEND_PATHS = new Set([
  "supabase/migrations/0032_care_circle_backend_foundation.sql",
  "supabase/migrations/0033_inactive_notification_foundation.sql",
  "supabase/migrations/0034_reusable_care_pairing_operations.sql",
  "supabase/functions/care-circle/index.ts",
  "supabase/functions/care-circle/operation-boundary.ts",
  "supabase/functions/_shared/cors.ts",
]);

export function validateCleanDescendantAuthority(input) {
  stopUnless(input.ancestorPresent === true, "ANCESTOR_MISSING");
  stopUnless(Array.isArray(input.dirtyPaths) && input.dirtyPaths.length === 0, "TREE_DIRTY");
  stopUnless(Array.isArray(input.changedPaths), "DIFF_INVALID");
  stopUnless(
    input.changedPaths.every((path) => typeof path === "string" && !PROHIBITED_BACKEND_PATHS.has(path)),
    "PROHIBITED_BACKEND_DRIFT",
  );
  stopUnless(input.lockedFilesValid === true, "OPERATOR_DRIFT");
  return { ok: true };
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T115_${code}`);
}
