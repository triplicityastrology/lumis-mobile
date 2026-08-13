import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const target = "config/s2-t341-chat-product-integration-rc-seal.json";
const files = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/services/chatProductIntegrationRc.ts",
  "apps/mobile/src/services/chatProductIntegrationFixture.ts",
  "apps/mobile/src/services/normalChatAiCandidate.ts",
  "supabase/functions/_shared/normal-chat-ai-candidate-v1.ts",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "config/s2-t341-chat-product-integration-rc.json",
  "scripts/start-s2-t341-chat-product.sh",
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const source = Object.fromEntries(files.map((file) => [file, sha(readFileSync(file))]));
const payload = {
  schema: "s2_t341_chat_product_integration_rc_seal_v1",
  base_commit: "b31dcd54b96aada1bc9bf422ddcf7df79328c52d",
  t240_commit: "beab3bc47d3d32fd0e76673f538f47f368f95347",
  source,
  package_sha256: sha(JSON.stringify(source)),
};
const rendered = `${JSON.stringify(payload, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== rendered) throw new Error("S2_T341_CHAT_PRODUCT_SEAL_DRIFT");
  console.log(`S2_T341_CHAT_PRODUCT_SEAL_OK package=${payload.package_sha256}`);
} else {
  writeFileSync(target, rendered);
  console.log(`S2_T341_CHAT_PRODUCT_SEAL_WRITTEN package=${payload.package_sha256}`);
}
