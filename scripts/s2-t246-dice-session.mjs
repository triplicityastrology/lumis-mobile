import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sha256, validateSessionReceipt } from "./lib/s2-t246-dice-exact-receipts.mjs";

const [mode, receiptPath, bundlePath] = process.argv.slice(2);
const control = JSON.parse(readFileSync("config/s2-t246-dice-exact-evidence.json", "utf8"));
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (mode === "create") {
  if (!bundlePath) stop("BUNDLE_MISSING");
  const bundle = readFileSync(bundlePath);
  const text = bundle.toString("utf8");
  for (const marker of [sourceSha, "dice-capture-evidence-strip", "dice-zero-effects-boundary", "FounderDiceInterpretationWorkbench"]) {
    if (!text.includes(marker)) stop("BUNDLE_MARKER");
  }
  const receipt = {
    schema: "s2_t246_dice_capture_session_v1",
    session_id: randomBytes(32).toString("hex"),
    source_sha: sourceSha,
    metro_bundle_sha256: sha256(bundle),
    route_prefix: control.route_prefix,
    port: control.simulator_port,
    device_udid: control.device_udid,
    created_at: new Date().toISOString(),
    expected_states: control.states.map(({ id }) => id)
  };
  validateSessionReceipt(receipt, control, sourceSha);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  chmodSync(receiptPath, 0o600);
  process.stdout.write(`S2_T246_CAPTURE_SESSION_READY source_sha=${sourceSha} bundle_sha256=${receipt.metro_bundle_sha256}\n`);
} else if (mode === "validate") {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  validateSessionReceipt(receipt, control, sourceSha);
  if (!bundlePath || sha256(readFileSync(bundlePath)) !== receipt.metro_bundle_sha256) stop("LIVE_BUNDLE_DRIFT");
  process.stdout.write(`S2_T246_CAPTURE_SESSION_VALID source_sha=${sourceSha}\n`);
} else {
  stop("SESSION_MODE");
}

function stop(code) {
  throw new Error(`STOP_S2_T246_${code}`);
}
