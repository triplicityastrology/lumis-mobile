import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const paths = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/services/chatPostDiceReleaseCandidate.ts",
  "apps/mobile/src/services/diceFounderProductBridge.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.ts",
  "apps/mobile/src/services/chatReleaseCandidate.ts",
  "apps/mobile/src/services/normalChatAiCandidate.ts",
  "packages/shared/src/config/dice-question-boundary.ts",
  "config/s2-t321-chat-post-dice-release-candidate.json",
  "supabase/functions/_shared/chat-post-dice-release-candidate-v1.ts",
  "supabase/functions/_shared/normal-chat-release-candidate-v1.ts",
  "supabase/functions/_shared/normal-chat-ai-candidate-v1.ts",
  "supabase/tests/s2-t321-accepted-dice-evidence.schema.json",
  "supabase/tests/s2-t321-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t321-chat-traffic-authorization.schema.json",
  "scripts/s2-t311-chat-release-candidate-contract.mjs",
  "scripts/mobile-ui-contract.mjs",
  "scripts/s2-t321-chat-post-dice-contract.mjs",
  "scripts/s2-t321-chat-readiness.mjs"
];
const digest = (value) => createHash("sha256").update(value).digest("hex");
const source_sha256 = Object.fromEntries(paths.map((path) => [path, digest(readFileSync(path))]));
const package_sha256 = digest(JSON.stringify(source_sha256));
const seal = {
  schema: "s2_t321_chat_post_dice_release_candidate_seal_v1",
  authorities: {
    t240: "beab3bc47d3d32fd0e76673f538f47f368f95347",
    t306: "78c0ce93f211c9ded4d2e65cb789b5dfbfeb9df3",
    t311: "eff1a5872198e9cef766515954dd60f0f1630575",
    t316: "482ebf58cb03270acce8755b11af7a1a9360f189"
  },
  final_t317_binding: {
    source_commit: "8706db6cadbbf4ae0a58d10a194479a0c7aca465",
    source_tree: "edf01652aa245cc1bc202f3e3cee677b074a2565",
    release_package_sha256: "690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075",
    release_manifest_sha256: "1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84",
    accepted_evidence_sha256: null
  },
  source_sha256,
  package_sha256,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY"
};
const output = "config/s2-t321-chat-post-dice-release-candidate-seal.json";
const serialized = `${JSON.stringify(seal, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== serialized) throw new Error("STOP_S2_T321_SOURCE_DRIFT");
} else {
  writeFileSync(output, serialized);
}
console.log(`S2_T321_PACKAGE_SHA256 ${package_sha256}`);
