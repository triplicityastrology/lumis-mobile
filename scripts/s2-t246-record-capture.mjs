import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sha256, validateCaptureReceipt, validateSessionReceipt } from "./lib/s2-t246-dice-exact-receipts.mjs";

const [sessionPath, imagePath, ocrPath, state, widthText, heightText, outputPath] = process.argv.slice(2);
const control = JSON.parse(readFileSync("config/s2-t246-dice-exact-evidence.json", "utf8"));
const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
validateSessionReceipt(session, control, sourceSha);
const stateControl = control.states.find(({ id }) => id === state);
if (!stateControl) stop("UNKNOWN_STATE");
const imageBytes = readFileSync(imagePath);
const ocrText = readFileSync(ocrPath, "utf8");
const receipt = {
  schema: "s2_t246_dice_capture_receipt_v1",
  session_id: session.session_id,
  source_sha: sourceSha,
  metro_bundle_sha256: session.metro_bundle_sha256,
  state,
  fixture: stateControl.fixture,
  route: `${control.route_prefix}?state=${state}`,
  file: `captures/${state}.png`,
  image_sha256: sha256(imageBytes),
  ocr_sha256: sha256(ocrText),
  width: Number(widthText),
  height: Number(heightText),
  captured_at: new Date().toISOString(),
  build_marker_verified: true,
  state_marker_verified: true,
  product_evidence_verified: true,
  forbidden_frame_detected: false,
  provider_calls: 0,
  units_consumed: 0,
  persistence_writes: 0,
  remote_history_reads: 0,
  remote_history_deletes: 0,
  live_ai_proof: false,
  human_verdict: "pending"
};
validateCaptureReceipt(receipt, { control, session, imageBytes, ocrText, width: receipt.width, height: receipt.height });
writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
chmodSync(outputPath, 0o600);
process.stdout.write(`S2_T246_CAPTURE_RECEIPT_READY state=${state} image_sha256=${receipt.image_sha256}\n`);

function stop(code) {
  throw new Error(`STOP_S2_T246_${code}`);
}
