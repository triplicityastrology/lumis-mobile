import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { rejectDuplicateCaptures, validateCaptureReceipt, validateSessionReceipt } from "./lib/s2-t243-dice-capture-receipts.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t243-dice-capture-control.json", "utf8"));
const root = control.evidence_root;
const session = JSON.parse(readFileSync(path.join(root, "session.json"), "utf8"));
validateSessionReceipt(session, control, session.source_sha);
const captures = control.states.map((state) => {
  const file = path.join(root, "captures", `${state}.png`);
  const imageBytes = readFileSync(file);
  const receipt = JSON.parse(readFileSync(path.join(root, "capture-receipts", `${state}.json`), "utf8"));
  const properties = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  const width = Number(properties.match(/pixelWidth: (\d+)/)?.[1]);
  const height = Number(properties.match(/pixelHeight: (\d+)/)?.[1]);
  return validateCaptureReceipt(receipt, { control, session, sourceSha: session.source_sha, imageBytes, width, height });
});
rejectDuplicateCaptures(captures);
const manifest = { schema: control.schema, authority_founder_base: control.authority_founder_base, source_sha: session.source_sha, displayed_build_marker: session.build_marker, capture_session_nonce_sha256: (await import("node:crypto")).createHash("sha256").update(session.session_nonce).digest("hex"), route_prefix: control.route_prefix, device_name: control.device_name, runtime: control.runtime, human_verdict: "pending", live_ai_proof: false, units_consumed: 0, persistence_writes: 0, inactive_unresolved: control.inactive_unresolved, captures };
mkdirSync(root, { recursive: true });
writeFileSync(path.join(root, "sha256-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
const cards = captures.map((item) => `<figure><img src="${item.file}" alt="${item.state}"><figcaption>${item.state}<br>${item.route}<br>${item.image_sha256.slice(0,16)}</figcaption></figure>`).join("\n");
writeFileSync(path.join(root, "contact-sheet.html"), `<!doctype html><meta charset="utf-8"><title>S2-T243 Dice exact-build evidence</title><style>body{background:#06101c;color:#eef3f8;font:13px system-ui;margin:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}figure{margin:0}img{width:100%;border:1px solid #ffffff24}figcaption{overflow-wrap:anywhere;padding:8px 0;color:#c4cedb}</style><h1>S2-T243 Dice exact-build evidence</h1><p>Build ${session.source_sha}</p><p>Human verdict pending · local synthetic · no live AI, units, or persistence</p><div class="grid">${cards}</div>`, { mode: 0o600 });
console.log(`S2_T243_EVIDENCE_READY source_sha=${session.source_sha} captures=${captures.length} human_verdict=pending live_ai_proof=false`);
