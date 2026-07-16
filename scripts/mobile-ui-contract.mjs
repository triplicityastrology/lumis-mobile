import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/mobile/App.tsx");
const screensPath = path.join(root, "apps/mobile/src/screens");
const appSource = await readFile(appPath, "utf8");
const paywallSource = extractFunction(appSource, "PlansAccessScreen", "BirthDetailsScreen");
const nonPaywallAppSource = appSource.replace(paywallSource, "");
const screenFiles = (await readdir(screensPath))
  .filter((name) => name.endsWith(".tsx") && !/profile|paywall/i.test(name))
  .map((name) => path.join(screensPath, name));

const scannedSurfaces = [
  { name: "App surfaces outside Paywall", source: nonPaywallAppSource },
  ...await Promise.all(screenFiles.map(async (file) => ({
    name: path.relative(root, file),
    source: await readFile(file, "utf8")
  })))
];

for (const surface of scannedSurfaces) {
  assertNoVisibleBilling(surface.source, surface.name);
}

assert.match(paywallSource, /credits/i, "Paywall must retain credit information");
assert.doesNotMatch(appSource, /accessibilityLabel="Credit estimate"/i);
assert.doesNotMatch(appSource, /test mode:\s*no charge/i);

console.log(`mobile UI contract checks passed across ${scannedSurfaces.length} non-billing surfaces`);

function extractFunction(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  assert.notEqual(start, -1, `${startName} must exist`);
  assert.notEqual(end, -1, `${endName} must exist after ${startName}`);
  return source.slice(start, end);
}

function assertNoVisibleBilling(source, surface) {
  const visibleBillingStrings = [...source.matchAll(
    /["'`]([^"'`\n]*(?:\bcredits?\b|\bbilling\b|test mode|no charge)[^"'`\n]*)["'`]/gi
  )].map((match) => match[1]);

  assert.deepEqual(
    visibleBillingStrings,
    [],
    `${surface} contains billing language outside Profile/Paywall: ${visibleBillingStrings.join(" | ")}`
  );
}
