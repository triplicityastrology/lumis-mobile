import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const seal = spawnSync(process.execPath, ["scripts/s2-care-circle-four-digit-seal.mjs", "--check"], { encoding: "utf8" });
assert.equal(seal.status, 0, seal.stderr);
const manifest = JSON.parse(readFileSync("supabase/tests/s2-t146-care-circle-four-digit-parity-seal.json", "utf8"));
for (const required of ["supabase/functions/care-circle/index.ts", "supabase/functions/care-circle/operation-boundary.ts", "supabase/functions/_shared/cors.ts"]) {
  assert.ok(manifest.locked_sources.some(({ path }) => path === required), `seal omits ${required}`);
}
const edge = readFileSync("supabase/functions/care-circle/index.ts", "utf8");
const runner = readFileSync("supabase/functions/care-circle/local-edge-contract-runner.ts", "utf8");
for (const marker of ["userClient.auth.getUser()", "p_actor_user_id: actorUserId", "register_care_pairing_attempt_backend", "fingerprintPairingCode", "mapRpcError"]) assert.ok(edge.includes(marker));
assert.match(runner, /validateCareCircleRequest/);
assert.match(runner, /projectSafeCareCircleResponse/);
assert.doesNotMatch(runner, /fetch\(|https?:\/\/|createClient|Deno\.env|console\./u);
assert.doesNotMatch(edge, /console\.(?:log|error|warn)|JSON\.stringify\(body\)/u);
console.log("S2-T149 sealed local Edge runner source contract passed; network calls=0.");
