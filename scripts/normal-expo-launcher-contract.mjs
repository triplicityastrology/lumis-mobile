import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [rootPackage, launcher] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("scripts/start-normal-expo.sh", "utf8")
]);

const packageJson = JSON.parse(rootPackage);

assert.equal(packageJson.scripts["start:normal-expo"], "bash scripts/start-normal-expo.sh");
assert.match(launcher, /LUMIS_EXPO_PORT:-8081/);
assert.match(launcher, /8081\|8082/);
assert.match(launcher, /lsof -tiTCP:/);
assert.match(launcher, /another process\/project/);
assert.match(launcher, /It was not stopped/);
assert.match(launcher, /exec pnpm --dir "\$MOBILE_DIR" exec expo start --tunnel --port "\$PORT" --clear/);
assert.match(launcher, /Care Circle workbench is not enabled by this command/);
assert.doesNotMatch(launcher, /test-workbenches|CARE_CIRCLE_STAGING_WORKBENCH|kill\s/);

console.log("Normal Expo launcher contract passed.");
