const SECRET_BEARING_EXPO_NAME = /^EXPO_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PAT|PASSWORD|TOKEN|QA_KEY)/i;

export function validateBootstrapDescendantAuthority(input) {
  stopUnless(input.ancestorPresent === true, "ANCESTOR_MISSING");
  stopUnless(Array.isArray(input.dirtyPaths) && input.dirtyPaths.length === 0, "TREE_DIRTY");
  stopUnless(input.lockedFilesValid === true, "OPERATOR_DRIFT");
  stopUnless(input.projectRef === "bmqhwofmdgebpcihjlnb", "WRONG_PROJECT");
  stopUnless(input.origin === "https://bmqhwofmdgebpcihjlnb.supabase.co", "WRONG_ORIGIN");
  stopUnless(
    Array.isArray(input.environmentNames) && input.environmentNames.every((name) => !SECRET_BEARING_EXPO_NAME.test(name)),
    "SECRET_BEARING_EXPO_ENV",
  );
  return { ok: true };
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T116_${code}`);
}
