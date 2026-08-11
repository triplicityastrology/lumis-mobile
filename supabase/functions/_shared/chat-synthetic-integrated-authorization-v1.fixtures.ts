import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE,
  CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256,
  CHAT_SYNTHETIC_API_ROUTE_FAMILY,
  CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256,
  ChatSyntheticIntegratedAuthorizationError,
  ChatSyntheticIntegratedCandidateV1,
  canonicalSha256,
  textSha256,
  validateAzureApiVersionForV1
} from "./chat-synthetic-integrated-authorization-v1.ts";
import {
  CHAT_CANONICAL_T240_SCHEMA_SHA256,
  ChatSyntheticGatewayPortV1,
  type ChatSyntheticAuthorityStore
} from "./chat-synthetic-gateway-port-v1.ts";
import { ChatSyntheticRun } from "./chat-synthetic-gateway-v1.ts";

const NOW = Date.parse("2026-08-11T08:00:00.000Z");
const CANDIDATE_SHA = "a".repeat(64);
const GATEWAY_SHA = "c".repeat(64);
const REGISTRY_SHA = "d".repeat(64);
const RUN_ID = "chat-syn-0123456789ab";
const MICROSOFT_EVIDENCE_TEXT = readFileSync("config/evidence/s2-t265-lumis-azure-foundry-deployment-readonly-v1.json", "utf8");
const MICROSOFT_MANIFEST = JSON.parse(readFileSync("config/s2-t265-microsoft-chat-manifest.json", "utf8"));
const API_ROUTE_EVIDENCE_TEXT = readFileSync("config/evidence/s2-t265-sanitized-api-route-family-v1.json", "utf8");

function evidence() {
  return {
    schema: "lumis_dice_technical_window_80_accepted_evidence_v4",
    review_decision: "accepted",
    deployment_receipt: {
      schema: "lumis_dice_default_off_function_deployment_receipt_v4",
      authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
      source_commit: "e".repeat(40),
      runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
      disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
      provider_calls: 0,
      model_invocations: 0,
      migration_applied: false,
      post_deploy_disabled: true
    },
    technical_window: {
      schema: "lumis_dice_technical_window_80_evidence_v4",
      authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
      evidence_package_sha256: "f".repeat(64),
      logical_total: 80,
      en: 40,
      zh_hant: 40,
      attempt_total: 96,
      max_attempts: 160,
      input_token_limit: 800,
      output_token_limit: 300,
      concurrency_limit: 2,
      shared_deadline_ms: 12000,
      cost_ceiling_usd: 0.128,
      provider_disabled_verified: true,
      finally_disabled: true,
      post_window_disabled_proof_sha256: "b".repeat(64),
      founder_cases_run: 0,
      persistence_writes: 0,
      units_charged: 0
    },
    accepted_at: "2026-08-11T07:00:00.000Z"
  };
}

function integratedAuthorization(evidenceSha256: string, manifestSha256: string, overrides: Record<string, unknown> = {}) {
  return {
    schema: "s2_t265_chat_authorization_v1",
    authority: "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED",
    prerequisite_authority: ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE,
    base_commit: "aff17b9698f37d6e251dce3b1aeda73005e91faa",
    candidate_sha256: CANDIDATE_SHA,
    microsoft_manifest_sha256: manifestSha256,
    microsoft_readonly_evidence_sha256: CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256,
    api_route_evidence_sha256: CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256,
    azure_api_version: null,
    accepted_dice_evidence_sha256: evidenceSha256,
    gateway_source_sha256: GATEWAY_SHA,
    fixture_registry_sha256: REGISTRY_SHA,
    canonical_t240_schema_sha256: CHAT_CANONICAL_T240_SCHEMA_SHA256,
    gateway_interface: "chat_synthetic_gateway_port_v1",
    run_id: RUN_ID,
    caps: { logical: 60, en: 30, zh_hant: 30, attempts: 120, input_tokens: 1200, output_tokens: 300, concurrency: 1, deadline_ms: 12000, retries: 1 },
    issued_at: "2026-08-11T07:00:00.000Z",
    valid_until: "2026-08-11T09:00:00.000Z",
    ...overrides
  };
}

