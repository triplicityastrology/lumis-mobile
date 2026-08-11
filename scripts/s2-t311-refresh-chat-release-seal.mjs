import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/src/dev/FounderPolishedChatExperience.tsx",
  "apps/mobile/src/dev/founderPolishedChatContract.ts",
  "apps/mobile/src/services/normalChatAiCandidate.ts",
  "apps/mobile/src/services/chatReleaseCandidate.ts",
  "supabase/functions/_shared/normal-chat-ai-candidate-v1.ts",
  "supabase/functions/_shared/normal-chat-release-candidate-v1.ts",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "supabase/tests/s2-t311-chat-deployment-receipt.schema.json",
  "supabase/tests/s2-t311-chat-traffic-authorization.schema.json",
  "config/s2-t311-chat-release-candidate.json",
].sort();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const source_sha256 = Object.fromEntries(files.map((file) => [file, digest(readFileSync(file))]));
const package_sha256 = digest(files.map((file) => `${file}\0${source_sha256[file]}\n`).join(""));
const seal = {
  schema: "s2_t311_chat_release_candidate_seal_v1",
  authorities: {
    t240: "beab3bc47d3d32fd0e76673f538f47f368f95347",
    t299: "5797ddeee0402c88f39fecfa45d060ea7991061a",
    t306: "78c0ce93f211c9ded4d2e65cb789b5dfbfeb9df3"
  },
  source_sha256,
  package_sha256,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY"
};

const output = `${JSON.stringify(seal, null, 2)}\n`;
const path = "config/s2-t311-chat-release-candidate-seal.json";
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output) throw new Error("STOP_S2_T311_PACKAGE_SEAL_DRIFT");
  console.log(`S2_T311_CHAT_RELEASE_SEAL_OK package_sha256=${package_sha256}`);
} else {
  writeFileSync(path, output);
  console.log(`S2_T311_CHAT_RELEASE_SEAL_WRITTEN package_sha256=${package_sha256}`);
}
