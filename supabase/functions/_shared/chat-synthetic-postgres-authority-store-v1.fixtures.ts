import { strict as assert } from "node:assert";
import { createChatSyntheticPostgresAuthorityStore } from "./chat-synthetic-postgres-authority-store-v1.ts";

async function main() {
  const calls: Array<{ name: string; parameters: Readonly<Record<string, unknown>> }> = [];
  const store = createChatSyntheticPostgresAuthorityStore({
    async rpc(name, parameters) {
      calls.push({ name, parameters });
      return { data: "consumed", error: null };
    },
  });
  const outcome = await store.consumeFixture({
    authoritySha256: "a".repeat(64),
    reviewPackageSha256: "d".repeat(64),
    runId: "chat-syn-0123456789ab",
    fixtureId: "chat_en_small_decision_v1",
    idempotencyKey: "raw-idempotency-must-not-persist",
  });
  assert.equal(outcome, "consumed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "consume_chat_synthetic_fixture_v1");
  assert.match(String(calls[0].parameters.p_idempotency_sha256), /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(calls[0].parameters).includes("raw-idempotency-must-not-persist"), false);

  const malformed = createChatSyntheticPostgresAuthorityStore({
    async rpc() { return { data: { outcome: "consumed" }, error: null }; },
  });
  await assert.rejects(() => malformed.consumeAuthority({
    authoritySha256: "a".repeat(64), reviewPackageSha256: "d".repeat(64), runId: "chat-syn-0123456789ab",
    diceEvidenceSha256: "c".repeat(64), gatewaySourceSha256: "a".repeat(64), fixtureRegistrySha256: "b".repeat(64),
    validUntil: "2026-08-09T13:00:00.000Z",
  }), /CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE/);

  console.log("S2-T270 Postgres RPC authority store hashing and fail-closed fixtures passed");
}

main();