function authority(evidenceSha256: string, overrides: Record<string, unknown> = {}) {
  return {
    schema: "s2_t260_chat_single_use_authority_v1",
    authority: "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED",
    scope: "closed_fixture_registry_60",
    gateway_interface: "chat_synthetic_gateway_port_v1",
    review_package_sha256: CANDIDATE_SHA,
    gateway_source_sha256: GATEWAY_SHA,
    fixture_registry_sha256: REGISTRY_SHA,
    canonical_t240_schema_sha256: CHAT_CANONICAL_T240_SCHEMA_SHA256,
    dice_evidence_sha256: evidenceSha256,
    run_id: RUN_ID,
    caps: { logical: 60, en: 30, zh_hant: 30, attempts: 120, input_tokens: 1200, output_tokens: 300, concurrency: 1, deadline_ms: 12000, retries: 1 },
    issued_at: "2026-08-11T07:00:00.000Z",
    valid_until: "2026-08-11T09:00:00.000Z",
    ...overrides
  };
}

function store(): ChatSyntheticAuthorityStore {
  return {
    async consumeAuthority() { return "consumed"; },
    async consumeFixture() { return "consumed"; },
    async closeAuthority() { return "closed"; }
  };
}

async function makeCandidate(
  authorizationValue: ReturnType<typeof integratedAuthorization>,
  evidenceSha: string,
  manifestSha: string,
  portOverrides: Record<string, unknown> = {}
) {
  const portAuthority = authority(evidenceSha, portOverrides);
  const portAuthoritySha = await canonicalSha256(portAuthority);
  const authorizationSha = await canonicalSha256(authorizationValue);
  let factoryCalls = 0;
  let providerCalls = 0;
  const portFactory = () => {
    factoryCalls += 1;
    return new ChatSyntheticGatewayPortV1({
      gateway: new ChatSyntheticRun({
        aiEnabled: true,
        nowMs: () => NOW,
        recordMetadata() {},
        adapter: { async complete() { providerCalls += 1; return { kind: "completed", assistantMessage: "A local bounded reflection." }; } }
      }),
      authorityStore: store(),
      nowMs: () => NOW,
      control: {
        executionAuthority: true,
        acceptedDiceEvidenceSha256: evidenceSha,
        acceptedAuthoritySha256: portAuthoritySha,
        reviewPackageSha256: CANDIDATE_SHA,
        gatewaySourceSha256: GATEWAY_SHA,
        fixtureRegistrySha256: REGISTRY_SHA
      }
    });
  };
  return {
    candidate: new ChatSyntheticIntegratedCandidateV1(portFactory, {
      executionAuthority: true,
      candidateSha256: CANDIDATE_SHA,
      microsoftManifestSha256: manifestSha,
      microsoftReadonlyEvidenceSha256: CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256,
      apiRouteEvidenceSha256: CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256,
      acceptedDiceEvidenceSha256: evidenceSha,
      acceptedAuthorizationSha256: authorizationSha,
      gatewaySourceSha256: GATEWAY_SHA,
      fixtureRegistrySha256: REGISTRY_SHA
    }, () => NOW),
    portAuthority,
    portAuthoritySha,
    authorizationSha,
    factoryCalls: () => factoryCalls,
    providerCalls: () => providerCalls
  };
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(async () => action(), (error: unknown) => error instanceof ChatSyntheticIntegratedAuthorizationError && error.code === code);
}

