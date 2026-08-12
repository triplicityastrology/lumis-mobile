import {
  handleChatProductPathCandidate,
} from "./chat-product-path-candidate-v1.ts";
import type { ChatPostDiceDependencies } from "./chat-post-dice-release-candidate-v1.ts";

export const CHAT_AFTER_DICE_SERVER_VERSION = "s2_t331_chat_after_dice_root_server_v1" as const;
export const CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED = false as const;
export const CHAT_AFTER_DICE_SERVER_SYNTHETIC_TRAFFIC_ENABLED = false as const;

export type ChatAfterDiceServerControls = Readonly<{
  acceptedCorrectedDiceEvidenceSha256: string | null;
  acceptedDefaultOffDeploymentReceiptSha256: string | null;
  acceptedSyntheticTrafficReceiptSha256: string | null;
}>;

export type ChatAfterDiceServerDependencies = Readonly<{
  controls: ChatAfterDiceServerControls;
  correctedDiceEvidence: unknown;
  defaultOffDeploymentReceipt: unknown;
  syntheticTrafficReceipt: unknown;
  sha256Canonical(value: unknown): string;
  productPath: ChatPostDiceDependencies;
}>;

export async function handleChatAfterDiceRoot(
  rawRequest: unknown,
  dependencies: ChatAfterDiceServerDependencies,
) {
  // These source gates precede evidence reads, request parsing, actor/member
  // resolution, persistence, billing, provider construction, and telemetry.
  if (
    !CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED ||
    !CHAT_AFTER_DICE_SERVER_SYNTHETIC_TRAFFIC_ENABLED
  ) return disabledResponse();

  /* c8 ignore start -- later reviewed source activation is required */
  if (!validateT331Authorities(dependencies)) return disabledResponse();
  return handleChatProductPathCandidate(rawRequest, dependencies.productPath);
  /* c8 ignore stop */
}

export function validateT331Authorities(dependencies: ChatAfterDiceServerDependencies): boolean {
  const entries = [
    [dependencies.correctedDiceEvidence, dependencies.controls.acceptedCorrectedDiceEvidenceSha256, "s2_t331_corrected_dice_evidence_acceptance_v1"],
    [dependencies.defaultOffDeploymentReceipt, dependencies.controls.acceptedDefaultOffDeploymentReceiptSha256, "s2_t331_chat_default_off_deployment_receipt_v1"],
    [dependencies.syntheticTrafficReceipt, dependencies.controls.acceptedSyntheticTrafficReceiptSha256, "s2_t331_chat_synthetic_traffic_authorization_v1"],
  ] as const;
  return entries.every(([value, expectedSha, schema]) =>
    isRecord(value) && value.schema === schema && isSha256(expectedSha) &&
    dependencies.sha256Canonical(value) === expectedSha
  );
}

function disabledResponse() {
  return Object.freeze({
    schema_version: "normal_chat_mobile_response_v1",
    request_id: "chat_t331_disabled",
    client_turn_id: "00000000-0000-4000-8000-000000000000",
    result: "technical_error",
    error_code: "NORMAL_CHAT_AI_DISABLED",
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  });
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
