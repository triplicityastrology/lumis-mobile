import { strict as assert } from "node:assert";
import {
  CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN,
  createChatSyntheticPostgresAuthorityStore,
  readChatSyntheticAuthorityStoreConfig
} from "./chat-synthetic-postgres-authority-store-v1.ts";

async function main() {
  assert.equal(readChatSyntheticAuthorityStoreConfig({}).ok, false);
  assert.equal(readChatSyntheticAuthorityStoreConfig({ SUPABASE_URL: "https://evil.example", SUPABASE_SERVICE_ROLE_KEY: "fixture" }).ok, false);
  const parsed = readChatSyntheticAuthorityStoreConfig({
    SUPABASE_URL: CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN,
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role"
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("fixture config unavailable");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = createChatSyntheticPostgresAuthorityStore(parsed.config, async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify("consumed"), { status: 200, headers: { "content-type": "application/json" } });
  });
  const outcome = await store.consumeFixture({
    authoritySha256: "a".repeat(64),
    reviewPackageSha256: "d".repeat(64),
    runId: "chat-syn-0123456789ab",
    fixtureId: "chat_en_small_decision_v1",
    idempotencyKey: "raw-idempotency-must-not-persist"
  });
  assert.equal(outcome, "consumed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${CHAT_SYNTHETIC_APPROVED_SUPABASE_ORIGIN}/rest/v1/rpc/consume_chat_synthetic_fixture_v1`);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer fixture-service-role");
  assert.equal(headers.apikey, "fixture-service-role");
  const body = JSON.parse(String(calls[0].init?.body));
  assert.match(body.p_idempotency_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(body).includes("raw-idempotency-must-not-persist"), false);

  const malformed = createChatSyntheticPostgresAuthorityStore(parsed.config, async () => new Response(JSON.stringify({ outcome: "consumed" }), { status: 200 }));
  await assert.rejects(() => malformed.consumeAuthority({
    authoritySha256: "a".repeat(64), reviewPackageSha256: "d".repeat(64), runId: "chat-syn-0123456789ab",
    diceEvidenceSha256: "c".repeat(64), gatewaySourceSha256: "a".repeat(64), fixtureRegistrySha256: "b".repeat(64),
    validUntil: "2026-08-09T13:00:00.000Z"
  }), /CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE/);

  console.log("S2-T260 Postgres authority store hashing and fail-closed fixtures passed");
}

main();
