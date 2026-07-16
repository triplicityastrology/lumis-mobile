import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8");
const homeSource = await readFile(
  new URL("../apps/mobile/src/screens/LumisHomeScreen.tsx", import.meta.url),
  "utf8"
);

const chatSource = extractFunction(appSource, "ChatShellScreen", "PastReflectionsScreen");
const reflectionsSource = extractFunction(appSource, "PastReflectionsScreen", "formatReflectionDate");
const paywallSource = extractFunction(appSource, "PlansAccessScreen", "BirthDetailsScreen");

assertNoVisibleBilling(chatSource, "Chat");
assertNoVisibleBilling(reflectionsSource, "Past Reflections");
assertNoVisibleBilling(homeSource, "Home");
assert.match(paywallSource, /credits/i, "Paywall must retain credit information");
assert.doesNotMatch(appSource, /accessibilityLabel="Credit estimate"/i);
assert.doesNotMatch(appSource, /test mode:\s*no charge/i);

console.log("mobile UI contract checks passed");

function extractFunction(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  assert.notEqual(start, -1, `${startName} must exist`);
  assert.notEqual(end, -1, `${endName} must exist after ${startName}`);
  return source.slice(start, end);
}

function assertNoVisibleBilling(source, surface) {
  assert.doesNotMatch(source, /(?:Estimated|left|available)[^`<\n]*credits?/i, `${surface} must not display credits`);
  assert.doesNotMatch(source, /test mode|no charge/i, `${surface} must not display test billing state`);
  assert.doesNotMatch(source, /accessibilityLabel="Credit estimate"/i, `${surface} must not expose a credit estimate`);
}
