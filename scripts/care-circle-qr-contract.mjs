import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import QRCode from "qrcode";

const payload = "2468";
const encoded = QRCode.create(payload, { errorCorrectionLevel: "M" });
const margin = 4;
const scale = 8;
const modules = encoded.modules.size;
const width = (modules + margin * 2) * scale;
const pixels = new Uint8ClampedArray(width * width * 4).fill(255);

for (let row = 0; row < modules; row += 1) {
  for (let column = 0; column < modules; column += 1) {
    if (!encoded.modules.get(row, column)) continue;
    for (let y = 0; y < scale; y += 1) {
      for (let x = 0; x < scale; x += 1) {
        const pixel = (((row + margin) * scale + y) * width + (column + margin) * scale + x) * 4;
        pixels[pixel] = 16;
        pixels[pixel + 1] = 36;
        pixels[pixel + 2] = 58;
      }
    }
  }
}

const decoded = jsQR(pixels, width, width);
assert.equal(decoded?.data, payload, "the rendered QR must decode to exactly four digits");

const component = readFileSync("apps/mobile/src/features/careCircle/CareCircleScreen.tsx", "utf8");
const boundary = readFileSync("apps/mobile/src/features/careCircle/careCircleQrPayload.ts", "utf8");
const workbench = readFileSync("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx", "utf8");
assert.match(component, /import QRCode from "react-native-qrcode-svg"/);
assert.match(component, /value=\{payload\}/);
assert.match(component, /quietZone=\{12\}/);
assert.match(component, /if \(!payload\)[\s\S]*Code unavailable/);
assert.match(boundary, /\^\\d\{4\}\$/);
assert.match(workbench, /normalizeCareCircleQrPayload\(pairingCodeInput\)/);
assert.match(workbench, /keyboardType="number-pad"/);
assert.doesNotMatch(component, /https?:\/\/|user_id|relationship_id|email|timestamp/i);

console.log("Care Circle standards-compliant QR round-trip contract passed");
