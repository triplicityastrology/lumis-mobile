import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../migrations/0008_onboarding_chart_history.sql", import.meta.url),
  "utf8"
);
const forwardSanitizerMigration = readFileSync(
  new URL("../../migrations/0010_strip_legacy_raw_provider_response.sql", import.meta.url),
  "utf8"
);
const profileFunction = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

const repairReturn = migration.indexOf("'repaired_missing_starter', true");
const userUpsert = migration.indexOf("insert into public.users");

assert(repairReturn >= 0, "Recovery RPC must identify the missing-Starter repair result.");
assert(userUpsert >= 0, "Onboarding RPC must retain its fresh-onboarding user upsert.");
assert(
  repairReturn < userUpsert,
  "Recovery must return before the general user upsert can change saved settings."
);
assert(
  migration.includes("display_name = excluded.display_name"),
  "Fresh/partial onboarding must be able to replace a placeholder display name."
);
assert(
  profileFunction.includes("p_display_name: null") && profileFunction.includes("p_role: null"),
  "Recovery must not submit replacement user settings."
);
assert(
  profileFunction.includes("p_raw_chart_json: null"),
  "Recovery must not claim to store unused audit metadata."
);
assert(
  profileFunction.includes(
    "p_chart_json: sanitizeChartForClient(profile.chart_json, birthData.time_unknown)"
  ),
  "Recovery must sanitize a legacy chart before copying it into client-readable history."
);
assert(
  (migration.match(/- 'rawProviderResponse'/g) ?? []).length >= 4,
  "Migration 0008 must strip raw provider output during backfill, repair, and fresh onboarding."
);
assert(
  forwardSanitizerMigration.includes("update public.ai_profiles") &&
    forwardSanitizerMigration.includes("update public.birth_data_history") &&
    forwardSanitizerMigration.includes("before insert or update of chart_json"),
  "Forward migration must clean existing charts and guard future chart-history writes."
);
assert(
  !profileFunction.includes("recovery_source") &&
    !profileFunction.includes("legacy_profile_repaired_without_worker"),
  "Recovery must not contain an unpersisted audit marker."
);

console.log("Profile recovery contract fixtures passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
