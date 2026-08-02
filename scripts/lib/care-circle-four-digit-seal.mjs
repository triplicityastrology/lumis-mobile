import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const DEFAULT_SEAL_PATH = "supabase/tests/s2-t146-care-circle-four-digit-parity-seal.json";

export function validateFourDigitSeal(path = DEFAULT_SEAL_PATH) {
  const seal = JSON.parse(readFileSync(path, "utf8"));
  stopUnless(seal.schema === "s2_t146_care_circle_four_digit_parity_v1", "SCHEMA_INVALID");
  stopUnless(seal.project_ref === "bmqhwofmdgebpcihjlnb", "PROJECT_INVALID");
  stopUnless(seal.migration_version === "0037", "MIGRATION_VERSION_INVALID");
  stopUnless(seal.pairing_code_format === "four_numeric_digits", "CODE_FORMAT_INVALID");
  stopUnless(seal.expiry_seconds === 600, "EXPIRY_INVALID");
  stopUnless(seal.reservation_seconds === 3600, "RESERVATION_INVALID");
  stopUnless(seal.hourly_pool_capacity === 10000, "POOL_CAPACITY_INVALID");
  stopUnless(seal.attempt_limit === 5 && seal.attempt_window_seconds === 600, "THROTTLE_INVALID");
  stopUnless(seal.custom_secret_name === "CARE_CIRCLE_PAIRING_SECRET", "SECRET_NAME_INVALID");
  stopUnless(Array.isArray(seal.locked_sources) && seal.locked_sources.length >= 12, "SOURCE_SET_INCOMPLETE");

  const paths = new Set();
  for (const source of seal.locked_sources) {
    stopUnless(source && typeof source.path === "string" && /^[a-zA-Z0-9_./-]+$/.test(source.path), "SOURCE_PATH_INVALID");
    stopUnless(typeof source.sha256 === "string" && /^[0-9a-f]{64}$/.test(source.sha256), "SOURCE_HASH_INVALID");
    stopUnless(!paths.has(source.path), "SOURCE_DUPLICATE");
    paths.add(source.path);
    const actual = createHash("sha256").update(readFileSync(source.path)).digest("hex");
    stopUnless(actual === source.sha256, "SOURCE_DRIFT");
  }
  for (const required of [
    "supabase/migrations/0037_four_digit_care_pairing_codes.sql",
    "supabase/functions/care-circle/index.ts",
    "supabase/functions/care-circle/operation-boundary.ts",
    "supabase/functions/_shared/cors.ts",
    "apps/mobile/src/services/inactiveCareCircleClient.ts",
    "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
    "apps/mobile/src/features/careCircle/careCircleQrPayload.ts",
    "apps/mobile/package.json",
    "pnpm-lock.yaml",
    "apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx",
    "scripts/run-s2-care-circle-pat-deploy.zsh",
    "scripts/run-s2-care-circle-pairing-secret-provision.zsh",
    "scripts/run-s2-care-circle-function-health.zsh",
    "scripts/s2-care-circle-function-health.mjs",
    "scripts/run-s2-care-circle-bootstrap.zsh",
    "scripts/run-s2-care-circle-two-account-evidence.zsh",
    "scripts/run-s2-care-circle-two-account-operator.sh",
    "scripts/s2-care-circle-two-account-operator.mjs",
    "scripts/run-s2-care-circle-staging-evidence.sh",
    "scripts/s2-care-circle-staging-evidence.mjs"
  ]) stopUnless(paths.has(required), "REQUIRED_SOURCE_MISSING");

  validateFourDigitPolicySources({
    migration: readFileSync("supabase/migrations/0037_four_digit_care_pairing_codes.sql", "utf8"),
    edge: readFileSync("supabase/functions/care-circle/operation-boundary.ts", "utf8"),
    client: readFileSync("apps/mobile/src/services/inactiveCareCircleClient.ts", "utf8"),
    mobile: readFileSync("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx", "utf8")
  });
  return seal;
}

export function validateFourDigitPolicySources({ migration, edge, client, mobile }) {
  stopUnless(/interval '10 minutes'/.test(migration) && /interval '60 minutes'/.test(migration) && /care_pairing_code_reservations/.test(migration) && /attempt_count between 0 and 5/.test(migration), "MIGRATION_POLICY_MISSING");
  stopUnless(/\^\\d\{4\}\$/.test(edge) && /PAIRING_CODE_PATTERN = \/\^\\d\{4\}\$\//.test(client), "FOUR_DIGIT_CONTRACT_MISSING");
  stopUnless(/maxLength=\{4\}/.test(mobile) && /keyboardType="number-pad"/.test(mobile) && /Pairing code copied/.test(mobile), "MOBILE_BOUNDARY_MISSING");
  stopUnless(!/one[- ]hour|60[- ]minute|LUMIS123|[A-Z]{4}[0-9]{4}/i.test(`${edge}\n${client}\n${mobile}`), "STALE_CODE_POLICY");
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T146_${code}`);
}
