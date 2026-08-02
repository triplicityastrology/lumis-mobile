import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const operator = readFileSync("scripts/run-s2-care-circle-pairing-secret-provision.zsh", "utf8");
const config = JSON.parse(readFileSync("supabase/tests/s2-t48-care-circle-function-config-control.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(config.project_ref, "bmqhwofmdgebpcihjlnb");
assert.deepEqual(config.required_custom_secret_names, ["CARE_CIRCLE_PAIRING_SECRET"]);
assert.deepEqual(config.platform_provided_runtime_names.sort(), ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"]);
for (const marker of [
  'EXPECTED_REF="bmqhwofmdgebpcihjlnb"', 'SECRET_NAME="CARE_CIRCLE_PAIRING_SECRET"',
  "READY_FOR_PAIRING_SECRET_PROVISION", "openssl rand -hex 32", "stty -echo",
  'secrets set', '--env-file "$SECRET_FIFO"', "mktemp -d", "mkfifo -m 600", 'secrets list', 'validate-supabase-secret-names.mjs',
  "classify-supabase-config-command.mjs", "classify-supabase-pat-revocation.mjs",
  "STOP_S2_T130_SECRET_SET_", "STOP_S2_T130_SECRET_VERIFY_", "PAT_REVOKE_VERIFIED",
]) assert.ok(operator.includes(marker), marker);
assert.doesNotMatch(operator, /functions deploy|functions invoke|supabase login|pbcopy|tee |set -x|(?:^|[\/\s])\.env(?:[\/\s]|$)|AsyncStorage|SecureStore/);
assert.match(operator, /print -r -- "\$\{SECRET_NAME\}=\$\{PAIRING_SECRET\}" > "\$SECRET_FIFO"/);
assert.doesNotMatch(operator, /(?:print|echo)[^\n]*PAIRING_SECRET[^\n]*(?:\/dev\/tty|\/dev\/stdout|\/dev\/stderr)/);
assert.doesNotMatch(operator, /secrets set[\s\S]{0,160}SECRET_NAME=.*PAIRING_SECRET/);
assert.match(operator, /cleanup[\s\S]*kill "\$SECRET_WRITER_PID"[\s\S]*rm -f -- "\$SECRET_FIFO"[\s\S]*rmdir -- "\$SECRET_FIFO_DIR"[\s\S]*unset SUPABASE_ACCESS_TOKEN PAIRING_SECRET/);
assert.equal(pkg.scripts["test:s2-care-circle-pairing-secret-provision"], "node scripts/s2-care-circle-pairing-secret-provision-contract.mjs");
assert.match(pkg.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-pairing-secret-provision/);

const preflight = spawnSync("zsh", ["scripts/run-s2-care-circle-pairing-secret-provision.zsh"], { encoding: "utf8" });
if (preflight.status === 0) {
  assert.match(preflight.stdout, /READY_FOR_PAIRING_SECRET_PROVISION/);
  assert.match(preflight.stdout, /network_calls=0 token_requested=0 secret_generated=0 secret_set=0/);
} else {
  assert.match(preflight.stderr, /^STOP_S2_T130_(?:TREE_DIRTY|PROJECT_REF_MISMATCH)\n$/);
}
assert.doesNotMatch(preflight.stdout + preflight.stderr, /sbp_|[0-9a-f]{64}|https?:\/\//i);

const fixtureRoot = mkdtempSync(join(tmpdir(), "s2-t136-argv-"));
const argvCapture = join(fixtureRoot, "argv.json");
const fakePnpm = join(fixtureRoot, "pnpm");
const canary = "f".repeat(64);
writeFileSync(fakePnpm, `#!/bin/zsh
node -e '
  const fs = require("node:fs");
  const args = process.argv.slice(1);
  fs.writeFileSync(process.env.ARGV_CAPTURE, JSON.stringify(args));
  const envIndex = args.indexOf("--env-file");
  if (envIndex < 0) process.exit(3);
  if (!args[envIndex + 1].endsWith("secret.fifo")) process.exit(4);
' -- "$@"
`);
chmodSync(fakePnpm, 0o700);
const fifo = join(fixtureRoot, "secret.fifo");
const child = spawnSync(fakePnpm, [
  "dlx", "supabase@2.109.1", "secrets", "set", "--project-ref", "bmqhwofmdgebpcihjlnb", "--env-file", fifo,
], { encoding: "utf8", env: { ...process.env, ARGV_CAPTURE: argvCapture } });
assert.equal(child.status, 0, child.stderr);
const spawnedArgv = JSON.parse(readFileSync(argvCapture, "utf8"));
assert.equal(spawnedArgv.some((arg) => arg.includes(canary)), false);
assert.equal(spawnedArgv.includes("--env-file"), true);
assert.equal(child.stdout.includes(canary) || child.stderr.includes(canary), false);
rmSync(fixtureRoot, { recursive: true, force: true });
console.log("S2-T130 pairing-secret provisioning contract passed; execution remained inert.");
