#!/usr/bin/env node
import { createReviewPacket } from "./lib/s2-t292-dice-v4-decision-packet.mjs";
import { NEXT_DECISION, sha256, verifyOfflinePreflight, T298Stop } from "./lib/s2-t298-dice-v4-zero-call.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));

try {
  if (!/^dice-auth-request-[a-z0-9]{16,40}$/u.test(args["request-id"] ?? "") || !/^[a-f0-9]{64}$/u.test(args["signing-key-sha256"] ?? "")) throw new T298Stop("STOP_S2_T298_SEPARATE_AUTHORIZATION_REQUIRED");
  const ready = await verifyOfflinePreflight();
  const t292 = await createReviewPacket({ requestId: args["request-id"], signingKeySha256: args["signing-key-sha256"] });
  const packet = {
    schema: "s2_t298_dice_v4_zero_call_review_request_v1",
    decision_requested: NEXT_DECISION,
    authorization_scope: ready.control.authorization_scope,
    source_commit: ready.identity.source_commit,
    source_tree: ready.identity.source_tree,
    runtime_package_sha256: ready.control.runtime_package_sha256,
    authorization_package_sha256: ready.control.authorization_package_sha256,
    authorization_request: t292.authorization_request,
    configuration_names: ready.control.configuration_names,
    expected_disabled_probes: Object.fromEntries(ready.control.disabled_probes.map((name) => [name, ready.control.expected_disabled_result])),
    post_deploy_requirements: ready.control.post_deploy,
    rollback_target: ready.control.rollback_target,
    migration_0039_authorized: false,
    normal_chat_authority: ready.control.normal_chat_authority,
    azure_traffic_authority: ready.control.azure_traffic_authority,
  };
  process.stdout.write(`${JSON.stringify({ ...packet, packet_sha256: sha256(`${JSON.stringify(packet)}\n`) }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof T298Stop ? error.code : "STOP_S2_T298_REVIEW_REQUEST_UNSAFE"}\n`);
  process.exitCode = 1;
}
