import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const source = read(
  "packages/shared/src/config/preview-capability-boundary.ts"
);
const fixture = read(
  "packages/shared/src/config/preview-capability-boundary.fixtures.ts"
);
const doc = read("docs/architecture/S2-T33-preview-capability-boundary.md");
const app = read("apps/mobile/App.tsx");
const insights = read("apps/mobile/src/screens/ChartInsightsScreen.tsx");

for (const surface of [
  "weekly_sky",
  "astrology_timing",
  "advanced_astrology",
  "care_circle",
  "notifications",
]) {
  assert.match(source, new RegExp(`"${surface}"`));
}
for (const operation of [
  "provider_call",
  "timing_calculation",
  "transit_calculation",
  "ai_retrieval",
  "billing_charge",
  "entitlement_enforcement",
  "scheduler_action",
  "notification_action",
  "care_circle_operation",
]) {
  assert.match(source, new RegExp(`"${operation}"`));
}

assert.match(source, /visibility: "reachable_preview"/);
assert.match(source, /activation: "inactive"/);
assert.match(source, /allowedLiveOperations: readonly \[\]/);
assert.match(source, /code: "PREVIEW_CAPABILITY_INACTIVE"/);
assert.doesNotMatch(
  source,
  /fetch\(|supabase|openai|anthropic|providerRequest|setTimeout|setInterval|process\.env|EXPO_PUBLIC/
);

assert.match(fixture, /for \(const operation of PROHIBITED_PREVIEW_OPERATIONS\)/);
assert.match(fixture, /\["solar_return", "dice", "transit_live"\]/);
assert.match(doc, /A \*\*reachable preview\*\* is an existing screen/);
assert.match(doc, /Reachability does[\s\S]*not grant authority/);
assert.match(doc, /An \*\*active capability\*\* has separately approved product authority/);
assert.match(doc, /Care Circle and Notifications remain static[\s\n]*previews/);
assert.match(doc, /Solar Return is not a preview/);
assert.match(doc, /Dice is a[\s\n]*separate product surface/);

assert.match(insights, /THIS WEEK'S SKY/);
assert.match(app, /Timing window · planning aid, not a guarantee/);
assert.doesNotMatch(
  `${app}\n${insights}`,
  /preview-capability-boundary|guardPreviewOperation|getPreviewCapabilityState/
);
assert.doesNotMatch(
  doc,
  /supabase (?:db push|functions deploy)|wrangler deploy|curl |fetch\(|service_role\s*[:=]|sb_secret_/i
);

console.log("inactive preview capability boundary contract passed");
