import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const panel = readFileSync("apps/mobile/src/dev/QuotaVerificationPanel.tsx", "utf8");
const evidence = readFileSync("apps/mobile/src/dev/quotaVerification.ts", "utf8");
const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");

assert.match(app, /founderTestsAvailable && founderTestRoute === "quota"/);
assert.match(app, /loadSupabaseAccountState\(status\.user\.id\)/);
assert.match(app, /accountState\.successfulBirthDetailChanges/);
assert.match(app, /onReload=\{reloadQuotaEvidence\}/);
assert.match(panel, /Remaining allowance/);
assert.match(panel, /Consumed count/);
assert.match(panel, /Refresh status/);
assert.match(panel, /Source/);
assert.match(panel, /Existing values were not changed/);
assert.match(panel, /status === "refreshing"/);
assert.match(evidence, /bmqhwofmdgebpcihjlnb\.supabase\.co/);
assert.match(evidence, /Local demo · not authoritative staging/);
assert.match(hub, /Quota verification/);
assert.doesNotMatch(`${panel}\n${evidence}`, /\.update\s*\(|\.insert\s*\(|\.delete\s*\(|rpc\s*\(/);
assert.doesNotMatch(`${panel}\n${evidence}`, /user\.id|accountId|email|birth_date|birth_time/);

console.log("read-only Founder quota verification contract passed");
