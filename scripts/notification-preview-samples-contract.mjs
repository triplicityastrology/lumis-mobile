import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "apps/mobile/src/features/notifications/NotificationCenterScreen.tsx",
  "utf8"
);
const releaseStart = source.indexOf("export function NotificationCenterScreen");
const prototypeStart = source.indexOf("function NotificationCenterPrototypeScreen");
const releaseScreen = source.slice(releaseStart, prototypeStart);

assert.ok(releaseStart >= 0 && prototypeStart > releaseStart);
assert.match(source, /const PREVIEW_SAMPLES: readonly PreviewNotifItem\[\]/);
assert.match(source, /Sample Care Circle reminder/);
assert.match(source, /Sample account notice/);
assert.match(source, /Layout preview only\. Reminders and delivery are not active\./);
assert.match(source, /This local sample is not from your account\./);
assert.match(releaseScreen, /useState<ReleasePreviewMode>\("populated"\)/);
assert.match(releaseScreen, /\{__DEV__ \? \(/);
// NOTIF-002 (loading) and NOTIF-004 (error) join the DEV-only preview switcher.
// Release default stays "populated"; loading/error are dev-preview only
// (__DEV__-gated) and add no real fetch/delivery (asserted below).
assert.match(releaseScreen, /\["populated", "loading", "error", "empty"\]/);
assert.match(releaseScreen, /Sample layout · local preview data only/);
assert.match(releaseScreen, /PREVIEW_SAMPLES\.map/);
assert.match(releaseScreen, /Preview · notifications are not active/);
assert.doesNotMatch(
  releaseScreen,
  /accept_decline|onAccept|onDecline|onDeeplink|supabase|fetch\(|AsyncStorage|SecureStore|expo-notifications|Notifications\.|schedule|registerForPush/i
);
assert.doesNotMatch(source.slice(0, prototypeStart), /console\.|analytics|persist/i);

console.log("deterministic inactive notification preview samples contract passed");
