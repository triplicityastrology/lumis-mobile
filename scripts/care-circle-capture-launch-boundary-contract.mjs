import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { classifyCapturePort } from "./lib/care-circle-capture-launch-boundary.mjs";

const root = "/canonical/lumis";
const mobile = `${root}/apps/mobile`;
assert.equal(classifyCapturePort({ ownerCwds: [], expectedRoot: root, mobileDir: mobile }), "free");
assert.equal(classifyCapturePort({ ownerCwds: [root], expectedRoot: root, mobileDir: mobile }), "same_project_stale");
assert.equal(classifyCapturePort({ ownerCwds: [mobile], expectedRoot: root, mobileDir: mobile }), "same_project_stale");
assert.equal(classifyCapturePort({ ownerCwds: ["/another/project"], expectedRoot: root, mobileDir: mobile }), "another_project");
assert.equal(classifyCapturePort({ ownerCwds: [root, "/another/project"], expectedRoot: root, mobileDir: mobile }), "another_project");
assert.equal(classifyCapturePort({ ownerCwds: [null], expectedRoot: root, mobileDir: mobile }), "owner_unverified");

const launcher = readFileSync("scripts/start-care-circle-product-capture.sh", "utf8");
assert.match(launcher, /Press Ctrl\+C in that Metro Terminal/);
assert.match(launcher, /pnpm start:care-circle-capture/);
assert.doesNotMatch(launcher, /\bkill\b|pkill|killall/);
assert.match(launcher, /current_bundle_marker=%s/);
assert.match(launcher, /capture_folder=%s/);
console.log("S2-T155 Care Circle capture launch failure fixtures passed.");
