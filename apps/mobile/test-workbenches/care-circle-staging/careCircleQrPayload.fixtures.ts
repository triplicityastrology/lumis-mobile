import assert from "node:assert/strict";

import { normalizeCareCircleQrPayload } from "../../src/features/careCircle/careCircleQrPayload";

assert.equal(normalizeCareCircleQrPayload("2468"), "2468");
for (const rejected of ["", "123", "12345", "12a4", " 2468", "2468 ", "https://example.test", { code: "2468" }]) {
  assert.equal(normalizeCareCircleQrPayload(rejected), null);
}

console.log("Care Circle QR payload fixtures passed");
