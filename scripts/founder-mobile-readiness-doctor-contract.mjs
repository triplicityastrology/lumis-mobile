import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doctor = readFileSync("scripts/founder-mobile-readiness-doctor.mjs", "utf8");
const launcher = readFileSync("scripts/start-normal-expo.sh", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const marker of [
  "lumis-mobile-s1t04-work", "a52586a", "df90ce0", "fe35650",
  "NATIVE_MODULE_UNRESOLVED", "FOUNDER_ROUTE_MISSING", "PUBLIC_CONFIG_MISMATCH",
  "local_rehearsal_available", "live_ready_receipt_verified", "restart_required",
  "another_project", "pnpm start:normal-expo",
]) assert.match(doctor, new RegExp(marker));
assert.match(doctor, /validateMobileModuleSpecifiers/);
assert.match(doctor, /status", "--porcelain", "--untracked-files=no/);
assert.match(doctor, /normal-expo-session\.json/);
assert.doesNotMatch(doctor, /console\.log\(environment|EXPO_PUBLIC_SUPABASE_KEY=/);
assert.doesNotMatch(doctor, /\bkill\b|curl|fetch\s*\(|supabase\s+(?:link|deploy|secrets)/i);
assert.match(launcher, /normal-expo-session\.json/);
assert.equal(packageJson.scripts["founder:doctor"], "node scripts/founder-mobile-readiness-doctor.mjs");
assert.equal(packageJson.scripts["test:founder-doctor"], "node scripts/founder-mobile-readiness-doctor-contract.mjs");
assert.match(packageJson.scripts["test:mobile-native-bundle-contract"], /founder-mobile-readiness-doctor-contract/);
assert.match(packageJson.scripts["test:all-local"], /test:mobile-native-bundle-contract/);
console.log("Founder mobile readiness doctor contract passed");