async function main() {
  assert.equal(await textSha256(MICROSOFT_EVIDENCE_TEXT), CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256);
  assert.equal(await textSha256(API_ROUTE_EVIDENCE_TEXT), CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256);
  assert.equal(CHAT_SYNTHETIC_API_ROUTE_FAMILY, "v1");
  validateAzureApiVersionForV1(null);
  for (const rejected of ["preview", "2024-10-21", "2025-08-07"]) {
    assert.throws(() => validateAzureApiVersionForV1(rejected), (error: unknown) =>
      error instanceof ChatSyntheticIntegratedAuthorizationError && error.code === "CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_REQUIRED"
    );
  }
  assert.equal(MICROSOFT_EVIDENCE_TEXT.endsWith("\n"), true);
  assert.equal(MICROSOFT_EVIDENCE_TEXT.endsWith("\n\n"), false);
  const acceptedEvidence = evidence();
  const evidenceSha = await canonicalSha256(acceptedEvidence);
  const manifestSha = await canonicalSha256(MICROSOFT_MANIFEST);
  const authorizationValue = integratedAuthorization(evidenceSha, manifestSha);

  const accepted = await makeCandidate(authorizationValue, evidenceSha, manifestSha);
  await accepted.candidate.authorize({
    diceEvidence: acceptedEvidence,
    diceEvidenceSha256: evidenceSha,
    authorization: authorizationValue,
    authorizationSha256: accepted.authorizationSha,
    microsoftManifest: MICROSOFT_MANIFEST,
    microsoftReadonlyEvidenceText: MICROSOFT_EVIDENCE_TEXT,
    apiRouteEvidenceText: API_ROUTE_EVIDENCE_TEXT,
    portAuthority: accepted.portAuthority,
    portAuthoritySha256: accepted.portAuthoritySha
  });
  const acceptedResult = await accepted.candidate.invokeFixture({
    fixture_id: "chat_en_small_decision_v1",
    idempotency_key: "accepted-evidence-fixture-0001",
    run_id: RUN_ID
  });
  assert.equal(acceptedResult.result, "completed");
  assert.equal(accepted.factoryCalls(), 1);
  assert.equal(accepted.providerCalls(), 1);

  const badMarker = integratedAuthorization(evidenceSha, manifestSha, { prerequisite_authority: "accepted" });
  const badMarkerCandidate = await makeCandidate(badMarker, evidenceSha, manifestSha);
  await expectCode(() => badMarkerCandidate.candidate.authorize({
    diceEvidence: acceptedEvidence,
    diceEvidenceSha256: evidenceSha,
    authorization: badMarker,
    authorizationSha256: badMarkerCandidate.authorizationSha,
    microsoftManifest: MICROSOFT_MANIFEST,
    microsoftReadonlyEvidenceText: MICROSOFT_EVIDENCE_TEXT,
    apiRouteEvidenceText: API_ROUTE_EVIDENCE_TEXT,
    portAuthority: badMarkerCandidate.portAuthority,
    portAuthoritySha256: badMarkerCandidate.portAuthoritySha
  }), "CHAT_SYNTHETIC_AUTHORIZATION_INVALID");
  assert.equal(badMarkerCandidate.factoryCalls(), 0);

  const checksumCandidate = await makeCandidate(authorizationValue, evidenceSha, manifestSha);
  await expectCode(() => checksumCandidate.candidate.authorize({
    diceEvidence: { ...acceptedEvidence, logical_total: 79 },
    diceEvidenceSha256: evidenceSha,
    authorization: authorizationValue,
    authorizationSha256: checksumCandidate.authorizationSha,
    microsoftManifest: MICROSOFT_MANIFEST,
    microsoftReadonlyEvidenceText: MICROSOFT_EVIDENCE_TEXT,
    apiRouteEvidenceText: API_ROUTE_EVIDENCE_TEXT,
    portAuthority: checksumCandidate.portAuthority,
    portAuthoritySha256: checksumCandidate.portAuthoritySha
  }), "CHAT_SYNTHETIC_CHECKSUM_MISMATCH");
  assert.equal(checksumCandidate.factoryCalls(), 0);

  const bindingAuthority = integratedAuthorization(evidenceSha, manifestSha);
  const bindingCandidate = await makeCandidate(bindingAuthority, evidenceSha, manifestSha, { review_package_sha256: "e".repeat(64) });
  await expectCode(() => bindingCandidate.candidate.authorize({
    diceEvidence: acceptedEvidence,
    diceEvidenceSha256: evidenceSha,
    authorization: bindingAuthority,
    authorizationSha256: bindingCandidate.authorizationSha,
    microsoftManifest: MICROSOFT_MANIFEST,
    microsoftReadonlyEvidenceText: MICROSOFT_EVIDENCE_TEXT,
    apiRouteEvidenceText: API_ROUTE_EVIDENCE_TEXT,
    portAuthority: bindingCandidate.portAuthority,
    portAuthoritySha256: bindingCandidate.portAuthoritySha
  }), "CHAT_SYNTHETIC_AUTHORITY_BINDING_INVALID");
  assert.equal(bindingCandidate.factoryCalls(), 0);

  console.log("S2-T265 names-only evidence and pre-construction fail-closed fixtures passed");
}

main();
