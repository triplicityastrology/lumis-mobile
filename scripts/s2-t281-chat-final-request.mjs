import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateDeploymentRequest, validateMigrationRequest, validateTrafficRequest } from "./lib/s2-t281-chat-final-request.mjs";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, "config/s2-t281-chat-final-request-seal.json"), "utf8"));
const { package_binding_sha256: binding, ...bound } = manifest;
const sha = (value) => createHash("sha256").update(value).digest("hex");
if (sha(JSON.stringify(bound)) !== binding) throw new Error("STOP_S2_T281_PACKAGE_DRIFT");
for (const [file, digest] of Object.entries(manifest.source_sha256)) {
  if (sha(readFileSync(path.join(root, file))) !== digest) throw new Error(`STOP_S2_T281_SOURCE_DRIFT:${file}`);
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const mode = process.argv[2];
if (!mode) {
  console.log("WAITING_FOR_MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");
  console.log("NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
  console.log("NO_AZURE_TRAFFIC_AUTHORITY");
  console.log("next=pnpm chat:final-request-readiness -- --validate-deployment <reviewed-receipt.json>");
  process.exit(0);
}
const file = process.argv[3];
if (!file) throw new Error("STOP_S2_T281_RECEIPT_PATH_REQUIRED");
const value = JSON.parse(readFileSync(path.resolve(root, file), "utf8"));
if (mode === "--validate-deployment") validateDeploymentRequest(value, manifest, head);
else if (mode === "--validate-migration") validateMigrationRequest(value, manifest, head);
else if (mode === "--validate-traffic") validateTrafficRequest(value, manifest, head);
else throw new Error("STOP_S2_T281_UNKNOWN_SCOPE");
console.log(`S2_T281_${mode.slice(11).toUpperCase()}_REQUEST_ACCEPTED_LOCAL_VALIDATION_ONLY`);
console.log("NO_REMOTE_COMMAND_EXECUTED");
