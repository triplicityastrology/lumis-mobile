// Optional Regression panel tests — the 12 frozen synthetic fixtures.
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-regression.fixtures.js
//
// Proves: the 12 fixtures are still present (6 EN / 6 zh-Hant); a fixture runs through the SAME
// authorized Azure path as free text; unknown/malformed fixture requests are rejected; and the
// regression path is NOT required before free text and imposes no limit (it is authorized by the
// same identity + kill switch, independently of the conversation path).

import test from "node:test";
import { strict as assert } from "node:assert";
import { handleRegressionFixture, listRegressionFixtures, REGRESSION_REQUEST_SCHEMA } from "../src/lab-regression.ts";
import { mintIdentityReceipt, verifyIdentityReceipt, type RuntimeIdentity } from "../src/lab-identity.ts";
import { LIVE_FIXTURE_IDS, LIVE_FIXTURE_COUNT, liveLanguageCounts } from "../src/lab-live-registry.ts";

const SECRET = "SECRET_SENTINEL_KEY_DO_NOT_LEAK";
const enabledEnv = { LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: SECRET };
const CLEAN: RuntimeIdentity = { commit: "c0ffee".padEnd(40, "0"), tree: "tree01".padEnd(40, "0"), clean: true, packageChecksum: "pkg-1" };
const goodIdentity = () => verifyIdentityReceipt(mintIdentityReceipt(CLEAN), CLEAN);

function spyFetch(reply = "Frozen fixture response.") {
  const calls: string[] = [];
  const fn = (async (url: unknown) => { calls.push(String(url)); return new Response(JSON.stringify({ output_text: reply }), { status: 200 }); }) as unknown as typeof fetch;
  return { fn, calls };
}
const regReq = (fixture_id: string) => ({ schema_version: REGRESSION_REQUEST_SCHEMA, fixture_id });

test("the 12 frozen fixtures are still present (6 EN / 6 zh-Hant)", () => {
  assert.equal(LIVE_FIXTURE_COUNT, 12);
  assert.equal(listRegressionFixtures().length, 12);
  const counts = liveLanguageCounts();
  assert.equal(counts.en, 6);
  assert.equal(counts["zh-Hant"], 6);
  // The UI listing is non-secret: id/language/slug/preview only, never a key.
  for (const f of listRegressionFixtures()) {
    assert.ok(f.id && f.language && f.slug);
    assert.equal(JSON.stringify(f).includes(SECRET), false);
  }
});

test("an authorized fixture runs through the same Azure path and is flagged as regression", async () => {
  const spy = spyFetch();
  const out = await handleRegressionFixture(regReq(LIVE_FIXTURE_IDS[0]), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(out.status, 200);
  assert.equal(b.regression, true);
  assert.equal(b.regression_fixture_id, LIVE_FIXTURE_IDS[0]);
  assert.equal(b.provider_authorized, true);
  assert.ok(b.product_classification, "regression result carries a product classification too");
  assert.ok(spy.calls.length >= 1, "the authorized fixture reached the provider");
  assert.equal(b.units_charged, 0);
  assert.equal(b.persistence, "not_committed");
});

test("under the kill switch, a fixture makes zero provider calls", async () => {
  const spy = spyFetch();
  const out = await handleRegressionFixture(regReq(LIVE_FIXTURE_IDS[0]), { environment: { ...enabledEnv, LUMIS_AI_ENABLED: "false" }, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(b.provider_authorized, false);
  assert.equal(b.provider_authorization_reason, "LAB_AI_KILL_SWITCH");
  assert.equal(spy.calls.length, 0);
});

test("unknown / malformed fixture requests are rejected before any provider access", async () => {
  const spy = spyFetch();
  const bad: unknown[] = [
    { schema_version: REGRESSION_REQUEST_SCHEMA, fixture_id: "not-a-real-fixture" },
    { schema_version: "wrong", fixture_id: LIVE_FIXTURE_IDS[0] },
    { schema_version: REGRESSION_REQUEST_SCHEMA, fixture_id: LIVE_FIXTURE_IDS[0], extra: 1 },
    { schema_version: REGRESSION_REQUEST_SCHEMA },
    null,
  ];
  for (const raw of bad) {
    const out = await handleRegressionFixture(raw, { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
    assert.equal(out.status, 400, `${JSON.stringify(raw)?.slice(0, 40)} rejected`);
  }
  assert.equal(spy.calls.length, 0, "no provider access for malformed/unknown fixture requests");
});
