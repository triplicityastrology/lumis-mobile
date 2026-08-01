import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const launcher = readFileSync("scripts/start-care-circle-two-account-workbench.sh", "utf8");
const validator = "scripts/s2-care-circle-two-account-evidence-validator.mjs";
const validPath = "supabase/tests/s2-t72-two-account-evidence.valid.json";
const root = mkdtempSync(path.join(tmpdir(), "s2-t72-"));

try {
  assert.match(launcher, /bmqhwofmdgebpcihjlnb/);
  assert.match(launcher, /https:\/\/bmqhwofmdgebpcihjlnb\.supabase\.co/);
  assert.match(launcher, /0032,0033,0034,care-circle/);
  assert.match(launcher, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1/);
  assert.match(launcher, /--tunnel --port "\$PORT" --clear/);
  assert.match(launcher, /lsof -tiTCP:/);
  assert.match(launcher, /PORT_OWNED_BY_ANOTHER_PROJECT/);
  assert.doesNotMatch(launcher, /\bkill\b|normal-expo|apps\/mobile\/App\.tsx/);
  assert.match(launcher, /create code -> pending\/no authority -> Caree accept -> active -> pause\/resume -> remove/);
  assert.match(launcher, /deletes exactly two disposable accounts/);

  const passed = run(validPath);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stdout, "S2_T72_TWO_ACCOUNT_EVIDENCE_PASS\n");
  const unsafe = JSON.parse(readFileSync(validPath, "utf8"));
  unsafe.user_id = "not-allowed";
  const unsafePath = path.join(root, "unsafe.json");
  writeFileSync(unsafePath, JSON.stringify(unsafe));
  const rejected = run(unsafePath);
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, "");
  assert.equal(rejected.stderr, "STOP_S2_T72_FIELD_SHAPE_INVALID\n");
  assert.doesNotMatch(rejected.stderr, /not-allowed|stack|Error|at file:/i);

  console.log("S2-T72 two-account launch and evidence contract passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}

function run(file) {
  return spawnSync(process.execPath, [validator, file], { encoding: "utf8" });
}
