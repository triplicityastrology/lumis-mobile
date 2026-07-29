import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "apps/mobile/src/services/inactiveNotificationDeviceClient.ts",
  "utf8"
);
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const notifications = readFileSync(
  "apps/mobile/src/features/notifications/NotificationCenterScreen.tsx",
  "utf8"
);
const careCircle = readFileSync(
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T29-inactive-notification-device-mobile-client.md",
  "utf8"
);

for (const action of [
  "register",
  "rotate",
  "unregister_on_logout",
  "revoke_permission",
  "invalidate_provider_token",
]) {
  assert.match(source, new RegExp(`"${action}"`));
}
for (const type of [
  "care_circle_check_in",
  "care_circle_reminder",
]) {
  assert.match(source, new RegExp(`"${type}"`));
}
assert.match(source, /enabled: false/);
assert.match(source, /NOTIFICATION_TYPE_REJECTED/);
assert.match(source, /NOTIFICATION_REQUEST_CONFLICT/);
assert.match(doc, /Status: source-only, inactive/);
assert.doesNotMatch(
  source,
  /console\.|AsyncStorage|SecureStore|supabase|fetch\(|expo-notifications|Notifications\.|setInterval|setTimeout/
);
for (const reachableSource of [app, notifications, careCircle]) {
  assert.doesNotMatch(reachableSource, /inactiveNotificationDeviceClient/);
}

console.log("inactive notification device client contract passed");
