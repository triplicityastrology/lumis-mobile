import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");
const journey = readFileSync("apps/mobile/src/dev/FounderReflectionDeletionPanel.tsx", "utf8");
const state = readFileSync("apps/mobile/src/dev/founderReflectionDeletionJourney.ts", "utf8");
assert.match(app, /founderTestsAvailable && founderTestRoute === "reflectionDeletion"/);
assert.match(hub, /Local demo · gated signed-in staging mode/);
assert.match(journey, /Signed-in deletion is Not Ready until migration 0036 is authorised and applied remotely/);
assert.match(journey, /Lumis could not delete this reflection\. It remains saved\. Retry or cancel\./);
assert.match(journey, /Delete Past Reflection\?/);
assert.match(state, /failurePending: true/);
assert.match(state, /requestId: DELETION_REQUEST_ID/);
assert.doesNotMatch(`${journey}\n${state}`, /supabase|fetch\s*\(|rpc\s*\(|SecureStore|AsyncStorage|email|accountId|userId/i);
console.log("Founder reflection deletion journey contract passed.");
