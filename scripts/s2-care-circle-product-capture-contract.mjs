import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const control = JSON.parse(read("supabase/tests/s2-t145-care-circle-capture-control.json"));
const launcher = read("scripts/start-care-circle-product-capture.sh");
const product = read("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx");
const rehearsal = read("apps/mobile/src/dev/CareCircleLocalRehearsal.tsx");
const founder = read("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx");

assert.equal(control.approved_ancestor, "43ac4fa2273aa4ae1baf7b78b52116fb21d9a64b");
for (const source of control.protected_sources) {
  assert.equal(createHash("sha256").update(readFileSync(source.path)).digest("hex"), source.sha256, source.path);
}
assert.deepEqual(control.portrait_viewports.map(({ width, height }) => [width, height]), [[388, 786], [400, 800], [393, 852]]);
assert.equal((product.match(/<ScrollView/g) ?? []).length, 1);
assert.match(product, /contentInsetAdjustmentBehavior="never"/);
assert.match(product, /style=\{styles\.safe\}/);
assert.match(rehearsal, /<CareCircleStagingWorkbench/);
assert.match(founder, /<CareCircleLocalRehearsal/);
assert.doesNotMatch(product, /FOUNDER TEST GUIDE|Synthetic Caree|Synthetic Carer|PREVIEW \/ NOT ACTIVE/);
for (const required of [
  /merge-base --is-ancestor/, /PROTECTED_UI_DRIFT/, /status --porcelain/, /STALE_METRO_RUNNING/,
  /PORT_OWNED_BY_ANOTHER_PROJECT/, /EXPO_PUBLIC_LUMIS_SOURCE_COMMIT/, /expo start --tunnel --port "\$PORT" --clear/,
]) assert.match(launcher, required);
assert.doesNotMatch(launcher, /\bkill\b|SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE_KEY)|sb_secret_|https?:\/\//);
console.log("S2-T145 corrected Care Circle product capture launcher contract passed.");
