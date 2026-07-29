import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "apps/mobile/src/services/inactiveCareCircleClient.ts",
  "utf8"
);
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const preview = readFileSync(
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T28-inactive-care-circle-mobile-client.md",
  "utf8"
);

for (const operation of [
  "create_pairing_code",
  "rotate_pairing_code",
  "submit_pairing_code",
  "accept_relationship",
  "decline_relationship",
  "pause_care",
  "resume_care",
  "remove_relationship",
]) {
  assert.match(source, new RegExp(`"${operation}"`));
}
assert.match(source, /pending_caree_acceptance/);
assert.match(source, /CARE_CIRCLE_PAIRING_CODE_INVALID/);
assert.match(source, /CARE_CIRCLE_REQUEST_CONFLICT/);
assert.match(source, /CARE_CIRCLE_AUTH_REQUIRED/);
assert.match(doc, /Status: source-only, inactive/);
assert.match(doc, /immediate successful create\/rotate response/);
assert.doesNotMatch(
  source,
  /console\.|AsyncStorage|SecureStore|supabase|fetch\(|react-native|expo-|setInterval|setTimeout/
);
assert.doesNotMatch(app, /inactiveCareCircleClient/);
assert.doesNotMatch(preview, /inactiveCareCircleClient/);

console.log("inactive Care Circle mobile client contract passed");
