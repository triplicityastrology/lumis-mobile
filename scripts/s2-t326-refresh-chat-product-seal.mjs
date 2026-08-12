import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const paths = [
  "apps/mobile/src/services/chatPostDiceReleaseCandidate.ts",
  "apps/mobile/src/services/chatProductPathCandidate.ts",
  "apps/mobile/src/services/chatReleaseCandidate.ts",
  "apps/mobile/src/services/normalChatAiCandidate.ts",
  "apps/mobile/src/dev/FounderPolishedChatExperience.tsx",
  "supabase/functions/_shared/chat-product-path-candidate-v1.ts",
  "supabase/functions/_shared/chat-post-dice-release-candidate-v1.ts",
  "supabase/functions/_shared/normal-chat-release-candidate-v1.ts",
  "supabase/functions/_shared/normal-chat-ai-candidate-v1.ts",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/tests/s2-t326-chat-default-off-deployment.schema.json",
  "supabase/tests/s2-t326-chat-synthetic-traffic.schema.json",
  "config/s2-t326-chat-product-path.json"
];
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const source_sha256 = Object.fromEntries(paths.map((path) => [path, digest(path)]));
const package_sha256 = createHash("sha256")
  .update(paths.map((path) => `${path}\0${source_sha256[path]}\n`).join(""))
  .digest("hex");
const next = { schema: "s2_t326_chat_product_path_seal_v1", source_sha256, package_sha256 };
const target = "config/s2-t326-chat-product-path-seal.json";
if (process.argv.includes("--check")) {
  const current = JSON.parse(readFileSync(target, "utf8"));
  if (JSON.stringify(current) !== JSON.stringify(next)) throw new Error("STOP_S2_T326_SOURCE_DRIFT");
  console.log(`S2_T326_SEAL_OK ${package_sha256}`);
} else {
  writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
  console.log(`S2_T326_SEAL_WRITTEN ${package_sha256}`);
}
