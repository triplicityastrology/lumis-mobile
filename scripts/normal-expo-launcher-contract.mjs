import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [rootPackage, launcher] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("scripts/start-normal-expo.sh", "utf8")
]);

const packageJson = JSON.parse(rootPackage);

assert.equal(packageJson.scripts["start:normal-expo"], "bash scripts/start-normal-expo.sh");
assert.equal(
  packageJson.scripts["start:care-circle-founder"],
  "bash scripts/start-care-circle-founder-expo.sh"
);
assert.match(launcher, /LUMIS_EXPO_PORT:-8081/);
assert.match(launcher, /8081\|8082/);
assert.match(launcher, /lsof -tiTCP:/);
assert.match(launcher, /another process\/project/);
assert.match(launcher, /It was not stopped/);
assert.match(launcher, /git -C "\$ROOT" rev-parse --show-toplevel/);
assert.match(launcher, /status --porcelain --untracked-files=no/);
assert.match(launcher, /LUMIS_CURRENT_BUILD commit=%s branch=%s app=normal tracked_tree=clean/);
assert.match(launcher, /current Lumis source revision could not be verified/);
assert.match(launcher, /export EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="\$COMMIT"/);
assert.match(launcher, /exec pnpm --dir "\$MOBILE_DIR" exec expo start --tunnel --port "\$PORT" --clear/);
assert.match(launcher, /Care Circle workbench is not enabled by this command/);
assert.doesNotMatch(launcher, /test-workbenches|CARE_CIRCLE_STAGING_WORKBENCH|kill\s/);
assert.doesNotMatch(launcher, /SUPABASE|secret|token|password/i);

console.log("Normal Expo launcher contract passed.");
