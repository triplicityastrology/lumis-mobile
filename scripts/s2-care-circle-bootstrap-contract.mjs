import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const wrapper = readFileSync("scripts/run-s2-care-circle-bootstrap.zsh", "utf8");
const operator = readFileSync("scripts/s2-care-circle-two-account-operator.mjs", "utf8");
const library = readFileSync("scripts/lib/care-circle-two-account-operator.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

for (const required of [
  'PROJECT_REF="bmqhwofmdgebpcihjlnb"',
  "READY_FOR_QA_KEY",
  "s2-care-circle-bootstrap-descendant-authority.mjs",
  "approved_technical_ancestor",
  "stty -echo",
  "S2_T75_SECRET_KEY",
  "S2_T75_CAREE_EMAIL",
  "S2_T75_CARER_EMAIL",
  'ACTION" == "setup"',
  'ACTION" == "cleanup"',
  "qa_key_revocation=required_now",
  "temporary_credentials_unset=on_exit",
]) {
  assert.ok(wrapper.includes(required), `bootstrap omits ${required}`);
}
assert.match(operator, /verifyCapabilities/);
assert.match(operator, /account_modes_verified=2/);
assert.match(operator, /modes\.get\(careeId\) !== "standard"/);
assert.match(operator, /modes\.get\(carerId\) !== "carer_only"/);
assert.match(operator, /auth_accounts_remaining=0/);
assert.match(operator, /run_rows_remaining=0/);
assert.match(library, /AUTH_DISCOVERY_MAX_PAGES = 100/);
assert.match(library, /AUTH_PAGE_DUPLICATE/);
assert.match(library, /AUTH_SNAPSHOT_INCOMPLETE/);
assert.doesNotMatch(
  wrapper,
  /(?:>|>>)\s*(?!\/dev\/(?:tty|null)\b)[A-Za-z_.~]|tee |set -x|printenv|\.env|pbcopy/
);
assert.doesNotMatch(operator, /console\.(?:log|error)|error\.message|stack/);
assert.equal(
  packageJson.scripts["care-circle:bootstrap-two-account"],
  "zsh scripts/run-s2-care-circle-bootstrap.zsh"
);

const preflight = spawnSync(
  "zsh",
  ["scripts/run-s2-care-circle-bootstrap.zsh"],
  { cwd: process.cwd(), encoding: "utf8", env: { ...process.env } }
);
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /^READY_FOR_QA_KEY/m);
assert.match(preflight.stdout, /network_calls=0 credentials_requested=0 accounts_created=0/);
assert.match(preflight.stdout, /approved_technical_ancestor=[0-9a-f]{40}/);
assert.doesNotMatch(
  preflight.stdout + preflight.stderr,
  /@example|sb_secret_|password|https?:\/\//i
);

process.stdout.write(
  "S2-T103 two-account bootstrap contracts passed; READY_FOR_QA_KEY is inert.\n"
);
