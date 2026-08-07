import { strict as assert } from "node:assert";
import { acceptCareCircleCameraPayload, resolveCareCircleCameraState, type CareCircleCameraPort } from "./careCircleNativeScanner";
const port = (availability: "available" | "unavailable", permission: "granted" | "denied" | "undetermined"): CareCircleCameraPort => ({ availability: () => availability, permission: () => permission, requestPermission: async () => permission === "granted" ? "granted" : "denied" });
assert.equal(resolveCareCircleCameraState(port("unavailable", "undetermined")), "module_unavailable");
assert.equal(resolveCareCircleCameraState(port("available", "undetermined")), "permission_required");
assert.equal(resolveCareCircleCameraState(port("available", "denied")), "permission_denied");
assert.deepEqual(acceptCareCircleCameraPayload("2468"), { ok: true, pairingCode: "2468" });
for (const value of ["24680", "24 68", "https://example.invalid/2468", { code: "2468" }]) assert.deepEqual(acceptCareCircleCameraPayload(value), { ok: false, code: "CARE_CIRCLE_QR_INVALID" });
console.log("Care Circle native scanner boundary fixtures passed");
