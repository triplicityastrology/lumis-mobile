import assert from "node:assert/strict";

import {
  CHAT_RELEASE_CANDIDATE_ENABLED,
  CHAT_RELEASE_TRAFFIC_ENABLED,
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  buildChatReleaseCandidateRequest,
  invokeChatReleaseCandidate,
} from "./chatReleaseCandidate";

assert.equal(CHAT_RELEASE_CANDIDATE_ENABLED, false);
assert.equal(CHAT_RELEASE_TRAFFIC_ENABLED, false);
assert.equal(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(NO_AZURE_TRAFFIC_AUTHORITY, "NO_AZURE_TRAFFIC_AUTHORITY");

for (const fixture_id of ["chat-en-reflection-01", "chat-zh-hant-reflection-01"] as const) {
  assert.deepEqual(buildChatReleaseCandidateRequest({ fixture_id }), {
    schema_version: "chat_release_candidate_mobile_v1",
    fixture_id,
  });
}
for (const hostile of [
  {},
  { fixture_id: "chat-en-reflection-01", message: "private text" },
  { fixture_id: "unknown" },
  { message: "free form" },
  { fixture_id: "chat-en-reflection-01", endpoint: "https://example.invalid" },
]) {
  assert.throws(() => buildChatReleaseCandidateRequest(hostile));
}

async function main(): Promise<void> {
  let transportConstructions = 0;
  await assert.rejects(
    invokeChatReleaseCandidate(
      buildChatReleaseCandidateRequest({ fixture_id: "chat-en-reflection-01" }),
      () => {
        transportConstructions += 1;
        return { invoke: async () => ({}) };
      },
    ),
    /CHAT_RELEASE_CANDIDATE_DISABLED/,
  );
  assert.equal(transportConstructions, 0);
  console.log("S2_T311_CHAT_RELEASE_MOBILE_FIXTURES_OK");
}

void main();
