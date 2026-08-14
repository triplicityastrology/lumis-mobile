import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const path = "config/founder-live-chat-candidate.json";
const control = JSON.parse(readFileSync(path, "utf8"));
const sourcePaths = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/services/founderLiveChat.ts",
  "apps/mobile/src/services/founderLiveChat.fixtures.ts",
  "apps/mobile/src/types/env.d.ts",
  "apps/mobile/tsconfig.founder-live-chat-test.json",
  "supabase/functions/_shared/founder-chat-window-v1.ts",
  "supabase/functions/_shared/founder-chat-window-v1.fixtures.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/functions/tsconfig.founder-chat-window-test.json",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/chat-synthetic/edge-handler-v1.fixtures.ts",
  "supabase/functions/chat-synthetic/deno.json",
  "supabase/functions/chat-synthetic/node-test.d.ts",
  "supabase/functions/tsconfig.chat-synthetic-edge-v1-test.json",
  "supabase/tests/founder-chat-synthetic-window-authorization-v1.schema.json",
  "scripts/start-founder-live-chat.sh",
  "scripts/t350-chat-readiness.mjs",
  "scripts/run-founder-live-chat-tests.sh",
  "scripts/founder-live-chat-contract.mjs",
  "scripts/refresh-founder-live-chat-seal.mjs",
  "docs/architecture/Founder-live-normal-chat-candidate.md",
  "package.json",
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const source = Object.fromEntries(sourcePaths.map((file) => [file, sha(readFileSync(file))]));
const packageSha = sha(JSON.stringify(source));
if (process.argv.includes("--check")) {
  if (JSON.stringify(control.source) !== JSON.stringify(source) || control.package_sha256 !== packageSha) {
    throw new Error("FOUNDER_LIVE_CHAT_SEAL_DRIFT");
  }
  console.log("FOUNDER_LIVE_CHAT_SEAL_OK");
} else {
  control.source = source;
  control.package_sha256 = packageSha;
  writeFileSync(path, `${JSON.stringify(control, null, 2)}\n`);
  console.log(`FOUNDER_LIVE_CHAT_SEAL_REFRESHED ${packageSha}`);
}
