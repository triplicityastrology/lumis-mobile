import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const runbookPath =
  "docs/qa/S2-T12-language-aware-chat-staging-deployment-readiness.md";
const runbook = readFileSync(runbookPath, "utf8");

const reviewedSources = new Map([
  [
    "supabase/migrations/0035_app_language_preference.sql",
    "93c6c9e7bc3a1d912a9c2979af9678a05a8f397423d0613c98a1f50948316747",
  ],
  [
    "packages/shared/src/config/app-language.ts",
    "2264cdcf025d2b21b39e3410adab16440360319b3609847bf0204d0de960e1c5",
  ],
  [
    "packages/shared/src/config/chat-router.ts",
    "6e1fd4728c71adeb99434cf1a4987d98aaf0ac7d41a2604f49d62db711bf9a82",
  ],
  [
    "supabase/functions/chat-message/index.ts",
    "73a7df7042c4b8400996092ebbc7fb9a67eb24c3185fd812918b4887a56cd7ad",
  ],
  [
    "apps/mobile/src/services/accountState.ts",
    "9d4dd1de3add3f4a938ccb99973347a7433fdf37d9bbab9d536c7ad2ee4b6ef6",
  ],
]);

for (const [path, expectedDigest] of reviewedSources) {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(digest, expectedDigest, `reviewed source drifted: ${path}`);
  assert.match(runbook, new RegExp(expectedDigest));
}

assert.match(runbook, /bmqhwofmdgebpcihjlnb/g);
assert.match(
  runbook,
  /0035_app_language_preference\.sql[\s\S]*before[\s\S]*chat-message/i
);
assert.match(runbook, /Migration `0035` is forward-only/i);
assert.match(runbook, /post-S2-T10 reviewed function source/i);
assert.match(
  runbook,
  /Persisted app preference[\s\S]*request-language detection is the fallback/i
);
assert.match(runbook, /anonymous[\s\S]*cross-user/i);
assert.match(runbook, /no generated translation/i);
assert.match(runbook, /names-only/i);
assert.match(runbook, /No Azure, OpenAI, model, or translation provider/i);
assert.match(runbook, /does not authorise or execute deployment/i);
assert.doesNotMatch(runbook, /--no-verify-jwt/i);
assert.doesNotMatch(runbook, /supabase secrets set/i);
assert.doesNotMatch(runbook, /curl[\s\S]*Authorization:/i);
assert.doesNotMatch(runbook, /access_token|refresh_token|service_role|sb_secret_/i);

const migrationPosition = runbook.indexOf("Apply migration `0035`");
const functionPosition = runbook.indexOf("Deploy `chat-message`");
assert.ok(migrationPosition >= 0 && functionPosition > migrationPosition);

console.log("language-aware Chat staging readiness contracts passed");
