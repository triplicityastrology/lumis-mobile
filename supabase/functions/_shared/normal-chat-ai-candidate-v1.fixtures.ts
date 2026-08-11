import assert from "node:assert/strict";

import {
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  exerciseAuthorizedCoreForOfflineProof,
  handleNormalChatAiCandidate,
  validateFinalAcceptedDiceEvidence,
  type AtomicCommit,
  type NormalChatCandidateDependencies,
  type NormalChatProviderClient,
} from "./normal-chat-ai-candidate-v1.ts";

const clientTurnId = "123e4567-e89b-42d3-a456-426614174000";
const threadId = "89abcdef-0123-4567-89ab-0123456789ab";
const request = Object.freeze({
  schema_version: "normal_chat_mobile_request_v1" as const,
  client_turn_id: clientTurnId,
  message: "A synthetic reflection question.",
  thread_intent: Object.freeze({ mode: "new" as const }),
});

async function main() {

function makeDependencies(input: Readonly<{
  provider?: readonly Awaited<ReturnType<NormalChatProviderClient["complete"]>>[];
  policy?: "allowed" | "safety";
  replay?: AtomicCommit | null;
  commit?: AtomicCommit | null;
  authenticated?: boolean;
  activeProfile?: boolean;
}> = {}) {
  let providerConstructions = 0;
  let providerCalls = 0;
  let authCalls = 0;
  let profileCalls = 0;
  let replayCalls = 0;
  let commitCalls = 0;
  const metadata: unknown[] = [];
  const provider = input.provider ?? [{ kind: "completed", assistantMessage: "A safe synthetic reflection." }];
  const dependencies = {
    control: Object.freeze({ integrationEnabled: true, trafficEnabled: true, acceptedDiceEvidenceSha256: "a".repeat(64), acceptedChatAuthoritySha256: "b".repeat(64) }),
    diceEvidence: {},
    independentlyComputedDiceEvidenceSha256: "a".repeat(64),
    async resolveAuthenticatedActor() { authCalls += 1; return input.authenticated === false ? null : { actorId: "internal-actor" }; },
    async hasActiveProfile() { profileCalls += 1; return input.activeProfile !== false; },
    inspectPolicy() { return input.policy === "safety" ? { kind: "safety" as const } : { kind: "allowed" as const, unitsToCharge: 1 }; },
    async findCommittedReplay() { replayCalls += 1; return input.replay ?? null; },
    createProviderClient() {
      providerConstructions += 1;
      return {
        async complete() {
          const result = provider[Math.min(providerCalls, provider.length - 1)];
          providerCalls += 1;
          return result;
        },
      };
    },
    async commitAtomicSuccess() {
      commitCalls += 1;
      return input.commit === undefined
        ? { threadId, assistantMessage: "A safe synthetic reflection.", unitsCharged: 1, state: "committed" as const }
        : input.commit;
    },
    nextRequestId() { return "request_12345678"; },
    nowMs() { return 1_000; },
    recordMetadata(value: unknown) { metadata.push(value); },
  } satisfies NormalChatCandidateDependencies;
  return {
    dependencies,
    coreDependencies: dependencies,
    counts: () => ({ providerConstructions, providerCalls, authCalls, profileCalls, replayCalls, commitCalls, metadata: metadata.length }),
  };
}

{
  const fixture = makeDependencies();
  const response = await handleNormalChatAiCandidate({ ...request, provider_endpoint: "forbidden" }, fixture.dependencies);
  assert.equal(response.result, "technical_error");
  assert.equal(response.error_code, "NORMAL_CHAT_AI_DISABLED");
  assert.deepEqual(fixture.counts(), { providerConstructions: 0, providerCalls: 0, authCalls: 0, profileCalls: 0, replayCalls: 0, commitCalls: 0, metadata: 1 });
  assert.equal("assistant_message" in response, false);
  assert.equal(response.units_charged, 0);
  assert.equal(response.persistence, "not_committed");
}

assert.equal(validateFinalAcceptedDiceEvidence({}, "a".repeat(64), "a".repeat(64)), false);

{
  const fixture = makeDependencies();
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "completed");
  assert.equal(response.thread_id, threadId);
  assert.equal(response.persistence, "committed");
  assert.equal(response.units_charged, 1);
  assert.deepEqual(response.atomic_outcome, { user_message: "committed", assistant_message: "committed", unit_ledger: "committed", idempotency_outcome: "committed" });
  assert.deepEqual(fixture.counts(), { providerConstructions: 1, providerCalls: 1, authCalls: 1, profileCalls: 1, replayCalls: 1, commitCalls: 1, metadata: 1 });
}

{
  const replay: AtomicCommit = { threadId, assistantMessage: "Stored reply.", unitsCharged: 1, state: "replayed" };
  const fixture = makeDependencies({ replay });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "duplicate");
  assert.equal(response.units_charged, 0);
  assert.equal(fixture.counts().providerConstructions, 0);
  assert.equal(fixture.counts().commitCalls, 0);
}

{
  const fixture = makeDependencies({ policy: "safety" });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "safety_rejected");
  assert.equal(response.assistant_message, T240_SAFETY_REDIRECT);
  assert.equal(fixture.counts().providerConstructions, 0);
  assert.equal(fixture.counts().commitCalls, 0);
  assert.equal(response.units_charged, 0);
}

{
  const fixture = makeDependencies({ provider: [{ kind: "content_filter_partial" }] });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "safety_rejected");
  assert.equal(response.assistant_message, T240_SAFETY_REDIRECT);
  assert.equal(fixture.counts().commitCalls, 0);
}

{
  const fixture = makeDependencies({ provider: [{ kind: "timeout" }, { kind: "server_error" }] });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "fixed_fallback");
  assert.equal(response.assistant_message, T240_FIXED_FALLBACK);
  assert.equal(fixture.counts().providerCalls, 2);
  assert.equal(fixture.counts().commitCalls, 0);
  assert.equal(response.units_charged, 0);
}

{
  const fixture = makeDependencies({ provider: [{ kind: "unauthorized" }] });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "technical_error");
  assert.equal("assistant_message" in response, false);
  assert.equal(fixture.counts().providerCalls, 1);
}

{
  const fixture = makeDependencies({ commit: null });
  const response = await exerciseAuthorizedCoreForOfflineProof(request, fixture.coreDependencies);
  assert.equal(response.result, "technical_error");
  assert.equal(response.error_code, "NORMAL_CHAT_ATOMIC_COMMIT_FAILED");
  assert.equal(response.persistence, "not_committed");
  assert.equal(response.units_charged, 0);
}

{
  const fixture = makeDependencies();
  const invalid = await exerciseAuthorizedCoreForOfflineProof({ ...request, raw_prompt: "forbidden" }, fixture.coreDependencies);
  assert.equal(invalid.result, "technical_error");
  assert.equal(fixture.counts().providerConstructions, 0);
}

assert.equal(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(NO_AZURE_TRAFFIC_AUTHORITY, "NO_AZURE_TRAFFIC_AUTHORITY");
console.log("S2_T306_SERVER_CANDIDATE_FIXTURES_OK");
}

void main();
