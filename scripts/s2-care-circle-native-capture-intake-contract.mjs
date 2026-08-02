import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { renderContactSheet, validateCaptureBuffers } from "./lib/care-circle-native-capture-intake.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t150-care-circle-native-capture-states.json", "utf8"));
function png(width, height, unique, label = "") {
  const value = Buffer.alloc(32 + label.length, unique);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(value, 0);
  value.writeUInt32BE(width, 16); value.writeUInt32BE(height, 20); value.write(label, 32, "latin1");
  return value;
}
const entries = control.captures.map(({ file }, index) => ({ file, buffer: png(1179, 2556, index + 1) }));
const valid = validateCaptureBuffers(entries, control);
assert.equal(valid.length, 13); assert.equal(valid[0].scale, 3); assert.deepEqual(valid[0].logical_viewport, { width: 393, height: 852 });
assert.throws(() => validateCaptureBuffers(entries.slice(0, 12), control), /STOP_S2_T150_CAPTURE_COUNT_INVALID/);
assert.throws(() => validateCaptureBuffers(entries.map((item, index) => index === 1 ? { ...item, buffer: entries[0].buffer } : item), control), /STOP_S2_T150_DUPLICATE_CAPTURE/);
assert.throws(() => validateCaptureBuffers(entries.map((item, index) => index === 1 ? { ...item, buffer: png(1179, 2556, 2, "static web") } : item), control), /STOP_S2_T150_NON_NATIVE_LABEL_DETECTED/);
assert.throws(() => validateCaptureBuffers(entries.map((item, index) => index === 1 ? { ...item, buffer: png(1000, 1000, 2) } : item), control), /STOP_S2_T150_CAPTURE_ORIENTATION_INVALID/);
const html = renderContactSheet(valid, "/safe/captures", [{ label: "Reference", path: "/safe/reference.png" }]);
assert.match(html, /Human comparison required/); assert.match(html, /visual similarity/u);

const source = readFileSync("scripts/s2-care-circle-native-capture-intake.mjs", "utf8");
assert.doesNotMatch(source, /fetch\(|https?:\/\/|sharp|writeFileSync\([^,]*CAPTURE_ROOT/iu);
const inert = spawnSync(process.execPath, ["scripts/s2-care-circle-native-capture-intake.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr); assert.match(inert.stdout, /^WAITING_FOR_FOUNDER_NATIVE_CAPTURES/mu); assert.match(inert.stdout, /filesystem_writes=0/u);
console.log("S2-T150 native Care Circle capture intake contracts passed; default remained inert.");
