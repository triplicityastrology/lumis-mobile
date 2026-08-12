import {
  handleChatReleaseCandidate,
  type ChatReleaseDependencies,
  type ChatReleaseServerRequest,
} from "./normal-chat-release-candidate-v1.ts";

export const CHAT_POST_DICE_SERVER_VERSION = "s2_t321_chat_post_dice_release_server_v1" as const;
export const CHAT_POST_DICE_SERVER_ENABLED = false as const;
export const CHAT_POST_DICE_SERVER_TRAFFIC_ENABLED = false as const;
export const T317_DICE_EVIDENCE_SCHEMA = "s2_t317_dice_technical_80_accepted_evidence_v1" as const;
export const T321_DEPLOYMENT_RECEIPT_SCHEMA = "s2_t321_chat_default_off_deployment_receipt_v1" as const;
export const T321_TRAFFIC_RECEIPT_SCHEMA = "s2_t321_chat_synthetic_traffic_authorization_v1" as const;
export const T317_FINAL_SOURCE_COMMIT = "8706db6cadbbf4ae0a58d10a194479a0c7aca465" as const;
export const T317_FINAL_SOURCE_TREE = "edf01652aa245cc1bc202f3e3cee677b074a2565" as const;
export const T317_FINAL_PACKAGE_SHA256 = "690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075" as const;
export const T317_FINAL_MANIFEST_SHA256 = "1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84" as const;

export type ChatPostDiceControls = Readonly<{
  acceptedT317SourceCommit: string | null;
  acceptedT317SourceTree: string | null;
  acceptedT317ReleasePackageSha256: string | null;
  acceptedT317ReleaseManifestSha256: string | null;
  acceptedDiceEvidenceSha256: string | null;
  acceptedDeploymentReceiptSha256: string | null;
  acceptedTrafficReceiptSha256: string | null;
}>;

export type ChatPostDiceDependencies = Readonly<{
  controls: ChatPostDiceControls;
  diceEvidence: unknown;
  deploymentReceipt: unknown;
  trafficReceipt: unknown;
  sha256Canonical(value: unknown): string;
  release: ChatReleaseDependencies;
}>;

export async function handleChatPostDiceReleaseCandidate(
  rawRequest: unknown,
  dependencies: ChatPostDiceDependencies,
) {
  // Admission precedes request parsing, actor/profile reads, database access,
  // provider client construction, or evidence mutation.
  if (
    !CHAT_POST_DICE_SERVER_ENABLED ||
    !CHAT_POST_DICE_SERVER_TRAFFIC_ENABLED ||
    !validateClosedEvidence(dependencies)
  ) return disabledResponse();

  /* c8 ignore next 2 -- requires separate source activation and accepted receipts */
  return handleChatReleaseCandidate(rawRequest as ChatReleaseServerRequest, dependencies.release);
}

export function validateClosedEvidence(dependencies: ChatPostDiceDependencies): boolean {
  const { controls } = dependencies;
  if (
    !isSha40(controls.acceptedT317SourceCommit) ||
    !isSha40(controls.acceptedT317SourceTree) ||
    !isSha256(controls.acceptedT317ReleasePackageSha256) ||
    !isSha256(controls.acceptedT317ReleaseManifestSha256) ||
    !isSha256(controls.acceptedDiceEvidenceSha256) ||
    !isSha256(controls.acceptedDeploymentReceiptSha256) ||
    !isSha256(controls.acceptedTrafficReceiptSha256)
  ) return false;

  if (!validDiceEvidence(dependencies.diceEvidence, controls)) return false;
  if (!validDeploymentReceipt(dependencies.deploymentReceipt, controls.acceptedDeploymentReceiptSha256, dependencies.sha256Canonical)) return false;
  if (!validTrafficReceipt(
    dependencies.trafficReceipt,
    controls.acceptedTrafficReceiptSha256,
    controls.acceptedDiceEvidenceSha256,
    dependencies.sha256Canonical,
  )) return false;
  return dependencies.sha256Canonical(dependencies.diceEvidence) === controls.acceptedDiceEvidenceSha256;
}

