import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { assertCompleteUniqueCaptures, validateCaptureReceipt, validateSessionReceipt } from "./lib/s2-t246-dice-exact-receipts.mjs";

const control = JSON.parse(readFileSync("config/s2-t246-dice-exact-evidence.json", "utf8"));
const root = control.evidence_root;
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const session = JSON.parse(readFileSync(path.join(root, "session.json"), "utf8"));
validateSessionReceipt(session, control, sourceSha);
const captures = control.states.map(({ id }) => {
  const imagePath = path.join(root, "captures", `${id}.png`);
  const ocrPath = path.join(root, "ocr", `${id}.txt`);
  const imageBytes = readFileSync(imagePath);
  const ocrText = readFileSync(ocrPath, "utf8");
  const receipt = JSON.parse(readFileSync(path.join(root, "capture-receipts", `${id}.json`), "utf8"));
  const properties = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", imagePath], { encoding: "utf8" });
  const width = Number(properties.match(/pixelWidth: (\d+)/u)?.[1]);
  const height = Number(properties.match(/pixelHeight: (\d+)/u)?.[1]);
  return validateCaptureReceipt(receipt, { control, session, imageBytes, ocrText, width, height });
});
assertCompleteUniqueCaptures(captures, control);
const manifest = {
  schema: control.schema,
  source_sha: sourceSha,
  metro_bundle_sha256: session.metro_bundle_sha256,
  session_id_sha256: (await import("node:crypto")).createHash("sha256").update(session.session_id).digest("hex"),
  route_prefix: control.route_prefix,
  device_name: control.device_name,
  runtime: control.runtime,
  human_verdict: "pending",
  live_ai_proof: false,
  effects: control.effects,
  inactive_unresolved: control.inactive_unresolved,
  captures
};
mkdirSync(root, { recursive: true });
writeFileSync(path.join(root, "sha256-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
const cards = captures.map((capture) => `<figure><img src="${capture.file}" alt="${capture.state}"><figcaption>${capture.state}<br>${capture.fixture}<br>${capture.image_sha256.slice(0, 16)}</figcaption></figure>`).join("\n");
writeFileSync(path.join(root, "contact-sheet.html"), `<!doctype html><meta charset="utf-8"><title>S2-T246 Dice exact-state evidence</title><style>body{background:#06101c;color:#eef3f8;font:13px system-ui;margin:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}figure{margin:0}img{width:100%;border:1px solid #ffffff24}figcaption{overflow-wrap:anywhere;padding:8px 0;color:#c4cedb}</style><h1>S2-T246 Dice exact-state evidence</h1><p>Build ${sourceSha}</p><p>Bundle ${session.metro_bundle_sha256}</p><p>Human verdict pending · local synthetic · no provider, units, persistence, or remote history</p><div class="grid">${cards}</div>`, { mode: 0o600 });
process.stdout.write(`S2_T246_EVIDENCE_READY source_sha=${sourceSha} captures=${captures.length} human_verdict=pending\n`);
