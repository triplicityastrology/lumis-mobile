import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const readiness = spawnSync(process.execPath, ["scripts/s2-t276-chat-readiness.mjs"], { encoding: "utf8" });
assert.equal(readiness.status, 0);
assert.equal(readiness.stdout.trim(), "OBTAIN_MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");

const execute = spawnSync("zsh", ["scripts/run-s2-t276-chat-deployment.zsh", "--execute"], {
  encoding: "utf8",
  env: { PATH: process.env.PATH, HOME: process.env.HOME },
});
assert.equal(execute.status, 2);
assert.equal(execute.stdout.trim(), "STOP_S2_T276_MICROSOFT_DEFAULT_OFF_AUTHORIZATION_REQUIRED");
const source = readFileSync("scripts/run-s2-t276-chat-deployment.zsh", "utf8");
assert.ok(source.indexOf("--validate-deployment-authorization") < source.indexOf("LUMIS_CHAT_REMOTE_EXECUTION_APPROVED"));
assert.doesNotMatch(source, /supabase functions deploy|supabase db push|curl .*https|AZURE.*KEY/);
console.log("S2_T276_CHAT_OPERATOR_FAIL_CLOSED_OK remote_commands=0 credential_reads=0");