function validDiceEvidence(value: unknown, controls: ChatPostDiceControls): boolean {
  if (!isRecord(value) || !exactKeys(value, [
    "schema", "decision", "source_commit", "source_tree", "release_package_sha256",
    "release_manifest_sha256", "registry_sha256",
    "technical_case_count", "language_counts", "post_window_disabled", "provider_enabled_after",
    "raw_content_retained", "member_data_used", "persistence_writes", "units_charged",
  ])) return false;
  return value.schema === T317_DICE_EVIDENCE_SCHEMA && value.decision === "accepted" &&
    value.source_commit === controls.acceptedT317SourceCommit &&
    value.source_commit === T317_FINAL_SOURCE_COMMIT &&
    value.source_tree === controls.acceptedT317SourceTree &&
    value.source_tree === T317_FINAL_SOURCE_TREE &&
    value.release_package_sha256 === controls.acceptedT317ReleasePackageSha256 &&
    value.release_package_sha256 === T317_FINAL_PACKAGE_SHA256 &&
    value.release_manifest_sha256 === controls.acceptedT317ReleaseManifestSha256 &&
    value.release_manifest_sha256 === T317_FINAL_MANIFEST_SHA256 &&
    isSha256(value.registry_sha256) && value.technical_case_count === 80 &&
    isRecord(value.language_counts) && exactKeys(value.language_counts, ["en", "zh_hant"]) &&
    value.language_counts.en === 40 && value.language_counts.zh_hant === 40 &&
    value.post_window_disabled === true && value.provider_enabled_after === false &&
    value.raw_content_retained === false && value.member_data_used === false &&
    value.persistence_writes === 0 && value.units_charged === 0;
}

function validDeploymentReceipt(value: unknown, acceptedSha: string, sha256Canonical: (value: unknown) => string): boolean {
  if (!isRecord(value) || !exactKeys(value, [
    "schema", "decision", "package_sha256", "function", "provider_enabled",
    "normal_chat_unchanged", "disabled_probes", "provider_calls", "model_invocations", "rollback_revision",
  ])) return false;
  return value.schema === T321_DEPLOYMENT_RECEIPT_SCHEMA && value.decision === "accepted" &&
    isSha256(value.package_sha256) && value.function === "chat-synthetic" &&
    value.provider_enabled === false && value.normal_chat_unchanged === true &&
    Array.isArray(value.disabled_probes) && value.disabled_probes.length === 4 &&
    value.disabled_probes.every((entry) => entry === "CHAT_AI_DISABLED") &&
    value.provider_calls === 0 && value.model_invocations === 0 &&
    typeof value.rollback_revision === "string" && value.rollback_revision.length > 0 &&
    sha256Canonical(value) === acceptedSha;
}

function validTrafficReceipt(
  value: unknown,
  acceptedSha: string,
  acceptedDiceEvidenceSha: string,
  sha256Canonical: (value: unknown) => string,
): boolean {
  if (!isRecord(value) || !exactKeys(value, [
    "schema", "decision", "package_sha256", "accepted_dice_evidence_sha256",
    "scope", "fixture_count", "language_counts", "single_use", "valid_until",
  ])) return false;
  return value.schema === T321_TRAFFIC_RECEIPT_SCHEMA && value.decision === "accepted" &&
    isSha256(value.package_sha256) && value.accepted_dice_evidence_sha256 === acceptedDiceEvidenceSha &&
    value.scope === "SYNTHETIC_CHAT_FIXTURE_IDS_ONLY" && value.fixture_count === 2 &&
    isRecord(value.language_counts) && exactKeys(value.language_counts, ["en", "zh_hant"]) &&
    value.language_counts.en === 1 && value.language_counts.zh_hant === 1 &&
    value.single_use === true && typeof value.valid_until === "string" &&
    sha256Canonical(value) === acceptedSha;
}

function disabledResponse() {
  return Object.freeze({
    schema_version: "normal_chat_mobile_response_v1",
    request_id: "chat_t321_disabled",
    client_turn_id: "00000000-0000-4000-8000-000000000000",
    result: "technical_error",
    error_code: "NORMAL_CHAT_AI_DISABLED",
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  });
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSha40(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
