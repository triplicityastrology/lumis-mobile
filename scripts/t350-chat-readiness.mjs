import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const control = JSON.parse(readFileSync(`${root}/config/founder-live-chat-candidate.json`, "utf8"));
const evidencePath = "/Volumes/LumisDevSSD/Development/Evidence/S2-T345-Technical-80-Live/technical-80-metadata-receipt.json";
const evidenceSha = createHash("sha256").update(readFileSync(evidencePath)).digest("hex");

execFileSync(process.execPath, ["scripts/refresh-founder-live-chat-seal.mjs", "--check"], {
  cwd: root,
  stdio: "ignore",
});
if (evidenceSha !== control.accepted_dice_technical_80_receipt_sha256) {
  throw new Error("STOP_T350_ACCEPTED_DICE_EVIDENCE_DRIFT");
}
if (control.authority.normal_chat !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" ||
    control.authority.azure_traffic !== "NO_AZURE_TRAFFIC_AUTHORITY") {
  throw new Error("STOP_T350_AUTHORITY_STATUS_DRIFT");
}

console.log("T350_SOURCE_AND_DICE_EVIDENCE_READY");
console.log("MOBILE_PUBLIC_NAMES=EXPO_PUBLIC_SUPABASE_URL,one_supported_EXPO_PUBLIC_SUPABASE_key");
console.log("SERVER_SECRET_NAMES=LUMIS_CHAT_AZURE_API_KEY,SUPABASE_SERVICE_ROLE_KEY");
console.log("SERVER_CONTROL_NAMES=LUMIS_CHAT_AI_ENABLED,LUMIS_CHAT_TRAFFIC_AUTHORIZED,LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256,LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_JSON,LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256,LUMIS_CHAT_ACCEPTED_AUTHORITY_JSON,LUMIS_CHAT_REVIEW_PACKAGE_SHA256,LUMIS_CHAT_GATEWAY_SOURCE_SHA256,LUMIS_CHAT_FIXTURE_REGISTRY_SHA256,LUMIS_CHAT_FOUNDER_WINDOW_AUTHORITY_JSON,LUMIS_CHAT_FOUNDER_WINDOW_PACKAGE_SHA256,SUPABASE_URL");
console.log("NEXT_ACTION=SEPARATELY_AUTHORIZE_T350_DEFAULT_OFF_DEPLOYMENT_MIGRATION_0040_AND_12_FIXTURE_CHAT_WINDOW");
console.log("STOP_T350_NO_DEPLOYMENT_OR_CHAT_TRAFFIC_AUTHORITY");
