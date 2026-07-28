import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scaffold = readFileSync("supabase/migrations/0003_care_notifications_usage.sql", "utf8");
const correction = readFileSync(
  "supabase/migrations/0018_remove_misleading_care_max_index.sql",
  "utf8"
);
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const profile = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const careCircle = readFileSync("apps/mobile/src/features/careCircle/CareCircleScreen.tsx", "utf8");
const notifications = readFileSync(
  "apps/mobile/src/features/notifications/NotificationCenterScreen.tsx",
  "utf8"
);
const authority = readFileSync("docs/architecture/care-circle-preview-boundary.md", "utf8");

assert.match(scaffold, /create unique index if not exists care_relationships_active_pair_idx/i);
assert.match(correction, /drop index if exists public\.care_relationships_max_five_active_carers_idx/i);
assert.match(correction, /This does not enforce a maximum carer count/i);
assert.doesNotMatch(correction, /create unique index[^;]+max_five/is);

assert.match(profile, /label="Care Circle preview"/);
assert.match(profile, /value="Not active yet"/);
assert.equal(
  (profile.match(/onPress=\{onCareCircle\}/g) ?? []).length,
  1,
  "Profile must expose exactly one Care Circle preview entry"
);
assert.match(app, /import \{ CareCirclePreviewScreen \}/);
assert.doesNotMatch(app, /import \{ CareCircleScreen \}/);
assert.equal(
  (app.match(/<CareCirclePreviewScreen/g) ?? []).length,
  1,
  "release navigation must render only the static Care Circle preview"
);
assert.match(careCircle, /export function CareCirclePreviewScreen/);
assert.doesNotMatch(careCircle, /export function CareCircle(?:Prototype)?Screen/);
const preview = extractRange(
  careCircle,
  "export function CareCirclePreviewScreen",
  "// Preserved prototype only."
);
assert.match(preview, /Care Circle is a preview\./);
assert.match(preview, /Check-ins, linking, codes, and reminders are not active in this build\./);
assert.doesNotMatch(
  preview,
  /onCta|TextInput|Modal|simulate|scan|accept|decline|schedule|notification|billing|entitlement/i
);

const releaseNotifications = extractRange(
  notifications,
  "export function NotificationCenterScreen",
  "// Preserved prototype only."
);
assert.match(releaseNotifications, /Preview · notifications are not active/);
assert.match(releaseNotifications, /Account and Care Circle notices are not active in this build\./);
assert.doesNotMatch(
  releaseNotifications,
  /MOCK|resolve\(|markAllRead|deeplink|Accept|Decline|carer_request|missed_checkin/
);
assert.doesNotMatch(app, /PermissionBridgeScreen/);

for (const canonicalName of [
  "Carer_Caree_Business_Process_and_Technical_Requirements_v0.3.md",
  "Carer_Caree_Business_Process_and_Technical_Requirements_v0.3.docx"
]) {
  assert.match(
    authority,
    new RegExp(canonicalName.replaceAll(".", "\\.")),
    `${canonicalName} must remain referenced as future implementation authority`
  );
}
assert.match(authority, /future implementation authority/i);
assert.match(authority, /preview-only/i);

console.log("Care Circle schema and preview-boundary contract checks passed");

function extractRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}
