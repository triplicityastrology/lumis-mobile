import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { collectBareModuleSpecifiers, validateMobileModuleSpecifiers } from "./lib/mobile-native-import-resolution.mjs";

const mobileRoot = path.resolve("apps/mobile");
const validSource = 'import { createElement } from "react";\n';
const missingSpecifier = "lucide-react-native/icons/s2-t112-synthetic-missing-icon";
const invalidSource = `${validSource}import Missing from "${missingSpecifier}";\n`;

assert.deepEqual(collectBareModuleSpecifiers(validSource), ["react"]);
assert.deepEqual(collectBareModuleSpecifiers(invalidSource), [missingSpecifier, "react"]);
assert.equal(validateMobileModuleSpecifiers({ source: validSource, mobileRoot }).ok, true);
const invalid = validateMobileModuleSpecifiers({ source: invalidSource, mobileRoot });
assert.equal(invalid.ok, false);
assert.equal(invalid.unresolvedCount, 1);
assert.deepEqual(invalid.unresolved, [missingSpecifier]);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:mobile-native-bundle-contract"],
  "node scripts/mobile-native-bundle-resolution-contract.mjs && node scripts/founder-mobile-readiness-doctor-contract.mjs"
);
assert.match(packageJson.scripts["test:all-local"], /test:mobile-native-bundle-contract/);
assert.equal(packageJson.scripts["verify:mobile-native-bundle"], "zsh scripts/run-mobile-native-bundle-smoke.zsh");

const runner = readFileSync("scripts/run-mobile-native-bundle-smoke.zsh", "utf8");
assert.match(runner, /expo export/);
assert.match(runner, /--platform ios/);
assert.match(runner, /--clear/);
assert.match(runner, /trap cleanup EXIT/);
assert.match(runner, /rm -rf -- "\$EXPORT_ROOT"/);
assert.doesNotMatch(runner, /expo start|--tunnel|curl|SUPABASE|TOKEN|PASSWORD/);

console.log("native mobile bundle resolution contract passed");
